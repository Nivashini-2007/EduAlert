// EduAlert Backend - Node.js + Express
// Full REST API with PostgreSQL, Prisma ORM, JWT Authentication, and SSC CGL Integration

const path = require("path");
const fs = require("fs");

// Load Environment Variables
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { prisma, pool, initDB, checkDBHealth } = require("./db");
const { setupSwagger } = require("./swagger-ui");
const {
  checkSSCSiteAccessibility,
  getSSCCGLOpportunity,
  updateSSCCGLOpportunity
} = require("./services/sscService");

const app = express();
const PORT = parseInt(process.env.PORT || "5001", 10);
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
    if (!req.originalUrl.startsWith("/api-docs")) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Setup Swagger Documentation
setupSwagger(app);

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

async function hashPassword(pw) {
  return await bcrypt.hash(pw, BCRYPT_SALT_ROUNDS);
}

async function comparePassword(pw, storedHash) {
  if (!pw || !storedHash) return false;
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    return await bcrypt.compare(pw, storedHash);
  }
  // Legacy sha256 fallback (auto-compatible with older records)
  const legacyHash = crypto.createHash("sha256").update(pw + "edualert_salt_secret_2026").digest("hex");
  return legacyHash === storedHash;
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role || "STUDENT"
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, password_hash, password, ...safeUser } = user;
  return safeUser;
}

function verifyToken(req) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
    if (!token) return null;

    // Verify with jsonwebtoken
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

// Authentication guard middleware
async function authMiddleware(req, res, next) {
  const decoded = verifyToken(req);
  if (!decoded || (!decoded.id && !decoded.userId && !decoded.email)) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Please sign in to access this resource. Missing or invalid Bearer token."
    });
  }

  try {
    const rawId = decoded.id !== undefined ? decoded.id : decoded.userId;
    const userIdNum = rawId !== undefined && !isNaN(Number(rawId)) ? Number(rawId) : null;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(userIdNum !== null ? [{ id: userIdNum }] : []),
          ...(decoded.email ? [{ email: decoded.email.toLowerCase() }] : [])
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User account no longer exists."
      });
    }

    req.user = sanitizeUser(user);
    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (dbErr) {
    console.error("[AUTH] Error checking user in PostgreSQL:", dbErr.message);
    return res.status(500).json({ error: "Internal Server Error", message: "Authentication check failed" });
  }
}

// ─── SYSTEM ROUTES ────────────────────────────────────────────────────────────

// Root route (API directory)
app.get("/", (req, res) => {
  const acceptsHtml = req.accepts("html");
  const acceptsJson = req.accepts("json");
  if (acceptsHtml && !acceptsJson) {
    return res.redirect("/api-docs");
  }

  res.json({
    status: "online",
    message: "EduAlert Backend API is running successfully with PostgreSQL & Prisma",
    version: "2.0.0",
    documentation: "Visit /api-docs to view the interactive Swagger UI.",
    endpoints: {
      health: "GET /api/health",
      swaggerDocs: "GET /api-docs",
      register: "POST /api/auth/register (stores in users table)",
      login: "POST /api/auth/login (stores login record in user_logins table)",
      userLogins: "GET /api/auth/logins | GET /api/auth/logins/all",
      logout: "POST /api/auth/logout",
      currentUser: "GET /api/auth/me",
      profile: "GET /api/profile | POST /api/profile",
      alerts: "GET /api/alerts | POST /api/alerts | PUT /api/alerts/:id | DELETE /api/alerts/:id",
      notifications: "GET /api/notifications (current user) | GET /api/notifications/all (all users)",
      deviceTokens: "GET /api/notifications/device-tokens | POST /api/notifications/device-token",
      opportunities: "GET /api/opportunities",
      sscCgl: "GET /api/opportunities/ssc-cgl"
    }
  });
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  const dbHealth = await checkDBHealth();
  const statusCode = dbHealth.connected ? 200 : 503;
  res.status(statusCode).json({
    status: dbHealth.connected ? "online" : "database_unreachable",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbHealth,
    server: {
      port: PORT,
      nodeVersion: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || "development"
    }
  });
});

// ─── AUTHENTICATION ROUTES (NO OTP) ──────────────────────────────────────────

/**
 * POST /api/auth/register
 * Registers user in PostgreSQL with bcrypt password hashing.
 * Records actual creation timestamp and creates initial active device token.
 */
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

    // Check if email or username already exists in PostgreSQL
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          { username: { equals: cleanUsername, mode: "insensitive" } }
        ]
      }
    });

    if (existing) {
      const isEmail = existing.email.toLowerCase() === cleanEmail;
      return res.status(409).json({
        error: isEmail
          ? "An account with this email address already exists. Please log in."
          : "This username is already taken. Please choose another username."
      });
    }

    // Hash password with Bcrypt
    const hashedPassword = await hashPassword(password);
    const actualTime = new Date();

    // Store user in PostgreSQL users table with actual creation time and profile
    const newUser = await prisma.user.create({
      data: {
        username: cleanUsername,
        email: cleanEmail,
        passwordHash: hashedPassword,
        role: "STUDENT",
        createdAt: actualTime,
        updatedAt: actualTime,
        profile: {
          create: {
            fullName: cleanUsername,
            educationLevel: "Undergraduate",
            course: "",
            institution: "",
            state: "",
            interests: [],
            preferredCategories: [],
            updatedAt: actualTime
          }
        }
      },
      include: {
        profile: true
      }
    });

    // Create initial active device token recording the exact registration timestamp
    const regDeviceToken = `dt_${newUser.id}_${crypto.randomBytes(16).toString("hex")}`;
    await prisma.userDeviceToken.create({
      data: {
        userId: newUser.id,
        token: regDeviceToken,
        deviceLabel: (req.headers["user-agent"] || "Web Browser (Registration)").slice(0, 100),
        isActive: true,
        createdAt: actualTime,
        lastUsedAt: actualTime
      }
    });

    const safeUser = sanitizeUser(newUser);
    console.log(`[AUTH] 👤 Registered user in PostgreSQL: ${cleanUsername} (${cleanEmail}) [ID: ${newUser.id}] at ${actualTime.toISOString()}`);

    // IMPORTANT: No JWT token is generated here! User is redirected to login page.
    return res.status(201).json({
      success: true,
      message: "Registration successful! Please log in with your credentials.",
      user: safeUser
    });
  } catch (err) {
    console.error("[AUTH] Registration error in PostgreSQL:", err);
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Username or email is already registered." });
    }
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

/**
 * POST /api/auth/login
 * Verifies email/username and password using Bcrypt against PostgreSQL.
 * Generates and returns a JWT token ONLY on successful login.
 * Updates user_device_tokens recording the exact actual login time.
 */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    const identifier = String(email || username || "").trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ error: "Email/username and password are required" });
    }

    // Retrieve user from PostgreSQL
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: { equals: identifier, mode: "insensitive" } }
        ]
      },
      include: {
        profile: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials. Please check your email/username and password." });
    }

    // Verify Bcrypt password hash
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials. Please check your email/username and password." });
    }

    // Generate JWT token ONLY after successful authentication
    const token = generateToken(user);
    const safeUser = sanitizeUser(user);
    const actualLoginTime = new Date();

    // Record or update active device token with actual login timestamp
    const sessionToken = `dt_${user.id}_${crypto.randomBytes(16).toString("hex")}`;
    await prisma.userDeviceToken.create({
      data: {
        userId: user.id,
        token: sessionToken,
        deviceLabel: (req.headers["user-agent"] || "Web Browser Session").slice(0, 100),
        isActive: true,
        createdAt: actualLoginTime,
        lastUsedAt: actualLoginTime
      }
    });

    // Record login event in the separate user_logins table
    const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "Unknown";
    const loginRecord = await prisma.userLogin.create({
      data: {
        userId: user.id,
        ipAddress: typeof clientIp === "string" ? clientIp.split(",")[0].trim().slice(0, 100) : "127.0.0.1",
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : "Unknown",
        loginAt: actualLoginTime
      }
    });

    console.log(`[AUTH] 🔓 User logged in via PostgreSQL: ${user.username} (${user.email}) at ${actualLoginTime.toISOString()}`);
    console.log(`[AUTH] 📝 Login event recorded in user_logins table [ID: ${loginRecord.id}]`);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: safeUser,
      loginId: loginRecord.id
    });
  } catch (err) {
    console.error("[AUTH] Login error in PostgreSQL:", err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Clears user session.
 */
app.post("/api/auth/logout", (req, res) => {
  return res.json({
    success: true,
    message: "Logged out successfully"
  });
});

/**
 * GET /api/auth/me
 * Retrieves the current authenticated user's profile.
 */
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to retrieve user data" });
  }
});

/**
 * GET /api/auth/logins
 * Retrieves login history for the currently logged-in user from the user_logins table.
 */
app.get("/api/auth/logins", authMiddleware, async (req, res) => {
  try {
    const userLogins = await prisma.userLogin.findMany({
      where: { userId: req.userId },
      orderBy: { loginAt: "desc" }
    });

    return res.json({
      userId: req.userId,
      totalLogins: userLogins.length,
      logins: userLogins
    });
  } catch (err) {
    console.error("[AUTH] Error loading user login records:", err);
    return res.status(500).json({ error: "Failed to load user login records" });
  }
});

/**
 * GET /api/auth/logins/all
 * Retrieves ALL users' login history across the database from the user_logins table.
 */
app.get("/api/auth/logins/all", authMiddleware, async (req, res) => {
  try {
    const allLogins = await prisma.userLogin.findMany({
      orderBy: { loginAt: "desc" },
      include: {
        user: { select: { id: true, username: true, email: true } }
      }
    });

    return res.json({
      totalLogins: allLogins.length,
      logins: allLogins
    });
  } catch (err) {
    console.error("[AUTH] Error loading all login records:", err);
    return res.status(500).json({ error: "Failed to load all login records" });
  }
});

// ─── USER PROFILE ROUTES ──────────────────────────────────────────────────────

// Get profile from PostgreSQL
app.get("/api/profile", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const prof = user.profile || {};
    return res.json({
      name: prof.fullName || user.username,
      qualification: prof.educationLevel || "",
      course: prof.course || "",
      age: 22,
      category: "General",
      state: prof.state || "",
      exams: prof.interests || [],
      profileDone: Boolean(prof.course || prof.educationLevel)
    });
  } catch (err) {
    console.error("[PROFILE] Error fetching profile:", err);
    return res.status(500).json({ error: "Failed to load profile" });
  }
});

// Save or update profile in PostgreSQL
app.post("/api/profile", authMiddleware, async (req, res) => {
  try {
    const { name, qualification, course, age, category, state, exams } = req.body || {};
    const actualTime = new Date();

    const updatedProfile = await prisma.userProfile.upsert({
      where: { userId: req.userId },
      update: {
        ...(name && { fullName: name.trim() }),
        ...(qualification && { educationLevel: qualification }),
        ...(course && { course: course.trim() }),
        ...(state && { state: state.trim() }),
        ...(Array.isArray(exams) && { interests: exams }),
        updatedAt: actualTime
      },
      create: {
        userId: req.userId,
        fullName: (name && name.trim()) || req.user.username,
        educationLevel: qualification || "Undergraduate",
        course: course || "",
        state: state || "",
        interests: Array.isArray(exams) ? exams : [],
        updatedAt: actualTime
      }
    });

    console.log(`[PROFILE] 📝 Updated profile in PostgreSQL for ${req.user.email} at ${actualTime.toISOString()}`);

    return res.json({
      success: true,
      message: "Profile saved successfully to PostgreSQL",
      profile: {
        name: updatedProfile.fullName,
        qualification: updatedProfile.educationLevel,
        course: updatedProfile.course,
        age: age || 22,
        category: category || "General",
        state: updatedProfile.state,
        exams: updatedProfile.interests,
        profileDone: true
      }
    });
  } catch (err) {
    console.error("[PROFILE] Error saving profile:", err);
    return res.status(500).json({ error: "Failed to save profile" });
  }
});

// ─── ALERTS & NOTIFICATIONS MANAGEMENT ROUTES (POSTGRESQL) ────────────────────

// Get user alerts
app.get("/api/alerts", authMiddleware, async (req, res) => {
  try {
    const alerts = await prisma.userAlert.findMany({
      where: { userId: req.userId },
      orderBy: { eventDate: "asc" }
    });

    const formatted = alerts.map((a) => ({
      id: a.id,
      title: a.title,
      date: a.eventDate.toISOString().split("T")[0],
      category: a.category === "GOVT_EXAM" ? "Exam" : a.category === "SCHOLARSHIP" ? "Scholarship" : a.category === "INTERNSHIP" ? "Internship" : "Exam",
      note: a.description || "",
      completed: a.status === "COMPLETED",
      createdAt: a.createdAt.toISOString()
    }));

    return res.json(formatted);
  } catch (err) {
    console.error("[ALERTS] Error fetching alerts from PostgreSQL:", err);
    return res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// Create new alert AND store notification in PostgreSQL
app.post("/api/alerts", authMiddleware, async (req, res) => {
  try {
    const { title, date, category, note } = req.body || {};
    if (!title || !date) {
      return res.status(400).json({ error: "Title and date are required" });
    }

    const eventDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (eventDate < today) {
      return res.status(400).json({ error: "Event date cannot be in the past" });
    }

    // Map category string to OpportunityCategory enum
    let catEnum = "OTHER";
    if (category === "Exam" || category === "Government Exam") catEnum = "GOVT_EXAM";
    else if (category === "Scholarship") catEnum = "SCHOLARSHIP";
    else if (category === "Internship") catEnum = "INTERNSHIP";
    else if (category === "Result") catEnum = "RESULT";
    else if (category === "Admit Card") catEnum = "ADMIT_CARD";

    const actualTime = new Date();

    // 1. Create User Alert in PostgreSQL
    const newAlert = await prisma.userAlert.create({
      data: {
        userId: req.userId,
        title: title.trim(),
        description: (note && note.trim()) || "",
        eventDate,
        category: catEnum,
        status: "ACTIVE",
        createdAt: actualTime
      }
    });

    // 2. CRITICAL: Store notification in PostgreSQL notifications table
    const notifMessage = `Deadline alert: "${newAlert.title}" is scheduled for ${date}.${note ? " (" + note.trim() + ")" : ""}`;
    const newNotification = await prisma.notification.create({
      data: {
        userId: req.userId,
        alertId: newAlert.id,
        type: "REMINDER",
        title: newAlert.title,
        message: notifMessage,
        scheduledAt: eventDate,
        status: "SENT",
        isRead: false,
        createdAt: actualTime
      }
    });

    console.log(`[ALERTS] ➕ Added alert & stored notification in PostgreSQL for "${newAlert.title}" [User: ${req.userEmail}] at ${actualTime.toISOString()}`);

    return res.status(201).json({
      id: newAlert.id,
      title: newAlert.title,
      date: newAlert.eventDate.toISOString().split("T")[0],
      category: category || "Exam",
      note: newAlert.description,
      completed: false,
      createdAt: newAlert.createdAt.toISOString(),
      notification: {
        id: newNotification.id,
        title: newNotification.title,
        message: newNotification.message,
        status: newNotification.status,
        createdAt: newNotification.createdAt.toISOString()
      }
    });
  } catch (err) {
    console.error("[ALERTS] Error creating alert in PostgreSQL:", err);
    return res.status(500).json({ error: "Failed to create alert" });
  }
});

// Update alert
app.put("/api/alerts/:id", authMiddleware, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    if (isNaN(alertId)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }
    const { title, date, category, note, completed } = req.body || {};

    const existing = await prisma.userAlert.findFirst({
      where: { id: alertId, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Alert not found or unauthorized" });
    }

    let status = existing.status;
    if (completed !== undefined) {
      status = completed ? "COMPLETED" : "ACTIVE";
    }

    const updated = await prisma.userAlert.update({
      where: { id: alertId },
      data: {
        ...(title && { title: title.trim() }),
        ...(date && { eventDate: new Date(date) }),
        ...(note !== undefined && { description: note.trim() }),
        status
      }
    });

    // Update corresponding notification read/status
    if (completed !== undefined) {
      await prisma.notification.updateMany({
        where: { alertId: alertId },
        data: {
          isRead: Boolean(completed),
          status: completed ? "SENT" : "PENDING"
        }
      });
    }

    console.log(`[ALERTS] ✏️  Updated alert "${updated.title}" in PostgreSQL`);

    return res.json({
      id: updated.id,
      title: updated.title,
      date: updated.eventDate.toISOString().split("T")[0],
      category: category || (updated.category === "GOVT_EXAM" ? "Exam" : "Scholarship"),
      note: updated.description,
      completed: updated.status === "COMPLETED",
      createdAt: updated.createdAt.toISOString()
    });
  } catch (err) {
    console.error("[ALERTS] Error updating alert:", err);
    return res.status(500).json({ error: "Failed to update alert" });
  }
});

// Delete alert
app.delete("/api/alerts/:id", authMiddleware, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    if (isNaN(alertId)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }
    const existing = await prisma.userAlert.findFirst({
      where: { id: alertId, userId: req.userId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Alert not found or unauthorized" });
    }

    // Unlink and delete associated notifications
    await prisma.notification.deleteMany({ where: { alertId: alertId } });
    await prisma.userAlert.delete({ where: { id: alertId } });

    console.log(`[ALERTS] 🗑️  Deleted alert ${alertId} and associated notifications from PostgreSQL`);

    return res.json({ success: true, message: "Alert and associated notifications deleted successfully" });
  } catch (err) {
    console.error("[ALERTS] Error deleting alert:", err);
    return res.status(500).json({ error: "Failed to delete alert" });
  }
});

// ─── NOTIFICATIONS & DEVICE TOKENS ROUTES ─────────────────────────────────────

// GET /api/notifications -> Displays notifications for currently logged-in user
app.get("/api/notifications", authMiddleware, async (req, res) => {
  try {
    const userNotifs = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" }
    });

    const formatted = userNotifs.map(n => ({
      id: n.id,
      alertId: n.alertId,
      title: n.title,
      msg: n.message,
      message: n.message,
      status: n.status,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString()
    }));

    return res.json(formatted);
  } catch (err) {
    console.error("[NOTIFICATIONS] Error loading user notifications:", err);
    return res.status(500).json({ error: "Failed to load notifications" });
  }
});

// GET /api/notifications/all -> Displays ALL users' notifications across the database
app.get("/api/notifications/all", authMiddleware, async (req, res) => {
  try {
    const allNotifs = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, email: true } },
        alert: { select: { id: true, title: true, eventDate: true } }
      }
    });

    return res.json({
      totalCount: allNotifs.length,
      notifications: allNotifs
    });
  } catch (err) {
    console.error("[NOTIFICATIONS] Error loading all notifications:", err);
    return res.status(500).json({ error: "Failed to load all notifications" });
  }
});

// GET /api/notifications/device-tokens -> Displays active device tokens for logged in user
app.get("/api/notifications/device-tokens", authMiddleware, async (req, res) => {
  try {
    const tokens = await prisma.userDeviceToken.findMany({
      where: { userId: req.userId },
      orderBy: { lastUsedAt: "desc" }
    });
    return res.json(tokens);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch device tokens" });
  }
});

// POST /api/notifications/device-token -> Registers or updates a device token with actual timestamps
app.post("/api/notifications/device-token", authMiddleware, async (req, res) => {
  try {
    const { token, deviceLabel } = req.body || {};
    const actualTime = new Date();
    const tokenVal = token || `dt_${req.userId}_${crypto.randomBytes(16).toString("hex")}`;

    const devToken = await prisma.userDeviceToken.upsert({
      where: { token: tokenVal },
      update: {
        isActive: true,
        lastUsedAt: actualTime
      },
      create: {
        userId: req.userId,
        token: tokenVal,
        deviceLabel: (deviceLabel || req.headers["user-agent"] || "Web Browser Client").slice(0, 100),
        isActive: true,
        createdAt: actualTime,
        lastUsedAt: actualTime
      }
    });

    return res.json({ success: true, deviceToken: devToken });
  } catch (err) {
    console.error("[DEVICE TOKEN] Error registering device token:", err);
    return res.status(500).json({ error: "Failed to register device token" });
  }
});

// ─── OPPORTUNITIES & SSC CGL ROUTES ───────────────────────────────────────────

function mapCategoryToFrontend(cat) {
  switch (cat) {
    case "GOVT_EXAM": return "Government Exam";
    case "SCHOLARSHIP": return "Scholarship";
    case "INTERNSHIP": return "Internship";
    case "RESULT": return "Result";
    case "ADMIT_CARD": return "Admit Card";
    case "FELLOWSHIP": return "Fellowship";
    default: return "Government Exam";
  }
}

// Active opportunities endpoint
app.get("/api/opportunities", async (req, res) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      orderBy: { createdAt: "desc" }
    });

    const now = new Date();
    const formatted = opportunities.map((op) => ({
      id: op.id,
      type: mapCategoryToFrontend(op.category),
      title: op.title,
      eligibility: op.eligibility || "Any graduate",
      startDate: op.applicationStartDate ? op.applicationStartDate.toISOString().split("T")[0] : new Date(now.getTime() - 5 * 86400000).toISOString().split("T")[0],
      endDate: op.applicationDeadline ? op.applicationDeadline.toISOString().split("T")[0] : new Date(now.getTime() + 30 * 86400000).toISOString().split("T")[0],
      link: op.officialSourceUrl,
      sourceName: op.sourceName,
      verificationStatus: op.verificationStatus,
      status: op.status,
      description: op.description,
      states: op.eligibleStates && op.eligibleStates.length > 0 ? op.eligibleStates : ["All"],
      courses: op.educationLevels && op.educationLevels.length > 0 ? op.educationLevels : ["Graduation"],
      ageMin: 18,
      ageMax: 32
    }));

    return res.json(formatted);
  } catch (err) {
    console.error("[OPPORTUNITIES] Error loading from PostgreSQL:", err);
    return res.status(500).json({ error: "Failed to load opportunities" });
  }
});

// Dedicated SSC CGL Examination details & live connectivity check
app.get("/api/opportunities/ssc-cgl", async (req, res) => {
  try {
    const [opp, siteStatus] = await Promise.all([
      getSSCCGLOpportunity(),
      checkSSCSiteAccessibility()
    ]);

    return res.json({
      success: true,
      opportunity: opp ? {
        id: opp.id,
        title: opp.title,
        officialSourceUrl: opp.officialSourceUrl,
        category: opp.category,
        eligibility: opp.eligibility,
        status: opp.status,
        verificationStatus: opp.verificationStatus,
        applicationStartDate: opp.applicationStartDate,
        applicationDeadline: opp.applicationDeadline,
        applicationProcedure: opp.applicationProcedure,
        description: opp.description
      } : null,
      officialPortal: {
        url: "https://ssc.gov.in",
        status: siteStatus
      }
    });
  } catch (err) {
    console.error("[SSC] Error fetching SSC CGL details:", err);
    return res.status(500).json({ error: "Failed to retrieve SSC CGL data", message: err.message });
  }
});

// Admin manual update / sync endpoint for opportunities
app.put("/api/opportunities/:id", authMiddleware, async (req, res) => {
  try {
    const oppId = parseInt(req.params.id, 10);
    if (isNaN(oppId)) {
      return res.status(400).json({ error: "Invalid opportunity ID" });
    }
    const { title, description, eligibility, startDate, endDate, link, procedure, status } = req.body || {};

    const updated = await prisma.opportunity.update({
      where: { id: oppId },
      data: {
        ...(title && { title: title.trim() }),
        ...(description && { description: description.trim() }),
        ...(eligibility && { eligibility: eligibility.trim() }),
        ...(startDate && { applicationStartDate: new Date(startDate) }),
        ...(endDate && { applicationDeadline: new Date(endDate) }),
        ...(link && { officialSourceUrl: link.trim() }),
        ...(procedure && { applicationProcedure: procedure.trim() }),
        ...(status && { status }),
        lastVerifiedAt: new Date(),
        verificationStatus: "VERIFIED"
      }
    });

    console.log(`[OPPORTUNITIES] ✏️  Opportunity updated: "${updated.title}"`);
    return res.json({ success: true, message: "Opportunity updated successfully", opportunity: updated });
  } catch (err) {
    console.error("[OPPORTUNITIES] Error updating opportunity:", err);
    return res.status(500).json({ error: "Failed to update opportunity" });
  }
});

// ─── 404 HANDLER ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.originalUrl}. Route does not exist.`,
    method: req.method,
    path: req.originalUrl,
    availableEndpoints: "Visit GET / to see all available endpoints or /api-docs for interactive Swagger UI."
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
let server = null;

async function startServer() {
  try {
    await initDB();

    if (process.env.NODE_ENV !== "test") {
      server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n==================================================`);
        console.log(`  🎓 EduAlert Backend Server Running Successfully`);
        console.log(`  🐘 Database:      PostgreSQL (edualert_db) via Prisma`);
        console.log(`  📖 Swagger UI:    http://localhost:${PORT}/api-docs`);
        console.log(`  🌐 Base URL:      http://localhost:${PORT}`);
        console.log(`  🏥 Health Check:  http://localhost:${PORT}/api/health`);
        console.log(`  🚀 Environment:   ${process.env.NODE_ENV || "development"}`);
        console.log(`==================================================\n`);
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
          console.error(`👉 Kill the process on port ${PORT} or choose another port in .env\n`);
        } else {
          console.error(`\n❌ Server failed to start:`, err.message);
        }
      });
    }
  } catch (err) {
    console.error(`❌ Failed to start server:`, err.message);
  }
}

startServer();

module.exports = {
  app,
  server,
  prisma,
  pool,
  initDB,
  checkDBHealth
};
