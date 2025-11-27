// Test bcrypt comparison
import bcrypt from "bcryptjs";

// 👇 CHANGE THESE to match what you're testing
const password = "LaFadeBarberPWD1";
const hash = "$2b$10$z5e4n58NDVvlSitWAHjBSOrJgfVfwU.ZZxSoMbYrYHL17zBmLrWi";

async function run() {
  console.log("🧪 Testing bcrypt comparison\n");
  console.log("Password:", password);
  console.log("Hash:", hash);
  console.log("Hash length:", hash.length);
  console.log("");

  // Check hash format
  if (!hash.startsWith("$2b$10$")) {
    console.log("❌ Hash doesn't start with $2b$10$");
    console.log("   This might not be a valid bcrypt hash");
  }

  if (hash.length !== 60) {
    console.log(`❌ Hash length is ${hash.length}, should be 60`);
    console.log("   Hash might have extra characters (spaces, dots, etc.)");
  }

  console.log("Comparing...\n");

  try {
    const ok = await bcrypt.compare(password, hash);
    console.log("Result:", ok ? "✅ MATCH" : "❌ NO MATCH");
    
    if (!ok) {
      console.log("\n⚠️  Hash doesn't match password!");
      console.log("   Possible issues:");
      console.log("   - Hash has extra characters (trailing dot, spaces)");
      console.log("   - Password is wrong");
      console.log("   - Hash was generated with different password");
      console.log("\n💡 Solution: Regenerate hash with:");
      console.log("   pnpm hash:generate YourPassword");
    } else {
      console.log("\n✅ Hash matches password!");
      console.log("   Login should work with these credentials.");
    }
  } catch (error) {
    console.log("❌ Error:", error);
  }
}

run();




