import { z } from "zod";
import { mn } from "@/lib/i18n/mn";
import { MAX_UPLOAD_BYTES } from "@/lib/pipeline/messages";

const allowedExtensions = [".mp4", ".mov", ".webm"];
const allowedTypes = ["video/mp4", "video/quicktime", "video/webm"];

export const uploadFileSchema = z
  .object({
    name: z.string().min(1),
    type: z.string(),
    size: z
      .number()
      .positive(mn.errors.empty)
      .max(MAX_UPLOAD_BYTES, mn.errors.size),
  })
  .superRefine((file, ctx) => {
    const lower = file.name.toLowerCase();
    const extensionOk = allowedExtensions.some((extension) => lower.endsWith(extension));
    const typeOk = allowedTypes.includes(file.type);
    if (!extensionOk && !typeOk) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: mn.errors.type,
      });
    }
  });
