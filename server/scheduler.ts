import cron from "node-cron";
import { prisma } from "./db";
import { sendExpiredEmail } from "./email-service";

const ACTIVE_ABSENCE_STATUSES = ["ABSENT_LOGGED", "WAITING", "CANCELLED"];

export function startScheduler() {
  cron.schedule("*/10 * * * *", async () => {
    console.log("[Scheduler] レッスン開始1時間前の待機クローズをチェック中...");

    const now = new Date();
    const oneHourFromNow = new Date(now);
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);

    const expiringRequests = await prisma.request.findMany({
      where: {
        status: "待ち",
        toSlotStartDateTime: {
          lte: oneHourFromNow,
          gte: now,
        },
      },
    });

    if (expiringRequests.length > 0) {
      const requestsBySlot: Record<string, typeof expiringRequests> = {};
      for (const request of expiringRequests) {
        if (!requestsBySlot[request.toSlotId]) {
          requestsBySlot[request.toSlotId] = [];
        }
        requestsBySlot[request.toSlotId].push(request);
      }

      const slotIds = Object.keys(requestsBySlot);
      const slots = await prisma.classSlot.findMany({
        where: { id: { in: slotIds } },
      });
      const slotMap = new Map(slots.map((slot) => [slot.id, slot]));

      for (const [slotId, requests] of Object.entries(requestsBySlot)) {
        const slot = slotMap.get(slotId);
        if (!slot) continue;

        console.log(`[Scheduler] 枠 ${slotId} をクローズ...`);

        for (const request of requests) {
          await prisma.request.update({
            where: { id: request.id },
            data: { status: "期限切れ" },
          });

          if (request.absenceNoticeId) {
            const absence = await prisma.absenceNotice.findUnique({
              where: { id: request.absenceNoticeId },
            });

            if (absence) {
              const nextStatus = now > absence.makeupDeadline ? "EXPIRED" : "ABSENT_LOGGED";
              await prisma.absenceNotice.update({
                where: { id: absence.id },
                data: {
                  makeupStatus: nextStatus,
                  makeupSlotId: null,
                },
              });
            }
          }

          if (request.contactEmail) {
            try {
              await sendExpiredEmail(
                request.contactEmail,
                request.childName,
                slot.courseLabel,
                slot.date.toLocaleDateString("ja-JP"),
                slot.startTime,
                slot.classBand
              );
            } catch (error) {
              console.error("メール送信エラー:", error);
            }
          }
        }

        const remainingWaiters = await prisma.request.count({
          where: {
            toSlotId: slotId,
            status: "待ち",
          },
        });

        await prisma.classSlot.update({
          where: { id: slotId },
          data: {
            waitlistCount: remainingWaiters,
            lastNotifiedRequestId: null,
          },
        });

        console.log(`[Scheduler] 枠 ${slotId} をクローズしました（${requests.length}名）`);
      }
    }

    console.log("[Scheduler] 欠席の期限切れチェック...");
    const expiredAbsences = await prisma.absenceNotice.findMany({
      where: {
        makeupDeadline: { lt: now },
        makeupStatus: { in: ACTIVE_ABSENCE_STATUSES },
      },
    });

    for (const absence of expiredAbsences) {
      await prisma.absenceNotice.update({
        where: { id: absence.id },
        data: {
          makeupStatus: "EXPIRED",
          makeupSlotId: null,
        },
      });
    }

    if (expiredAbsences.length > 0) {
      console.log(`[Scheduler] 欠席 ${expiredAbsences.length} 件を期限切れに更新しました`);
    }
  });

  console.log("✅ スケジューラーを起動しました（10分おきに待機クローズをチェック）");
}
