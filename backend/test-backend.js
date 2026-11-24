// EduAlert Backend - Comprehensive Automated Test Suite
process.env.NODE_ENV = "test";
const { app, checkDBHealth, readDB } = require("./server.js");
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
  console.log("  🧪 RUNNING EDUALERT BACKEND TEST SUITE");
  console.log("==================================================\n");

  const testEmail = `student_${Date.now()}@test.com`;
  const testUsername = `user_${Date.now().toString().slice(-6)}`;
  const testPassword = "Password123!";
  let authToken = null;
  let createdAlertId = null;

  // 1. Database Health Check
  console.log("--- 1. Database Health Check ---");
  const dbHealth = checkDBHealth();
  assert(dbHealth.connected === true, "Database is connected and healthy");
  assert(typeof dbHealth.path === "string", `Database path resolved: ${dbHealth.path}`);

  // 2. Root Endpoint (prevents blank page)
  console.log("\n--- 2. Root Endpoint (GET /) ---");
  const rootRes = await request(app, { method: "GET", url: "/" });
  assert(rootRes.status === 200, "Root returns 200 OK");
  assert(rootRes.body && rootRes.body.status === "online", "Root returns status: online");
  assert(rootRes.body.endpoints !== undefined, "Root returns endpoints directory");

  // 3. Health Check Endpoint
  console.log("\n--- 3. Health Check (GET /api/health) ---");
  const healthRes = await request(app, { method: "GET", url: "/api/health" });
  assert(healthRes.status === 200, "Health check returns 200 OK");
  assert(healthRes.body.database && healthRes.body.database.connected === true, "Health check reports database connected");

  // Swagger Documentation
  console.log("\n--- Swagger Documentation (GET /api-docs & /api/docs/swagger.json) ---");
  const swaggerJsonRes = await request(app, { method: "GET", url: "/api/docs/swagger.json" });
  assert(swaggerJsonRes.status === 200, "GET /api/docs/swagger.json returns 200 OK");
  assert(swaggerJsonRes.body.openapi === "3.0.3", "Swagger spec has openapi: 3.0.3");

  const swaggerUiRes = await request(app, { method: "GET", url: "/api-docs" });
  assert(swaggerUiRes.status === 200, "GET /api-docs returns 200 OK");
  assert(typeof swaggerUiRes.body === "string" && swaggerUiRes.body.includes("SwaggerUIBundle"), "GET /api-docs serves Swagger UI HTML");

  // 4. Send OTP
  console.log("\n--- 4. Send OTP (POST /api/auth/send-otp) ---");
  const badOtpRes = await request(app, { method: "POST", url: "/api/auth/send-otp", body: { email: "invalid-email" } });
  assert(badOtpRes.status === 400, "Rejects invalid email format with 400");

  const otpRes = await request(app, { method: "POST", url: "/api/auth/send-otp", body: { email: testEmail } });
  assert(otpRes.status === 200, "Send OTP returns 200 OK");
  assert(otpRes.body.success === true, "Send OTP reports success: true");
  assert(typeof otpRes.body.demoOtp === "string" && otpRes.body.demoOtp.length === 6, "Returns 6-digit OTP");
  const demoOtp = otpRes.body.demoOtp;

  // 5. Verify OTP
  console.log("\n--- 5. Verify OTP (POST /api/auth/verify-otp) ---");
  const wrongOtpRes = await request(app, { method: "POST", url: "/api/auth/verify-otp", body: { email: testEmail, otp: "000000" } });
  assert(wrongOtpRes.status === 400, "Rejects invalid OTP with 400");

  const verifyRes = await request(app, { method: "POST", url: "/api/auth/verify-otp", body: { email: testEmail, otp: demoOtp } });
  assert(verifyRes.status === 200, "Verify OTP returns 200 OK");
  assert(verifyRes.body.success === true, "OTP verified successfully");

  // 6. User Registration (with Username, Email, Password & Bcrypt Hashing)
  console.log("\n--- 6. User Registration (POST /api/auth/register) ---");
  const missingFieldsRes = await request(app, { method: "POST", url: "/api/auth/register", body: { email: testEmail, password: testPassword } });
  assert(missingFieldsRes.status === 400, "Rejects registration without username with 400");

  const shortPwRes = await request(app, { method: "POST", url: "/api/auth/register", body: { username: testUsername, email: testEmail, password: "123" } });
  assert(shortPwRes.status === 400, "Rejects short password with 400");

  const regRes = await request(app, { method: "POST", url: "/api/auth/register", body: { username: testUsername, email: testEmail, password: testPassword } });
  assert(regRes.status === 201, "Registration returns 201 Created");
  assert(regRes.body.success === true, "Registration reports success: true");
  assert(typeof regRes.body.token === "string", "Registration returns authentication token");
  assert(regRes.body.user && regRes.body.user.email === testEmail, "Returns user object matching registered email");
  assert(regRes.body.user.username === testUsername, "Returns user object with username");
  assert(regRes.body.user.password === undefined, "Password hash is never exposed in response");

  // Verify bcrypt hashing in the database directly
  const dbData = readDB();
  const dbUser = dbData.users[testEmail];
  assert(dbUser && typeof dbUser.id === "string", "User stored in database with unique User ID");
  assert(dbUser && dbUser.username === testUsername, "User stored in database with Username");
  assert(dbUser && dbUser.email === testEmail, "User stored in database with Email");
  assert(dbUser && (dbUser.password.startsWith("$2a$") || dbUser.password.startsWith("$2b$")), "Password stored as a bcrypt hash (starts with $2a$ or $2b$)");
  assert(dbUser && typeof dbUser.createdAt === "string", "User has Created At timestamp");

  // Verify duplicate email rejection
  const dupEmailRes = await request(app, { method: "POST", url: "/api/auth/register", body: { username: "other_user", email: testEmail, password: testPassword } });
  assert(dupEmailRes.status === 409, "Rejects duplicate email registration with 409 Conflict");

  // Verify duplicate username rejection
  const dupUsernameRes = await request(app, { method: "POST", url: "/api/auth/register", body: { username: testUsername, email: "other@example.com", password: testPassword } });
  assert(dupUsernameRes.status === 409, "Rejects duplicate username registration with 409 Conflict");

  // 7. User Login (by email or username with bcrypt verification)
  console.log("\n--- 7. User Login (POST /api/auth/login) ---");
  const badLoginRes = await request(app, { method: "POST", url: "/api/auth/login", body: { email: testEmail, password: "WrongPassword" } });
  assert(badLoginRes.status === 401, "Rejects bad credentials with 401 Unauthorized");

  // Login using Email
  const loginRes = await request(app, { method: "POST", url: "/api/auth/login", body: { email: testEmail, password: testPassword } });
  assert(loginRes.status === 200, "Login with Email returns 200 OK");
  assert(loginRes.body.success === true, "Login reports success: true");
  assert(typeof loginRes.body.token === "string", "Login returns auth token");
  assert(loginRes.body.user.password === undefined, "Login does not leak password hash");
  authToken = loginRes.body.token;

  // Login using Username
  const loginUserRes = await request(app, { method: "POST", url: "/api/auth/login", body: { username: testUsername, password: testPassword } });
  assert(loginUserRes.status === 200, "Login with Username returns 200 OK");
  assert(loginUserRes.body.user.email === testEmail, "Username login authenticates correct account");

  // 8. User Profile
  console.log("\n--- 8. User Profile (GET & POST /api/profile) ---");
  const noAuthProfile = await request(app, { method: "GET", url: "/api/profile" });
  assert(noAuthProfile.status === 401, "Rejects unauthenticated GET /api/profile with 401");

  const getProfileRes = await request(app, {
    method: "GET",
    url: "/api/profile",
    headers: { authorization: `Bearer ${authToken}` }
  });
  assert(getProfileRes.status === 200, "Authenticated GET /api/profile returns 200 OK");
  assert(getProfileRes.body.email === testEmail, "Profile email matches user");

  const saveProfileRes = await request(app, {
    method: "POST",
    url: "/api/profile",
    headers: { authorization: `Bearer ${authToken}` },
    body: {
      name: "Alex Doe",
      qualification: "UG (Graduated)",
      course: "Computer Science",
      age: 22,
      category: "General",
      state: "Tamil Nadu",
      exams: ["UPSC", "GATE"]
    }
  });
  assert(saveProfileRes.status === 200, "Save profile returns 200 OK");
  assert(saveProfileRes.body.name === "Alex Doe", "Profile name stored at user root");
  assert(saveProfileRes.body.profileDone === true, "profileDone set to true");

  // 9. Alerts CRUD
  console.log("\n--- 9. Alerts Management (CRUD) ---");
  const pastAlertRes = await request(app, {
    method: "POST",
    url: "/api/alerts",
    headers: { authorization: `Bearer ${authToken}` },
    body: {
      title: "Past Deadline",
      date: "2020-01-01",
      category: "Exam"
    }
  });
  assert(pastAlertRes.status === 400, "Rejects alert with past date with 400");

  const futureDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
  const createAlertRes = await request(app, {
    method: "POST",
    url: "/api/alerts",
    headers: { authorization: `Bearer ${authToken}` },
    body: {
      title: "GATE 2027 Registration",
      date: futureDate,
      category: "Exam",
      note: "Complete online form"
    }
  });
  assert(createAlertRes.status === 201, "Create alert returns 201 Created");
  assert(createAlertRes.body.success === true, "Alert created successfully");
  assert(createAlertRes.body.alert && createAlertRes.body.alert.id, "Returns created alert with ID");
  createdAlertId = createAlertRes.body.alert.id;

  const getAlertsRes = await request(app, {
    method: "GET",
    url: "/api/alerts",
    headers: { authorization: `Bearer ${authToken}` }
  });
  assert(getAlertsRes.status === 200, "GET /api/alerts returns 200 OK");
  assert(Array.isArray(getAlertsRes.body), "Alerts response is an array");
  assert(getAlertsRes.body.some(a => String(a.id) === String(createdAlertId)), "Created alert is in list");

  const updateAlertRes = await request(app, {
    method: "PUT",
    url: `/api/alerts/${createdAlertId}`,
    headers: { authorization: `Bearer ${authToken}` },
    body: {
      completed: true,
      note: "Updated note: already completed"
    }
  });
  assert(updateAlertRes.status === 200, "PUT /api/alerts/:id returns 200 OK");
  assert(updateAlertRes.body.alert && updateAlertRes.body.alert.completed === true, "Alert completion status updated");

  const deleteAlertRes = await request(app, {
    method: "DELETE",
    url: `/api/alerts/${createdAlertId}`,
    headers: { authorization: `Bearer ${authToken}` }
  });
  assert(deleteAlertRes.status === 200, "DELETE /api/alerts/:id returns 200 OK");

  const verifyDeleteRes = await request(app, {
    method: "GET",
    url: "/api/alerts",
    headers: { authorization: `Bearer ${authToken}` }
  });
  assert(!verifyDeleteRes.body.some(a => String(a.id) === String(createdAlertId)), "Alert is removed from list");

  // 10. Opportunities
  console.log("\n--- 10. Opportunities (GET /api/opportunities) ---");
  const oppRes = await request(app, { method: "GET", url: "/api/opportunities" });
  assert(oppRes.status === 200, "GET /api/opportunities returns 200 OK");
  assert(Array.isArray(oppRes.body) && oppRes.body.length > 0, "Returns active opportunities list");

  // 11. 404 Handler
  console.log("\n--- 11. 404 Handler ---");
  const notFoundRes = await request(app, { method: "GET", url: "/api/unknown-endpoint" });
  assert(notFoundRes.status === 404, "Unknown endpoint returns 404 JSON");
  assert(notFoundRes.body.error === "Not Found", "Returns structured 404 JSON");

  console.log("\n==================================================");
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

