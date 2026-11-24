// EduAlert - Database Manager
// File-based JSON Database with schema validation, atomic writes, and health checks

const fs = require("fs");
const path = require("path");

const DB_FILENAME = process.env.DB_FILE || process.env.DATABASE_PATH || "db.json";
const DB_PATH = path.isAbsolute(DB_FILENAME)
  ? DB_FILENAME
  : path.join(__dirname, DB_FILENAME);

const INITIAL_SCHEMA = {
  users: {},
  alerts: {},
  meta: {
    createdAt: new Date().toISOString(),
    version: "1.0.0",
    name: "EduAlert JSON Database"
  }
};

/**
 * Initializes and establishes the database connection.
 * Runs before server starts listening to guarantee database availability.
 */
function initDB() {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let data;
    if (!fs.existsSync(DB_PATH)) {
      console.log(`[Database] Database file not found. Creating new database at: ${DB_PATH}`);
      fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_SCHEMA, null, 2), "utf-8");
      data = INITIAL_SCHEMA;
    } else {
      const raw = fs.readFileSync(DB_PATH, "utf-8").trim();
      if (!raw) {
        console.warn(`[Database] Database file was empty. Reinitializing schema.`);
        fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_SCHEMA, null, 2), "utf-8");
        data = INITIAL_SCHEMA;
      } else {
        try {
          data = JSON.parse(raw);
        } catch (parseErr) {
          const backupPath = `${DB_PATH}.corrupt.${Date.now()}`;
          console.error(`[Database] Corrupted database JSON detected! Backing up to ${backupPath}`);
          fs.writeFileSync(backupPath, raw, "utf-8");
          fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_SCHEMA, null, 2), "utf-8");
          data = INITIAL_SCHEMA;
        }
      }
    }

    // Ensure core collections exist
    let modified = false;
    if (!data.users || typeof data.users !== "object") { data.users = {}; modified = true; }
    if (!data.alerts || typeof data.alerts !== "object") { data.alerts = {}; modified = true; }
    if (!data.meta) { data.meta = INITIAL_SCHEMA.meta; modified = true; }

    // Ensure all existing users have user ID, username, and valid structure
    for (const [key, user] of Object.entries(data.users)) {
      if (!user.id) {
        user.id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        modified = true;
      }
      if (!user.username) {
        user.username = (user.name || user.email.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9_]/g, "_");
        modified = true;
      }
      if (!user.createdAt) {
        user.createdAt = new Date().toISOString();
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
    }

    const userCount = Object.keys(data.users).length;
    const alertCount = Object.keys(data.alerts).reduce(
      (sum, email) => sum + (Array.isArray(data.alerts[email]) ? data.alerts[email].length : 0),
      0
    );

    console.log(`[Database] ✅ Database connected successfully: ${DB_PATH}`);
    console.log(`[Database] 📊 Loaded ${userCount} registered user(s), ${alertCount} alert(s)`);

    return true;
  } catch (err) {
    console.error(`[Database] ❌ Critical error connecting to database at ${DB_PATH}:`, err.message);
    throw err;
  }
}

/**
 * Safely reads the database content.
 */
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      initDB();
    }
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (!data.users) data.users = {};
    if (!data.alerts) data.alerts = {};
    return data;
  } catch (err) {
    console.error(`[Database] Error reading database:`, err.message);
    initDB();
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  }
}

/**
 * Safely writes data to the database using an atomic temporary write.
 */
function writeDB(data) {
  try {
    data.meta = {
      ...(data.meta || {}),
      updatedAt: new Date().toISOString()
    };
    const tempPath = `${DB_PATH}.tmp.${Date.now()}`;
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, serialized, "utf-8");
    fs.renameSync(tempPath, DB_PATH);
    return true;
  } catch (err) {
    console.error(`[Database] Error writing to database:`, err.message);
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
      return true;
    } catch (writeErr) {
      console.error(`[Database] Fallback write also failed:`, writeErr.message);
      throw writeErr;
    }
  }
}

/**
 * Database health check helper.
 */
function checkDBHealth() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { connected: false, error: "Database file does not exist" };
    }
    const stats = fs.statSync(DB_PATH);
    const data = readDB();
    return {
      connected: true,
      databaseType: "JSON Document Store",
      path: DB_PATH,
      sizeBytes: stats.size,
      usersCount: Object.keys(data.users || {}).length,
      alertsCount: Object.keys(data.alerts || {}).reduce(
        (sum, email) => sum + (Array.isArray(data.alerts[email]) ? data.alerts[email].length : 0),
        0
      ),
      lastModified: stats.mtime.toISOString()
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = {
  DB_PATH,
  initDB,
  readDB,
  writeDB,
  checkDBHealth
};
