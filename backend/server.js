// EduAlert Backend - Node.js + Express
// Run: npm install && node server.js
// API runs on http://localhost:5000

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5000;
const DB_FILE = path.join(__dirname, "db.json");

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

// ─── Simple JSON file database ────────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {}, alerts: {}, otps: {} }));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw + "edualert_salt").digest("hex");
}

function generateToken(email) {
  const payload = { email, exp: Date.now() + 7 * 24 * 3600 * 1000 };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    const token = auth.replace("Bearer ", "");
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (payload.exp < Date.now()) return null;
    return payload.email;
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const email = verifyToken(req);
  if (!email) return res.status(401).json({ error: "Unauthorized" });
  req.userEmail = email;
  next();
}

// ─── OTP store (in-memory, expires in 10 min) ─────────────────────────────────
const otpStore = {};

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Send OTP
app.post("/api/auth/send-otp", (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Invalid email" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 };

  // In production: send via nodemailer/SendGrid
  // For demo: return OTP in response
  console.log(`[OTP] ${email} → ${otp}`);
  res.json({ success: true, message: "OTP sent to email", demoOtp: otp });
});

// Verify OTP
app.post("/api/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const stored = otpStore[email];
  if (!stored) return res.status(400).json({ error: "OTP not requested" });
  if (Date.now() > stored.expires) { delete otpStore[email]; return res.status(400).json({ error: "OTP expired" }); }
  if (stored.otp !== otp) return res.status(400).json({ error: "Invalid OTP" });
  delete otpStore[email];
  res.json({ success: true, message: "Email verified" });
});

// Register
app.post("/api/auth/register", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be 6+ characters" });

  const db = readDB();
  if (db.users[email]) return res.status(409).json({ error: "Email already registered" });

  db.users[email] = {
    email,
    password: hashPassword(password),
    profileDone: false,
    profile: {},
    createdAt: new Date().toISOString(),
  };
  db.alerts[email] = [];
  writeDB(db);

  const token = generateToken(email);
  res.json({ success: true, token, user: { email, profileDone: false } });
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users[email];
  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = generateToken(email);
  const { password: _, ...safeUser } = user;
  res.json({ success: true, token, user: safeUser });
});

// Get profile
app.get("/api/profile", authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users[req.userEmail];
  if (!user) return res.status(404).json({ error: "User not found" });
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

// Save profile
app.post("/api/profile", authMiddleware, (req, res) => {
  const { name, qualification, course, age, category, state, exams } = req.body;
  if (!name || !qualification || !state) return res.status(400).json({ error: "Name, qualification, and state are required" });

  const db = readDB();
  db.users[req.userEmail].profile = { name, qualification, course, age, category, state, exams: exams || [] };
  db.users[req.userEmail].profileDone = true;
  writeDB(db);

  const { password: _, ...safeUser } = db.users[req.userEmail];
  res.json({ success: true, user: safeUser });
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
  const { title, date, category, note } = req.body;
  if (!title || !date) return res.status(400).json({ error: "Title and date are required" });

  // Reject past dates
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const alertDate = new Date(date);
  if (alertDate < today) return res.status(400).json({ error: "Cannot create alert for past dates" });

  const db = readDB();
  if (!db.alerts[req.userEmail]) db.alerts[req.userEmail] = [];

  const newAlert = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    title,
    date,
    category: category || "Exam",
    note: note || "",
    completed: false,
    createdAt: new Date().toISOString(),
  };

  db.alerts[req.userEmail].push(newAlert);
  writeDB(db);
  res.json({ success: true, alert: newAlert });
});

// Update alert
app.put("/api/alerts/:id", authMiddleware, (req, res) => {
  const db = readDB();
  const alerts = db.alerts[req.userEmail] || [];
  const idx = alerts.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Alert not found" });

  alerts[idx] = { ...alerts[idx], ...req.body, id: alerts[idx].id };
  db.alerts[req.userEmail] = alerts;
  writeDB(db);
  res.json({ success: true, alert: alerts[idx] });
});

// Delete alert
app.delete("/api/alerts/:id", authMiddleware, (req, res) => {
  const db = readDB();
  const before = (db.alerts[req.userEmail] || []).length;
  db.alerts[req.userEmail] = (db.alerts[req.userEmail] || []).filter((a) => a.id !== req.params.id);
  if (db.alerts[req.userEmail].length === before) return res.status(404).json({ error: "Alert not found" });
  writeDB(db);
  res.json({ success: true });
});

// ─── OPPORTUNITIES (static, filtered by date server-side) ────────────────────
const OPPORTUNITIES = [
  { id: 1, type: "Scholarship", title: "PM Scholarship Scheme 2025", eligibility: "10th/12th pass, family income < 6 LPA", startDate: "2025-04-01", endDate: "2026-05-30", link: "https://scholarships.gov.in", description: "Central sector scholarship for meritorious students." },
  { id: 2, type: "Scholarship", title: "NSP Post-Matric Scholarship (SC/ST)", eligibility: "SC/ST students, post-matric level", startDate: "2025-04-20", endDate: "2026-06-24", link: "https://scholarships.gov.in", description: "Financial assistance for SC/ST students pursuing higher education." },
  { id: 3, type: "Government Exam", title: "SSC CGL 2025 Tier-I", eligibility: "Any graduate, age 18-32", startDate: "2025-04-05", endDate: "2026-06-04", link: "https://ssc.nic.in", description: "Combined Graduate Level Examination for Group B & C posts." },
  { id: 4, type: "Government Exam", title: "TNPSC Group II 2025", eligibility: "Any degree, Tamil Nadu domicile preferred", startDate: "2025-04-25", endDate: "2026-05-20", link: "https://www.tnpsc.gov.in", description: "Recruitment for various Group II posts in Tamil Nadu." },
  { id: 5, type: "Internship", title: "ISRO Summer Internship 2025", eligibility: "B.Tech/M.Tech students (3rd year+)", startDate: "2025-04-20", endDate: "2026-05-25", link: "https://www.isro.gov.in", description: "Research internship at ISRO centers across India." },
  { id: 6, type: "Internship", title: "NASSCOM FutureSkills Internship", eligibility: "CS/IT students, 2nd year onwards", startDate: "2026-05-15", endDate: "2026-07-09", link: "https://nasscom.in", description: "Industry-led tech internship for budding professionals." },
  { id: 7, type: "Result", title: "UPSC Civil Services Prelims Result 2025", eligibility: "All appeared candidates", startDate: "2026-05-13", endDate: "2026-06-09", link: "https://upsc.gov.in", description: "Result declaration for Civil Services Preliminary Examination." },
  { id: 8, type: "Admit Card", title: "IBPS PO Admit Card 2025", eligibility: "Registered IBPS PO candidates", startDate: "2026-05-12", endDate: "2026-05-28", link: "https://ibps.in", description: "Download admit card for IBPS Probationary Officer exam." },
  { id: 9, type: "Government Exam", title: "UPSC NDA Exam 2025", eligibility: "12th pass, age 16.5-19.5", startDate: "2025-01-01", endDate: "2026-05-01", link: "https://upsc.gov.in", description: "National Defence Academy Exam." },
];

app.get("/api/opportunities", authMiddleware, (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const active = OPPORTUNITIES.filter((op) => new Date(op.endDate) >= today);
  res.json(active);
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.listen(PORT, () => console.log(`✅ EduAlert backend running at http://localhost:${PORT}`));
