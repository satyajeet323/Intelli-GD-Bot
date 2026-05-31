/**
 * promoteAdmin.js — Promote a regular user to admin role.
 * Usage: node src/promoteAdmin.js <email>
 * Example: node src/promoteAdmin.js satyajeet@example.com
 */

import "dotenv/config";
import { connectDB } from "./db.js";
import { User } from "./models/User.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node src/promoteAdmin.js <email>");
  process.exit(1);
}

await connectDB();

const user = await User.findOneAndUpdate(
  { email: email.toLowerCase() },
  { $set: { role: "admin" } },
  { new: true }
);

if (!user) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

console.log(`✓ Promoted ${user.name} (${user.email}) to admin role.`);
process.exit(0);
