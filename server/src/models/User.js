import { mongoose } from "../db.js";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true, maxlength: 100 },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatar:   { type: String, default: "" },
    plan:     { type: String, enum: ["free", "pro", "enterprise"], default: "free" },
    role:     { type: String, enum: ["user", "admin"], default: "user" },
    isSuspended:   { type: Boolean, default: false },
    suspendedAt:   { type: Date, default: null },
    suspendReason: { type: String, default: "" },

    // ── User preferences ──────────────────────────────────────────────────────
    preferences: {
      // Audio
      micEnabled:        { type: Boolean, default: true },
      noiseSuppression:  { type: Boolean, default: true },
      echoCancellation:  { type: Boolean, default: true },
      // Notifications
      practiceReminders: { type: Boolean, default: true },
      sessionSummary:    { type: Boolean, default: true },
      weeklyReport:      { type: Boolean, default: false },
      // AI Persona
      aiPersona: {
        type:    String,
        enum:    ["friendly", "critical", "devils-advocate", "neutral"],
        default: "friendly",
      },
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare plain password with hash
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Never return password in JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = mongoose.model("User", userSchema);
