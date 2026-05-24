const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

function loadLocalEnvFile() {
  const envFilePath = path.join(__dirname, ".env");

  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const envFileContent = fs.readFileSync(envFilePath, "utf8");

  for (const rawLine of envFileContent.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadLocalEnvFile();

const {
  DISCIPLINE_LABELS,
  buildAssessmentArtifacts,
  buildAssessmentArtifactsFromAnalysis,
  completeChallenge,
  historyEntryFromAssessment,
  intakeForClient,
  profileDefaultsFromIntake,
  sanitizeIntake,
  safeText
} = require("./lib/assessment");
const { generateAiReview, isAiReviewConfigured } = require("./lib/ai-review");
const { buildDemoReviewState } = require("./lib/demo-review");

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DB_FILE = process.env.VERCEL
  ? path.join("/tmp", "talent-thread.db")
  : path.join(DATA_DIR, "talent-thread.db");
const SESSION_COOKIE = "tt_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SHORT_SESSION_MAX_AGE = 60 * 60 * 12;
const PASSWORD_MIN_LENGTH = 8;
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_LOCK_MINUTES = 15;
const FREE_ANALYSIS_LIMIT = 3;
const FREE_ACTIVE_APPLICATION_LIMIT = 10;
const FREE_ACTIVE_JOB_LIMIT = 3;
const DEV_ADMIN_EMAIL = process.env.TT_ADMIN_EMAIL || "admin@talentthread.local";
const DEV_ADMIN_PASSWORD = process.env.TT_ADMIN_PASSWORD || "TalentThread@123";
const ROUTE_FILE_MAP = {
  "/admin": "admin.html",
  "/contracts": "contracts.html",
  "/dashboard": "designer-dashboard.html",
  "/designers": "designers.html",
  "/login": "login.html",
  "/register": "signup.html",
  "/client-dashboard": "client-dashboard.html",
  "/find-work": "find-work.html",
  "/my-applications": "my-applications.html",
  "/reset-password": "reset-password.html"
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);

function addColumnIfMissing(tableName, columnName, sql) {
  const columns = new Set(
    db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name)
  );

  if (!columns.has(columnName)) {
    db.exec(sql);
  }
}

function createSchema() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('designer', 'client', 'admin')),
      username TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT 'free',
      email_verified_at TEXT NOT NULL DEFAULT '',
      failed_login_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users_legacy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS designer_profiles (
      user_id INTEGER PRIMARY KEY,
      discipline TEXT NOT NULL,
      experience TEXT NOT NULL,
      goals_json TEXT NOT NULL,
      notes TEXT NOT NULL,
      portfolio_link TEXT NOT NULL,
      project_count INTEGER NOT NULL,
      tools_json TEXT NOT NULL,
      skills_json TEXT NOT NULL DEFAULT '[]',
      links_json TEXT NOT NULL DEFAULT '[]',
      challenge_preference TEXT NOT NULL,
      headline TEXT NOT NULL,
      bio TEXT NOT NULL,
      profile_image TEXT NOT NULL DEFAULT '',
      full_name TEXT NOT NULL DEFAULT '',
      about_text TEXT NOT NULL DEFAULT '',
      projects_text TEXT NOT NULL DEFAULT '',
      payment_details TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL,
      preferred_rate TEXT NOT NULL,
      availability TEXT NOT NULL,
      profile_completeness INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      intake_json TEXT NOT NULL,
      assessment_json TEXT NOT NULL,
      challenges_json TEXT NOT NULL,
      progress_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS client_profiles (
      user_id INTEGER PRIMARY KEY,
      company_name TEXT NOT NULL,
      industry TEXT NOT NULL,
      website TEXT NOT NULL,
      typical_budget TEXT NOT NULL,
      company_logo TEXT NOT NULL DEFAULT '',
      design_needs_json TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      budget TEXT NOT NULL,
      budget_type TEXT NOT NULL DEFAULT 'fixed',
      budget_min INTEGER NOT NULL DEFAULT 0,
      budget_max INTEGER NOT NULL DEFAULT 0,
      duration TEXT NOT NULL,
      mode TEXT NOT NULL,
      discipline TEXT NOT NULL,
      experience_level TEXT NOT NULL DEFAULT 'mid',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      deadline_text TEXT NOT NULL DEFAULT '',
      skills_json TEXT NOT NULL,
      applications_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      FOREIGN KEY(client_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      designer_user_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(designer_user_id, project_id),
      FOREIGN KEY(designer_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      designer_user_id INTEGER NOT NULL,
      cover_note TEXT NOT NULL,
      proposed_rate TEXT NOT NULL DEFAULT '',
      estimated_timeline TEXT NOT NULL DEFAULT '',
      ai_score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'applied',
      created_at TEXT NOT NULL,
      UNIQUE(project_id, designer_user_id),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(designer_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS portfolio_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      tools_json TEXT NOT NULL DEFAULT '[]',
      case_study_link TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      application_id INTEGER NOT NULL UNIQUE,
      client_user_id INTEGER NOT NULL,
      designer_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT '',
      total_value INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE,
      FOREIGN KEY(client_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(designer_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      amount INTEGER NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      revision_count INTEGER NOT NULL DEFAULT 0,
      deliverables_note TEXT NOT NULL DEFAULT '',
      submitted_at TEXT NOT NULL DEFAULT '',
      funded_at TEXT NOT NULL DEFAULT '',
      approved_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deliverables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      milestone_id INTEGER NOT NULL,
      designer_user_id INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      files_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY(milestone_id) REFERENCES milestones(id) ON DELETE CASCADE,
      FOREIGN KEY(designer_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      sender_user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      milestone_id INTEGER NOT NULL UNIQUE,
      client_user_id INTEGER NOT NULL,
      designer_user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      platform_fee INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'created',
      provider TEXT NOT NULL DEFAULT 'razorpay-test',
      provider_reference TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      released_at TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
      FOREIGN KEY(milestone_id) REFERENCES milestones(id) ON DELETE CASCADE,
      FOREIGN KEY(client_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(designer_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      milestone_id INTEGER NOT NULL,
      opened_by_user_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      resolution TEXT NOT NULL DEFAULT '',
      resolution_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      resolved_at TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
      FOREIGN KEY(milestone_id) REFERENCES milestones(id) ON DELETE CASCADE,
      FOREIGN KEY(opened_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL DEFAULT 0,
      detail_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  addColumnIfMissing("users", "username", "ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("users", "plan", "ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
  addColumnIfMissing("users", "email_verified_at", "ALTER TABLE users ADD COLUMN email_verified_at TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("users", "failed_login_count", "ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "locked_until", "ALTER TABLE users ADD COLUMN locked_until TEXT NOT NULL DEFAULT ''");

  addColumnIfMissing("designer_profiles", "skills_json", "ALTER TABLE designer_profiles ADD COLUMN skills_json TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing("designer_profiles", "links_json", "ALTER TABLE designer_profiles ADD COLUMN links_json TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing("designer_profiles", "profile_completeness", "ALTER TABLE designer_profiles ADD COLUMN profile_completeness INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("designer_profiles", "profile_image", "ALTER TABLE designer_profiles ADD COLUMN profile_image TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("designer_profiles", "full_name", "ALTER TABLE designer_profiles ADD COLUMN full_name TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("designer_profiles", "about_text", "ALTER TABLE designer_profiles ADD COLUMN about_text TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("designer_profiles", "projects_text", "ALTER TABLE designer_profiles ADD COLUMN projects_text TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("designer_profiles", "payment_details", "ALTER TABLE designer_profiles ADD COLUMN payment_details TEXT NOT NULL DEFAULT ''");

  addColumnIfMissing("client_profiles", "company_logo", "ALTER TABLE client_profiles ADD COLUMN company_logo TEXT NOT NULL DEFAULT ''");

  addColumnIfMissing("projects", "budget_type", "ALTER TABLE projects ADD COLUMN budget_type TEXT NOT NULL DEFAULT 'fixed'");
  addColumnIfMissing("projects", "budget_min", "ALTER TABLE projects ADD COLUMN budget_min INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("projects", "budget_max", "ALTER TABLE projects ADD COLUMN budget_max INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("projects", "experience_level", "ALTER TABLE projects ADD COLUMN experience_level TEXT NOT NULL DEFAULT 'mid'");
  addColumnIfMissing("projects", "attachments_json", "ALTER TABLE projects ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing("projects", "deadline_text", "ALTER TABLE projects ADD COLUMN deadline_text TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("projects", "applications_count", "ALTER TABLE projects ADD COLUMN applications_count INTEGER NOT NULL DEFAULT 0");

  addColumnIfMissing("applications", "proposed_rate", "ALTER TABLE applications ADD COLUMN proposed_rate TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("applications", "estimated_timeline", "ALTER TABLE applications ADD COLUMN estimated_timeline TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("applications", "ai_score", "ALTER TABLE applications ADD COLUMN ai_score INTEGER NOT NULL DEFAULT 0");

  db.exec(`
    INSERT OR IGNORE INTO users_legacy (id, name, email, password_hash, role, created_at)
    SELECT id, name, email, password_hash, role, created_at FROM users;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
    ON users(username)
    WHERE username <> '';

    CREATE INDEX IF NOT EXISTS idx_projects_client_status
    ON projects(client_user_id, status);

    CREATE INDEX IF NOT EXISTS idx_applications_project
    ON applications(project_id);

    CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(user_id, is_read, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_contracts_designer
    ON contracts(designer_user_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_contracts_client
    ON contracts(client_user_id, updated_at DESC);
  `);
}

createSchema();

function nowIso() {
  return new Date().toISOString();
}

function isoAfterMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function isoAfterDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isFutureIso(value) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function jsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function jsonStringify(value) {
  return JSON.stringify(value ?? null);
}

function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || "").split(":");
  if (!salt || !hash) {
    return false;
  }

  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function validatePassword(password) {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function slugify(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function uniqueUsername(baseValue, excludedUserId = 0) {
  const base = slugify(baseValue) || `member-${crypto.randomBytes(3).toString("hex")}`;
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = db.prepare(
      "SELECT id FROM users WHERE username = ? AND id != ?"
    ).get(candidate, excludedUserId);

    if (!existing) {
      return candidate;
    }

    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

function ensureUsernames() {
  const users = db.prepare("SELECT id, name, email, username FROM users").all();
  users.forEach((user) => {
    if (!safeText(user.username)) {
      const username = uniqueUsername(user.name || user.email, user.id);
      db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, user.id);
    }
  });
}

function ensureAdminUser() {
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existing) {
    db.prepare(`
      INSERT OR IGNORE INTO users_legacy (id, name, email, password_hash, role, created_at)
      SELECT id, name, email, password_hash, role, created_at
      FROM users
      WHERE id = ?
    `).run(existing.id);
    return;
  }

  const createdAt = nowIso();
  const username = uniqueUsername("talent-thread-admin");
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, username, plan, email_verified_at, created_at)
    VALUES (?, ?, ?, 'admin', ?, 'pro', ?, ?)
  `).run(
    "Talent Thread Admin",
    DEV_ADMIN_EMAIL,
    hashPassword(DEV_ADMIN_PASSWORD),
    username,
    createdAt,
    createdAt
  );
  const adminId = Number(db.prepare("SELECT id FROM users WHERE email = ?").get(DEV_ADMIN_EMAIL)?.id || 0);
  if (adminId) {
    db.prepare(`
      INSERT OR IGNORE INTO users_legacy (id, name, email, password_hash, role, created_at)
      SELECT id, name, email, password_hash, role, created_at
      FROM users
      WHERE id = ?
    `).run(adminId);
  }
}

function createSession(userId, rememberSession = true) {
  const maxAge = rememberSession ? SESSION_MAX_AGE : SHORT_SESSION_MAX_AGE;
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare(`
    INSERT INTO sessions (user_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(
    userId,
    hashSessionToken(token),
    nowIso(),
    new Date(Date.now() + maxAge * 1000).toISOString()
  );
  return { maxAge, token };
}

function clearExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
}

ensureUsernames();
ensureAdminUser();

function parseCookies(request) {
  const header = request.headers.cookie || "";
  return header
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const [key, ...rest] = item.split("=");
      accumulator[key] = decodeURIComponent(rest.join("="));
      return accumulator;
    }, {});
}

function sessionCookie(token, maxAge = SESSION_MAX_AGE) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function sanitizeEmail(value) {
  return safeText(value).toLowerCase();
}

function sanitizeRole(value) {
  if (value === "admin") {
    return "admin";
  }
  if (value === "client") {
    return "client";
  }
  return "designer";
}

function parseSkills(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => safeText(item)).filter(Boolean))];
  }

  return [...new Set(
    String(value || "")
      .split(/,|\n/)
      .map((item) => safeText(item))
      .filter(Boolean)
  )];
}

function parseLinks(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/,|\n/);
  return raw
    .map((item) => {
      if (typeof item === "string") {
        return { label: "Link", url: safeText(item) };
      }

      return {
        label: safeText(item?.label, "Link"),
        url: safeText(item?.url)
      };
    })
    .filter((item) => item.url);
}

function parseCurrencyValue(value) {
  const numbers = String(value || "").match(/\d[\d,]*/g);
  if (!numbers?.length) {
    return 0;
  }

  return Number(numbers[0].replace(/,/g, "")) || 0;
}

function parseBudgetRange(label) {
  const numbers = String(label || "").match(/\d[\d,]*/g);
  if (!numbers?.length) {
    return { max: 0, min: 0 };
  }

  const values = numbers.map((item) => Number(item.replace(/,/g, "")) || 0);
  return {
    max: values.length > 1 ? values[1] : values[0],
    min: values[0]
  };
}

function formatCurrencyRange(min, max, type = "fixed") {
  if (!min && !max) {
    return type === "hourly" ? "Rate on request /hr" : "Budget on request";
  }

  const prefix = type === "hourly" ? "/hr" : "";
  if (!max || min === max) {
    return `Rs ${min.toLocaleString("en-IN")}${prefix}`;
  }

  return `Rs ${min.toLocaleString("en-IN")} - Rs ${max.toLocaleString("en-IN")}${prefix}`;
}

function sanitizeProjectInput(payload = {}) {
  const discipline = Object.prototype.hasOwnProperty.call(DISCIPLINE_LABELS, payload.discipline)
    ? payload.discipline
    : "uiux";
  const budgetType = safeText(payload.budgetType || payload.budget_type, "fixed").toLowerCase() === "hourly"
    ? "hourly"
    : "fixed";
  const explicitMin = Number(payload.budgetMin ?? payload.budget_min);
  const explicitMax = Number(payload.budgetMax ?? payload.budget_max);
  const inferredRange = parseBudgetRange(payload.budget);
  const budgetMin = Number.isFinite(explicitMin) && explicitMin > 0 ? explicitMin : inferredRange.min;
  const budgetMax = Number.isFinite(explicitMax) && explicitMax > 0 ? explicitMax : inferredRange.max;
  const budget = safeText(payload.budget, formatCurrencyRange(budgetMin, budgetMax, budgetType));

  return {
    attachments: Array.isArray(payload.attachments) ? payload.attachments.map((item) => safeText(item)).filter(Boolean) : [],
    budget,
    budgetMax,
    budgetMin,
    budgetType,
    deadlineText: safeText(payload.deadlineText || payload.deadline_text),
    discipline,
    duration: safeText(payload.duration),
    experienceLevel: safeText(payload.experienceLevel || payload.experience_level || "mid"),
    mode: safeText(payload.mode, "Remote"),
    skills: parseSkills(payload.skills),
    summary: safeText(payload.summary),
    title: safeText(payload.title)
  };
}

// Serialize a raw project DB row into the public-facing project shape
function mapProjectRow(row) {
  return {
    applied: false,
    applicationStatus: null,
    applicationsCount: Number(row.applications_count || 0),
    attachments: jsonParse(row.attachments_json, []),
    budget: row.budget,
    budgetMax: Number(row.budget_max || 0),
    budgetMin: Number(row.budget_min || 0),
    budgetType: row.budget_type || "fixed",
    clientName: row.client_name || row.company_name || "Client",
    clientUsername: row.client_username || "",
    companyName: row.company_name || null,
    deadlineText: row.deadline_text || "",
    createdAt: row.created_at,
    discipline: row.discipline,
    duration: row.duration,
    experienceLevel: row.experience_level || "mid",
    id: row.id,
    mode: row.mode,
    saved: false,
    skills: jsonParse(row.skills_json, []),
    status: row.status,
    summary: row.summary,
    title: row.title
  };
}


function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    ...extraHeaders
  });
  response.end(payload);
}

async function parseBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        const error = new Error("Payload too large");
        error.statusCode = 413;
        reject(error);
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        const parseError = new Error("Invalid JSON payload");
        parseError.statusCode = 400;
        reject(parseError);
      }
    });

    request.on("error", reject);
  });
}

async function serveStatic(request, response, pathnameOverride = "") {
  const rawPath = pathnameOverride || decodeURIComponent((request.url || "/").split("?")[0]);
  const requestPath = (() => {
    if (rawPath === "/") {
      return "/index.html";
    }
    if (ROUTE_FILE_MAP[rawPath]) {
      return `/${ROUTE_FILE_MAP[rawPath]}`;
    }
    if (/^\/designers\/[^/]+$/.test(rawPath)) {
      return "/designer-public.html";
    }
    return rawPath;
  })();
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const content = await fsp.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
    });
    response.end(content);
  } catch (error) {
    sendText(response, 404, "Not found");
  }
}

function getCurrentUser(request) {
  clearExpiredSessions();
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) {
    return null;
  }

  return db.prepare(`
    SELECT users.id, users.name, users.email, users.role, users.username, users.plan
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(hashSessionToken(token), nowIso()) || null;
}

function requireUser(request) {
  const user = getCurrentUser(request);
  if (!user) {
    const error = new Error("Please log in to continue.");
    error.statusCode = 401;
    throw error;
  }
  return user;
}

function requireRole(request, role) {
  const user = requireUser(request);
  if (user.role !== role) {
    const error = new Error(`This area is only available to ${role}s.`);
    error.statusCode = 403;
    throw error;
  }
  return user;
}

function requireAnyRole(request, roles) {
  const user = requireUser(request);
  if (!roles.includes(user.role)) {
    const error = new Error("You do not have access to this area.");
    error.statusCode = 403;
    throw error;
  }
  return user;
}

function getDesignerProfileRow(userId) {
  return db.prepare("SELECT * FROM designer_profiles WHERE user_id = ?").get(userId) || null;
}

function getPortfolioItems(userId) {
  return db.prepare(`
    SELECT * FROM portfolio_items
    WHERE user_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(userId).map((row) => ({
    caseStudyLink: row.case_study_link || "",
    category: row.category || "",
    createdAt: row.created_at,
    description: row.description || "",
    id: row.id,
    imageUrl: row.image_url || "",
    title: row.title,
    tools: jsonParse(row.tools_json, [])
  }));
}

function mapDesignerProfile(row, user) {
  if (!row) {
    return null;
  }

  return {
    availability: row.availability,
    about: row.about_text || row.bio,
    bio: row.bio,
    challengePreference: row.challenge_preference,
    city: row.city,
    discipline: row.discipline,
    email: user.email,
    experience: row.experience,
    fullName: row.full_name || user.name,
    goals: jsonParse(row.goals_json, []),
    headline: row.headline,
    links: jsonParse(row.links_json, []),
    name: user.name,
    notes: row.notes,
    portfolioLink: row.portfolio_link,
    preferredRate: row.preferred_rate,
    profileCompleteness: Number(row.profile_completeness || 0),
    profileImage: row.profile_image || "",
    projectsInfo: row.projects_text || "",
    projectCount: row.project_count,
    role: user.role,
    skills: jsonParse(row.skills_json, []),
    tools: jsonParse(row.tools_json, []),
    username: user.username,
    userId: user.id
  };
}

function createDesignerProfileDraft(user, existingProfile = null) {
  return {
    availability: safeText(existingProfile?.availability, "Open to freelance"),
    about: safeText(existingProfile?.about, `${user.name} is building a complete Talent Thread profile.`),
    bio: safeText(existingProfile?.bio, "Add your background, skills, and the kind of work you want to do."),
    challengePreference: safeText(existingProfile?.challengePreference, "weekly_project"),
    city: safeText(existingProfile?.city, "India"),
    discipline: safeText(existingProfile?.discipline, "uiux"),
    email: user.email,
    experience: safeText(existingProfile?.experience, "graduate"),
    fullName: safeText(existingProfile?.fullName, user.name),
    goals: Array.isArray(existingProfile?.goals) ? existingProfile.goals : [],
    headline: safeText(existingProfile?.headline, "Designer building a clear and trusted profile"),
    links: Array.isArray(existingProfile?.links) ? existingProfile.links : [],
    name: user.name,
    notes: safeText(existingProfile?.notes),
    portfolioLink: safeText(existingProfile?.portfolioLink),
    preferredRate: safeText(existingProfile?.preferredRate, "Rate pending"),
    profileCompleteness: Number(existingProfile?.profileCompleteness || 0),
    profileImage: safeText(existingProfile?.profileImage),
    projectsInfo: safeText(existingProfile?.projectsInfo, "No project details added yet."),
    projectCount: Number.isFinite(existingProfile?.projectCount) ? existingProfile.projectCount : 0,
    role: user.role,
    skills: Array.isArray(existingProfile?.skills) ? existingProfile.skills : [],
    tools: Array.isArray(existingProfile?.tools) ? existingProfile.tools : [],
    username: safeText(existingProfile?.username, user.username),
    userId: user.id
  };
}

function upsertDesignerProfile(userId, profile) {
  db.prepare(`
    INSERT INTO designer_profiles (
      user_id, discipline, experience, goals_json, notes, portfolio_link, project_count, tools_json,
      skills_json, links_json, challenge_preference, headline, bio, profile_image, full_name, about_text,
      projects_text, payment_details, city, preferred_rate, availability, profile_completeness
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      discipline = excluded.discipline,
      experience = excluded.experience,
      goals_json = excluded.goals_json,
      notes = excluded.notes,
      portfolio_link = excluded.portfolio_link,
      project_count = excluded.project_count,
      tools_json = excluded.tools_json,
      skills_json = excluded.skills_json,
      links_json = excluded.links_json,
      challenge_preference = excluded.challenge_preference,
      headline = excluded.headline,
      bio = excluded.bio,
      profile_image = excluded.profile_image,
      full_name = excluded.full_name,
      about_text = excluded.about_text,
      projects_text = excluded.projects_text,
      payment_details = excluded.payment_details,
      city = excluded.city,
      preferred_rate = excluded.preferred_rate,
      availability = excluded.availability,
      profile_completeness = excluded.profile_completeness
  `).run(
    userId,
    profile.discipline,
    profile.experience,
    jsonStringify(profile.goals),
    profile.notes,
    profile.portfolioLink,
    profile.projectCount,
    jsonStringify(profile.tools),
    jsonStringify(profile.skills),
    jsonStringify(profile.links),
    profile.challengePreference,
    profile.headline,
    profile.bio,
    profile.profileImage,
    profile.fullName,
    profile.about,
    profile.projectsInfo,
    "",
    profile.city,
    profile.preferredRate,
    profile.availability,
    Number(profile.profileCompleteness || 0)
  );
}

function parseReviewRow(row) {
  if (!row) {
    return null;
  }

  return {
    assessment: jsonParse(row.assessment_json, null),
    challenges: jsonParse(row.challenges_json, []),
    createdAt: row.created_at,
    id: row.id,
    intake: jsonParse(row.intake_json, null),
    progress: jsonParse(row.progress_json, null)
  };
}

function getLatestReviewRow(userId) {
  return db.prepare("SELECT * FROM reviews WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(userId) || null;
}

function getReviewHistory(userId) {
  return db.prepare("SELECT created_at, assessment_json FROM reviews WHERE user_id = ? ORDER BY id DESC LIMIT 8").all(userId)
    .map((row) => {
      const assessment = jsonParse(row.assessment_json, {});
      return historyEntryFromAssessment({
        band: assessment.band,
        createdAt: row.created_at,
        overallScore: assessment.overallScore
      });
    })
    .reverse();
}

function getSavedProjectIds(userId) {
  return db.prepare("SELECT project_id FROM saved_projects WHERE designer_user_id = ?").all(userId).map((row) => row.project_id);
}

function createNotification(userId, type, title, body, link = "") {
  db.prepare(`
    INSERT INTO notifications (user_id, type, title, body, link, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, type, title, body, link, nowIso());
}

function writeAuditLog(actorUserId, action, entityType, entityId, detail = {}) {
  db.prepare(`
    INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actorUserId, action, entityType, entityId, jsonStringify(detail), nowIso());
}

function getUserNotifications(userId, limit = 12) {
  return db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(userId, limit).map((row) => ({
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    isRead: Boolean(row.is_read),
    link: row.link,
    title: row.title,
    type: row.type
  }));
}

function refreshProjectApplicationCount(projectId) {
  const count = db.prepare(
    "SELECT COUNT(*) AS count FROM applications WHERE project_id = ?"
  ).get(projectId)?.count || 0;
  db.prepare("UPDATE projects SET applications_count = ? WHERE id = ?").run(count, projectId);
  return Number(count);
}

function computeProfileCompleteness(profile, latestReview, portfolioCount) {
  let score = 0;
  if (profile.fullName) score += 10;
  if (profile.headline) score += 10;
  if (profile.city) score += 10;
  if (profile.about) score += 15;
  if (profile.preferredRate) score += 10;
  if (profile.portfolioLink) score += 10;
  if ((profile.tools || []).length) score += 10;
  if ((profile.skills || []).length) score += 10;
  if (portfolioCount > 0) score += 10;
  if (latestReview?.assessment) score += 5;
  return clamp(score, 0, 100);
}

function getDesignerApplications(userId) {
  return db.prepare(`
    SELECT applications.id, applications.status, applications.cover_note, applications.created_at,
           applications.proposed_rate, applications.estimated_timeline, applications.ai_score,
           projects.id AS project_id, projects.title, projects.summary, projects.budget, projects.duration, projects.mode,
           projects.discipline, users.name AS client_name, client_profiles.company_name
    FROM applications
    JOIN projects ON projects.id = applications.project_id
    JOIN users ON users.id = projects.client_user_id
    LEFT JOIN client_profiles ON client_profiles.user_id = projects.client_user_id
    WHERE applications.designer_user_id = ?
    ORDER BY applications.id DESC
  `).all(userId).map((row) => ({
    aiScore: Number(row.ai_score || 0),
    clientName: row.client_name,
    companyName: row.company_name || "",
    coverNote: row.cover_note,
    createdAt: row.created_at,
    estimatedTimeline: row.estimated_timeline || "",
    id: row.id,
    project: {
      budget: row.budget,
      discipline: row.discipline,
      duration: row.duration,
      id: row.project_id,
      mode: row.mode,
      summary: row.summary,
      title: row.title
    },
    proposedRate: row.proposed_rate || "",
    status: row.status
  }));
}

function getOpenProjectsForDesigner(userId) {
  const savedIds = new Set(getSavedProjectIds(userId));
  const applicationStatuses = new Map(
    db.prepare("SELECT project_id, status FROM applications WHERE designer_user_id = ?").all(userId).map((row) => [row.project_id, row.status])
  );

  return db.prepare(`
    SELECT projects.*, users.name AS client_name, users.username AS client_username, client_profiles.company_name
    FROM projects
    JOIN users ON users.id = projects.client_user_id
    LEFT JOIN client_profiles ON client_profiles.user_id = projects.client_user_id
    WHERE projects.status = 'open'
    ORDER BY projects.id DESC
  `).all().map((row) => ({
    ...mapProjectRow(row),
    applied: applicationStatuses.has(row.id),
    applicationStatus: applicationStatuses.get(row.id) || null,
    saved: savedIds.has(row.id)
  }));
}

function getClientProjects(userId) {
  return db.prepare("SELECT * FROM projects WHERE client_user_id = ? ORDER BY id DESC").all(userId).map((project) => ({
    applicants: db.prepare(`
      SELECT applications.id, applications.status, applications.cover_note, applications.created_at,
             applications.ai_score, applications.proposed_rate, applications.estimated_timeline,
             users.id AS designer_id, users.name AS designer_name, users.email AS designer_email, users.username AS designer_username,
             designer_profiles.headline, designer_profiles.portfolio_link
      FROM applications
      JOIN users ON users.id = applications.designer_user_id
      LEFT JOIN designer_profiles ON designer_profiles.user_id = users.id
      WHERE applications.project_id = ?
      ORDER BY applications.ai_score DESC, applications.id DESC
    `).all(project.id).map((row) => ({
      aiScore: Number(row.ai_score || 0),
      coverNote: row.cover_note,
      createdAt: row.created_at,
      designer: {
        email: row.designer_email,
        headline: row.headline || "Designer profile in progress",
        id: row.designer_id,
        name: row.designer_name,
        portfolioLink: row.portfolio_link || "",
        username: row.designer_username || ""
      },
      estimatedTimeline: row.estimated_timeline || "",
      id: row.id,
      proposedRate: row.proposed_rate || "",
      status: row.status
    })),
    ...mapProjectRow(project),
    contractId: db.prepare("SELECT id FROM contracts WHERE project_id = ? LIMIT 1").get(project.id)?.id || null
  }));
}

function getContractRowsByUser(user) {
  const field = user.role === "designer" ? "designer_user_id" : "client_user_id";
  return db.prepare(`
    SELECT contracts.*, projects.title AS project_title, projects.summary AS project_summary, projects.budget,
           client.name AS client_name, client.username AS client_username,
           designer.name AS designer_name, designer.username AS designer_username
    FROM contracts
    JOIN projects ON projects.id = contracts.project_id
    JOIN users AS client ON client.id = contracts.client_user_id
    JOIN users AS designer ON designer.id = contracts.designer_user_id
    WHERE contracts.${field} = ?
    ORDER BY contracts.updated_at DESC, contracts.id DESC
  `).all(user.id);
}

function getMessagesForContract(contractId) {
  return db.prepare(`
    SELECT messages.*, users.name, users.username, users.role
    FROM messages
    JOIN users ON users.id = messages.sender_user_id
    WHERE messages.contract_id = ?
    ORDER BY messages.id ASC
  `).all(contractId).map((row) => ({
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    sender: {
      id: row.sender_user_id,
      name: row.name,
      role: row.role,
      username: row.username
    }
  }));
}

function getMilestonesForContract(contractId) {
  return db.prepare(`
    SELECT milestones.*, payments.state AS payment_state, payments.platform_fee, payments.provider_reference, payments.released_at
    FROM milestones
    LEFT JOIN payments ON payments.milestone_id = milestones.id
    WHERE milestones.contract_id = ?
    ORDER BY milestones.id ASC
  `).all(contractId).map((row) => ({
    amount: Number(row.amount || 0),
    approvedAt: row.approved_at || "",
    createdAt: row.created_at,
    deliverables: db.prepare(`
      SELECT * FROM deliverables
      WHERE milestone_id = ?
      ORDER BY id DESC
    `).all(row.id).map((item) => ({
      createdAt: item.created_at,
      files: jsonParse(item.files_json, []),
      id: item.id,
      note: item.note
    })),
    description: row.description || "",
    dueDate: row.due_date || "",
    fundedAt: row.funded_at || "",
    id: row.id,
    payment: row.payment_state ? {
      platformFee: Number(row.platform_fee || 0),
      providerReference: row.provider_reference || "",
      releasedAt: row.released_at || "",
      state: row.payment_state
    } : null,
    revisionCount: Number(row.revision_count || 0),
    status: row.status,
    submittedAt: row.submitted_at || "",
    title: row.title,
    updatedAt: row.updated_at
  }));
}

function getContractDispute(contractId) {
  const row = db.prepare(`
    SELECT disputes.*, users.name AS opened_by_name
    FROM disputes
    JOIN users ON users.id = disputes.opened_by_user_id
    WHERE disputes.contract_id = ? AND disputes.status = 'open'
    ORDER BY disputes.id DESC
    LIMIT 1
  `).get(contractId);

  if (!row) {
    return null;
  }

  return {
    createdAt: row.created_at,
    id: row.id,
    openedBy: row.opened_by_name,
    reason: row.reason,
    status: row.status
  };
}

function buildContractRecord(row) {
  const milestones = getMilestonesForContract(row.id);
  const paid = milestones
    .filter((item) => item.payment?.state === "released")
    .reduce((sum, item) => sum + item.amount, 0);
  const escrowed = milestones
    .filter((item) => ["captured", "escrowed", "funded", "submitted", "revision_requested", "disputed"].includes(item.payment?.state || ""))
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    client: {
      name: row.client_name,
      username: row.client_username
    },
    createdAt: row.created_at,
    designer: {
      name: row.designer_name,
      username: row.designer_username
    },
    dispute: getContractDispute(row.id),
    id: row.id,
    messages: getMessagesForContract(row.id),
    milestones,
    paymentSummary: {
      escrowed,
      paid,
      remaining: Math.max(0, Number(row.total_value || 0) - paid),
      totalValue: Number(row.total_value || 0)
    },
    project: {
      budget: row.budget,
      id: row.project_id,
      summary: row.project_summary || "",
      title: row.project_title || row.title
    },
    scope: row.scope || "",
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at
  };
}

function getContractsForUser(user) {
  if (!["designer", "client"].includes(user.role)) {
    return [];
  }
  return getContractRowsByUser(user).map(buildContractRecord);
}

function buildPublicDesignerSummary(userId) {
  const user = db.prepare("SELECT id, name, email, role, username FROM users WHERE id = ?").get(userId);
  if (!user) {
    return null;
  }

  const profile = mapDesignerProfile(getDesignerProfileRow(userId), user);
  if (!profile) {
    return null;
  }

  const latestReview = parseReviewRow(getLatestReviewRow(userId));
  const portfolioItems = getPortfolioItems(userId);
  const completedContracts = db.prepare(`
    SELECT COUNT(*) AS count
    FROM contracts
    WHERE designer_user_id = ? AND status = 'completed'
  `).get(userId)?.count || 0;
  const completeness = computeProfileCompleteness(profile, latestReview, portfolioItems.length);
  db.prepare("UPDATE designer_profiles SET profile_completeness = ? WHERE user_id = ?").run(completeness, userId);

  return {
    availability: profile.availability,
    bio: profile.bio,
    city: profile.city,
    completedContracts: Number(completedContracts),
    fullName: profile.fullName,
    headline: profile.headline,
    hourlyRate: profile.preferredRate,
    id: userId,
    links: profile.links,
    portfolioItems,
    profileCompleteness: completeness,
    profileImage: profile.profileImage,
    publicUrl: `/designers/${user.username}`,
    score: Number(latestReview?.assessment?.overallScore || 0),
    skills: profile.skills,
    tools: profile.tools,
    username: user.username
  };
}

function buildDesignerState(user) {
  const profile = createDesignerProfileDraft(user, mapDesignerProfile(getDesignerProfileRow(user.id), user));
  const latestReview = parseReviewRow(getLatestReviewRow(user.id));
  const portfolioItems = getPortfolioItems(user.id);
  const profileCompleteness = computeProfileCompleteness(profile, latestReview, portfolioItems.length);
  profile.profileCompleteness = profileCompleteness;
  db.prepare("UPDATE designer_profiles SET profile_completeness = ? WHERE user_id = ?").run(profileCompleteness, user.id);
  return {
    applications: getDesignerApplications(user.id),
    assessment: latestReview?.assessment || null,
    challenges: latestReview?.challenges || [],
    contracts: getContractsForUser(user),
    history: getReviewHistory(user.id),
    intake: latestReview?.intake ? intakeForClient(latestReview.intake) : null,
    notifications: getUserNotifications(user.id),
    portfolioItems,
    profile,
    progress: latestReview?.progress || null,
    projects: getOpenProjectsForDesigner(user.id),
    user: {
      email: user.email,
      id: user.id,
      name: user.name,
      plan: user.plan || "free",
      role: user.role,
      username: user.username
    }
  };
}

function buildClientState(user) {
  const profileRow = db.prepare("SELECT * FROM client_profiles WHERE user_id = ?").get(user.id);
  return {
    profile: profileRow ? {
      companyLogo: profileRow.company_logo || "",
      company: profileRow.company_name,
      industry: profileRow.industry,
      website: profileRow.website,
      budget: profileRow.typical_budget,
      needs: jsonParse(profileRow.design_needs_json, [])
    } : null,
    contracts: getContractsForUser(user),
    notifications: getUserNotifications(user.id),
    projects: getClientProjects(user.id),
    user: {
      email: user.email,
      id: user.id,
      name: user.name,
      plan: user.plan || "free",
      role: user.role,
      username: user.username
    }
  };
}

function buildSessionPayload(user) {
  if (!user) {
    return { authenticated: false, user: null };
  }

  if (user.role === "designer") {
    const state = buildDesignerState(user);
    return {
      authenticated: true,
      designerSummary: {
        applicationCount: state.applications.length,
        hasReview: Boolean(state.assessment),
        marketplaceUnlocked: Boolean(state.progress?.marketplaceUnlocked),
        notificationCount: state.notifications.filter((item) => !item.isRead).length,
        openProjectCount: state.projects.length
      },
      user: state.user
    };
  }

  if (user.role === "admin") {
    return {
      authenticated: true,
      user: {
        email: user.email,
        id: user.id,
        name: user.name,
        plan: user.plan || "pro",
        role: user.role,
        username: user.username
      }
    };
  }

  const clientState = buildClientState(user);
  return {
    authenticated: true,
    clientSummary: {
      applicantCount: clientState.projects.reduce((sum, project) => sum + project.applicants.length, 0),
      notificationCount: clientState.notifications.filter((item) => !item.isRead).length,
      projectCount: clientState.projects.length
    },
    user: clientState.user
  };
}

function currentMonthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function countDesignerReviewsThisMonth(userId) {
  return Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM reviews
    WHERE user_id = ? AND created_at >= ?
  `).get(userId, currentMonthStartIso())?.count || 0);
}

function countActiveDesignerApplications(userId) {
  return Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM applications
    WHERE designer_user_id = ? AND status NOT IN ('rejected', 'withdrawn')
  `).get(userId)?.count || 0);
}

function countActiveClientJobs(userId) {
  return Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM projects
    WHERE client_user_id = ? AND status = 'open'
  `).get(userId)?.count || 0);
}

function createPasswordResetToken(userId) {
  const token = randomToken();
  db.prepare(`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, hashToken(token), isoAfterMinutes(30), nowIso());
  return token;
}

function consumePasswordResetToken(token) {
  const row = db.prepare(`
    SELECT password_reset_tokens.*, users.email
    FROM password_reset_tokens
    JOIN users ON users.id = password_reset_tokens.user_id
    WHERE token_hash = ? AND used_at = '' AND expires_at > ?
    ORDER BY id DESC
    LIMIT 1
  `).get(hashToken(token), nowIso());

  if (!row) {
    return null;
  }

  db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?").run(nowIso(), row.id);
  return row;
}

function createContractFromApplication(applicationId, actorUserId) {
  const existing = db.prepare("SELECT * FROM contracts WHERE application_id = ?").get(applicationId);
  if (existing) {
    const existingRow = db.prepare(`
      SELECT contracts.*, projects.title AS project_title, projects.summary AS project_summary, projects.budget,
             client.name AS client_name, client.username AS client_username,
             designer.name AS designer_name, designer.username AS designer_username
      FROM contracts
      JOIN projects ON projects.id = contracts.project_id
      JOIN users AS client ON client.id = contracts.client_user_id
      JOIN users AS designer ON designer.id = contracts.designer_user_id
      WHERE contracts.id = ?
    `).get(existing.id);
    return buildContractRecord(existingRow);
  }

  const application = db.prepare(`
    SELECT applications.*, projects.client_user_id, projects.title AS project_title, projects.summary AS project_summary,
           projects.budget, projects.budget_max, projects.budget_min, users.name AS designer_name
    FROM applications
    JOIN projects ON projects.id = applications.project_id
    JOIN users ON users.id = applications.designer_user_id
    WHERE applications.id = ?
  `).get(applicationId);

  if (!application) {
    const error = new Error("Application not found.");
    error.statusCode = 404;
    throw error;
  }

  const totalValue = Math.max(
    Number(application.budget_max || 0),
    Number(application.budget_min || 0),
    parseCurrencyValue(application.budget)
  );
  const createdAt = nowIso();

  const result = db.prepare(`
    INSERT INTO contracts (
      project_id, application_id, client_user_id, designer_user_id,
      title, scope, total_value, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(
    application.project_id,
    application.id,
    application.client_user_id,
    application.designer_user_id,
    application.project_title,
    application.project_summary || application.cover_note,
    totalValue,
    createdAt,
    createdAt
  );

  const contractId = Number(result.lastInsertRowid);
  db.prepare(`
    INSERT INTO milestones (
      contract_id, title, description, amount, due_date, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
  `).run(
    contractId,
    "Project delivery",
    application.project_summary || "Initial delivery milestone",
    totalValue,
    isoAfterDays(7),
    createdAt,
    createdAt
  );

  db.prepare("UPDATE applications SET status = 'hired' WHERE id = ?").run(application.id);
  db.prepare("UPDATE applications SET status = 'rejected' WHERE project_id = ? AND id != ? AND status != 'hired'").run(
    application.project_id,
    application.id
  );
  db.prepare("UPDATE projects SET status = 'closed' WHERE id = ?").run(application.project_id);
  createNotification(
    application.designer_user_id,
    "contract",
    "You were hired",
    `${application.project_title} moved into contract setup.`,
    "/contracts"
  );
  createNotification(
    application.client_user_id,
    "contract",
    "Contract created",
    `A contract was created with ${application.designer_name}.`,
    "/contracts"
  );
  writeAuditLog(actorUserId, "contract.created", "contract", contractId, { applicationId });

  const row = db.prepare(`
    SELECT contracts.*, projects.title AS project_title, projects.summary AS project_summary, projects.budget,
           client.name AS client_name, client.username AS client_username,
           designer.name AS designer_name, designer.username AS designer_username
    FROM contracts
    JOIN projects ON projects.id = contracts.project_id
    JOIN users AS client ON client.id = contracts.client_user_id
    JOIN users AS designer ON designer.id = contracts.designer_user_id
    WHERE contracts.id = ?
  `).get(contractId);

  return buildContractRecord(row);
}

function getContractForParticipant(contractId, user) {
  const row = db.prepare(`
    SELECT contracts.*, projects.title AS project_title, projects.summary AS project_summary, projects.budget,
           client.name AS client_name, client.username AS client_username,
           designer.name AS designer_name, designer.username AS designer_username
    FROM contracts
    JOIN projects ON projects.id = contracts.project_id
    JOIN users AS client ON client.id = contracts.client_user_id
    JOIN users AS designer ON designer.id = contracts.designer_user_id
    WHERE contracts.id = ?
  `).get(contractId);

  if (!row) {
    const error = new Error("Contract not found.");
    error.statusCode = 404;
    throw error;
  }

  if (user.role !== "admin" && user.id !== row.client_user_id && user.id !== row.designer_user_id) {
    const error = new Error("You do not have access to this contract.");
    error.statusCode = 403;
    throw error;
  }

  return row;
}

function handlePublicProjects(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const q = safeText(url.searchParams.get("q"));

  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT p.*, u.name AS client_name, u.username AS client_username, cp.company_name
      FROM projects p
      JOIN users u ON u.id = p.client_user_id
      LEFT JOIN client_profiles cp ON cp.user_id = p.client_user_id
      WHERE p.status = 'open'
        AND (p.title LIKE ? OR p.summary LIKE ? OR p.skills_json LIKE ?)
      ORDER BY p.created_at DESC
    `).all(like, like, like);
  } else {
    rows = db.prepare(`
      SELECT p.*, u.name AS client_name, u.username AS client_username, cp.company_name
      FROM projects p
      JOIN users u ON u.id = p.client_user_id
      LEFT JOIN client_profiles cp ON cp.user_id = p.client_user_id
      WHERE p.status = 'open'
      ORDER BY p.created_at DESC
    `).all();
  }

  sendJson(response, 200, { projects: rows.map(mapProjectRow) });
}

async function handleProjectStatusToggle(request, response, projectId) {
  const user = requireRole(request, "client");
  const project = db.prepare(
    "SELECT id, status FROM projects WHERE id = ? AND client_user_id = ?"
  ).get(projectId, user.id);

  if (!project) {
    sendJson(response, 404, { error: "Project not found or not yours." });
    return;
  }

  const next = project.status === "open" ? "closed" : "open";
  db.prepare("UPDATE projects SET status = ? WHERE id = ?").run(next, projectId);
  sendJson(response, 200, { role: "client", ...buildClientState(user) });
}

async function handleSignup(request, response) {
  const payload = await parseBody(request);
  const name = safeText(payload.name);
  const email = sanitizeEmail(payload.email);
  const password = safeText(payload.password);
  const role = sanitizeRole(payload.role);

  if (!name || !email || !password) {
    sendJson(response, 400, { error: "Name, email, and password are required." });
    return;
  }

  if (!validatePassword(password)) {
    sendJson(response, 400, {
      error: "Password must be at least 8 characters and include one special character."
    });
    return;
  }

  try {
    const createdAt = nowIso();
    const passwordHash = hashPassword(password);
    const username = uniqueUsername(name);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, username, email_verified_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, passwordHash, role, username, createdAt, createdAt);

    const userId = Number(result.lastInsertRowid);
    db.prepare(`
      INSERT INTO users_legacy (id, name, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, name, email, passwordHash, role, createdAt);
    createNotification(
      userId,
      "account",
      "Account created",
      "Welcome to Talent Thread. Your account is ready.",
      role === "designer" ? "/review.html" : "/marketplace.html"
    );

    sendJson(response, 200, {
      created: true,
      message: "Account created successfully. Please log in to continue.",
      redirectTo: "/login.html",
      user: {
        email,
        name,
        role,
        username
      }
    });
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      sendJson(response, 409, { error: "An account with this email already exists." });
      return;
    }
    throw error;
  }
}

async function handleLogin(request, response) {
  const payload = await parseBody(request);
  const email = sanitizeEmail(payload.email);
  const password = safeText(payload.password);
  const remember = normalizeBoolean(payload.remember);
  const userRow = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (userRow?.locked_until && isFutureIso(userRow.locked_until)) {
    sendJson(response, 423, {
      error: `Too many failed logins. Try again after ${new Date(userRow.locked_until).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.`
    });
    return;
  }

  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    if (userRow) {
      const failedCount = Number(userRow.failed_login_count || 0) + 1;
      const lockedUntil = failedCount >= LOGIN_ATTEMPT_LIMIT ? isoAfterMinutes(LOGIN_LOCK_MINUTES) : "";
      db.prepare(`
        UPDATE users
        SET failed_login_count = ?, locked_until = ?
        WHERE id = ?
      `).run(failedCount, lockedUntil, userRow.id);
    }
    sendJson(response, 401, { error: "Invalid email or password." });
    return;
  }

  db.prepare("UPDATE users SET failed_login_count = 0, locked_until = '' WHERE id = ?").run(userRow.id);
  const session = createSession(userRow.id, remember);
  sendJson(response, 200, buildSessionPayload({
    email: userRow.email,
    id: userRow.id,
    name: userRow.name,
    plan: userRow.plan,
    role: userRow.role,
    username: userRow.username
  }), {
    "Set-Cookie": sessionCookie(session.token, session.maxAge)
  });
}

function handleLogout(request, response) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
  }
  sendJson(response, 200, { ok: true }, { "Set-Cookie": expiredSessionCookie() });
}

function handleMe(request, response) {
  sendJson(response, 200, buildSessionPayload(getCurrentUser(request)));
}

function handleDemoReview(response) {
  sendJson(response, 200, buildDemoReviewState());
}

function buildMergedProfile(existingProfile, intake) {
  const defaults = profileDefaultsFromIntake(intake);
  return {
    availability: safeText(existingProfile?.availability, defaults.availability),
    about: safeText(existingProfile?.about, defaults.about),
    bio: safeText(existingProfile?.bio, defaults.bio),
    challengePreference: intake.challengePreference,
    city: safeText(existingProfile?.city, defaults.city),
    discipline: intake.discipline,
    experience: intake.experience,
    fullName: safeText(existingProfile?.fullName, intake.name),
    goals: intake.goals,
    headline: safeText(existingProfile?.headline, defaults.headline),
    name: intake.name,
    notes: intake.notes,
    portfolioLink: intake.portfolioLink,
    preferredRate: safeText(existingProfile?.preferredRate, defaults.preferredRate),
    profileImage: safeText(existingProfile?.profileImage, defaults.profileImage),
    projectsInfo: safeText(existingProfile?.projectsInfo, defaults.projectsInfo),
    projectCount: intake.projectCount,
    tools: intake.tools
  };
}

async function handleDesignerState(request, response) {
  sendJson(response, 200, buildDesignerState(requireRole(request, "designer")));
}

async function handleAssessment(request, response) {
  const user = requireRole(request, "designer");
  if ((user.plan || "free") === "free" && countDesignerReviewsThisMonth(user.id) >= FREE_ANALYSIS_LIMIT) {
    sendJson(response, 403, {
      error: `Free designer accounts are limited to ${FREE_ANALYSIS_LIMIT} AI analyses per month.`
    });
    return;
  }
  const intake = sanitizeIntake(await parseBody(request));
  const previousEntry = getReviewHistory(user.id).at(-1) || null;

  let artifacts;

  if (isAiReviewConfigured()) {
    // Full AI-powered assessment path
    const { analysis, evidence } = await generateAiReview(intake, previousEntry);
    artifacts = buildAssessmentArtifactsFromAnalysis(intake, analysis, previousEntry, evidence);
  } else {
    // No API key — fall back to rule-based scoring (still useful, just not AI-personalised)
    artifacts = buildAssessmentArtifacts(intake, previousEntry);
  }

  const existingProfile = mapDesignerProfile(getDesignerProfileRow(user.id), user);
  const mergedProfile = buildMergedProfile(existingProfile, intake);
  mergedProfile.username = uniqueUsername(intake.name, user.id);
  mergedProfile.skills = Array.isArray(mergedProfile.skills) ? mergedProfile.skills : [];
  mergedProfile.links = Array.isArray(mergedProfile.links) ? mergedProfile.links : [];

  db.prepare("UPDATE users SET name = ?, username = ? WHERE id = ?").run(intake.name, mergedProfile.username, user.id);
  db.prepare("UPDATE users_legacy SET name = ? WHERE id = ?").run(intake.name, user.id);
  upsertDesignerProfile(user.id, mergedProfile);
  db.prepare(`
    INSERT INTO reviews (user_id, intake_json, assessment_json, challenges_json, progress_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    jsonStringify(intake),
    jsonStringify(artifacts.assessment),
    jsonStringify(artifacts.challenges),
    jsonStringify(artifacts.progress),
    artifacts.assessment.createdAt
  );

  sendJson(response, 200, buildDesignerState({
    email: user.email,
    id: user.id,
    name: intake.name,
    plan: user.plan,
    role: user.role,
    username: mergedProfile.username
  }));
}

async function handleChallengeCompletion(request, response, challengeId) {
  const user = requireRole(request, "designer");
  const reviewRow = getLatestReviewRow(user.id);
  if (!reviewRow) {
    sendJson(response, 400, { error: "Run an assessment before completing challenges." });
    return;
  }

  const updated = completeChallenge(parseReviewRow(reviewRow), challengeId);
  db.prepare("UPDATE reviews SET challenges_json = ?, progress_json = ? WHERE id = ?").run(
    jsonStringify(updated.challenges),
    jsonStringify(updated.progress),
    reviewRow.id
  );

  sendJson(response, 200, buildDesignerState(user));
}

async function handleProfileUpdate(request, response) {
  const user = requireRole(request, "designer");
  const existingProfile = createDesignerProfileDraft(user, mapDesignerProfile(getDesignerProfileRow(user.id), user));
  const payload = await parseBody(request);
  const nextProfile = {
    ...existingProfile,
    about: safeText(payload.about, existingProfile.about),
    availability: safeText(payload.availability, existingProfile.availability),
    bio: safeText(payload.bio, existingProfile.bio),
    city: safeText(payload.city, existingProfile.city),
    fullName: safeText(payload.fullName, existingProfile.fullName),
    headline: safeText(payload.headline, existingProfile.headline),
    links: parseLinks(payload.links ?? existingProfile.links),
    preferredRate: safeText(payload.preferredRate, existingProfile.preferredRate),
    profileImage: safeText(payload.profileImage, existingProfile.profileImage),
    projectsInfo: safeText(payload.projectsInfo, existingProfile.projectsInfo),
    skills: parseSkills(payload.skills ?? existingProfile.skills),
    username: uniqueUsername(payload.username || payload.fullName || existingProfile.username || existingProfile.fullName, user.id)
  };
  if (!nextProfile.profileImage || !nextProfile.fullName || !nextProfile.city || !nextProfile.availability || !nextProfile.about) {
    sendJson(response, 400, {
      error: "Profile photo, full name, city, availability, and about are required."
    });
    return;
  }
  if (nextProfile.fullName) {
    db.prepare("UPDATE users SET name = ?, username = ? WHERE id = ?").run(nextProfile.fullName, nextProfile.username, user.id);
    db.prepare("UPDATE users_legacy SET name = ? WHERE id = ?").run(nextProfile.fullName, user.id);
  }
  upsertDesignerProfile(user.id, nextProfile);
  sendJson(response, 200, buildDesignerState({
    ...user,
    name: nextProfile.fullName || user.name,
    username: nextProfile.username || user.username
  }));
}

async function handleClientOnboarding(request, response) {
  const user = requireRole(request, "client");
  const payload = await parseBody(request);
  const company = safeText(payload.company);
  const companyLogo = safeText(payload.companyLogo);
  const industry = safeText(payload.industry);
  const website = safeText(payload.website);
  const typicalBudget = safeText(payload.budget);
  const designNeeds = Array.isArray(payload.clientNeeds) ? payload.clientNeeds : [];
  
  if (!company || !industry) {
    sendJson(response, 400, { error: "Company Name and Industry are required." });
    return;
  }

  db.prepare(`
    INSERT INTO client_profiles (user_id, company_name, industry, website, typical_budget, company_logo, design_needs_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      company_name = excluded.company_name,
      industry = excluded.industry,
      website = excluded.website,
      typical_budget = excluded.typical_budget,
      company_logo = excluded.company_logo,
      design_needs_json = excluded.design_needs_json
  `).run(user.id, company, industry, website, typicalBudget, companyLogo, jsonStringify(designNeeds));

  sendJson(response, 200, { role: "client", ...buildClientState(user) });
}

async function handleMarketplaceState(request, response) {
  const user = requireUser(request);
  if (user.role === "designer") {
    sendJson(response, 200, { role: "designer", ...buildDesignerState(user) });
    return;
  }

  sendJson(response, 200, { role: "client", ...buildClientState(user) });
}

async function handleProjectCreate(request, response) {
  const user = requireRole(request, "client");
  if ((user.plan || "free") === "free" && countActiveClientJobs(user.id) >= FREE_ACTIVE_JOB_LIMIT) {
    sendJson(response, 403, {
      error: `Free client accounts can keep up to ${FREE_ACTIVE_JOB_LIMIT} active job postings.`
    });
    return;
  }
  const payload = sanitizeProjectInput(await parseBody(request));

  if (!payload.title || !payload.summary || !payload.budget || !payload.duration || !payload.skills.length) {
    sendJson(response, 400, { error: "Title, summary, budget, duration, and at least one skill are required." });
    return;
  }

  db.prepare(`
    INSERT INTO projects (
      client_user_id, title, summary, budget, budget_type, budget_min, budget_max, duration,
      mode, discipline, experience_level, attachments_json, deadline_text, skills_json, status, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
  `).run(
    user.id,
    payload.title,
    payload.summary,
    payload.budget,
    payload.budgetType,
    payload.budgetMin,
    payload.budgetMax,
    payload.duration,
    payload.mode,
    payload.discipline,
    payload.experienceLevel,
    jsonStringify(payload.attachments),
    payload.deadlineText,
    jsonStringify(payload.skills),
    nowIso()
  );

  sendJson(response, 200, { role: "client", ...buildClientState(user) });
}

async function handleProjectSave(request, response, projectId) {
  const user = requireRole(request, "designer");
  const project = db.prepare("SELECT id FROM projects WHERE id = ? AND status = 'open'").get(projectId);
  if (!project) {
    sendJson(response, 404, { error: "Project not found." });
    return;
  }

  const existing = db.prepare("SELECT id FROM saved_projects WHERE designer_user_id = ? AND project_id = ?").get(user.id, projectId);
  if (existing) {
    db.prepare("DELETE FROM saved_projects WHERE id = ?").run(existing.id);
  } else {
    db.prepare("INSERT INTO saved_projects (designer_user_id, project_id, created_at) VALUES (?, ?, ?)").run(user.id, projectId, nowIso());
  }

  sendJson(response, 200, { role: "designer", ...buildDesignerState(user) });
}

async function handleProjectApply(request, response, projectId) {
  const user = requireRole(request, "designer");
  const state = buildDesignerState(user);
  if (!state.progress?.marketplaceUnlocked) {
    sendJson(response, 403, { error: "Complete your review and reach marketplace unlock before applying." });
    return;
  }

  if ((user.plan || "free") === "free" && countActiveDesignerApplications(user.id) >= FREE_ACTIVE_APPLICATION_LIMIT) {
    sendJson(response, 403, {
      error: `Free designer accounts can keep up to ${FREE_ACTIVE_APPLICATION_LIMIT} active applications.`
    });
    return;
  }

  const project = db.prepare("SELECT id FROM projects WHERE id = ? AND status = 'open'").get(projectId);
  if (!project) {
    sendJson(response, 404, { error: "Project not found." });
    return;
  }

  const payload = await parseBody(request);
  const coverNote = safeText(payload.coverNote);
  const proposedRate = safeText(payload.proposedRate);
  const estimatedTimeline = safeText(payload.estimatedTimeline);
  if (!coverNote) {
    sendJson(response, 400, { error: "A short cover note is required." });
    return;
  }

  try {
    db.prepare(`
      INSERT INTO applications (
        project_id, designer_user_id, cover_note, proposed_rate, estimated_timeline, ai_score, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'applied', ?)
    `).run(
      projectId,
      user.id,
      coverNote,
      proposedRate,
      estimatedTimeline,
      Number(state.assessment?.overallScore || 0),
      nowIso()
    );
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      sendJson(response, 409, { error: "You have already applied to this project." });
      return;
    }
    throw error;
  }

  refreshProjectApplicationCount(projectId);
  const projectOwner = db.prepare("SELECT client_user_id, title FROM projects WHERE id = ?").get(projectId);
  if (projectOwner) {
    createNotification(
      projectOwner.client_user_id,
      "application",
      "New application received",
      `A designer applied to ${projectOwner.title}.`,
      "/marketplace.html"
    );
  }

  sendJson(response, 200, { role: "designer", ...buildDesignerState(user) });
}

async function handleApplicationStatus(request, response, applicationId) {
  const user = requireRole(request, "client");
  const payload = await parseBody(request);
  const status = safeText(payload.status);
  const allowed = new Set(["shortlisted", "interview", "rejected", "accepted", "hired"]);
  if (!allowed.has(status)) {
    sendJson(response, 400, { error: "Invalid application status." });
    return;
  }

  const application = db.prepare(`
    SELECT applications.id, applications.designer_user_id, applications.project_id, projects.title
    FROM applications
    JOIN projects ON projects.id = applications.project_id
    WHERE applications.id = ? AND projects.client_user_id = ?
  `).get(applicationId, user.id);

  if (!application) {
    sendJson(response, 404, { error: "Application not found." });
    return;
  }

  const nextStatus = status === "accepted" ? "hired" : status;
  db.prepare("UPDATE applications SET status = ? WHERE id = ?").run(nextStatus, applicationId);
  createNotification(
    application.designer_user_id,
    "application",
    "Application status updated",
    `${application.title} is now ${nextStatus}.`,
    "/marketplace.html"
  );
  writeAuditLog(user.id, "application.status", "application", applicationId, { status: nextStatus });

  if (nextStatus === "hired") {
    createContractFromApplication(applicationId, user.id);
  }

  sendJson(response, 200, { role: "client", ...buildClientState(user) });
}

async function handleReset(response) {
  db.exec(`
    DELETE FROM messages;
    DELETE FROM deliverables;
    DELETE FROM payments;
    DELETE FROM milestones;
    DELETE FROM disputes;
    DELETE FROM contracts;
    DELETE FROM notifications;
    DELETE FROM audit_logs;
    DELETE FROM portfolio_items;
    DELETE FROM applications;
    DELETE FROM saved_projects;
    DELETE FROM projects;
    DELETE FROM reviews;
    DELETE FROM designer_profiles;
    DELETE FROM client_profiles;
    DELETE FROM password_reset_tokens;
    DELETE FROM sessions;
    DELETE FROM users;
    DELETE FROM users_legacy;
  `);
  ensureAdminUser();
  sendJson(response, 200, { ok: true });
}

function refreshContractStatus(contractId) {
  const milestones = db.prepare("SELECT status FROM milestones WHERE contract_id = ?").all(contractId);
  if (!milestones.length) {
    return;
  }

  const statuses = milestones.map((item) => item.status);
  const nextStatus = statuses.every((status) => status === "released")
    ? "completed"
    : statuses.some((status) => status === "disputed")
      ? "disputed"
      : "active";

  db.prepare("UPDATE contracts SET status = ?, updated_at = ? WHERE id = ?").run(nextStatus, nowIso(), contractId);
}

async function handleForgotPassword(request, response) {
  const payload = await parseBody(request);
  const email = sanitizeEmail(payload.email);
  const user = db.prepare("SELECT id, email FROM users WHERE email = ?").get(email);

  if (user) {
    const token = createPasswordResetToken(user.id);
    createNotification(
      user.id,
      "security",
      "Password reset requested",
      "Use the generated reset link to choose a new password.",
      `/reset-password.html?token=${token}`
    );
    sendJson(response, 200, {
      message: "Password reset link created.",
      resetUrl: `/reset-password.html?token=${token}`
    });
    return;
  }

  sendJson(response, 200, { message: "If the account exists, a reset link is ready." });
}

async function handleResetPassword(request, response) {
  const payload = await parseBody(request);
  const token = safeText(payload.token);
  const password = safeText(payload.password);

  if (!token || !validatePassword(password)) {
    sendJson(response, 400, {
      error: "Provide a valid reset token and a strong password."
    });
    return;
  }

  const tokenRow = consumePasswordResetToken(token);
  if (!tokenRow) {
    sendJson(response, 400, { error: "Reset token is invalid or expired." });
    return;
  }

  const newPasswordHash = hashPassword(password);
  db.prepare(`
    UPDATE users
    SET password_hash = ?, failed_login_count = 0, locked_until = ''
    WHERE id = ?
  `).run(newPasswordHash, tokenRow.user_id);
  db.prepare("UPDATE users_legacy SET password_hash = ? WHERE id = ?").run(newPasswordHash, tokenRow.user_id);

  createNotification(
    tokenRow.user_id,
    "security",
    "Password updated",
    "Your password was changed successfully."
  );

  sendJson(response, 200, { ok: true, redirectTo: "/login.html" });
}

function handleNotifications(request, response) {
  const user = requireUser(request);
  sendJson(response, 200, { notifications: getUserNotifications(user.id, 50) });
}

function handleNotificationRead(request, response, notificationId) {
  const user = requireUser(request);
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(notificationId, user.id);
  sendJson(response, 200, { notifications: getUserNotifications(user.id, 50) });
}

function handleContracts(request, response) {
  const user = requireAnyRole(request, ["designer", "client", "admin"]);
  if (user.role === "admin") {
    const contracts = db.prepare(`
      SELECT contracts.*, projects.title AS project_title, projects.summary AS project_summary, projects.budget,
             client.name AS client_name, client.username AS client_username,
             designer.name AS designer_name, designer.username AS designer_username
      FROM contracts
      JOIN projects ON projects.id = contracts.project_id
      JOIN users AS client ON client.id = contracts.client_user_id
      JOIN users AS designer ON designer.id = contracts.designer_user_id
      ORDER BY contracts.updated_at DESC
    `).all().map(buildContractRecord);
    sendJson(response, 200, { contracts });
    return;
  }

  sendJson(response, 200, { contracts: getContractsForUser(user) });
}

function handleContractDetail(request, response, contractId) {
  const user = requireAnyRole(request, ["designer", "client", "admin"]);
  const contractRow = getContractForParticipant(contractId, user);
  sendJson(response, 200, { contract: buildContractRecord(contractRow) });
}

async function handleContractMessage(request, response, contractId) {
  const user = requireAnyRole(request, ["designer", "client"]);
  const contractRow = getContractForParticipant(contractId, user);
  const payload = await parseBody(request);
  const body = safeText(payload.body);

  if (!body) {
    sendJson(response, 400, { error: "Message body is required." });
    return;
  }

  db.prepare(`
    INSERT INTO messages (contract_id, sender_user_id, body, created_at)
    VALUES (?, ?, ?, ?)
  `).run(contractId, user.id, body, nowIso());
  db.prepare("UPDATE contracts SET updated_at = ? WHERE id = ?").run(nowIso(), contractId);

  const recipientId = user.id === contractRow.client_user_id ? contractRow.designer_user_id : contractRow.client_user_id;
  createNotification(recipientId, "message", "New contract message", body, `/contracts?id=${contractId}`);

  sendJson(response, 200, { contract: buildContractRecord(getContractForParticipant(contractId, user)) });
}

async function handleMilestoneCreate(request, response, contractId) {
  const user = requireRole(request, "client");
  const contractRow = getContractForParticipant(contractId, user);
  const payload = await parseBody(request);
  const title = safeText(payload.title);
  const description = safeText(payload.description);
  const amount = Number(payload.amount);
  const dueDate = safeText(payload.dueDate);

  if (!title || !Number.isFinite(amount) || amount <= 0) {
    sendJson(response, 400, { error: "Title and milestone amount are required." });
    return;
  }

  db.prepare(`
    INSERT INTO milestones (contract_id, title, description, amount, due_date, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
  `).run(contractId, title, description, amount, dueDate, nowIso(), nowIso());
  db.prepare("UPDATE contracts SET updated_at = ? WHERE id = ?").run(nowIso(), contractId);
  createNotification(contractRow.designer_user_id, "contract", "A new milestone was added", title, `/contracts?id=${contractId}`);

  sendJson(response, 200, { contract: buildContractRecord(getContractForParticipant(contractId, user)) });
}

function getMilestoneForParticipant(milestoneId, user) {
  const row = db.prepare(`
    SELECT milestones.*, contracts.client_user_id, contracts.designer_user_id, contracts.id AS contract_id, contracts.title AS contract_title
    FROM milestones
    JOIN contracts ON contracts.id = milestones.contract_id
    WHERE milestones.id = ?
  `).get(milestoneId);

  if (!row) {
    const error = new Error("Milestone not found.");
    error.statusCode = 404;
    throw error;
  }

  if (user.role !== "admin" && user.id !== row.client_user_id && user.id !== row.designer_user_id) {
    const error = new Error("You do not have access to this milestone.");
    error.statusCode = 403;
    throw error;
  }

  return row;
}

async function handleMilestoneFund(request, response, milestoneId) {
  const user = requireRole(request, "client");
  const milestone = getMilestoneForParticipant(milestoneId, user);
  const paymentRef = `rzp_test_${randomToken().slice(0, 12)}`;
  const fee = Math.round(Number(milestone.amount || 0) * 0.1);

  db.prepare(`
    INSERT INTO payments (
      contract_id, milestone_id, client_user_id, designer_user_id, amount, platform_fee,
      state, provider_reference, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'escrowed', ?, ?, ?)
    ON CONFLICT(milestone_id) DO UPDATE SET
      state = 'escrowed',
      provider_reference = excluded.provider_reference,
      updated_at = excluded.updated_at
  `).run(
    milestone.contract_id,
    milestoneId,
    milestone.client_user_id,
    milestone.designer_user_id,
    Number(milestone.amount || 0),
    fee,
    paymentRef,
    nowIso(),
    nowIso()
  );
  db.prepare(`
    UPDATE milestones
    SET status = 'funded', funded_at = ?, updated_at = ?
    WHERE id = ?
  `).run(nowIso(), nowIso(), milestoneId);
  db.prepare("UPDATE contracts SET updated_at = ? WHERE id = ?").run(nowIso(), milestone.contract_id);
  createNotification(milestone.designer_user_id, "payment", "Milestone funded", `${milestone.title} is funded in escrow.`, `/contracts?id=${milestone.contract_id}`);

  sendJson(response, 200, { contract: buildContractRecord(getContractForParticipant(milestone.contract_id, user)) });
}

async function handleMilestoneSubmit(request, response, milestoneId) {
  const user = requireRole(request, "designer");
  const milestone = getMilestoneForParticipant(milestoneId, user);
  const payload = await parseBody(request);
  const note = safeText(payload.note);
  const files = Array.isArray(payload.files) ? payload.files.map((item) => safeText(item)).filter(Boolean) : [];

  db.prepare(`
    INSERT INTO deliverables (milestone_id, designer_user_id, note, files_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(milestoneId, user.id, note, jsonStringify(files), nowIso());
  db.prepare(`
    UPDATE milestones
    SET status = 'submitted', deliverables_note = ?, submitted_at = ?, updated_at = ?
    WHERE id = ?
  `).run(note, nowIso(), nowIso(), milestoneId);
  db.prepare("UPDATE contracts SET updated_at = ? WHERE id = ?").run(nowIso(), milestone.contract_id);
  createNotification(milestone.client_user_id, "deliverable", "Deliverables submitted", `${milestone.title} is ready for review.`, `/contracts?id=${milestone.contract_id}`);

  sendJson(response, 200, { contract: buildContractRecord(getContractForParticipant(milestone.contract_id, user)) });
}

async function handleMilestoneRevision(request, response, milestoneId) {
  const user = requireRole(request, "client");
  const milestone = getMilestoneForParticipant(milestoneId, user);
  db.prepare(`
    UPDATE milestones
    SET status = 'revision_requested', revision_count = revision_count + 1, updated_at = ?
    WHERE id = ?
  `).run(nowIso(), milestoneId);
  db.prepare("UPDATE contracts SET updated_at = ? WHERE id = ?").run(nowIso(), milestone.contract_id);
  createNotification(milestone.designer_user_id, "deliverable", "Revision requested", `${milestone.title} needs another pass.`, `/contracts?id=${milestone.contract_id}`);

  sendJson(response, 200, { contract: buildContractRecord(getContractForParticipant(milestone.contract_id, user)) });
}

async function handleMilestoneApprove(request, response, milestoneId) {
  const user = requireRole(request, "client");
  const milestone = getMilestoneForParticipant(milestoneId, user);
  db.prepare(`
    UPDATE milestones
    SET status = 'released', approved_at = ?, updated_at = ?
    WHERE id = ?
  `).run(nowIso(), nowIso(), milestoneId);
  db.prepare(`
    UPDATE payments
    SET state = 'released', released_at = ?, updated_at = ?
    WHERE milestone_id = ?
  `).run(nowIso(), nowIso(), milestoneId);
  db.prepare("UPDATE contracts SET updated_at = ? WHERE id = ?").run(nowIso(), milestone.contract_id);
  refreshContractStatus(milestone.contract_id);
  createNotification(milestone.designer_user_id, "payment", "Payment released", `${milestone.title} was approved and released.`, `/contracts?id=${milestone.contract_id}`);

  sendJson(response, 200, { contract: buildContractRecord(getContractForParticipant(milestone.contract_id, user)) });
}

async function handleMilestoneDispute(request, response, milestoneId) {
  const user = requireAnyRole(request, ["designer", "client"]);
  const milestone = getMilestoneForParticipant(milestoneId, user);
  const payload = await parseBody(request);
  const reason = safeText(payload.reason);

  if (!reason) {
    sendJson(response, 400, { error: "Dispute reason is required." });
    return;
  }

  db.prepare(`
    INSERT INTO disputes (contract_id, milestone_id, opened_by_user_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(milestone.contract_id, milestoneId, user.id, reason, nowIso());
  db.prepare("UPDATE milestones SET status = 'disputed', updated_at = ? WHERE id = ?").run(nowIso(), milestoneId);
  db.prepare("UPDATE payments SET state = 'disputed', updated_at = ? WHERE milestone_id = ?").run(nowIso(), milestoneId);
  db.prepare("UPDATE contracts SET status = 'disputed', updated_at = ? WHERE id = ?").run(nowIso(), milestone.contract_id);

  const counterpartyId = user.id === milestone.client_user_id ? milestone.designer_user_id : milestone.client_user_id;
  createNotification(counterpartyId, "dispute", "A dispute was opened", reason, `/contracts?id=${milestone.contract_id}`);
  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (admin) {
    createNotification(admin.id, "dispute", "New dispute needs review", reason, "/admin");
  }

  sendJson(response, 200, { contract: buildContractRecord(getContractForParticipant(milestone.contract_id, user)) });
}

function buildAdminState() {
  const metrics = {
    activeContracts: Number(db.prepare("SELECT COUNT(*) AS count FROM contracts WHERE status = 'active'").get()?.count || 0),
    designers: Number(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'designer'").get()?.count || 0),
    gmv: Number(db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE state = 'released'").get()?.total || 0),
    clients: Number(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'client'").get()?.count || 0),
    openDisputes: Number(db.prepare("SELECT COUNT(*) AS count FROM disputes WHERE status = 'open'").get()?.count || 0),
    openJobs: Number(db.prepare("SELECT COUNT(*) AS count FROM projects WHERE status = 'open'").get()?.count || 0)
  };

  const disputes = db.prepare(`
    SELECT disputes.*, contracts.title AS contract_title, milestones.title AS milestone_title,
           opener.name AS opened_by_name, client.name AS client_name, designer.name AS designer_name
    FROM disputes
    JOIN contracts ON contracts.id = disputes.contract_id
    JOIN milestones ON milestones.id = disputes.milestone_id
    JOIN users AS opener ON opener.id = disputes.opened_by_user_id
    JOIN users AS client ON client.id = contracts.client_user_id
    JOIN users AS designer ON designer.id = contracts.designer_user_id
    ORDER BY disputes.status ASC, disputes.id DESC
  `).all().map((row) => ({
    clientName: row.client_name,
    contractId: row.contract_id,
    contractTitle: row.contract_title,
    createdAt: row.created_at,
    designerName: row.designer_name,
    id: row.id,
    milestoneId: row.milestone_id,
    milestoneTitle: row.milestone_title,
    openedBy: row.opened_by_name,
    reason: row.reason,
    resolution: row.resolution,
    resolutionNote: row.resolution_note,
    status: row.status
  }));

  return {
    disputes,
    metrics,
    recentContracts: db.prepare(`
      SELECT contracts.*, projects.title AS project_title, projects.summary AS project_summary, projects.budget,
             client.name AS client_name, client.username AS client_username,
             designer.name AS designer_name, designer.username AS designer_username
      FROM contracts
      JOIN projects ON projects.id = contracts.project_id
      JOIN users AS client ON client.id = contracts.client_user_id
      JOIN users AS designer ON designer.id = contracts.designer_user_id
      ORDER BY contracts.updated_at DESC
      LIMIT 20
    `).all().map(buildContractRecord),
    users: db.prepare(`
      SELECT id, name, email, role, username, plan, created_at
      FROM users
      ORDER BY id DESC
      LIMIT 50
    `).all()
  };
}

function handleAdminState(request, response) {
  requireRole(request, "admin");
  sendJson(response, 200, buildAdminState());
}

async function handleDisputeResolve(request, response, disputeId) {
  const user = requireRole(request, "admin");
  const payload = await parseBody(request);
  const resolution = safeText(payload.resolution);
  const resolutionNote = safeText(payload.resolutionNote);

  if (!resolution || !resolutionNote) {
    sendJson(response, 400, { error: "Resolution and resolution note are required." });
    return;
  }

  const dispute = db.prepare("SELECT * FROM disputes WHERE id = ?").get(disputeId);
  if (!dispute) {
    sendJson(response, 404, { error: "Dispute not found." });
    return;
  }

  db.prepare(`
    UPDATE disputes
    SET status = 'resolved', resolution = ?, resolution_note = ?, resolved_at = ?
    WHERE id = ?
  `).run(resolution, resolutionNote, nowIso(), disputeId);

  const nextMilestoneStatus = resolution === "refund" ? "refunded" : "released";
  const nextPaymentState = resolution === "refund" ? "refunded" : "released";
  db.prepare("UPDATE milestones SET status = ?, updated_at = ? WHERE id = ?").run(nextMilestoneStatus, nowIso(), dispute.milestone_id);
  db.prepare(`
    UPDATE payments
    SET state = ?, updated_at = ?, released_at = CASE WHEN ? = 'released' THEN ? ELSE released_at END
    WHERE milestone_id = ?
  `).run(nextPaymentState, nowIso(), nextPaymentState, nowIso(), dispute.milestone_id);
  refreshContractStatus(dispute.contract_id);
  writeAuditLog(user.id, "dispute.resolved", "dispute", disputeId, { resolution });

  const contract = db.prepare("SELECT client_user_id, designer_user_id FROM contracts WHERE id = ?").get(dispute.contract_id);
  if (contract) {
    createNotification(contract.client_user_id, "dispute", "Dispute resolved", resolutionNote, `/contracts?id=${dispute.contract_id}`);
    createNotification(contract.designer_user_id, "dispute", "Dispute resolved", resolutionNote, `/contracts?id=${dispute.contract_id}`);
  }

  sendJson(response, 200, buildAdminState());
}

function handleDesignerDiscovery(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const q = safeText(url.searchParams.get("q")).toLowerCase();
  const discipline = safeText(url.searchParams.get("discipline")).toLowerCase();
  const availability = safeText(url.searchParams.get("availability")).toLowerCase();

  const rows = db.prepare(`
    SELECT users.id
    FROM users
    JOIN designer_profiles ON designer_profiles.user_id = users.id
    WHERE users.role = 'designer'
    ORDER BY users.id DESC
  `).all();

  const designers = rows
    .map((row) => buildPublicDesignerSummary(row.id))
    .filter(Boolean)
    .filter((designer) => {
      if (q) {
        const haystack = [
          designer.fullName,
          designer.headline,
          designer.city,
          ...(designer.skills || []),
          ...(designer.tools || [])
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }

      if (discipline && !String(designer.headline || "").toLowerCase().includes(discipline) && !(designer.skills || []).some((item) => item.toLowerCase().includes(discipline))) {
        return false;
      }

      if (availability && !String(designer.availability || "").toLowerCase().includes(availability)) {
        return false;
      }

      return true;
    });

  sendJson(response, 200, { designers });
}

function handleDesignerPublicProfile(request, response, username) {
  const user = db.prepare(`
    SELECT id, name, email, role, username, plan
    FROM users
    WHERE username = ? AND role = 'designer'
  `).get(username);

  if (!user) {
    sendJson(response, 404, { error: "Designer not found." });
    return;
  }

  const profile = buildPublicDesignerSummary(user.id);
  sendJson(response, 200, { designer: profile });
}

async function handleRequest(request, response) {
  try {
    if (!request.url || !request.method) {
      sendText(response, 400, "Bad request");
      return;
    }

    const { pathname } = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && pathname === "/api/me") {
      handleMe(request, response);
      return;
    }

    if (request.method === "GET" && pathname === "/api/demo-review") {
      handleDemoReview(response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/signup") {
      await handleSignup(request, response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/login") {
      await handleLogin(request, response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/forgot-password") {
      await handleForgotPassword(request, response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/reset-password") {
      await handleResetPassword(request, response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/logout") {
      handleLogout(request, response);
      return;
    }

    if (request.method === "GET" && pathname === "/api/designer/state") {
      await handleDesignerState(request, response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/assessment") {
      await handleAssessment(request, response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/profile") {
      await handleProfileUpdate(request, response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/client/onboarding") {
      await handleClientOnboarding(request, response);
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/challenges/") && pathname.endsWith("/complete")) {
      const parts = pathname.split("/");
      await handleChallengeCompletion(request, response, parts[3]);
      return;
    }

    if (request.method === "GET" && pathname === "/api/marketplace/state") {
      await handleMarketplaceState(request, response);
      return;
    }

    if (request.method === "GET" && pathname === "/api/notifications") {
      handleNotifications(request, response);
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/notifications/") && pathname.endsWith("/read")) {
      const parts = pathname.split("/");
      handleNotificationRead(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "POST" && pathname === "/api/projects") {
      await handleProjectCreate(request, response);
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/projects/") && pathname.endsWith("/save")) {
      const parts = pathname.split("/");
      await handleProjectSave(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/projects/") && pathname.endsWith("/apply")) {
      const parts = pathname.split("/");
      await handleProjectApply(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/applications/") && pathname.endsWith("/status")) {
      const parts = pathname.split("/");
      await handleApplicationStatus(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "GET" && pathname === "/api/contracts") {
      handleContracts(request, response);
      return;
    }

    if (request.method === "GET" && pathname.startsWith("/api/contracts/")) {
      const parts = pathname.split("/");
      if (parts.length === 4) {
        handleContractDetail(request, response, Number(parts[3]));
        return;
      }
    }

    if (request.method === "POST" && pathname.startsWith("/api/contracts/") && pathname.endsWith("/messages")) {
      const parts = pathname.split("/");
      await handleContractMessage(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/contracts/") && pathname.endsWith("/milestones")) {
      const parts = pathname.split("/");
      await handleMilestoneCreate(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/milestones/") && pathname.endsWith("/fund")) {
      const parts = pathname.split("/");
      await handleMilestoneFund(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/milestones/") && pathname.endsWith("/submit")) {
      const parts = pathname.split("/");
      await handleMilestoneSubmit(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/milestones/") && pathname.endsWith("/revision")) {
      const parts = pathname.split("/");
      await handleMilestoneRevision(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/milestones/") && pathname.endsWith("/approve")) {
      const parts = pathname.split("/");
      await handleMilestoneApprove(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/milestones/") && pathname.endsWith("/dispute")) {
      const parts = pathname.split("/");
      await handleMilestoneDispute(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "GET" && pathname === "/api/admin/state") {
      handleAdminState(request, response);
      return;
    }

    if (request.method === "POST" && pathname.startsWith("/api/disputes/") && pathname.endsWith("/resolve")) {
      const parts = pathname.split("/");
      await handleDisputeResolve(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "POST" && pathname === "/api/reset") {
      await handleReset(response);
      return;
    }

    if (request.method === "GET" && pathname === "/api/projects") {
      handlePublicProjects(request, response);
      return;
    }

    if (request.method === "GET" && pathname === "/api/designers") {
      handleDesignerDiscovery(request, response);
      return;
    }

    if (request.method === "GET" && pathname.startsWith("/api/designers/")) {
      const parts = pathname.split("/");
      handleDesignerPublicProfile(request, response, safeText(parts[3]));
      return;
    }

    if (request.method === "PATCH" && pathname.startsWith("/api/projects/") && pathname.endsWith("/status")) {
      const parts = pathname.split("/");
      await handleProjectStatusToggle(request, response, Number(parts[3]));
      return;
    }

    if (request.method === "GET") {
      await serveStatic(request, response, pathname);
      return;
    }

    sendText(response, 405, "Method not allowed");
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Unexpected server error"
    });
  }
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Talent Thread running at http://localhost:${PORT}`);
  });
}

module.exports = {
  handleRequest,
  server
};
