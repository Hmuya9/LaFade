// Generate a clean bcrypt hash for a password
import bcrypt from "bcryptjs";

const password = process.argv[2] || "LaFadeOwner123"; // Default or from command line
const rounds = 10;

console.log("🔐 Generating bcrypt hash...\n");
console.log("Plain password:", password);
console.log("Rounds:", rounds);
console.log("");

bcrypt.hash(password, rounds).then((hash) => {
  console.log("✅ Hash generated:");
  console.log(hash);
  console.log("");
  console.log("📋 Copy this hash (exactly 60 characters):");
  console.log("   Length:", hash.length);
  console.log("");
  console.log("📝 Next steps:");
  console.log("   1. Copy the hash above (no quotes, no spaces)");
  console.log("   2. Open Prisma Studio → User table");
  console.log("   3. Find your user");
  console.log("   4. Paste hash into passwordHash field");
  console.log("   5. Save changes");
  console.log("   6. Log in with password:", password);
  console.log("");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Error generating hash:", error);
  process.exit(1);
});




