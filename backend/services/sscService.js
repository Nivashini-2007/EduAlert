// EduAlert - Staff Selection Commission (SSC) Integration Service
// Reliable server-side connectivity check, Angular SPA diagnostics, and PostgreSQL sync

const https = require("https");
const { prisma } = require("../db");

const SSC_OFFICIAL_URL = "https://ssc.gov.in";
const SSC_CGL_EXAM_URL = "https://ssc.gov.in/for-candidates/cgl-exam";

/**
 * Checks server-side accessibility of the official SSC portal.
 * Identifies Angular SPA architecture and verifies connection health.
 */
async function checkSSCSiteAccessibility() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const options = {
      hostname: "ssc.gov.in",
      port: 443,
      path: "/",
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        if (data.length < 50000) data += chunk.toString();
      });

      res.on("end", () => {
        const latencyMs = Date.now() - startTime;
        const isSpa = data.includes("<app-root") || data.includes("main.") || data.includes("polyfills.");
        
        resolve({
          success: true,
          httpStatus: res.statusCode,
          latencyMs,
          officialUrl: SSC_OFFICIAL_URL,
          isSpa,
          notes: isSpa
            ? "Official SSC portal is an Angular Single-Page Application (SPA). Data is rendered dynamically client-side via JavaScript bundles rather than static server-rendered HTML tables."
            : "Standard HTML response received.",
          timestamp: new Date().toISOString()
        });
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        success: false,
        error: "Connection to https://ssc.gov.in timed out after 8 seconds.",
        officialUrl: SSC_OFFICIAL_URL,
        timestamp: new Date().toISOString()
      });
    });

    req.on("error", (err) => {
      resolve({
        success: false,
        error: `Failed to connect to https://ssc.gov.in: ${err.message}`,
        officialUrl: SSC_OFFICIAL_URL,
        timestamp: new Date().toISOString()
      });
    });

    req.end();
  });
}

/**
 * Retrieves the official SSC CGL opportunity from PostgreSQL.
 */
async function getSSCCGLOpportunity() {
  const opp = await prisma.opportunity.findFirst({
    where: {
      title: { contains: "SSC CGL", mode: "insensitive" }
    }
  });
  return opp;
}

/**
 * Allows administrators to update or sync SSC CGL examination details.
 */
async function updateSSCCGLOpportunity(data) {
  const existing = await getSSCCGLOpportunity();
  if (!existing) {
    throw new Error("SSC CGL opportunity not found in database.");
  }

  const updated = await prisma.opportunity.update({
    where: { id: existing.id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.eligibility && { eligibility: data.eligibility }),
      ...(data.applicationStartDate && { applicationStartDate: new Date(data.applicationStartDate) }),
      ...(data.applicationDeadline && { applicationDeadline: new Date(data.applicationDeadline) }),
      ...(data.officialSourceUrl && { officialSourceUrl: data.officialSourceUrl }),
      ...(data.applicationProcedure && { applicationProcedure: data.applicationProcedure }),
      ...(data.status && { status: data.status }),
      lastVerifiedAt: new Date(),
      verificationStatus: "VERIFIED"
    }
  });

  return updated;
}

module.exports = {
  SSC_OFFICIAL_URL,
  SSC_CGL_EXAM_URL,
  checkSSCSiteAccessibility,
  getSSCCGLOpportunity,
  updateSSCCGLOpportunity
};
