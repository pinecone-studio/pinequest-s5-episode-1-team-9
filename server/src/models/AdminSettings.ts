import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * Single-row settings document (key = "global"). Holds the knobs admins can turn without a deploy:
 * which languages are open, the extra topics per CEFR level, and the nudity-confidence threshold.
 */
const AdminSettingsSchema = new Schema(
  {
    key: { type: String, unique: true, default: "global" },
    /** Languages that may be practised. Codes match `TARGET_LANGUAGES` in @linguamatch/shared. */
    languages: { type: [{ code: String, enabled: Boolean, _id: false }], default: [] },
    /** Extra topic titles per CEFR level, merged into the built-in topic bank. */
    topicsByLevel: { type: Schema.Types.Mixed, default: {} },
    /** 0–1. A frame scoring at or above this is treated as nudity by the browser check. */
    nudityThreshold: { type: Number, default: 0.7, min: 0, max: 1 },
  },
  { timestamps: true },
);

export type AdminSettingsAttrs = InferSchemaType<typeof AdminSettingsSchema>;
export type AdminSettingsDoc = HydratedDocument<AdminSettingsAttrs>;
export const AdminSettings = mongoose.model("AdminSettings", AdminSettingsSchema);

export const SETTINGS_KEY = "global";
