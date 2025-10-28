import { z } from "zod";

export const globalSettingsSchema = z.object({
  id: z.number(),
  makeupWindowDays: z.number(),
  cutoffTime: z.string(),
});

export const classSlotSchema = z.object({
  id: z.string(),
  date: z.date(),
  startTime: z.string(),
  courseLabel: z.string(),
  classBand: z.enum(["初級", "中級", "上級"]),
  capacityLimit: z.number(),
  capacityCurrent: z.number(),
  capacityMakeupAllowed: z.number(),
  capacityMakeupUsed: z.number(),
  waitlistCount: z.number(),
  lessonStartDateTime: z.date(),
  lastNotifiedRequestId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const requestSchema = z.object({
  id: z.string(),
  childName: z.string(),
  declaredClassBand: z.enum(["初級", "中級", "上級"]),
  absentDate: z.date(),
  toSlotId: z.string(),
  status: z.enum(["確定", "待ち", "却下", "期限切れ"]),
  contactEmail: z.string().email().nullable(),
  confirmToken: z.string().nullable(),
  declineToken: z.string().nullable(),
  toSlotStartDateTime: z.date(),
  createdAt: z.date(),
});

export const searchSlotsRequestSchema = z.object({
  childName: z.string().min(1, "お子様の名前を入力してください"),
  declaredClassBand: z.enum(["初級", "中級", "上級"], {
    required_error: "クラス帯を選択してください"
  }),
  absentDateISO: z.string().min(1, "欠席日を選択してください"),
});

export const bookRequestSchema = z.object({
  childName: z.string().min(1),
  declaredClassBand: z.enum(["初級", "中級", "上級"]),
  absentDateISO: z.string(),
  toSlotId: z.string(),
});

export const waitlistRequestSchema = z.object({
  childName: z.string().min(1),
  declaredClassBand: z.enum(["初級", "中級", "上級"]),
  absentDateISO: z.string(),
  toSlotId: z.string(),
  contactEmail: z.string().email("正しいメールアドレスを入力してください"),
});

export const updateSlotCapacityRequestSchema = z.object({
  slotId: z.string(),
  capacityCurrent: z.number().optional(),
  capacityMakeupAllowed: z.number().optional(),
  capacityMakeupUsed: z.number().optional(),
});

export const closeWaitlistRequestSchema = z.object({
  slotId: z.string(),
});

export const createSlotRequestSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  courseLabel: z.string().min(1, "コース名を入力してください"),
  classBand: z.enum(["初級", "中級", "上級"]),
  capacityLimit: z.number().min(0),
  capacityCurrent: z.number().min(0),
  capacityMakeupAllowed: z.number().min(0),
});

export const updateSlotRequestSchema = z.object({
  id: z.string(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  courseLabel: z.string().optional(),
  classBand: z.enum(["初級", "中級", "上級"]).optional(),
  capacityLimit: z.number().optional(),
  capacityCurrent: z.number().optional(),
  capacityMakeupAllowed: z.number().optional(),
});

export const deleteSlotRequestSchema = z.object({
  id: z.string(),
});

export const holidaySchema = z.object({
  id: z.string(),
  date: z.date(),
  name: z.string(),
  createdAt: z.date(),
});

export const createHolidayRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "正しい日付形式（YYYY-MM-DD）で入力してください"),
  name: z.string().min(1, "休館日名を入力してください"),
});

export const deleteHolidayRequestSchema = z.object({
  id: z.string(),
});

export type GlobalSettings = z.infer<typeof globalSettingsSchema>;
export type Holiday = z.infer<typeof holidaySchema>;
export type HolidayResponse = Omit<Holiday, 'date' | 'createdAt'> & { 
  date: string; 
  createdAt: string; 
};
export type ClassSlot = z.infer<typeof classSlotSchema>;
export type Request = z.infer<typeof requestSchema>;
export type SearchSlotsRequest = z.infer<typeof searchSlotsRequestSchema>;
export type BookRequest = z.infer<typeof bookRequestSchema>;
export type WaitlistRequest = z.infer<typeof waitlistRequestSchema>;
export type UpdateSlotCapacityRequest = z.infer<typeof updateSlotCapacityRequestSchema>;
export type CloseWaitlistRequest = z.infer<typeof closeWaitlistRequestSchema>;
export type CreateSlotRequest = z.infer<typeof createSlotRequestSchema>;
export type UpdateSlotRequest = z.infer<typeof updateSlotRequestSchema>;
export type DeleteSlotRequest = z.infer<typeof deleteSlotRequestSchema>;
export type CreateHolidayRequest = z.infer<typeof createHolidayRequestSchema>;
export type DeleteHolidayRequest = z.infer<typeof deleteHolidayRequestSchema>;

export type SlotSearchResult = {
  slotId: string;
  date: string;
  startTime: string;
  courseLabel: string;
  classBand: string;
  statusCode: "〇" | "△" | "×";
  statusText: string;
  remainingSlots: number;
  waitlistCount: number;
};
