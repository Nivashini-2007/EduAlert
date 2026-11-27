// EduAlert - Database Manager
// PostgreSQL with Prisma ORM and @prisma/adapter-pg Driver Adapter

const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

// Load .env
require("dotenv").config({ path: path.join(__dirname, ".env") });

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://nivashini:postgres@localhost:5432/edualert_db?schema=public";

// Initialize PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Configure Prisma driver adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

/**
 * Initializes and establishes the PostgreSQL database connection.
 * Runs before the server starts listening to guarantee database availability.
 */
async function initDB() {
  try {
    // 1. Verify PostgreSQL connection via raw query
    await prisma.$queryRaw`SELECT 1`;

    const userCount = await prisma.user.count();
    const oppCount = await prisma.opportunity.count();
    const alertCount = await prisma.userAlert.count();

    console.log(`[Database] ✅ PostgreSQL connected successfully via Prisma!`);
    console.log(`[Database] 📊 Target Database: edualert_db (schema: public)`);
    console.log(`[Database] 📊 Current Counts: ${userCount} user(s), ${oppCount} opportunity(ies), ${alertCount} alert(s)`);

    // 2. Ensure SSC CGL 2026-27 Tier-I opportunity is seeded into PostgreSQL
    await ensureSSCCGLOpportunity();

    return true;
  } catch (err) {
    console.error(`[Database] ❌ Critical error connecting to PostgreSQL:`, err.message);
    throw err;
  }
}

/**
 * Ensures the official SSC CGL 2026-27 Tier-I opportunity exists in PostgreSQL.
 */
async function ensureSSCCGLOpportunity() {
  try {
    const existing = await prisma.opportunity.findFirst({
      where: {
        title: { contains: "SSC CGL", mode: "insensitive" }
      }
    });

    const now = new Date();
    const startDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const deadline = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    if (!existing) {
      await prisma.opportunity.create({
        data: {
          title: "SSC CGL 2026-27 Tier-I",
          description: "Combined Graduate Level Examination (Tier-I) for recruitment to Group B and Group C non-technical and gazetted posts across ministries, departments, and organizations of the Government of India.",
          category: "GOVT_EXAM",
          eligibility: "Bachelor's Degree from a recognized University or equivalent. Age: 18-32 years depending on post.",
          educationLevels: ["Graduation", "Bachelor's Degree"],
          eligibleStates: ["All India"],
          applicationStartDate: startDate,
          applicationDeadline: deadline,
          officialSourceUrl: "https://ssc.gov.in",
          sourceName: "Staff Selection Commission (GoI)",
          verificationStatus: "VERIFIED",
          status: "OPEN",
          applicationProcedure: "Apply online at https://ssc.gov.in using One-Time Registration (OTR). Complete the online application form and upload scanned photograph and signature as per official notification guidelines."
        }
      });
      console.log(`[Database] 🏛️  Seeded official opportunity: "SSC CGL 2026-27 Tier-I" into PostgreSQL`);
    } else {
      // Update link to official https://ssc.gov.in if legacy
      if (existing.officialSourceUrl !== "https://ssc.gov.in") {
        await prisma.opportunity.update({
          where: { id: existing.id },
          data: { officialSourceUrl: "https://ssc.gov.in" }
        });
      }
    }
  } catch (err) {
    console.warn(`[Database] Note on seeding SSC CGL opportunity:`, err.message);
  }
}

/**
 * Comprehensive PostgreSQL Database Health Check.
 */
async function checkDBHealth() {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    const [userCount, oppCount, alertCount] = await Promise.all([
      prisma.user.count(),
      prisma.opportunity.count(),
      prisma.userAlert.count()
    ]);

    // Parse host, port, db name from connection string
    let host = "localhost";
    let port = 5432;
    let database = "edualert_db";
    let user = "nivashini";

    try {
      const url = new URL(DATABASE_URL);
      host = url.hostname || host;
      port = parseInt(url.port || "5432", 10);
      database = url.pathname.replace(/^\//, "").split("?")[0] || database;
      user = url.username || user;
    } catch (_) {}

    return {
      connected: true,
      databaseType: "PostgreSQL",
      orm: "Prisma v7.10.1 (@prisma/adapter-pg)",
      databaseName: database,
      schema: "public",
      host,
      port,
      user,
      latencyMs,
      usersCount: userCount,
      opportunitiesCount: oppCount,
      alertsCount: alertCount
    };
  } catch (err) {
    return {
      connected: false,
      databaseType: "PostgreSQL",
      error: err.message
    };
  }
}

module.exports = {
  prisma,
  pool,
  initDB,
  checkDBHealth,
  ensureSSCCGLOpportunity
};
