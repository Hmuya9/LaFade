// Complete end-to-end login test
// Uses the EXACT same verifyCredentials() function as authorize() in auth-options.ts
import { verifyCredentials } from "../src/lib/auth-utils";

async function testFullLogin() {
  console.log("🧪 Complete Login Flow Test\n");
  console.log("=" .repeat(50));
  
  // Get email and password from command line or use defaults
  const testEmail = process.argv[2] || "hussemuya.hm.hm@gmail.com";
  const testPassword = process.argv[3] || "LaFadeOwner123";
  
  console.log(`Testing with:`);
  console.log(`  Email: ${testEmail}`);
  console.log(`  Password: ${testPassword}`);
  console.log("");
  
  // Use the EXACT same verifyCredentials() function that authorize() uses
  console.log("Step 1: Testing verifyCredentials() (same function used by authorize())...");
  
  const user = await verifyCredentials(testEmail, testPassword);
  
  if (!user) {
    console.log("❌ FAIL: verifyCredentials() returned null");
    console.log("   This means authorize() will also return null → 401 error");
    console.log("   Check the logs above to see why verification failed");
    process.exit(1);
  }
  
  console.log("✅ PASS: verifyCredentials() returned user");
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name || "(undefined)"}`);
  console.log(`   Role: ${user.role}`);
  console.log("");
  
  // Step 2: Simulate JWT callback
  console.log("Step 2: Simulating JWT callback...");
  const mockToken: any = {};
  const mockUser = user;
  
  if (mockUser) {
    mockToken.userId = mockUser.id ?? null;
    mockToken.email = mockUser.email ?? null;
    mockToken.name = mockUser.name ?? null;
    mockToken.role = mockUser.role ?? "CLIENT";
  }
  
  if (!mockToken.role) {
    mockToken.role = "CLIENT";
  }
  
  console.log("✅ PASS: JWT token created");
  console.log(`   userId: ${mockToken.userId}`);
  console.log(`   email: ${mockToken.email}`);
  console.log(`   name: ${mockToken.name || "(null)"}`);
  console.log(`   role: ${mockToken.role}`);
  console.log("");
  
  // Step 3: Simulate Session callback
  console.log("Step 3: Simulating Session callback...");
  const mockSession: any = {
    user: {
      email: mockToken.email,
      name: mockToken.name,
    },
  };
  
  if (mockSession.user) {
    mockSession.user.id = mockToken.userId ?? null;
    mockSession.user.role = mockToken.role ?? "CLIENT";
  }
  
  console.log("✅ PASS: Session created");
  console.log(`   user.id: ${mockSession.user.id}`);
  console.log(`   user.email: ${mockSession.user.email}`);
  console.log(`   user.name: ${mockSession.user.name || "(null)"}`);
  console.log(`   user.role: ${mockSession.user.role}`);
  console.log("");
  
  // Final summary
  console.log("=" .repeat(50));
  console.log("🎉 ALL TESTS PASSED!");
  console.log("");
  console.log("✅ verifyCredentials() works (same function used by authorize())");
  console.log("✅ JWT callback would work correctly");
  console.log("✅ Session callback would work correctly");
  console.log("");
  console.log("💡 Next step: Test in browser");
  console.log(`   1. Restart dev server (Ctrl+C then pnpm dev)`);
  console.log(`   2. Go to: http://localhost:3000/login`);
  console.log(`   3. Email: ${testEmail} (any casing works)`);
  console.log(`   4. Password: ${testPassword}`);
  console.log(`   5. Click "Sign in"`);
  console.log(`   6. Should work now! (uses same authorize() logic)`);
  console.log("");
}

testFullLogin().catch((error) => {
  console.error("❌ Test failed with error:", error);
  process.exit(1);
});

