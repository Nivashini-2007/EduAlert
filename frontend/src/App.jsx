import { useState, useEffect, useCallback } from "react";

// ─── Logo as inline SVG/img ───────────────────────────────────────────────────
const LOGO_URL = "/assets/logo.png";

// ─── Hardcoded demo data ──────────────────────────────────────────────────────
const TODAY = new Date();
const fmt = (d) => d.toISOString().split("T")[0];
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const OPPORTUNITIES = [
  {
    id: 1, type: "Scholarship", title: "PM Scholarship Scheme 2025",
    eligibility: "10th/12th pass, family income < 6 LPA",
    startDate: fmt(addDays(TODAY, -30)), endDate: fmt(addDays(TODAY, 20)),
    link: "https://scholarships.gov.in", description: "Central sector scholarship for meritorious students.",
    states: ["All"], courses: ["Any"], ageMin: 17, ageMax: 25,
  },
  {
    id: 2, type: "Scholarship", title: "NSP Post-Matric Scholarship (SC/ST)",
    eligibility: "SC/ST students, post-matric level",
    startDate: fmt(addDays(TODAY, -10)), endDate: fmt(addDays(TODAY, 45)),
    link: "https://scholarships.gov.in", description: "Financial assistance for SC/ST students pursuing higher education.",
    states: ["All"], courses: ["Any"], ageMin: 16, ageMax: 30,
  },
  {
    id: 3, type: "Government Exam", title: "SSC CGL 2025 Tier-I",
    eligibility: "Any graduate, age 18-32",
    startDate: fmt(addDays(TODAY, -5)), endDate: fmt(addDays(TODAY, 25)),
    link: "https://ssc.nic.in", description: "Combined Graduate Level Examination for Group B & C posts.",
    states: ["All"], courses: ["Graduation"], ageMin: 18, ageMax: 32,
  },
  {
    id: 4, type: "Government Exam", title: "TNPSC Group II 2025",
    eligibility: "Any degree, Tamil Nadu domicile preferred",
    startDate: fmt(addDays(TODAY, -15)), endDate: fmt(addDays(TODAY, 10)),
    link: "https://www.tnpsc.gov.in", description: "Recruitment for various Group II posts in Tamil Nadu.",
    states: ["Tamil Nadu"], courses: ["Any"], ageMin: 18, ageMax: 32,
  },
  {
    id: 5, type: "Internship", title: "ISRO Summer Internship 2025",
    eligibility: "B.Tech/M.Tech students (3rd year+)",
    startDate: fmt(addDays(TODAY, -20)), endDate: fmt(addDays(TODAY, 15)),
    link: "https://www.isro.gov.in", description: "Research internship at ISRO centers across India.",
    states: ["All"], courses: ["Engineering"], ageMin: 18, ageMax: 28,
  },
  {
    id: 6, type: "Internship", title: "NASSCOM FutureSkills Internship",
    eligibility: "CS/IT students, 2nd year onwards",
    startDate: fmt(addDays(TODAY, 5)), endDate: fmt(addDays(TODAY, 60)),
    link: "https://nasscom.in", description: "Industry-led tech internship for budding professionals.",
    states: ["All"], courses: ["Engineering", "Science"], ageMin: 18, ageMax: 26,
  },
  {
    id: 7, type: "Result", title: "UPSC Civil Services Prelims Result 2025",
    eligibility: "All appeared candidates",
    startDate: fmt(addDays(TODAY, 3)), endDate: fmt(addDays(TODAY, 30)),
    link: "https://upsc.gov.in", description: "Result declaration for Civil Services Preliminary Examination.",
    states: ["All"], courses: ["Any"], ageMin: 21, ageMax: 35,
  },
  {
    id: 8, type: "Admit Card", title: "Banking (IBPS PO) Admit Card 2025",
    eligibility: "Registered IBPS PO candidates",
    startDate: fmt(addDays(TODAY, 2)), endDate: fmt(addDays(TODAY, 18)),
    link: "https://ibps.in", description: "Download admit card for IBPS Probationary Officer exam.",
    states: ["All"], courses: ["Graduation"], ageMin: 20, ageMax: 30,
  },
  {
    id: 9, type: "Government Exam", title: "UPSC NDA Exam 2025",
    eligibility: "12th pass, age 16.5-19.5",
    startDate: fmt(addDays(TODAY, -40)), endDate: fmt(addDays(TODAY, -5)),
    link: "https://upsc.gov.in", description: "Expired — National Defence Academy Exam.",
    states: ["All"], courses: ["Science"], ageMin: 16, ageMax: 20,
  },
];

const TYPE_COLORS = {
  Scholarship: { bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
  "Government Exam": { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  Internship: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  Result: { bg: "#f3e8ff", text: "#6b21a8", border: "#c4b5fd" },
  "Admit Card": { bg: "#ffe4e6", text: "#9f1239", border: "#fda4af" },
};

const EXAM_INTERESTS = ["UPSC", "SSC", "Banking", "TNPSC", "Railway", "Defence", "State PSC", "Teaching","Engineering Exams (GATE/ESE)"];
const CATEGORIES = ["Scholarship", "Government Exam", "Internship", "Result", "Admit Card"];
const EVENT_CATEGORIES = ["Scholarship", "Exam", "Internship", "Result", "Personal"];
const EVENT_CAT_COLORS = { Scholarship: "#0ea5e9", Exam: "#f59e0b", Internship: "#22c55e", Result: "#a855f7", Personal: "#f43f5e" };

// ─── OTP via Claude API ──────────────────────────────────────────────────────
async function sendOTPviaAI(email, otp) {
  try {
    await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [{ role: "user", content: `Acknowledge that OTP ${otp} has been prepared for ${email}. Reply in one short sentence.` }],
      }),
    });
  } catch (_) {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysLeft(dateStr) {
  const d = new Date(dateStr);
  const diff = Math.ceil((d - TODAY) / 86400000);
  return diff;
}

function Badge({ type }) {
  const c = TYPE_COLORS[type] || { bg: "#f1f5f9", text: "#334155", border: "#cbd5e1" };
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>
      {type}
    </span>
  );
}

function CountdownBadge({ endDate }) {
  const days = daysLeft(endDate);
  if (days < 0) return <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>Closed</span>;
  if (days === 0) return <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>Last Day!</span>;
  if (days <= 5) return <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚡ {days}d left</span>;
  return <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>{days} days left</span>;
}

// ─── PAGES ────────────────────────────────────────────────────────────────────

// LOGIN / REGISTER
function AuthPage({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", mobile: "", otp: "" });
  const [generatedOTP, setGeneratedOTP] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function sendOTP() {
    if (!form.email.includes("@")) { setError("Enter a valid email."); return; }
    setLoading(true); setError("");
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(otp);
    await sendOTPviaAI(form.email, otp);
    setOtpSent(true);
    setMsg(`OTP sent! (Demo OTP: ${otp})`);
    setLoading(false);
  }

  function verifyOTP() {
    if (form.otp === generatedOTP) { setOtpVerified(true); setError(""); setMsg("✅ Email verified!"); }
    else { setError("Invalid OTP. Try again."); }
  }

  function handleLogin() {
    if (!form.email || !form.password) { setError("Fill all fields."); return; }
    const users = JSON.parse(localStorage.getItem("edu_users") || "{}");
    if (users[form.email] && users[form.email].password === form.password) {
      onLogin({ email: form.email, ...users[form.email] });
    } else { setError("Invalid credentials."); }
  }

  function handleRegister() {
    if (!otpVerified) { setError("Please verify your email via OTP."); return; }
    if (!form.password || form.password.length < 6) { setError("Password must be 6+ characters."); return; }
    const users = JSON.parse(localStorage.getItem("edu_users") || "{}");
    if (users[form.email]) { setError("Email already registered."); return; }
    users[form.email] = { password: form.password, profileDone: false };
    localStorage.setItem("edu_users", JSON.stringify(users));
    onLogin({ email: form.email, profileDone: false });
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f2848 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "2rem 2.5rem", width: "100%", maxWidth: 420, boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src={LOGO_URL} alt="EduAlert" style={{ height: 150, objectFit: "contain" }} />
        </div>
        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, marginBottom: 24, padding: 4 }}>
          {["login", "register"].map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(""); setMsg(""); }} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 8, background: tab === t ? "#fff" : "transparent", fontWeight: tab === t ? 700 : 400, color: tab === t ? "#1e40af" : "#64748b", cursor: "pointer", fontSize: 14, transition: "all .2s" }}>
              {t === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {error && <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        {msg && <div style={{ background: "#d1fae5", color: "#065f46", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{msg}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Email address" value={form.email} onChange={set("email")} style={inputStyle} type="email" />

          {tab === "register" && (
            <>
              {!otpSent ? (
                <button onClick={sendOTP} disabled={loading} style={btnOutline}>
                  {loading ? "Sending…" : "Send OTP to Email"}
                </button>
              ) : !otpVerified ? (
                <>
                  <input placeholder="Enter 6-digit OTP" value={form.otp} onChange={set("otp")} style={inputStyle} maxLength={6} />
                  <button onClick={verifyOTP} style={btnOutline}>Verify OTP</button>
                </>
              ) : null}
            </>
          )}

          <input placeholder="Password" value={form.password} onChange={set("password")} style={inputStyle} type="password" />

          <button onClick={tab === "login" ? handleLogin : handleRegister} style={btnPrimary}>
            {tab === "login" ? "Sign In" : "Create Account"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          <button onClick={() => setMsg("Google login: configure OAuth in production.")} style={{ ...btnOutline, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

// PROFILE SETUP
function ProfileSetup({ user, onDone }) {
  const [form, setForm] = useState({ name: "", qualification: "", course: "", age: "", category: "General", state: "", exams: [] });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleExam = (ex) => setForm((f) => ({ ...f, exams: f.exams.includes(ex) ? f.exams.filter((x) => x !== ex) : [...f.exams, ex] }));

  function save() {
    if (!form.name || !form.qualification || !form.state) { alert("Please fill required fields."); return; }
    const users = JSON.parse(localStorage.getItem("edu_users") || "{}");
    users[user.email] = { ...users[user.email], ...form, profileDone: true };
    localStorage.setItem("edu_users", JSON.stringify(users));
    onDone({ ...user, ...form, profileDone: true });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "2rem 2.5rem", width: "100%", maxWidth: 540, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src={LOGO_URL} alt="EduAlert" style={{ height: 150, objectFit: "contain", marginBottom: 8 }} />
          <h2 style={{ margin: 0, fontSize: 22, color: "#0f172a", fontWeight: 700 }}>Complete Your Profile</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>Help us personalize opportunities for you</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Full Name *" value={form.name} onChange={set("name")} style={inputStyle} />
          <select value={form.qualification} onChange={set("qualification")} style={inputStyle}>
            <option value="">Educational Qualification *</option>
            {["10th", "12th", "Diploma", "UG","UG (Graduated)", "PG","PG (Graduated)", "PhD"].map((q) => <option key={q}>{q}</option>)}
          </select>
          <input placeholder="Course / Field of Study" value={form.course} onChange={set("course")} style={inputStyle} />
          <div style={{ display: "flex", gap: 10 }}>
            <input placeholder="Age" value={form.age} onChange={set("age")} style={{ ...inputStyle, flex: 1 }} type="number" min={14} max={60} />
            <select value={form.category} onChange={set("category")} style={{ ...inputStyle, flex: 2 }}>
              {["General", "OBC", "SC", "ST", "EWS"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <select value={form.state} onChange={set("state")} style={inputStyle}>
            <option value="">Select State *</option>
            {["Tamil Nadu", "Maharashtra", "Delhi", "Karnataka", "Kerala", "Uttar Pradesh", "West Bengal", "Rajasthan", "Gujarat", "Andhra Pradesh", "Telangana", "Bihar", "Other"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#374151" }}>Exam Interests</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXAM_INTERESTS.map((ex) => (
                <button key={ex} onClick={() => toggleExam(ex)} style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${form.exams.includes(ex) ? "#1d4ed8" : "#cbd5e1"}`, background: form.exams.includes(ex) ? "#dbeafe" : "#fff", color: form.exams.includes(ex) ? "#1d4ed8" : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <button onClick={save} style={btnPrimary}>Save & Continue →</button>
        </div>
      </div>
    </div>
  );
}

// MAIN APP SHELL
function AppShell({ user, onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [alerts, setAlerts] = useState(() => JSON.parse(localStorage.getItem(`edu_alerts_${user.email}`) || "[]"));
  const [notifications, setNotifications] = useState([]);

  const saveAlerts = (arr) => { setAlerts(arr); localStorage.setItem(`edu_alerts_${user.email}`, JSON.stringify(arr)); };

  // Generate notifications from alerts
  useEffect(() => {
    const notifs = alerts.filter(a => !a.completed).map(a => {
      const days = daysLeft(a.date);
      let msg = "";
      if (days < 0) msg = `"${a.title}" deadline has passed.`;
      else if (days === 0) msg = `🔔 TODAY is the deadline for "${a.title}"!`;
      else if (days <= 5) msg = `⚡ Only ${days} day(s) left for "${a.title}"!`;
      else msg = `📅 ${days} days until "${a.title}"`;
      return { id: a.id, msg, days, title: a.title };
    }).sort((a, b) => a.days - b.days);
    setNotifications(notifs);
  }, [alerts]);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "calendar", label: "My Alerts", icon: "📅" },
    { id: "opportunities", label: "Opportunities", icon: "🎯" },
    { id: "notifications", label: "Notifications", icon: "🔔", badge: notifications.filter(n => n.days >= 0 && n.days <= 5).length },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 230, background: "#0f172a", display: "flex", flexDirection: "column", padding: "0 0 16px" }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #1e293b" }}>
          <img src={LOGO_URL} alt="EduAlert" style={{ height: 150, objectFit: "contain", filter: "brightness(1.1)" }} />
        </div>
        <div style={{ padding: "8px 10px", flex: 1 }}>
          {navItems.map((n) => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 12px", border: "none", borderRadius: 10, background: page === n.id ? "#1d4ed8" : "transparent", color: page === n.id ? "#fff" : "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: page === n.id ? 700 : 500, marginBottom: 2, textAlign: "left", transition: "all .15s" }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
              {n.badge > 0 && <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{n.badge}</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: "0 10px" }}>
          <div style={{ padding: "12px", background: "#1e293b", borderRadius: 10, marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Logged in as</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#e2e8f0", fontWeight: 600, wordBreak: "break-all" }}>{user.name || user.email}</p>
          </div>
          <button onClick={onLogout} style={{ width: "100%", padding: "9px", border: "1px solid #334155", borderRadius: 8, background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>Sign Out</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {page === "dashboard" && <DashboardHome user={user} alerts={alerts} notifications={notifications} setPage={setPage} />}
        {page === "calendar" && <CalendarPage alerts={alerts} saveAlerts={saveAlerts} />}
        {page === "opportunities" && <OpportunitiesPage user={user} alerts={alerts} saveAlerts={saveAlerts} />}
        {page === "notifications" && <NotificationsPage notifications={notifications} alerts={alerts} saveAlerts={saveAlerts} />}
      </div>
    </div>
  );
}

// DASHBOARD HOME
function DashboardHome({ user, alerts, notifications, setPage }) {
  const activeAlerts = alerts.filter(a => !a.completed);
  const urgent = activeAlerts.filter(a => daysLeft(a.date) <= 5 && daysLeft(a.date) >= 0);
  const upcoming = activeAlerts.filter(a => daysLeft(a.date) > 5).length;
  const completed = alerts.filter(a => a.completed).length;

  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#0f172a" }}>Welcome back, {user.name || "Student"}! 👋</h1>
        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Active Alerts", value: activeAlerts.length, color: "#1d4ed8", bg: "#dbeafe" },
          { label: "Urgent (≤5 days)", value: urgent.length, color: "#dc2626", bg: "#fee2e2" },
          { label: "Upcoming", value: upcoming, color: "#059669", bg: "#d1fae5" },
          { label: "Completed", value: completed, color: "#7c3aed", bg: "#ede9fe" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Urgent alerts */}
      {urgent.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "#dc2626" }}>⚡ Urgent Deadlines</h3>
          {urgent.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fff5f5", borderRadius: 10, marginBottom: 8, border: "1px solid #fecaca" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{a.title}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{a.date} · {a.category}</div>
              </div>
              <CountdownBadge endDate={a.date} />
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div onClick={() => setPage("opportunities")} style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", borderRadius: 16, padding: "22px 24px", cursor: "pointer", color: "#fff" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Browse Opportunities</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Scholarships, Exams, Internships</div>
        </div>
        <div onClick={() => setPage("calendar")} style={{ background: "linear-gradient(135deg,#059669,#10b981)", borderRadius: 16, padding: "22px 24px", cursor: "pointer", color: "#fff" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>My Alert Calendar</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>View & manage your deadlines</div>
        </div>
      </div>
    </div>
  );
}

// CALENDAR PAGE
function CalendarPage({ alerts, saveAlerts }) {
  const [view, setView] = useState("calendar");
  const [month, setMonth] = useState(TODAY.getMonth());
  const [year, setYear] = useState(TODAY.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editAlert, setEditAlert] = useState(null);
  const [form, setForm] = useState({ title: "", date: "", category: "Exam", note: "" });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function openAdd(date = "") { setEditAlert(null); setForm({ title: "", date, category: "Exam", note: "" }); setShowForm(true); }
  function openEdit(a) { setEditAlert(a); setForm({ title: a.title, date: a.date, category: a.category, note: a.note || "" }); setShowForm(true); }

  function saveAlert() {
    if (!form.title || !form.date) { alert("Title and date required."); return; }
    if (editAlert) {
      saveAlerts(alerts.map(a => a.id === editAlert.id ? { ...a, ...form } : a));
    } else {
      saveAlerts([...alerts, { id: Date.now(), ...form, completed: false, createdAt: fmt(TODAY) }]);
    }
    setShowForm(false);
  }

  function deleteAlert(id) { if (window.confirm("Delete this alert?")) saveAlerts(alerts.filter(a => a.id !== id)); }
  function toggleComplete(id) { saveAlerts(alerts.map(a => a.id === id ? { ...a, completed: !a.completed } : a)); }

  const alertsByDate = {};
  alerts.forEach(a => { if (!alertsByDate[a.date]) alertsByDate[a.date] = []; alertsByDate[a.date].push(a); });

  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0f172a" }}>📅 My Alert Calendar</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setView(view === "calendar" ? "list" : "calendar")} style={btnOutline}>{view === "calendar" ? "List View" : "Calendar View"}</button>
          <button onClick={() => openAdd()} style={btnPrimary}>+ Add Alert</button>
        </div>
      </div>

      {view === "calendar" ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }} style={{ ...btnOutline, padding: "6px 14px" }}>←</button>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: 18, color: "#0f172a" }}>{monthNames[month]} {year}</h3>
            <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }} style={{ ...btnOutline, padding: "6px 14px" }}>→</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#94a3b8", padding: "8px 0" }}>{d}</div>
            ))}
            {Array(firstDay).fill(null).map((_, i) => <div key={"e"+i} />)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isToday = dateStr === fmt(TODAY);
              const dayAlerts = alertsByDate[dateStr] || [];
              return (
                <div key={day} onClick={() => openAdd(dateStr)} style={{ minHeight: 70, background: isToday ? "#dbeafe" : "#f8fafc", borderRadius: 8, padding: 6, cursor: "pointer", border: isToday ? "2px solid #1d4ed8" : "1px solid #e2e8f0", transition: "background .15s" }}>
                  <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: isToday ? "#1d4ed8" : "#374151", marginBottom: 3 }}>{day}</div>
                  {dayAlerts.slice(0, 2).map(a => (
                    <div key={a.id} onClick={(e) => { e.stopPropagation(); openEdit(a); }} style={{ fontSize: 10, background: EVENT_CAT_COLORS[a.category] + "22", color: EVENT_CAT_COLORS[a.category], borderRadius: 4, padding: "1px 4px", marginBottom: 2, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {a.completed ? "✓ " : ""}{a.title}
                    </div>
                  ))}
                  {dayAlerts.length > 2 && <div style={{ fontSize: 9, color: "#94a3b8" }}>+{dayAlerts.length - 2} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {alerts.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>No alerts yet. Add your first alert!</div> :
            alerts.sort((a, b) => a.date.localeCompare(b.date)).map(a => (
              <div key={a.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 14, opacity: a.completed ? 0.6 : 1 }}>
                <div style={{ width: 6, height: 48, borderRadius: 4, background: EVENT_CAT_COLORS[a.category] }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", textDecoration: a.completed ? "line-through" : "none" }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{a.date} · {a.category}</div>
                </div>
                <CountdownBadge endDate={a.date} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => toggleComplete(a.id)} style={{ ...btnOutline, padding: "4px 10px", fontSize: 12 }}>{a.completed ? "Undo" : "✓ Done"}</button>
                  <button onClick={() => openEdit(a)} style={{ ...btnOutline, padding: "4px 10px", fontSize: 12 }}>Edit</button>
                  <button onClick={() => deleteAlert(a.id)} style={{ ...btnOutline, padding: "4px 10px", fontSize: 12, color: "#dc2626", borderColor: "#fca5a5" }}>Del</button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Alert Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>{editAlert ? "Edit Alert" : "Add New Alert"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Event title *" value={form.title} onChange={set("title")} style={inputStyle} />
              <input type="date" value={form.date} onChange={set("date")} style={inputStyle} />
              <select value={form.category} onChange={set("category")} style={inputStyle}>
                {EVENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <textarea placeholder="Note (optional)" value={form.note} onChange={set("note")} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowForm(false)} style={{ ...btnOutline, flex: 1 }}>Cancel</button>
                <button onClick={saveAlert} style={{ ...btnPrimary, flex: 1 }}>Save Alert</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// OPPORTUNITIES PAGE
function OpportunitiesPage({ user, alerts, saveAlerts }) {
  const [activeType, setActiveType] = useState("All");
  const [search, setSearch] = useState("");
  const [converted, setConverted] = useState({});

  // Filter: only show opportunities whose endDate >= today
  const visible = OPPORTUNITIES.filter(op => {
    const endOk = new Date(op.endDate) >= TODAY;
    const typeOk = activeType === "All" || op.type === activeType;
    const searchOk = !search || op.title.toLowerCase().includes(search.toLowerCase()) || op.description.toLowerCase().includes(search.toLowerCase());
    return endOk && typeOk && searchOk;
  });

  function convertToAlert(op) {
    if (alerts.find(a => a.title === op.title)) { alert("Already in your alerts!"); return; }
    const newAlert = { id: Date.now(), title: op.title, date: op.endDate, category: op.type === "Government Exam" ? "Exam" : op.type === "Scholarship" ? "Scholarship" : op.type === "Internship" ? "Internship" : "Exam", note: op.description, completed: false, createdAt: fmt(TODAY) };
    saveAlerts([...alerts, newAlert]);
    setConverted(c => ({ ...c, [op.id]: true }));
  }

  const alreadyAdded = (op) => !!alerts.find(a => a.title === op.title);

  return (
    <div style={{ padding: "28px 32px" }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>🎯 Verified Opportunities</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input placeholder="Search opportunities…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 240 }} />
        {["All", ...CATEGORIES].map(t => (
          <button key={t} onClick={() => setActiveType(t)} style={{ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${activeType === t ? "#1d4ed8" : "#cbd5e1"}`, background: activeType === t ? "#1d4ed8" : "#fff", color: activeType === t ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {t}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>No active opportunities found in this category.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {visible.map(op => (
            <div key={op.id} style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <Badge type={op.type} />
                  <h3 style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{op.title}</h3>
                </div>
                <CountdownBadge endDate={op.endDate} />
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{op.description}</p>
              <div style={{ fontSize: 12, color: "#374151" }}>
                <span style={{ fontWeight: 600 }}>Eligibility:</span> {op.eligibility}
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#64748b" }}>
                <span>📅 Start: {op.startDate}</span>
                <span>⏰ End: {op.endDate}</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <a href={op.link} target="_blank" rel="noreferrer" style={{ ...btnOutline, textDecoration: "none", padding: "7px 14px", fontSize: 13 }}>🔗 Official Site</a>
                <button onClick={() => convertToAlert(op)} disabled={alreadyAdded(op) || converted[op.id]} style={{ ...btnPrimary, flex: 1, fontSize: 13, opacity: (alreadyAdded(op) || converted[op.id]) ? 0.6 : 1 }}>
                  {alreadyAdded(op) || converted[op.id] ? "✓ Alert Added" : "🔔 Convert to Alert"}
                </button>
              </div>
              {converted[op.id] && <div style={{ background: "#d1fae5", color: "#065f46", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>✅ Deadline added to your calendar with daily reminders!</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// NOTIFICATIONS PAGE
function NotificationsPage({ notifications, alerts, saveAlerts }) {
  function markDone(id) { saveAlerts(alerts.map(a => a.id === id ? { ...a, completed: true } : a)); }

  return (
    <div style={{ padding: "28px 32px" }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>🔔 Notifications & Reminders</h1>
      {notifications.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔕</div>
          <div>No active reminders. Add some alerts to get started!</div>
        </div>
      ) : (
        <div>
          {notifications.map(n => {
            const isUrgent = n.days >= 0 && n.days <= 5;
            const isOver = n.days < 0;
            return (
              <div key={n.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1.5px solid ${isUrgent ? "#fca5a5" : isOver ? "#e2e8f0" : "#e2e8f0"}`, display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: isUrgent ? "#fee2e2" : isOver ? "#f1f5f9" : "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {isOver ? "⏰" : isUrgent ? "⚡" : "🔔"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{n.msg}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Daily reminder active until completed</div>
                </div>
                {!isOver && (
                  <button onClick={() => markDone(n.id)} style={{ ...btnOutline, padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" }}>Mark Done</button>
                )}
              </div>
            );
          })}
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "14px 18px", marginTop: 20 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#166534", fontWeight: 600 }}>💡 How notifications work</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#166534", opacity: 0.8 }}>You receive daily reminders for all active alerts. Frequency increases as the deadline approaches. Reminders stop when you mark an event as completed.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputStyle = { padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, color: "#0f172a", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" };
const btnPrimary = { padding: "11px 20px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "inherit" };
const btnOutline = { padding: "9px 18px", background: "#fff", color: "#374151", border: "1.5px solid #e2e8f0", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: "inherit" };

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("edu_session");
    if (saved) { const u = JSON.parse(saved); const users = JSON.parse(localStorage.getItem("edu_users") || "{}"); if (users[u.email]) setUser({ ...u, ...users[u.email] }); }
  }, []);

  function onLogin(u) { setUser(u); localStorage.setItem("edu_session", JSON.stringify({ email: u.email })); }
  function onLogout() { setUser(null); localStorage.removeItem("edu_session"); }

  if (!user) return <AuthPage onLogin={onLogin} />;
  if (!user.profileDone) return <ProfileSetup user={user} onDone={(u) => { setUser(u); localStorage.setItem("edu_session", JSON.stringify({ email: u.email })); }} />;
  return <AppShell user={user} onLogout={onLogout} />;
}
