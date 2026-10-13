import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * A ban on an account, optionally tied to a device fingerprint. `endsAt = null` is permanent.
 * Kept separate from User.moderation so there is a full history of every ban and its expiry.
 */
const BanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceFingerprint: { type: String, default: null, index: true },
    reason: { type: String, required: true, maxlength: 500 },
    /** null = permanent. */
    endsAt: { type: Date, default: null },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reportId: { type: Schema.Types.ObjectId, ref: "Report", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

BanSchema.index({ active: 1, endsAt: -1 });

export type BanAttrs = InferSchemaType<typeof BanSchema>;
export type BanDoc = HydratedDocument<BanAttrs>;
export const Ban = mongoose.model("Ban", BanSchema);
