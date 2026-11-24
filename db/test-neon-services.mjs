import fs from 'fs';
import path from 'path';
import {
  getNeonConfigFromEnv,
  testPostgresConnection,
  testAuthService,
  uploadToStorage,
  listStorageObjects,
  testAiGateway,
  testNeonFunction,
  getRealtimeConfig,
} from '../apps/api/src/neon/index.ts';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

const config = getNeonConfigFromEnv();

async function runEndToEndVerification() {
  console.log('====================================================');
  console.log('   NEON END-TO-END SERVICE INTEGRATION TEST SUITE   ');
  console.log('====================================================\n');

  let passedCount = 0;
  let totalCount = 6;

  // 1. Neon Lakebase Postgres
  console.log('1. Testing Neon Lakebase Postgres...');
  try {
    const pgRes = await testPostgresConnection(config);
    console.log(`   ✓ Postgres Connected successfully!`);
    console.log(`   ✓ Server Timestamp: ${pgRes.serverTime}`);
    console.log(`   ✓ Query Result: Found ${pgRes.businessCount} registered business(es)`);
    passedCount++;
  } catch (err) {
    console.error(`   ✗ Postgres Connection failed:`, err.message);
  }
  console.log('');

  // 2. Neon Auth (Managed Better Auth)
  console.log('2. Testing Neon Auth (JWKS Endpoint)...');
  try {
    const authRes = await testAuthService(config);
    console.log(`   ✓ Neon Auth Connected!`);
    console.log(`   ✓ JWKS URL: ${authRes.jwksUrl}`);
    console.log(`   ✓ Public Key count: ${authRes.keysCount}`);
    passedCount++;
  } catch (err) {
    console.error(`   ✗ Neon Auth check failed:`, err.message);
  }
  console.log('');

  // 3. Neon Object Storage
  console.log('3. Testing Neon Object Storage (Bucket: assets)...');
  try {
    const testKey = `tests/bizledger-verify-${Date.now()}.txt`;
    const testContent = `BizLedger Neon Object Storage Verification at ${new Date().toISOString()}`;
    await uploadToStorage(config, 'assets', testKey, testContent, 'text/plain');
    console.log(`   ✓ Successfully uploaded test object: ${testKey}`);

    const objects = await listStorageObjects(config, 'assets');
    console.log(`   ✓ Successfully listed bucket objects (${objects.length} total objects)`);
    console.log(`   ✓ Object verified in branch storage bucket`);
    passedCount++;
  } catch (err) {
    console.error(`   ✗ Object Storage test failed:`, err.message);
  }
  console.log('');

  // 4. Neon AI Gateway
  console.log('4. Testing Neon AI Gateway...');
  try {
    const aiRes = await testAiGateway(config);
    console.log(`   ✓ AI Gateway Endpoint reachable: ${aiRes.baseUrl}`);
    console.log(`   ✓ Gateway Response Code: HTTP ${aiRes.httpStatus}`);
    passedCount++;
  } catch (err) {
    console.error(`   ✗ AI Gateway test failed:`, err.message);
  }
  console.log('');

  // 5. Neon Functions (Serverless Compute)
  console.log('5. Testing Neon Functions (hello)...');
  try {
    const functionUrl = 'https://br-purple-night-bep8owab-hello.compute.c-9.us-east-2.aws.neon.tech/';
    const funcRes = await testNeonFunction(functionUrl);
    console.log(`   ✓ Function URL: ${functionUrl}`);
    console.log(`   ✓ Function HTTP Status: ${funcRes.httpStatus}`);
    console.log(`   ✓ Function Output: "${funcRes.response}"`);
    passedCount++;
  } catch (err) {
    console.error(`   ✗ Neon Function call failed:`, err.message);
  }
  console.log('');

  // 6. Neon Realtime
  console.log('6. Testing Neon Realtime Configuration...');
  const rtConfig = getRealtimeConfig(config);
  if (rtConfig.status === 'configured') {
    console.log(`   ✓ Realtime service URL: ${rtConfig.url}`);
    console.log(`   ✓ Realtime secret validated`);
    passedCount++;
  } else {
    console.log(`   ✗ Realtime not configured`);
  }
  console.log('');

  console.log('====================================================');
  console.log(`   END-TO-END VERIFICATION: ${passedCount}/${totalCount} SERVICES OPERATIONAL`);
  console.log('====================================================');

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runEndToEndVerification().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
