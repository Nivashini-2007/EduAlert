// EduAlert Backend - Comprehensive Automated Verification Test Suite
// Tests PostgreSQL (edualert_db) integration, Bcrypt hashing, JWT generation on login only,
// OTP removal, SSC CGL live access, and DBeaver table verification.

process.env.NODE_ENV = "test";
const { app, checkDBHealth, prisma, pool } = require("./server.js");
const { EventEmitter } = require("events");

// In-memory test dispatcher for Express
function request(app, options) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = (options.method || "GET").toUpperCase();
    req.url = options.url || "/";
    req.originalUrl = req.url;
    req.headers = Object.fromEntries(
      Object.entries(options.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );
    req.body = options.body || {};
    req.connection = { remoteAddress: "127.0.0.1" };
    req.socket = req.connection;
    req.query = {};
    req.params = {};

    let responseData = "";
    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
    res.getHeader = (k) => res.headers[k.toLowerCase()];
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(obj));
      return res;
    };
    res.send = (body) => {
      res.end(body);
      return res;
    };
    res.end = (chunk) => {
      if (chunk) responseData += chunk;
      res.emit("finish");
      let parsed = null;
      try {
        parsed = responseData ? JSON.parse(responseData) : null;
      } catch {
        parsed = responseData;
      }
      resolve({
        status: res.statusCode,
        headers: res.headers,
        body: parsed
      });
    };

    app(req, res);
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n==================================================");
  console.log("  🧪 RUNNING EDUALERT BACKEND POSTGRESQL TEST SUITE");
  console.log("==================================================\n");

  const timestamp = Date.now();
  const testEmail = `student_${timestamp}@test.com`;
  const testUsername = `user_${timestamp.toString().slice(-6)}`;
  const testPassword = "Password123!";
  let authToken = null;
  let createdUserId = null;
  let createdAlertId = null;

  try {
    // 1. PostgreSQL Database Health Check
    console.log("--- 1. PostgreSQL Database Health Check ---");
    const dbHealth = await checkDBHealth();
    assert(dbHealth.connected === true, "PostgreSQL connected and healthy via Prisma");
    assert(dbHealth.databaseName === "edualert_db", "Connected to target database: edualert_db");
    assert(dbHealth.schema === "public", "Using schema: public");
    assert(dbHealth.usersCount >= 0, `Users table verified (Count: ${dbHealth.usersCount})`);
    assert(dbHealth.opportunitiesCount >= 0, `Opportunities table verified (Count: ${dbHealth.opportunitiesCount})`);

    // 2. Root Endpoint (GET /)
    console.log("\n--- 2. Root Endpoint (GET /) ---");
    const rootRes = await request(app, { method: "GET", url: "/" });
    assert(rootRes.status === 200, "Root returns 200 OK");
    assert(rootRes.body && rootRes.body.status === "online", "Root reports status: online");
    assert(rootRes.body.endpoints !== undefined, "Root returns endpoints directory");

    // 3. Health Check Endpoint (GET /api/health)
    console.log("\n--- 3. Health Check (GET /api/health) ---");
    const healthRes = await request(app, { method: "GET", url: "/api/health" });
    assert(healthRes.status === 200, "Health check returns 200 OK");
    assert(healthRes.body.database && healthRes.body.database.connected === true, "Reports PostgreSQL connected");
    assert(healthRes.body.database.databaseName === "edualert_db", "Reports database name is edualert_db");

    // 4. Swagger Documentation
    console.log("\n--- 4. Swagger Documentation ---");
    const swaggerDocRes = await request(app, { method: "GET", url: "/api/docs/swagger.json" });
    assert(swaggerDocRes.status === 200, "GET /api/docs/swagger.json returns 200 OK");
    assert(swaggerDocRes.body.openapi === "3.0.3", "Swagger spec has openapi: 3.0.3");
    assert(swaggerDocRes.body.paths["/api/auth/send-otp"] === undefined, "Swagger spec does NOT contain /api/auth/send-otp");
    assert(swaggerDocRes.body.paths["/api/auth/verify-otp"] === undefined, "Swagger spec does NOT contain /api/auth/verify-otp");
    assert(swaggerDocRes.body.paths["/api/auth/logout"] !== undefined, "Swagger spec contains /api/auth/logout");
    assert(swaggerDocRes.body.paths["/api/auth/me"] !== undefined, "Swagger spec contains /api/auth/me");

    const swaggerUiRes = await request(app, { method: "GET", url: "/api-docs" });
    assert(swaggerUiRes.status === 200, "GET /api-docs serves Swagger UI HTML");

    // 5. Verify OTP Endpoints Removed
    console.log("\n--- 5. Verify OTP Endpoints Removed ---");
    const otpSendRes = await request(app, {
      method: "POST",
      url: "/api/auth/send-otp",
      body: { email: testEmail }
    });
    assert(otpSendRes.status === 404, "POST /api/auth/send-otp returns 404 Not Found");

    const otpVerifyRes = await request(app, {
      method: "POST",
      url: "/api/auth/verify-otp",
      body: { email: testEmail, otp: "123456" }
    });
    assert(otpVerifyRes.status === 404, "POST /api/auth/verify-otp returns 404 Not Found");

    // 6. User Registration (POST /api/auth/register)
    console.log("\n--- 6. User Registration (POST /api/auth/register) ---");
    const noUserRes = await request(app, {
      method: "POST",
      url: "/api/auth/register",
      body: { email: testEmail, password: testPassword }
    });
    assert(noUserRes.status === 400, "Rejects registration without username with 400");

    const shortPwRes = await request(app, {
      method: "POST",
      url: "/api/auth/register",
      body: { username: testUsername, email: testEmail, password: "123" }
    });
    assert(shortPwRes.status === 400, "Rejects short password (< 6 chars) with 400");

    const regRes = await request(app, {
      method: "POST",
      url: "/api/auth/register",
      body: { username: testUsername, email: testEmail, password: testPassword }
    });
    assert(regRes.status === 201, "Registration returns 201 Created");
    assert(regRes.body.success === true, "Registration reports success: true");
    assert(regRes.body.token === undefined, "CRITICAL: No JWT token generated upon registration");
    assert(regRes.body.user !== undefined, "Returns registered user object");
    assert(regRes.body.user.email === testEmail, "User object has correct email");
    assert(regRes.body.user.username === testUsername, "User object has correct username");
    assert(regRes.body.user.password === undefined, "Password hash is NOT exposed in response");
    assert(regRes.body.user.passwordHash === undefined, "passwordHash is NOT exposed in response");

    createdUserId = regRes.body.user.id;
    assert(typeof createdUserId === "number" && createdUserId >= 1, "CRITICAL: User ID is unique sequential integer starting from 1");

    // Verify directly in PostgreSQL
    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail }
    });
    assert(dbUser !== null, "User successfully persisted in PostgreSQL users table");
    assert(dbUser.passwordHash.startsWith("$2a$") || dbUser.passwordHash.startsWith("$2b$"), "Password stored as Bcrypt hash in PostgreSQL");
    assert(dbUser.passwordHash.length === 60, "Bcrypt hash has length 60");

    // Duplicate email check
    const dupEmailRes = await request(app, {
      method: "POST",
      url: "/api/auth/register",
      body: { username: `other_${timestamp}`, email: testEmail, password: testPassword }
    });
    assert(dupEmailRes.status === 409, "Rejects duplicate email with 409 Conflict");

    // Duplicate username check
    const dupUserRes = await request(app, {
      method: "POST",
      url: "/api/auth/register",
      body: { username: testUsername, email: `other_${timestamp}@test.com`, password: testPassword }
    });
    assert(dupUserRes.status === 409, "Rejects duplicate username with 409 Conflict");

    // 7. User Login (POST /api/auth/login)
    console.log("\n--- 7. User Login (POST /api/auth/login) ---");
    const badLoginRes = await request(app, {
      method: "POST",
      url: "/api/auth/login",
      body: { email: testEmail, password: "WrongPassword" }
    });
    assert(badLoginRes.status === 401, "Rejects bad credentials with 401 Unauthorized");

    // Login with Email
    const loginRes = await request(app, {
      method: "POST",
      url: "/api/auth/login",
      body: { email: testEmail, password: testPassword }
    });
    assert(loginRes.status === 200, "Login with Email returns 200 OK");
    assert(loginRes.body.success === true, "Login reports success: true");
    assert(typeof loginRes.body.token === "string" && loginRes.body.token.length > 20, "CRITICAL: JWT token generated successfully upon login");
    assert(loginRes.body.user.password === undefined && loginRes.body.user.passwordHash === undefined, "Password hash is omitted from login response");

    authToken = loginRes.body.token;

    // Login with Username
    const loginUserRes = await request(app, {
      method: "POST",
      url: "/api/auth/login",
      body: { username: testUsername, password: testPassword }
    });
    assert(loginUserRes.status === 200, "Login with Username returns 200 OK");
    assert(typeof loginUserRes.body.token === "string", "Returns valid JWT token for username login");

    // CRITICAL: Verify login is stored in the separate user_logins table
    const recordedLogins = await prisma.userLogin.findMany({
      where: { userId: createdUserId },
      orderBy: { loginAt: "desc" }
    });
    assert(recordedLogins.length >= 2, "CRITICAL: user_logins table stores every login in a separate table");
    assert(recordedLogins[0].userId === createdUserId, "user_logins record matches user ID");
    assert(recordedLogins[0].loginAt instanceof Date, "user_logins has actual login timestamp");
    assert(typeof recordedLogins[0].ipAddress === "string", "user_logins records IP address");
    assert(typeof recordedLogins[0].userAgent === "string", "user_logins records client user agent");

    // Test GET /api/auth/logins (user login history)
    const loginsRes = await request(app, {
      method: "GET",
      url: "/api/auth/logins",
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(loginsRes.status === 200, "GET /api/auth/logins returns 200 OK");
    assert(loginsRes.body.totalLogins >= 2, "GET /api/auth/logins returns user login history");

    // Test GET /api/auth/logins/all (all logins across database)
    const allLoginsRes = await request(app, {
      method: "GET",
      url: "/api/auth/logins/all",
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(allLoginsRes.status === 200, "GET /api/auth/logins/all returns 200 OK");
    assert(allLoginsRes.body.totalLogins >= 2, "GET /api/auth/logins/all returns all users' login history");

    // 8. Logout and Current User (POST /api/auth/logout & GET /api/auth/me)
    console.log("\n--- 8. Session Endpoints (/api/auth/logout & /api/auth/me) ---");
    const logoutRes = await request(app, { method: "POST", url: "/api/auth/logout" });
    assert(logoutRes.status === 200, "POST /api/auth/logout returns 200 OK");

    const meNoAuth = await request(app, { method: "GET", url: "/api/auth/me" });
    assert(meNoAuth.status === 401, "GET /api/auth/me without token rejected with 401");

    const meAuth = await request(app, {
      method: "GET",
      url: "/api/auth/me",
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(meAuth.status === 200, "GET /api/auth/me with Bearer token returns 200 OK");
    assert(meAuth.body.user.email === testEmail, "GET /api/auth/me returns authenticated user");

    // 9. Profile Management (GET & POST /api/profile)
    console.log("\n--- 9. User Profile (GET & POST /api/profile) ---");
    const profGetRes = await request(app, {
      method: "GET",
      url: "/api/profile",
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(profGetRes.status === 200, "GET /api/profile returns 200 OK");

    const profSaveRes = await request(app, {
      method: "POST",
      url: "/api/profile",
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        name: "Alex Doe",
        qualification: "B.Tech Graduate",
        course: "Computer Science",
        state: "Tamil Nadu",
        exams: ["SSC CGL", "GATE", "UPSC"]
      }
    });
    assert(profSaveRes.status === 200, "POST /api/profile saves to PostgreSQL with 200 OK");
    assert(profSaveRes.body.profile.qualification === "B.Tech Graduate", "Profile field persisted correctly");

    // 10. Alerts CRUD & Notifications in PostgreSQL
    console.log("\n--- 10. Alerts CRUD & Notifications in PostgreSQL ---");
    const pastDateRes = await request(app, {
      method: "POST",
      url: "/api/alerts",
      headers: { Authorization: `Bearer ${authToken}` },
      body: { title: "Past Event", date: "2020-01-01" }
    });
    assert(pastDateRes.status === 400, "Rejects alert with past date with 400");

    const addAlertRes = await request(app, {
      method: "POST",
      url: "/api/alerts",
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        title: "SSC CGL 2026-27 Tier-I Deadline",
        date: "2026-12-30",
        category: "Exam",
        note: "Apply on official portal https://ssc.gov.in"
      }
    });
    assert(addAlertRes.status === 201, "POST /api/alerts creates alert in PostgreSQL with 201 Created");
    assert(typeof addAlertRes.body.id === "number" && addAlertRes.body.id >= 1, "Returns created alert sequential integer ID starting from 1");
    assert(addAlertRes.body.notification !== undefined, "Notification object created and returned");
    createdAlertId = addAlertRes.body.id;

    // Verify Notification stored in PostgreSQL notifications table
    const storedNotifs = await prisma.notification.findMany({
      where: { userId: createdUserId }
    });
    assert(storedNotifs.length > 0, "CRITICAL: Notification successfully persisted in PostgreSQL notifications table");
    assert(storedNotifs[0].alertId === createdAlertId, "Notification references the correct alertId");
    assert(storedNotifs[0].createdAt instanceof Date, "Notification has valid actual createdAt timestamp");

    // CRITICAL: Verify user_notification_preferences table is NOT required / removed
    const prefTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_notification_preferences'
      );
    `);
    assert(prefTableCheck.rows[0].exists === false, "CRITICAL: user_notification_preferences table is removed (not required)");

    // Verify user_device_tokens table
    const deviceTokens = await prisma.userDeviceToken.findMany({
      where: { userId: createdUserId }
    });
    assert(deviceTokens.length > 0, "CRITICAL: user_device_tokens table contains active token for user");
    assert(deviceTokens[0].isActive === true, "Device token isActive is true");
    assert(deviceTokens[0].createdAt instanceof Date, "Device token has actual creation timestamp");
    assert(deviceTokens[0].lastUsedAt instanceof Date, "Device token has actual lastUsedAt timestamp");

    // Test GET /api/notifications endpoint
    const userNotifsRes = await request(app, {
      method: "GET",
      url: "/api/notifications",
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(userNotifsRes.status === 200, "GET /api/notifications returns 200 OK");
    assert(Array.isArray(userNotifsRes.body) && userNotifsRes.body.length > 0, "GET /api/notifications returns array of notifications for logged-in user");

    // Test GET /api/notifications/all endpoint
    const allNotifsRes = await request(app, {
      method: "GET",
      url: "/api/notifications/all",
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(allNotifsRes.status === 200, "GET /api/notifications/all returns 200 OK");
    assert(allNotifsRes.body.totalCount >= 1, "notifications table displays all users' notifications");

    const listAlertsRes = await request(app, {
      method: "GET",
      url: "/api/alerts",
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(listAlertsRes.status === 200, "GET /api/alerts returns 200 OK");
    assert(Array.isArray(listAlertsRes.body) && listAlertsRes.body.length > 0, "Alerts list contains newly created alert");

    const updateAlertRes = await request(app, {
      method: "PUT",
      url: `/api/alerts/${createdAlertId}`,
      headers: { Authorization: `Bearer ${authToken}` },
      body: { completed: true, note: "Application submitted on ssc.gov.in" }
    });
    assert(updateAlertRes.status === 200, "PUT /api/alerts/:id updates alert status with 200 OK");
    assert(updateAlertRes.body.completed === true, "Alert marked completed in PostgreSQL");

    const deleteAlertRes = await request(app, {
      method: "DELETE",
      url: `/api/alerts/${createdAlertId}`,
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(deleteAlertRes.status === 200, "DELETE /api/alerts/:id removes alert with 200 OK");

    // 11. Opportunities & Official Links Verification
    console.log("\n--- 11. Opportunities & Official Links Verification ---");
    const oppsRes = await request(app, { method: "GET", url: "/api/opportunities" });
    assert(oppsRes.status === 200, "GET /api/opportunities returns 200 OK");
    assert(Array.isArray(oppsRes.body) && oppsRes.body.length > 0, "Opportunities list returned from PostgreSQL");

    // Verify the specific requested official links
    const nosOpp = oppsRes.body.find((o) => o.title.includes("National Overseas Scholarship"));
    assert(nosOpp !== undefined, "National Overseas Scholarship opportunity found");
    if (nosOpp) {
      assert(nosOpp.link === "https://www.dosje.gov.in/schemes-and-services/central-sector-scheme-of-national-overseas-scholarship/", "NOS links to https://www.dosje.gov.in/schemes-and-services/central-sector-scheme-of-national-overseas-scholarship/");
    }

    const aicteOpp = oppsRes.body.find((o) => o.title.includes("AICTE Pragati"));
    assert(aicteOpp !== undefined, "AICTE Pragati opportunity found");
    if (aicteOpp) {
      assert(aicteOpp.link === "https://aicte.gov.in/", "AICTE Pragati links to accessible portal: https://aicte.gov.in/");
    }

    const gateOpp = oppsRes.body.find((o) => o.title.includes("GATE"));
    assert(gateOpp !== undefined, "GATE opportunity found");
    if (gateOpp) {
      assert(gateOpp.link === "https://gate2025.iitr.ac.in/", "GATE links to accessible portal: https://gate2025.iitr.ac.in/");
    }

    const rrbOpp = oppsRes.body.find((o) => o.title.includes("Railway Recruitment Board"));
    assert(rrbOpp !== undefined, "RRB NTPC opportunity found");
    if (rrbOpp) {
      assert(rrbOpp.link === "https://indianrailways.gov.in/", "RRB links to accessible portal: https://indianrailways.gov.in/");
    }

    const sscOpp = oppsRes.body.find((o) => o.title.includes("SSC CGL"));
    assert(sscOpp !== undefined, "Opportunities list includes 'SSC CGL 2026-27 Tier-I'");
    if (sscOpp) {
      assert(sscOpp.link === "https://ssc.gov.in", "SSC CGL points to official link: https://ssc.gov.in");
      assert(sscOpp.type === "Government Exam", "SSC CGL categorized as Government Exam");
      assert(sscOpp.status === "OPEN" || sscOpp.status === "UPCOMING", "SSC CGL status is active");
    }

    // Dedicated SSC CGL Live Diagnostic Endpoint
    const sscDiagRes = await request(app, { method: "GET", url: "/api/opportunities/ssc-cgl" });
    assert(sscDiagRes.status === 200, "GET /api/opportunities/ssc-cgl returns 200 OK");
    assert(sscDiagRes.body.opportunity !== null, "Returns verified SSC CGL opportunity record");
    assert(sscDiagRes.body.officialPortal && sscDiagRes.body.officialPortal.url === "https://ssc.gov.in", "Official portal URL is https://ssc.gov.in");
    console.log(`  ℹ️  SSC Site Live Diagnostic: httpStatus=${sscDiagRes.body.officialPortal.status.httpStatus}, isSpa=${sscDiagRes.body.officialPortal.status.isSpa}`);

    // 12. Direct PostgreSQL DBeaver Verification
    console.log("\n--- 12. Direct PostgreSQL (edualert_db) Verification ---");
    const dbeaverUser = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { profile: true }
    });
    assert(dbeaverUser !== null, "User registration record exists in PostgreSQL users table");
    assert(dbeaverUser.role === "STUDENT", "User role in PostgreSQL is STUDENT");
    assert(dbeaverUser.passwordHash.startsWith("$2b$") || dbeaverUser.passwordHash.startsWith("$2a$"), "Password in DBeaver will be visible as 60-char Bcrypt hash");

    const dbeaverLogins = await prisma.userLogin.findMany({
      where: { userId: dbeaverUser.id },
      orderBy: { loginAt: "desc" }
    });
    assert(dbeaverLogins.length >= 2, "Separate user_logins table contains user login records for DBeaver");
    assert(dbeaverLogins[0].userId === dbeaverUser.id, "user_logins records correctly map to registered user");

    const sscRow = await prisma.opportunity.findFirst({
      where: { title: { contains: "SSC CGL", mode: "insensitive" } }
    });
    assert(sscRow !== null, "SSC CGL 2026-27 Tier-I opportunity row exists in PostgreSQL edualert_db.public.opportunities");
    assert(sscRow.officialSourceUrl === "https://ssc.gov.in", "Official source URL in PostgreSQL is https://ssc.gov.in");

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  console.log("\n==================================================");
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
