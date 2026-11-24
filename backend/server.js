// EduAlert Backend - Node.js + Express
// Full REST API with JSON Database, Authentication, and Alerts Management

const fs = require("fs");
const path = require("path");

// ─── Load Environment Variables ───────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { initDB, readDB, writeDB, checkDBHealth, DB_PATH } = require("./db");
const { setupSwagger } = require("./swagger-ui");

const app = express();
const PORT = process.env.PORT || 5001;
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
const JWT_SECRET = process.env.JWT_SECRET || "edualert_jwt_super_secret_key_2026";

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:") ||
      process.env.NODE_ENV !== "production"
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ─── Swagger Documentation ───────────────────────────────────────────────────
setupSwagger(app);

// ─── Auth helpers ─────────────────────────────────────────────────────────────
async function hashPassword(pw) {
  return await bcrypt.hash(pw, BCRYPT_SALT_ROUNDS);
}

async function comparePassword(pw, storedHash) {
  if (!pw || !storedHash) return false;
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$")) {
    return await bcrypt.compare(pw, storedHash);
  }
  // Legacy sha256 fallback (auto-compatible with older records)
  const legacyHash = crypto.createHash("sha256").update(pw + "edualert_salt_secret_2026").digest("hex");
  return legacyHash === storedHash;
}

function generateToken(email) {
  const payload = {
    email: email.toLowerCase().trim(),
    exp: Date.now() + 7 * 24 * 3600 * 1000,
    iat: Date.now()
  };
  const str = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(str).digest("hex");
  return Buffer.from(JSON.stringify({ payload, sig: signature })).toString("base64");
}

function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    const rawToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
    if (!rawToken) return null;
    const parsed = JSON.parse(Buffer.from(rawToken, "base64").toString());
    
    // Support legacy token format if present
    if (parsed.email && parsed.exp) {
      if (parsed.exp < Date.now()) return null;
      return parsed.email.toLowerCase().trim();
    }
    
    if (parsed.payload && parsed.sig) {
      const { payload, sig } = parsed;
      const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(JSON.stringify(payload)).digest("hex");
      if (sig !== expectedSig) return null;
      if (payload.exp < Date.now()) return null;
      return payload.email.toLowerCase().trim();
    }
    return null;
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const email = verifyToken(req);
  if (!email) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "A valid Bearer token is required in the Authorization header"
    });
  }
  req.userEmail = email;
  next();
}

// ─── In-memory and persistent OTP store ───────────────────────────────────────
const otpStore = {};

// ─── ROOT ENDPOINT ────────────────────────────────────────────────────────────
// Redirects browsers to interactive Swagger UI (/api-docs), and returns JSON for API clients
app.get("/", (req, res) => {
  // If request is from a browser expecting HTML, redirect to Swagger UI
  if (req.accepts("html") && !req.accepts("json")) {
    return res.redirect("/api-docs");
  }

  const dbHealth = checkDBHealth();
  res.json({
    name: "EduAlert API",
    status: "online",
    message: "EduAlert Backend Server is running successfully",
    swaggerUi: "/api-docs",
    swaggerJson: "/api/docs/swagger.json",
    timestamp: new Date().toISOString(),
    database: {
      type: "JSON File Database",
      status: dbHealth.connected ? "connected" : "error",
      path: DB_PATH,
      users: dbHealth.usersCount || 0,
      alerts: dbHealth.alertsCount || 0
    },
    healthCheck: "/api/health",
    endpoints: {
      swagger: { method: "GET", path: "/api-docs", description: "Interactive Swagger UI Documentation" },
      health: { method: "GET", path: "/api/health", description: "Health check and DB status" },
      auth: [
        { method: "POST", path: "/api/auth/send-otp", description: "Send 6-digit OTP to email" },
        { method: "POST", path: "/api/auth/verify-otp", description: "Verify OTP code" },
        { method: "POST", path: "/api/auth/register", description: "Register new user account" },
        { method: "POST", path: "/api/auth/login", description: "Login with email & password" }
      ],
      profile: [
        { method: "GET", path: "/api/profile", description: "Get current user profile (Requires Auth)" },
        { method: "POST", path: "/api/profile", description: "Save user profile (Requires Auth)" }
      ],
      alerts: [
        { method: "GET", path: "/api/alerts", description: "Get user alerts (Requires Auth)" },
        { method: "POST", path: "/api/alerts", description: "Create an alert (Requires Auth)" },
        { method: "PUT", path: "/api/alerts/:id", description: "Update alert by ID (Requires Auth)" },
        { method: "DELETE", path: "/api/alerts/:id", description: "Delete alert by ID (Requires Auth)" }
      ],
      opportunities: [
        { method: "GET", path: "/api/opportunities", description: "Get active opportunities list" }
      ]
    }
  });
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  const dbHealth = checkDBHealth();
  res.json({
    status: dbHealth.connected ? "ok" : "degraded",
    message: "EduAlert backend is operating normally",
    time: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbHealth
  });
});

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

// Send OTP
app.post("/api/auth/send-otp", (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email address is required" });
  }

  const cleanEmail = email.toLowerCase().trim();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 10 * 60 * 1000;

  otpStore[cleanEmail] = { otp, expires, verified: false };

  // Also persist in db for reliability
  const db = readDB();
  db.otps[cleanEmail] = { otp, expires, verified: false };
  writeDB(db);

  console.log(`[AUTH] ✉️  OTP generated for ${cleanEmail} -> ${otp}`);
  res.json({
    success: true,
    message: `OTP sent to ${cleanEmail}`,
    demoOtp: otp
  });
});

// Verify OTP
app.post("/api/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanOtp = String(otp).trim();

  const db = readDB();
  const stored = otpStore[cleanEmail] || (db.otps && db.otps[cleanEmail]);

  if (!stored) {
    return res.status(400).json({ error: "OTP not requested or expired. Please request a new OTP." });
  }

  if (Date.now() > stored.expires) {
    delete otpStore[cleanEmail];
    if (db.otps) delete db.otps[cleanEmail];
    writeDB(db);
    return res.status(400).json({ error: "OTP has expired. Please request a new OTP." });
  }

  if (String(stored.otp).trim() !== cleanOtp) {
    return res.status(400).json({ error: "Invalid OTP. Please check and try again." });
  }

  // Mark as verified
  otpStore[cleanEmail] = { ...stored, verified: true };
  if (!db.otps) db.otps = {};
  db.otps[cleanEmail] = { ...stored, verified: true };
  writeDB(db);

  console.log(`[AUTH] ✅ Email verified successfully: ${cleanEmail}`);
  res.json({ success: true, message: "Email verified successfully" });
});

// Register (No OTP required: requires username, email, password)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required fields" });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).toLowerCase().trim();

    // Validate username (3-30 chars, alphanumeric, underscores, hyphens)
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return res.status(400).json({ error: "Username must be between 3 and 30 characters" });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      return res.status(400).json({ error: "Username can only contain letters, numbers, underscores, and hyphens" });
    }

    // Validate email
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      return res.status(400).json({ error: "Please provide a valid email address" });
    }

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const db = readDB();

    // Check if email is already taken
    if (db.users[cleanEmail]) {
      return res.status(409).json({ error: "Email is already registered. Please sign in." });
    }

    // Check if username is already taken
    const usernameTaken = Object.values(db.users).some(
      (u) => u.username && u.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    if (usernameTaken) {
      return res.status(409).json({ error: "Username is already taken. Please choose another username." });
    }

    // Hash password securely with bcrypt
    const hashedPassword = await hashPassword(password);
    const userId = (crypto.randomUUID ? crypto.randomUUID() : `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

    const newUser = {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      name: cleanUsername,
      profileDone: false,
      profile: {},
      createdAt: new Date().toISOString()
    };

    db.users[cleanEmail] = newUser;
    if (!db.alerts[cleanEmail]) {
      db.alerts[cleanEmail] = [];
    }

    writeDB(db);

    const token = generateToken(cleanEmail);
    const { password: _, ...safeUser } = newUser;

    console.log(`[AUTH] 👤 Registered user: ${cleanUsername} (${cleanEmail}) with bcrypt password hash`);
    res.status(201).json({
      success: true,
      message: "Registration successful! You can now log in.",
      token,
      user: safeUser
    });
  } catch (err) {
    console.error("[AUTH] Registration error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// Login (supports either email or username)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    const identifier = String(email || username || "").trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ error: "Email/username and password are required" });
    }

    const db = readDB();
    const user = db.users[identifier] || Object.values(db.users).find(
      (u) => (u.email && u.email.toLowerCase() === identifier) || (u.username && u.username.toLowerCase() === identifier)
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials. Please check your email/username and password." });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials. Please check your email/username and password." });
    }

    const token = generateToken(user.email);
    const { password: _, ...safeUser } = user;

    console.log(`[AUTH] 🔓 User logged in: ${user.username || user.email}`);
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: safeUser
    });
  } catch (err) {
    console.error("[AUTH] Login error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// ─── PROFILE ROUTES ───────────────────────────────────────────────────────────

// Get profile
app.get("/api/profile", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users[req.userEmail];
  if (!user) {
    return res.status(404).json({ error: "User profile not found" });
  }
  const { password: _, ...safeUser } = user;
  res.json({
    success: true,
    user: safeUser,
    ...safeUser
  });
});

// Save / Update profile
app.post("/api/profile", authMiddleware, (req, res) => {
  const { name, qualification, course, age, category, state, exams } = req.body || {};
  if (!name || !qualification || !state) {
    return res.status(400).json({ error: "Name, qualification, and state are required fields" });
  }

  const db = readDB();
  if (!db.users[req.userEmail]) {
    return res.status(404).json({ error: "User not found" });
  }

  const profileData = {
    name: String(name).trim(),
    qualification: String(qualification).trim(),
    course: course ? String(course).trim() : "",
    age: age ? Number(age) : "",
    category: category || "General",
    state: String(state).trim(),
    exams: Array.isArray(exams) ? exams : []
  };

  db.users[req.userEmail] = {
    ...db.users[req.userEmail],
    ...profileData,
    profile: profileData,
    profileDone: true,
    updatedAt: new Date().toISOString()
  };

  writeDB(db);

  const { password: _, ...safeUser } = db.users[req.userEmail];
  console.log(`[PROFILE] 📝 Updated profile for ${req.userEmail} (${profileData.name})`);
  res.json({
    success: true,
    message: "Profile updated successfully",
    user: safeUser,
    ...safeUser
  });
});

// ─── ALERTS CRUD ──────────────────────────────────────────────────────────────

// Get all alerts
app.get("/api/alerts", authMiddleware, (req, res) => {
  const db = readDB();
  const alerts = db.alerts[req.userEmail] || [];
  res.json(alerts);
});

// Create alert
app.post("/api/alerts", authMiddleware, (req, res) => {
  const { title, date, category, note } = req.body || {};
  if (!title || !date) {
    return res.status(400).json({ error: "Title and date are required fields" });
  }

  // Reject past dates using standard string comparison (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split("T")[0];
  if (date < todayStr) {
    return res.status(400).json({ error: "Cannot create alert for past dates" });
  }

  const db = readDB();
  if (!Array.isArray(db.alerts[req.userEmail])) {
    db.alerts[req.userEmail] = [];
  }

  const newAlert = {
    id: (crypto.randomUUID ? crypto.randomUUID() : `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
    title: String(title).trim(),
    date: String(date).trim(),
    category: category || "Exam",
    note: note ? String(note).trim() : "",
    completed: false,
    createdAt: new Date().toISOString()
  };

  db.alerts[req.userEmail].push(newAlert);
  writeDB(db);

  console.log(`[ALERTS] ➕ Added alert "${newAlert.title}" for ${req.userEmail}`);
  res.status(201).json({ success: true, alert: newAlert });
});

// Update alert (supports both PUT and PATCH)
function handleUpdateAlert(req, res) {
  const db = readDB();
  const alerts = db.alerts[req.userEmail] || [];
  const alertId = String(req.params.id);

  const idx = alerts.findIndex((a) => String(a.id) === alertId);
  if (idx === -1) {
    return res.status(404).json({ error: "Alert not found" });
  }

  const current = alerts[idx];
  const { title, date, category, note, completed } = req.body || {};

  if (date !== undefined) {
    const todayStr = new Date().toISOString().split("T")[0];
    if (date < todayStr && date !== current.date) {
      return res.status(400).json({ error: "Cannot update alert to a past date" });
    }
  }

  const updatedAlert = {
    ...current,
    ...(title !== undefined && { title: String(title).trim() }),
    ...(date !== undefined && { date: String(date).trim() }),
    ...(category !== undefined && { category: String(category).trim() }),
    ...(note !== undefined && { note: String(note).trim() }),
    ...(completed !== undefined && { completed: Boolean(completed) }),
    id: current.id,
    updatedAt: new Date().toISOString()
  };

  alerts[idx] = updatedAlert;
  db.alerts[req.userEmail] = alerts;
  writeDB(db);

  console.log(`[ALERTS] ✏️  Updated alert "${updatedAlert.title}" (${alertId})`);
  res.json({ success: true, alert: updatedAlert });
}

app.put("/api/alerts/:id", authMiddleware, handleUpdateAlert);
app.patch("/api/alerts/:id", authMiddleware, handleUpdateAlert);

// Delete alert
app.delete("/api/alerts/:id", authMiddleware, (req, res) => {
  const db = readDB();
  const alerts = db.alerts[req.userEmail] || [];
  const alertId = String(req.params.id);
  const beforeLen = alerts.length;

  const filtered = alerts.filter((a) => String(a.id) !== alertId);
  if (filtered.length === beforeLen) {
    return res.status(404).json({ error: "Alert not found" });
  }

  db.alerts[req.userEmail] = filtered;
  writeDB(db);

  console.log(`[ALERTS] 🗑️  Deleted alert ${alertId} for ${req.userEmail}`);
  res.json({ success: true, message: "Alert deleted successfully" });
});

// ─── OPPORTUNITIES ────────────────────────────────────────────────────────────
function getOpportunities() {
  const now = new Date();
  const fmt = (d) => d.toISOString().split("T")[0];
  const addDays = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return fmt(d);
  };

  return [
    {
      id: 1, type: "Scholarship", title: "PM Scholarship Scheme 2026-27",
      eligibility: "10th/12th pass, family income < 6 LPA",
      startDate: addDays(-20), endDate: addDays(25),
      link: "https://scholarships.gov.in",
      description: "Central sector scholarship for meritorious students pursuing higher education.",
      states: ["All"], courses: ["Any"], ageMin: 17, ageMax: 25
    },
    {
      id: 2, type: "Scholarship", title: "NSP Post-Matric Scholarship (SC/ST)",
      eligibility: "SC/ST students, post-matric level",
      startDate: addDays(-15), endDate: addDays(40),
      link: "https://scholarships.gov.in",
      description: "Financial assistance for SC/ST students pursuing post-matric courses.",
      states: ["All"], courses: ["Any"], ageMin: 16, ageMax: 30
    },
    {
      id: 3, type: "Government Exam", title: "SSC CGL 2026-27 Tier-I",
      eligibility: "Any graduate, age 18-32",
      startDate: addDays(-5), endDate: addDays(20),
      link: "https://ssc.nic.in",
      description: "Combined Graduate Level Examination for Group B & C posts across ministries.",
      states: ["All"], courses: ["Graduation"], ageMin: 18, ageMax: 32
    },
    {
      id: 4, type: "Government Exam", title: "TNPSC Group II 2026-27",
      eligibility: "Any degree, Tamil Nadu domicile preferred",
      startDate: addDays(-10), endDate: addDays(15),
      link: "https://www.tnpsc.gov.in",
      description: "Recruitment for various Group II executive and non-executive posts in Tamil Nadu.",
      states: ["Tamil Nadu"], courses: ["Any"], ageMin: 18, ageMax: 32
    },
    {
      id: 5, type: "Internship", title: "ISRO Summer Research Internship",
      eligibility: "B.Tech/M.Tech students (3rd year+)",
      startDate: addDays(-12), endDate: addDays(18),
      link: "https://www.isro.gov.in",
      description: "Research internship at ISRO centers across India in aerospace and computer science.",
      states: ["All"], courses: ["Engineering"], ageMin: 18, ageMax: 28
    },
    {
      id: 6, type: "Internship", title: "NASSCOM FutureSkills Tech Internship",
      eligibility: "CS/IT students, 2nd year onwards",
      startDate: addDays(2), endDate: addDays(45),
      link: "https://nasscom.in",
      description: "Industry-led tech internship in AI, full stack development, and cloud computing.",
      states: ["All"], courses: ["Engineering", "Science"], ageMin: 18, ageMax: 26
    },
    {
      id: 7, type: "Result", title: "UPSC Civil Services Prelims Result",
      eligibility: "All appeared candidates",
      startDate: addDays(1), endDate: addDays(28),
      link: "https://upsc.gov.in",
      description: "Result declaration and scorecard for Civil Services Preliminary Examination.",
      states: ["All"], courses: ["Any"], ageMin: 21, ageMax: 35
    },
    {
      id: 8, type: "Admit Card", title: "Banking (IBPS PO) Admit Card",
      eligibility: "Registered IBPS PO candidates",
      startDate: addDays(0), endDate: addDays(14),
      link: "https://ibps.in",
      description: "Download hall ticket and exam day instructions for IBPS Probationary Officer.",
      states: ["All"], courses: ["Graduation"], ageMin: 20, ageMax: 30
    },
    {
      id: 9, type: "Government Exam", title: "UPSC NDA & NA Examination",
      eligibility: "12th pass, age 16.5-19.5",
      startDate: addDays(-40), endDate: addDays(-5),
      link: "https://upsc.gov.in",
      description: "Expired — National Defence Academy and Naval Academy Examination.",
      states: ["All"], courses: ["Science"], ageMin: 16, ageMax: 20
    }
  ];
}

// Active opportunities endpoint (accessible publicly or with auth token)
app.get("/api/opportunities", (req, res) => {
  const todayStr = new Date().toISOString().split("T")[0];
  const allOpportunities = getOpportunities();
  const active = allOpportunities.filter((op) => op.endDate >= todayStr);
  res.json(active);
});

// ─── 404 HANDLER ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.originalUrl}. Route does not exist.`,
    method: req.method,
    path: req.originalUrl,
    availableEndpoints: "Visit GET / to see all available endpoints."
  });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[Server Error] Unhandled exception:`, err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred on the server"
  });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
// Ensure database is initialized before accepting incoming connections
initDB();

let server = null;
if (process.env.NODE_ENV !== "test") {
  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n==================================================`);
    console.log(`  🎓 EduAlert Backend Server Running Successfully`);
    console.log(`  📖 Swagger UI:    http://localhost:${PORT}/api-docs`);
    console.log(`  🌐 Base URL:      http://localhost:${PORT}`);
    console.log(`  🏥 Health Check:  http://localhost:${PORT}/api/health`);
    console.log(`  📁 Database:      ${DB_PATH}`);
    console.log(`  🚀 Environment:   ${process.env.NODE_ENV || "development"}`);
    console.log(`  💡 Notice: Port 5001 is used because macOS AirPlay`);
    console.log(`     Receiver claims port 5000 by default.`);
    console.log(`==================================================\n`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
      console.error(`👉 Solution: Set a different port in backend/.env (e.g. PORT=5002) or kill the process on port ${PORT}.\n`);
    } else {
      console.error(`\n❌ Server failed to start:`, err.message);
    }
  });
}

module.exports = {
  app,
  server,
  initDB,
  readDB,
  writeDB,
  checkDBHealth
};
