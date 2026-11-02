/**
 * Automated Evaluator Test Suite for Campus Help Desk Board
 * Tests the requirements specified in the project PDF:
 * 1. Validation of empty student_name and message
 * 2. POST /api/requests persistence and cache invalidation
 * 3. GET /api/requests cache miss ("PostgreSQL") on first request
 * 4. GET /api/requests cache hit ("Redis") within 60s TTL
 * 5. Cache invalidation after writing a new request
 * 6. View counter atomic increment via Redis INCR help:views
 * 7. Bonus: Request resolution and cache invalidation
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log(`\n======================================================`);
  console.log(` Campus Help Desk API Automated Test Suite`);
  console.log(` Target Server: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(` ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    // Check if server is running
    const ping = await fetch(`${BASE_URL}/api/requests`).catch(() => null);
    if (!ping) {
      console.error(`\n⚠️ Server is not running at ${BASE_URL}.`);
      console.error(`Please start the server with: npm run dev`);
      process.exit(1);
    }

    // 1. Test validation on empty request
    console.log('\n--- 1. Testing Validation on Empty Inputs ---');
    const resEmpty = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_name: '', message: '' }),
    });
    const emptyJson = await resEmpty.json();
    assert(
      resEmpty.status === 400 && emptyJson.success === false && emptyJson.error === 'student_name and message are required',
      'Reject empty student_name and message (400)',
      JSON.stringify(emptyJson)
    );

    // 2. Test validation on missing message
    const resMissingMsg = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_name: 'Abhi', message: '' }),
    });
    const missingMsgJson = await resMissingMsg.json();
    assert(
      resMissingMsg.status === 400 && missingMsgJson.success === false,
      'Reject missing message field (400)',
      JSON.stringify(missingMsgJson)
    );

    // 3. Test View Counter atomic INCR
    console.log('\n--- 2. Testing View Counter (Redis INCR help:views) ---');
    const resView1 = await fetch(`${BASE_URL}/api/views`);
    const viewJson1 = await resView1.json();
    const count1 = viewJson1.views ?? viewJson1.count;

    const resView2 = await fetch(`${BASE_URL}/api/views`);
    const viewJson2 = await resView2.json();
    const count2 = viewJson2.views ?? viewJson2.count;

    assert(
      typeof count1 === 'number' && typeof count2 === 'number' && count2 === count1 + 1,
      `View counter increments atomically via INCR (${count1} -> ${count2})`
    );

    // 4. Post first help request
    console.log('\n--- 3. Testing Help Request Creation (POST /api/requests) ---');
    const postPayload1 = {
      student_name: 'Abhi',
      message: 'How do I reset my campus Wi-Fi password?',
    };
    const resPost1 = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload1),
    });
    const postJson1 = await resPost1.json();
    assert(
      resPost1.status === 201 && postJson1.success === true && typeof postJson1.id === 'number',
      `Create request successfully returned id: ${postJson1.id}`
    );

    const createdId1 = postJson1.id;

    // 5. Test initial GET: Cache Miss (PostgreSQL)
    console.log('\n--- 4. Testing GET /api/requests Cache Miss & Hit Cycle ---');
    const resGet1 = await fetch(`${BASE_URL}/api/requests`);
    const getJson1 = await resGet1.json();

    assert(
      getJson1.source === 'PostgreSQL',
      `First fetch after write returns source: "PostgreSQL" (cache miss)`
    );
    assert(
      Array.isArray(getJson1.requests) && getJson1.requests.some((r) => r.id === createdId1),
      `PostgreSQL results contain the newly created request #${createdId1}`
    );

    // 6. Test immediate subsequent GET: Cache Hit (Redis)
    const resGet2 = await fetch(`${BASE_URL}/api/requests`);
    const getJson2 = await resGet2.json();

    assert(
      getJson2.source === 'Redis',
      `Subsequent fetch within 60s returns source: "Redis" (cache hit)`
    );
    assert(
      Array.isArray(getJson2.requests) && getJson2.requests.length === getJson1.requests.length,
      `Cached Redis response contains same list of requests`
    );

    // 7. Post second help request and verify cache invalidation
    console.log('\n--- 5. Testing Cache Invalidation on New POST ---');
    const postPayload2 = {
      student_name: 'Sneha',
      message: 'Which lab is open after 5 pm?',
    };
    const resPost2 = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload2),
    });
    const postJson2 = await resPost2.json();
    assert(
      resPost2.status === 201 && postJson2.success === true,
      `Posted second request #${postJson2.id}`
    );

    // Next fetch must be cache miss (source: "PostgreSQL") because POST invalidated Redis
    const resGet3 = await fetch(`${BASE_URL}/api/requests`);
    const getJson3 = await resGet3.json();
    assert(
      getJson3.source === 'PostgreSQL',
      `Fetch immediately after POST returns source: "PostgreSQL" (cache was invalidated)`
    );

    // 8. Test Bonus: Resolve request
    console.log('\n--- 6. Testing Bonus: Request Resolution & Cache Invalidation ---');
    const resResolve = await fetch(`${BASE_URL}/api/requests/${createdId1}`, {
      method: 'PATCH',
    });
    const resolveJson = await resResolve.json();
    assert(
      resResolve.ok && resolveJson.success === true,
      `Bonus PATCH /api/requests/${createdId1} resolved request`
    );

    // After resolve, cache should also be invalidated
    const resGet4 = await fetch(`${BASE_URL}/api/requests`);
    const getJson4 = await resGet4.json();
    assert(
      getJson4.source === 'PostgreSQL',
      `Fetch after resolve returns source: "PostgreSQL" (cache invalidated on resolve)`
    );

    console.log(`\n======================================================`);
    console.log(` Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`======================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
