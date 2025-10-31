import fetch from 'node-fetch';

const APP_URL = 'http://localhost:3000';

async function diagnosticCheck() {
  console.log('🔧 LaFade Diagnostic Check');
  console.log('=' .repeat(40));

  try {
    // Check environment variables
    console.log('\n📋 Environment Variables:');
    const envResponse = await fetch(`${APP_URL}/api/dev/env`);
    if (envResponse.ok) {
      const envData: any = await envResponse.json();
      console.log('   Environment check:', envData.env);
      
      // Check for missing critical envs
      const critical = ['NEXTAUTH_SECRET', 'RESEND_API_KEY', 'DATABASE_URL'];
      const missing = critical.filter(key => !envData.env[key]);
      if (missing.length > 0) {
        console.log(`   ⚠️  Missing critical envs: ${missing.join(', ')}`);
      } else {
        console.log('   ✅ All critical environment variables present');
      }
    } else {
      console.log('   ❌ Failed to check environment');
    }

    // Check session/auth state
    console.log('\n🔐 Authentication State:');
    const sessionResponse = await fetch(`${APP_URL}/api/dev/session`);
    if (sessionResponse.ok) {
      const sessionData: any = await sessionResponse.json();
      console.log('   Session check:', sessionData.ok ? 'OK' : 'FAILED');
      if (sessionData.session) {
        console.log(`   User: ${sessionData.session.user?.email || 'None'}`);
        console.log(`   Role: ${sessionData.session.user?.role || 'None'}`);
      } else {
        console.log('   No active session');
      }
      console.log(`   Cookies: ${sessionData.cookies.join(', ')}`);
    } else {
      console.log('   ❌ Failed to check session');
    }

    // Check auth plumbing
    console.log('\n🔌 Auth Plumbing:');
    const authResponse = await fetch(`${APP_URL}/api/dev/ping-auth`);
    if (authResponse.ok) {
      const authData: any = await authResponse.json();
      console.log('   Auth check:', authData.ok ? 'OK' : 'FAILED');
      console.log('   Database connected:', authData.auth.dbConnected);
      console.log('   Tables:', authData.auth.tables);
    } else {
      console.log('   ❌ Failed to check auth plumbing');
    }

    // Check health endpoint
    console.log('\n💚 Health Check:');
    const healthResponse = await fetch(`${APP_URL}/api/health`);
    if (healthResponse.ok) {
      const healthData: any = await healthResponse.json();
      console.log('   Health:', healthData);
    } else {
      console.log('   ❌ Health check failed');
    }

    console.log('\n' + '='.repeat(40));
    console.log('✅ Diagnostic complete');

  } catch (error) {
    console.error('💥 Diagnostic failed:', error);
    process.exit(1);
  }
}

diagnosticCheck();
