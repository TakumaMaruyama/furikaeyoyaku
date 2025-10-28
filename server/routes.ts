import type { Express } from "express";
import { createServer, type Server } from "http";
import { prisma } from "./db";
import { 
  searchSlotsRequestSchema, 
  bookRequestSchema, 
  waitlistRequestSchema, 
  updateSlotCapacityRequestSchema, 
  closeWaitlistRequestSchema,
  createSlotRequestSchema,
  updateSlotRequestSchema,
  deleteSlotRequestSchema
} from "@shared/schema";
import { sendConfirmationEmail, sendExpiredEmail } from "./email-service";
import { createId } from "@paralleldrive/cuid2";
import { startScheduler } from "./scheduler";

export async function registerRoutes(app: Express): Promise<Server> {
  
  app.post("/api/search-slots", async (req, res) => {
    try {
      const data = searchSlotsRequestSchema.parse(req.body);
      
      const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });
      const makeupWindowDays = settings?.makeupWindowDays || 30;
      
      const absentDate = new Date(data.absentDateISO);
      const startRange = new Date(absentDate);
      startRange.setDate(startRange.getDate() - makeupWindowDays);
      const endRange = new Date(absentDate);
      endRange.setDate(endRange.getDate() + makeupWindowDays);
      
      const slots = await prisma.classSlot.findMany({
        where: {
          classBand: data.declaredClassBand,
          date: {
            gte: startRange,
            lte: endRange,
          },
          lessonStartDateTime: {
            gte: new Date(),
          },
        },
        orderBy: {
          lessonStartDateTime: 'asc',
        },
      });
      
      const results = slots.map(slot => {
        const remainingSlots = slot.capacityMakeupAllowed - slot.capacityMakeupUsed;
        let statusCode: "〇" | "△" | "×";
        let statusText: string;
        
        if (remainingSlots >= 2) {
          statusCode = "〇";
          statusText = `振替可能（残り${remainingSlots}枠）`;
        } else if (remainingSlots === 1) {
          statusCode = "△";
          statusText = "残席わずか（残り1枠）";
        } else {
          statusCode = "×";
          statusText = `欠席者待ち（現在${slot.waitlistCount}名待ち）`;
        }
        
        return {
          slotId: slot.id,
          date: slot.date.toISOString(),
          startTime: slot.startTime,
          courseLabel: slot.courseLabel,
          classBand: slot.classBand,
          statusCode,
          statusText,
          remainingSlots,
          waitlistCount: slot.waitlistCount,
        };
      });
      
      res.json(results);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.post("/api/book", async (req, res) => {
    try {
      const data = bookRequestSchema.parse(req.body);
      
      const slot = await prisma.classSlot.findUnique({ where: { id: data.toSlotId } });
      if (!slot) {
        return res.status(404).json({ success: false, message: "指定された枠が見つかりません。" });
      }
      
      if (slot.classBand !== data.declaredClassBand) {
        return res.status(400).json({ success: false, message: "クラス帯が一致しません。" });
      }
      
      const remainingSlots = slot.capacityMakeupAllowed - slot.capacityMakeupUsed;
      if (remainingSlots < 1) {
        return res.status(400).json({ success: false, message: "空きがありません。順番待ちで申し込んでください。" });
      }
      
      await prisma.request.create({
        data: {
          id: createId(),
          childName: data.childName,
          declaredClassBand: data.declaredClassBand,
          absentDate: new Date(data.absentDateISO),
          toSlotId: data.toSlotId,
          status: "確定",
          contactEmail: null,
          confirmToken: null,
          declineToken: null,
          toSlotStartDateTime: slot.lessonStartDateTime,
        },
      });
      
      await prisma.classSlot.update({
        where: { id: data.toSlotId },
        data: {
          capacityMakeupUsed: { increment: 1 },
        },
      });
      
      res.json({ success: true, status: "確定", message: "振替予約が成立しました。" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.post("/api/waitlist", async (req, res) => {
    try {
      const data = waitlistRequestSchema.parse(req.body);
      
      const slot = await prisma.classSlot.findUnique({ where: { id: data.toSlotId } });
      if (!slot) {
        return res.status(404).json({ success: false, message: "指定された枠が見つかりません。" });
      }
      
      if (slot.classBand !== data.declaredClassBand) {
        return res.status(400).json({ success: false, message: "クラス帯が一致しません。" });
      }
      
      await prisma.request.create({
        data: {
          id: createId(),
          childName: data.childName,
          declaredClassBand: data.declaredClassBand,
          absentDate: new Date(data.absentDateISO),
          toSlotId: data.toSlotId,
          status: "待ち",
          contactEmail: data.contactEmail,
          confirmToken: null,
          declineToken: null,
          toSlotStartDateTime: slot.lessonStartDateTime,
        },
      });
      
      await prisma.classSlot.update({
        where: { id: data.toSlotId },
        data: {
          waitlistCount: { increment: 1 },
        },
      });
      
      res.json({ success: true, status: "待ち", message: "順番待ちとして受け付けました。空きが出次第、自動的に確定されます。" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  async function confirmNextWaiter(slotId: string) {
    while (true) {
      const slot = await prisma.classSlot.findUnique({ where: { id: slotId } });
      if (!slot) return;
      
      const remainingSlots = slot.capacityMakeupAllowed - slot.capacityMakeupUsed;
      if (remainingSlots < 1) return;
      
      const waitingRequests = await prisma.request.findMany({
        where: {
          toSlotId: slotId,
          status: "待ち",
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 1,
      });
      
      if (waitingRequests.length === 0) return;
      
      const nextRequest = waitingRequests[0];
      const declineToken = createId();
      
      await prisma.request.update({
        where: { id: nextRequest.id },
        data: {
          status: "確定",
          declineToken: declineToken,
        },
      });
      
      await prisma.classSlot.update({
        where: { id: slotId },
        data: {
          capacityMakeupUsed: { increment: 1 },
          waitlistCount: { decrement: 1 },
        },
      });
      
      if (nextRequest.contactEmail) {
        try {
          await sendConfirmationEmail(
            nextRequest.contactEmail,
            nextRequest.childName,
            slot.courseLabel,
            slot.date.toLocaleDateString('ja-JP'),
            slot.startTime,
            slot.classBand,
            declineToken
          );
        } catch (error) {
          console.error("メール送信エラー:", error);
        }
      }
    }
  }
  
  app.post("/admin/update-slot-capacity", async (req, res) => {
    try {
      const data = updateSlotCapacityRequestSchema.parse(req.body);
      
      const slot = await prisma.classSlot.findUnique({ where: { id: data.slotId } });
      if (!slot) {
        return res.status(404).json({ error: "指定された枠が見つかりません。" });
      }
      
      const oldRemainingSlots = slot.capacityMakeupAllowed - slot.capacityMakeupUsed;
      
      const updateData: any = {};
      if (data.capacityCurrent !== undefined) updateData.capacityCurrent = data.capacityCurrent;
      if (data.capacityMakeupAllowed !== undefined) updateData.capacityMakeupAllowed = data.capacityMakeupAllowed;
      if (data.capacityMakeupUsed !== undefined) updateData.capacityMakeupUsed = data.capacityMakeupUsed;
      
      await prisma.classSlot.update({
        where: { id: data.slotId },
        data: updateData,
      });
      
      const updatedSlot = await prisma.classSlot.findUnique({ where: { id: data.slotId } });
      if (updatedSlot) {
        const newRemainingSlots = updatedSlot.capacityMakeupAllowed - updatedSlot.capacityMakeupUsed;
        
        if (oldRemainingSlots <= 0 && newRemainingSlots >= 1) {
          await confirmNextWaiter(data.slotId);
        }
      }
      
      res.json({ success: true, message: "枠容量を更新しました。" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.get("/api/wait-decline", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).send("<h1>無効なリクエストです</h1>");
      }
      
      const request = await prisma.request.findFirst({
        where: { declineToken: token },
      });
      
      if (!request) {
        return res.status(404).send("<h1>リクエストが見つかりません</h1>");
      }
      
      if (request.status !== "確定") {
        return res.status(400).send("<h1>このリクエストは既に処理されています</h1>");
      }
      
      await prisma.request.update({
        where: { id: request.id },
        data: { status: "却下" },
      });
      
      await prisma.classSlot.update({
        where: { id: request.toSlotId },
        data: {
          capacityMakeupUsed: { decrement: 1 },
        },
      });
      
      await confirmNextWaiter(request.toSlotId);
      
      res.send(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>辞退完了</title>
  <style>
    body {
      font-family: "Noto Sans JP", sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      padding: 48px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 500px;
    }
    h1 {
      color: #16a34a;
      margin-bottom: 16px;
    }
    p {
      color: #666;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✅ 辞退が完了しました</h1>
    <p>振替予約を辞退しました。<br>次の順番待ちの方に自動的にご案内いたします。</p>
  </div>
</body>
</html>
      `);
    } catch (error: any) {
      res.status(500).send("<h1>エラーが発生しました</h1>");
    }
  });
  
  app.post("/admin/close-waitlist", async (req, res) => {
    try {
      const data = closeWaitlistRequestSchema.parse(req.body);
      
      const slot = await prisma.classSlot.findUnique({ where: { id: data.slotId } });
      if (!slot) {
        return res.status(404).json({ error: "指定された枠が見つかりません。" });
      }
      
      const oneHourBefore = new Date(slot.lessonStartDateTime);
      oneHourBefore.setHours(oneHourBefore.getHours() - 1);
      
      if (new Date() < oneHourBefore) {
        return res.status(400).json({ error: "まだ開始1時間前ではありません。" });
      }
      
      const waitingRequests = await prisma.request.findMany({
        where: {
          toSlotId: data.slotId,
          status: "待ち",
        },
      });
      
      for (const request of waitingRequests) {
        await prisma.request.update({
          where: { id: request.id },
          data: { status: "期限切れ" },
        });
        
        if (request.contactEmail) {
          try {
            await sendExpiredEmail(
              request.contactEmail,
              request.childName,
              slot.courseLabel,
              slot.date.toLocaleDateString('ja-JP'),
              slot.startTime,
              slot.classBand
            );
          } catch (error) {
            console.error("メール送信エラー:", error);
          }
        }
      }
      
      await prisma.classSlot.update({
        where: { id: data.slotId },
        data: {
          waitlistCount: 0,
          lastNotifiedRequestId: null,
        },
      });
      
      res.json({ success: true, message: `待ちリストをクローズしました（${waitingRequests.length}件）。` });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.get("/api/admin/confirmed", async (req, res) => {
    try {
      const requests = await prisma.request.findMany({
        where: { status: "確定" },
        orderBy: {
          toSlotStartDateTime: 'asc',
        },
      });
      
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/admin/waiting", async (req, res) => {
    try {
      const waitingRequests = await prisma.request.findMany({
        where: { status: "待ち" },
        orderBy: {
          toSlotStartDateTime: 'asc',
        },
      });
      
      const slotIds = Array.from(new Set(waitingRequests.map(r => r.toSlotId)));
      const slots = await prisma.classSlot.findMany({
        where: {
          id: { in: slotIds },
        },
      });
      
      const slotMap = new Map(slots.map(s => [s.id, s]));
      
      const grouped: any[] = [];
      for (const slotId of slotIds) {
        const slot = slotMap.get(slotId);
        if (!slot) continue;
        
        const requests = waitingRequests.filter(r => r.toSlotId === slotId);
        requests.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        grouped.push({
          slotId,
          slot,
          requests,
        });
      }
      
      grouped.sort((a, b) => 
        a.slot.lessonStartDateTime.getTime() - b.slot.lessonStartDateTime.getTime()
      );
      
      res.json(grouped);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/slots", async (req, res) => {
    try {
      const slots = await prisma.classSlot.findMany({
        orderBy: {
          lessonStartDateTime: 'asc',
        },
      });
      res.json(slots);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/create-slot", async (req, res) => {
    try {
      const data = createSlotRequestSchema.parse(req.body);
      
      const dateTime = new Date(`${data.date}T${data.startTime}:00`);
      const slotId = `${data.date}_${data.startTime}_${data.classBand === "初級" ? "shokyu" : data.classBand === "中級" ? "chukyu" : "jokyu"}`;
      
      const existing = await prisma.classSlot.findUnique({ where: { id: slotId } });
      if (existing) {
        return res.status(400).json({ error: "同じ日時・クラス帯の枠が既に存在します。" });
      }
      
      const slot = await prisma.classSlot.create({
        data: {
          id: slotId,
          date: new Date(data.date),
          startTime: data.startTime,
          courseLabel: data.courseLabel,
          classBand: data.classBand,
          capacityLimit: data.capacityLimit,
          capacityCurrent: data.capacityCurrent,
          capacityMakeupAllowed: data.capacityMakeupAllowed,
          capacityMakeupUsed: 0,
          lessonStartDateTime: dateTime,
        },
      });
      
      res.json(slot);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/admin/update-slot", async (req, res) => {
    try {
      const data = updateSlotRequestSchema.parse(req.body);
      
      const existing = await prisma.classSlot.findUnique({ where: { id: data.id } });
      if (!existing) {
        return res.status(404).json({ error: "指定された枠が見つかりません。" });
      }
      
      const updateData: any = {};
      if (data.date) updateData.date = new Date(data.date);
      if (data.startTime) updateData.startTime = data.startTime;
      if (data.courseLabel) updateData.courseLabel = data.courseLabel;
      if (data.classBand) updateData.classBand = data.classBand;
      if (data.capacityLimit !== undefined) updateData.capacityLimit = data.capacityLimit;
      if (data.capacityCurrent !== undefined) updateData.capacityCurrent = data.capacityCurrent;
      if (data.capacityMakeupAllowed !== undefined) updateData.capacityMakeupAllowed = data.capacityMakeupAllowed;
      
      if (data.date && data.startTime) {
        updateData.lessonStartDateTime = new Date(`${data.date}T${data.startTime}:00`);
      } else if (data.date) {
        updateData.lessonStartDateTime = new Date(`${data.date}T${existing.startTime}:00`);
      } else if (data.startTime) {
        const dateStr = existing.date.toISOString().split('T')[0];
        updateData.lessonStartDateTime = new Date(`${dateStr}T${data.startTime}:00`);
      }
      
      const slot = await prisma.classSlot.update({
        where: { id: data.id },
        data: updateData,
      });
      
      res.json(slot);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/delete-slot", async (req, res) => {
    try {
      const { id } = deleteSlotRequestSchema.parse(req.body);
      
      const existing = await prisma.classSlot.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "指定された枠が見つかりません。" });
      }
      
      const requestsCount = await prisma.request.count({
        where: { toSlotId: id },
      });
      
      if (requestsCount > 0) {
        return res.status(400).json({ error: "この枠には申込みがあるため削除できません。" });
      }
      
      await prisma.classSlot.delete({
        where: { id },
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  
  startScheduler();

  return httpServer;
}
