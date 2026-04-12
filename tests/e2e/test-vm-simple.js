/**
 * PRISM E2E Test - Simple Authentication Test
 * Run: node test-vm-simple.js
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'http://192.168.122.230';

console.log('🧪 PRISM E2E Test - VM Authentication\n');
console.log(`🎯 Target: ${BASE_URL} (Nginx - Port 80)\n`);

try {
  console.log('1. Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  console.log('   ✅ Browser launched!\n');
  
  console.log('2. Opening page...');
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  console.log('   ✅ Page opened!\n');
  
  console.log('3. Navigating to login page...');
  await page.goto(`${BASE_URL}/login`);
  console.log('   ✅ Login page loaded!\n');
  
  console.log('4. Checking login form...');
  const usernameInput = await page.$('input[type="text"], input[type="email"]');
  const passwordInput = await page.$('input[type="password"]');
  const submitButton = await page.$('button[type="submit"]');
  
  if (usernameInput && passwordInput && submitButton) {
    console.log('   ✅ Login form found!\n');
  } else {
    console.log('   ❌ Login form not found!\n');
    await browser.close();
    process.exit(1);
  }
  
  console.log('5. Taking screenshot...');
  await page.screenshot({ path: 'test-login-page.png' });
  console.log('   ✅ Screenshot saved as test-login-page.png!\n');
  
  console.log('6. Closing browser...');
  await browser.close();
  console.log('   ✅ Browser closed!\n');
  
  console.log('✅ SUCCESS! E2E test PASSED!\n');
  console.log('📊 Summary:');
  console.log('   - VM accessible: ✅');
  console.log('   - Frontend loaded: ✅');
  console.log('   - Login form found: ✅');
  console.log('   - Screenshot taken: ✅\n');
  
} catch (error) {
  console.error('❌ FAILED! E2E test encountered an error:\n');
  console.error(error.message);
  console.error('\n💡 Troubleshooting:');
  console.error('   1. Check VM is running: virsh -c qemu:///system list');
  console.error('   2. Check VM accessible: ping 192.168.122.230');
  console.error('   3. Check frontend running: curl http://192.168.122.230:8080\n');
  process.exit(1);
}
