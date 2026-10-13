import type { AdminActionType } from "@linguamatch/shared";
import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * Append-only audit trail. Every admin decision is written here: who did what, to whom, when.
 * `adminId` is null for actions the system takes on its own (e.g. automatic suspension).
 */
const AdminActionSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    /** Denormalized so the trail still reads correctly if the admin account is deleted. */
    adminUsername: { type: String, default: null },
    action: {
      type: String,
      enum: [
        "dismiss",
        "warn",
        "ban_24h",
        "ban_7d",
        "ban_permanent",
        "unban",
        "role_change",
        "settings_update",
        "auto_suspend",
      ] satisfies AdminActionType[],
      required: true,
      index: true,
    },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    reportId: { type: Schema.Types.ObjectId, ref: "Report", default: null, index: true },
    note: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type AdminActionAttrs = InferSchemaType<typeof AdminActionSchema>;
export type AdminActionDoc = HydratedDocument<AdminActionAttrs>;
export const AdminAction = mongoose.model("AdminAction", AdminActionSchema);
