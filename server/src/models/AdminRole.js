/**
 * AdminRole.js — Custom roles with configurable permissions.
 */

import { mongoose } from "../db.js";
import { PERMISSIONS } from "./permissions.js";

const adminRoleSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    description: { type: String, default: "", maxlength: 500 },
    color:       { type: String, default: "#6366f1" }, // hex color for UI badge
    permissions: [{ type: String, enum: PERMISSIONS }],
    isSystem:    { type: Boolean, default: false }, // system roles can't be deleted
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

export const AdminRole = mongoose.model("AdminRole", adminRoleSchema);
