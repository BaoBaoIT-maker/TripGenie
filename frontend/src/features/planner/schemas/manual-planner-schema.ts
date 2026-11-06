import { z } from "zod";
import { format, isValid, parseISO } from "date-fns";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isoDateSchema = z
  .string()
  .regex(isoDate, "Ngày không đúng định dạng")
  .refine((value) => {
    const parsed = parseISO(`${value}T00:00:00`);
    return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
  }, "Ngày không hợp lệ");

export const manualPlannerSchema = z
  .object({
    title: z.string().trim().min(1, "Vui lòng nhập tên chuyến đi").max(100, "Tên chuyến đi tối đa 100 ký tự"),
    description: z.string().trim().max(500, "Mô tả tối đa 500 ký tự").optional(),
    destination: z.string().trim().min(1, "Vui lòng nhập điểm đến").max(120, "Điểm đến tối đa 120 ký tự"),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    people: z.number().int("Số người phải là số nguyên").min(1, "Số người ít nhất là 1").max(50, "Số người tối đa là 50"),
    budget: z.number().min(0, "Ngân sách không được âm"),
    coverImage: z.string().url("Ảnh bìa không hợp lệ"),
  })
  .refine(({ startDate, endDate }) => endDate >= startDate, {
    path: ["endDate"],
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
  });
