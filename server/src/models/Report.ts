import { REPORT_REASONS } from "@linguamatch/shared";
import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

const EvidenceFrameSchema = new Schema(
  {
    /** Base64 data URL of a blurred frame. Never a raw camera frame. */
    url: { type: String, required: true },
    capturedAt: { type: Date, required: true },
  },
  { _id: false },
);

/** Snapshot of the conversation transcript at report time, so it survives transcript purging. */
const EvidenceLineSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 2000 },
    spokenAt: { type: Date, required: true },
  },
  { _id: false },
);

const ReportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    reason: { type: String, enum: REPORT_REASONS.map((r) => r.value), required: true },
    details: { type: String, maxlength: 1000, default: "" },
    status: { type: String, enum: ["open", "reviewed", "dismissed", "actioned"], default: "open", index: true },

    /** Which automatic check raised this report (or "none" when a person tapped Report). */
    aiFlag: { type: String, enum: ["none", "nudity", "speech"], default: "none", index: true },
    /** True when the report was created by the browser safety check rather than by the user. */
    autoReported: { type: Boolean, default: false },

    evidenceFrames: { type: [EvidenceFrameSchema], default: [], select: false },
    evidenceTranscript: { type: [EvidenceLineSchema], default: [], select: false },
    /** Evidence is deleted after this time unless a case is still open. */
    evidenceExpiresAt: { type: Date, default: null, index: true },

    handledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    handledAt: { type: Date, default: null },
    resolution: { type: String, default: null },
  },
  { timestamps: true },
);

ReportSchema.index({ reporterId: 1, conversationId: 1 }, { unique: true });
ReportSchema.index({ status: 1, createdAt: -1 });

export type ReportAttrs = InferSchemaType<typeof ReportSchema>;
export type ReportDoc = HydratedDocument<ReportAttrs>;
export const Report = mongoose.model("Report", ReportSchema);
