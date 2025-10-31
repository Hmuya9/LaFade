import fetch from 'node-fetch';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function smokeTest() {
  console.log(`🧪 Running smoke tests against: ${APP_URL}`);
  console.log('=' .repeat(50));

  const tests: any[] = [
    {
      name: 'Health Check',
      url: `${APP_URL}/api/health`,
      expected: { ok: true, db: 'up' }
    },
    {
      name: 'Availability API',
      url: `${APP_URL}/api/availability?barberName=Mike&date=2025-10-20`,
      expected: { barberName: 'Mike' }
    },
    {
      name: 'Booking Page',
      url: `${APP_URL}/booking`,
      expected: 'Book Your Cut'
    },
    {
      name: 'Brand Check',
      url: `${APP_URL}/`,
      expected: 'LaFade'
    }
  ];

  // Add dev endpoints if running locally
  if (APP_URL.includes('localhost')) {
    tests.push(
      {
        name: 'Dev Session',
        url: `${APP_URL}/api/dev/session`,
        expected: { ok: true }
      },
      {
        name: 'Dev Environment',
        url: `${APP_URL}/api/dev/env`,
        expected: { ok: true }
      },
      {
        name: 'Dev Auth Ping',
        url: `${APP_URL}/api/dev/ping-auth`,
        expected: { ok: true }
      }
    );
  }

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n🔍 Testing: ${test.name}`);
      console.log(`   URL: ${test.url}`);
      
      const response = await fetch(test.url);
      const status = response.status;
      
      if (status === 200) {
        if (test.expected === 'Book Your Cut' || test.expected === 'LaFade') {
          // Text content check
          const text = await response.text();
          if (text.includes(test.expected)) {
            console.log(`   ✅ PASS - Found "${test.expected}"`);
            passed++;
          } else {
            console.log(`   ❌ FAIL - Expected "${test.expected}" not found`);
            failed++;
          }
        } else {
          // JSON content check
          const data: any = await response.json();
          if (typeof test.expected === 'object') {
            const keys = Object.keys(test.expected);
            const matches = keys.every(key => data[key] === test.expected[key]);
            if (matches) {
              console.log(`   ✅ PASS - ${JSON.stringify(test.expected)}`);
              passed++;
            } else {
              console.log(`   ❌ FAIL - Expected ${JSON.stringify(test.expected)}, got ${JSON.stringify(data)}`);
              failed++;
            }
          }
        }
      } else {
        console.log(`   ❌ FAIL - HTTP ${status}`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ FAIL - ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed!');
    process.exit(1);
  }
}

smokeTest().catch(error => {
  console.error('💥 Smoke test failed:', error);
  process.exit(1);
});