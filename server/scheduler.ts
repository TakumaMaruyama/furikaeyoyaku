import cron from "node-cron";
import { prisma } from "./db";
import { sendExpiredEmail } from "./email-service";

export function startScheduler() {
  cron.schedule("*/10 * * * *", async () => {
    console.log("[Scheduler] レッスン開始1時間前の自動クローズをチェック中...");
    
    const now = new Date();
    const oneHourFromNow = new Date(now);
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    
    const slotsToClose = await prisma.classSlot.findMany({
      where: {
        lessonStartDateTime: {
          lte: oneHourFromNow,
          gte: now,
        },
        waitlistCount: {
          gt: 0,
        },
      },
    });
    
    for (const slot of slotsToClose) {
      const oneHourBefore = new Date(slot.lessonStartDateTime);
      oneHourBefore.setHours(oneHourBefore.getHours() - 1);
      
      if (now >= oneHourBefore) {
        console.log(`[Scheduler] 枠 ${slot.id} をクローズ中...`);
        
        const waitingRequests = await prisma.request.findMany({
          where: {
            toSlotId: slot.id,
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
          where: { id: slot.id },
          data: {
            waitlistCount: 0,
            lastNotifiedRequestId: null,
          },
        });
        
        console.log(`[Scheduler] 枠 ${slot.id} をクローズしました（${waitingRequests.length}件）`);
      }
    }
  });
  
  console.log("✅ スケジューラを起動しました（10分ごとに自動クローズをチェック）");
}
