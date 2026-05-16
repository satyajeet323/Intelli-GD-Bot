/**
 * AdminUser.js — Admin accounts with roles and permissions.
 * Separate from regular User model for security isolation.
 */

import { mongoose } from "../db.js";
import bcrypt from "bcryptjs";
// Re-export for backwards compatibility
export { PERMISSIONS } from "./permissions.js";

const adminUserSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true, maxlength: 100 },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:     { type: String, required: true, minlength: 6 },
    avatar:       { type: String, default: "" },
    role:         { type: mongoose.Schema.Types.ObjectId, ref: "AdminRole", required: true },
    isActive:     { type: Boolean, default: true },
    isSuperAdmin: { type: Boolean, default: false },
    lastLogin:    { type: Date, default: null },
    lastLoginIp:  { type: String, default: "" },
    loginCount:   { type: Number, default: 0 },
    twoFAEnabled: { type: Boolean, default: false },
    preferences: {
      theme:    { type: String, enum: ["dark", "light", "system"], default: "dark" },
      timezone: { type: String, default: "UTC" },
      notifications: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

adminUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminUserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

adminUserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const AdminUser = mongoose.model("AdminUser", adminUserSchema);
