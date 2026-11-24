# EduAlert - Full Stack Setup & API Guide

EduAlert is an educational alert and deadline tracking platform designed for students in India. It notifies students about critical deadlines for scholarships, government exams, internships, results, and admit cards.

---

## 📁 Project Architecture

```
EduAlert_project/
└── EduAlert/
    ├── backend/
    │   ├── server.js          ← Express server & REST API endpoints
    │   ├── swagger-ui.js      ← Swagger UI middleware & HTML renderer
    │   ├── swagger.json       ← OpenAPI 3.0.3 specification
    │   ├── db.js              ← Database manager with schema verification & atomic writes
    │   ├── db.json            ← JSON file database (auto-created on first run)
    │   ├── test-backend.js    ← Automated end-to-end API test suite (49 tests)
    │   ├── .env               ← Environment configuration
    │   ├── .env.example       ← Example environment template
    │   └── package.json       ← Backend scripts & dependencies
    └── frontend/
        ├── index.html
        ├── vite.config.js     ← Vite config with /api reverse proxy to port 5001
        ├── package.json
        └── src/
            ├── App.jsx        ← React frontend connected to backend API
            ├── main.jsx
            └── index.css
```

---

## 🚀 Quick Start Guide

### 1. Run the Backend Server

```bash
cd EduAlert/backend
node server.js

# Start the server (runs on http://localhost:5001)
npm start

# Or start in development watch mode (auto-reloads on file changes)
npm run dev
```

> [!NOTE]
> **Why port 5001?**
> On macOS (Monterey 12.0 and later, Ventura, Sonoma, Sequoia), Apple's **AirPlay Receiver** (`ControlCenter`) listens on port 5000 by default. If a web server uses port 5000, macOS intercepts the connection and returns **"Access to localhost was denied (HTTP ERROR 403)"**.
> EduAlert runs on **port 5001** to completely avoid this conflict. (If you prefer port 5000, you can disable AirPlay Receiver in `System Settings` > `General` > `AirDrop & AirPlay`).

When started, the terminal will display:
```
==================================================
  🎓 EduAlert Backend Server Running Successfully
  📖 Swagger UI:    http://localhost:5001/api-docs
  🌐 Base URL:      http://localhost:5001
  🏥 Health Check:  http://localhost:5001/api/health
  📁 Database:      .../EduAlert/backend/db.json
  🚀 Environment:   development
==================================================
```

### 2. View Backend with Swagger UI

Open your web browser and navigate to:
👉 **http://localhost:5001/api-docs** (or simply **http://localhost:5001**)

You will see the full, interactive **Swagger UI** containing:
* **Interactive testing ("Try it out")** for every single endpoint.
* **Authorize button** for JWT Bearer Token (`Bearer <token>`).
* Request payload examples, status codes, schemas, and descriptions.
* Alternative aliases: `http://localhost:5001/docs` or `http://localhost:5001/swagger`.
* Raw OpenAPI 3.0 specification: `http://localhost:5001/api/docs/swagger.json`.

### 3. Run the Automated Backend Tests

```bash
cd EduAlert/backend
npm test
```
All 49 automated tests for Swagger docs, database health, authentication, profile management, and alerts CRUD will run and verify functionality.

### 4. Run the Frontend Client

```bash
cd EduAlert/frontend

# Install dependencies (if not already installed)
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev
```

Open **http://localhost:5173** in your web browser.

---

## 🗄️ Database Architecture (`db.json`)

EduAlert uses a lightweight, zero-dependency Node.js file-based JSON document database (`db.json`).

- **Location**: `EduAlert/backend/db.json` (configurable via `DB_FILE` in `.env`).
- **Startup Guarantee**: The database initializes (`initDB()`) before the server accepts incoming requests.
- **Corrupt-Proofing**: If the database file is ever emptied or corrupted, it automatically backs up the broken file and re-initializes a clean schema without crashing the server.
- **Atomic Writes**: Uses temporary files with atomic rename operations to prevent race conditions or partial file writes.

### Database Schema Structure:
```json
{
  "users": {
    "student@example.com": {
      "id": "cea432eb-1e2f-49a0-9698-8e1398e2ab85",
      "username": "alexdoe",
      "email": "student@example.com",
      "password": "$2b$10$6EgeSTOYGXOhvTDHBicgyO83R5RN9yPVYIhi0ps9S4SKKvbWGzP8e",
      "name": "Alex Doe",
      "profileDone": true,
      "profile": {
        "name": "Alex Doe",
        "qualification": "UG (Graduated)",
        "course": "Computer Science",
        "age": 22,
        "category": "General",
        "state": "Tamil Nadu",
        "exams": ["UPSC", "GATE"]
      },
      "createdAt": "2026-11-24T10:34:25.496Z",
      "updatedAt": "2026-11-24T10:34:25.647Z"
    }
  },
  "alerts": {
    "student@example.com": [
      {
        "id": "uuid-or-id",
        "title": "GATE 2027 Registration",
        "date": "2026-12-15",
        "category": "Exam",
        "note": "Complete application form online",
        "completed": false,
        "createdAt": "2026-11-24T10:00:00.000Z"
      }
    ]
  },
  "meta": {
    "version": "1.0.0",
    "createdAt": "2026-11-24T09:50:00.000Z",
    "updatedAt": "2026-11-24T10:00:00.000Z"
  }
}
```

---

## 🔍 How to Access and View the Database

The database is persisted in `EduAlert/backend/db.json`. You can easily view and verify all registered users, emails, and bcrypt password hashes using any of the methods below:

### Method 1: In VS Code / Cursor Editor
1. In the file explorer sidebar, open `EduAlert/backend/db.json`.
2. Look at the `"users"` object. Each user record includes:
   * **User ID** (`id`): Unique identifier (e.g., `cea432eb-1e2f-...`)
   * **Username** (`username`): Unique handle chosen during registration
   * **Email** (`email`): Normalized email address
   * **Password Hash** (`password`): Secure **bcrypt hash** starting with `$2a$10$` or `$2b$10$`
   * **Created At** (`createdAt`): Exact registration timestamp
3. **Password Verification**: Notice the password is **never stored as plain text**. It is an irreversible 60-character bcrypt hash with salt factor 10.

### Method 2: Terminal / Command Line
```bash
# Pretty-print the database users in terminal
node -e 'console.log(JSON.stringify(require("./EduAlert/backend/db.json").users, null, 2))'
```

### Method 3: Via Browser / Swagger UI
1. Open **http://localhost:5001/api-docs**
2. Check `GET /api/health` to view database size, path, and total registered user count.

## 📡 REST API Reference

### Overview of Endpoints

| HTTP Method | Route | Description | Auth Required? |
|---|---|---|---|
| `GET` | `/` | API status, health overview, & route directory | No |
| `GET` | `/api-docs` | Interactive Swagger UI API documentation | No |
| `GET` | `/api/health` | System health, database connection status, uptime | No |
| `POST` | `/api/auth/register` | Register new user (Username, Email, Password - no OTP required) | No |
| `POST` | `/api/auth/login` | Authenticate with email/username and password, returns Bearer token | No |
| `GET` | `/api/profile` | Get current user's profile details | Yes (`Bearer <token>`) |
| `POST` | `/api/profile` | Save or update profile information | Yes (`Bearer <token>`) |
| `GET` | `/api/alerts` | Get all alerts for logged-in user | Yes (`Bearer <token>`) |
| `POST` | `/api/alerts` | Create new alert (rejects past dates) | Yes (`Bearer <token>`) |
| `PUT` | `/api/alerts/:id` | Update alert title, date, category, completed | Yes (`Bearer <token>`) |
| `DELETE` | `/api/alerts/:id` | Delete an alert by ID | Yes (`Bearer <token>`) |
| `GET` | `/api/opportunities` | Get list of active scholarships, exams, internships | Optional |

---

## 📮 How to Test the APIs using Postman

### Step 1: Check Server Health & Root
- **Request**: `GET http://localhost:5001/`
  - In browser or Postman, open `http://localhost:5001/`.
  - Displays a clean JSON summary of the API and all available routes (no blank page!).
- **Request**: `GET http://localhost:5001/api/health`
  - Verifies database status: `"database": { "connected": true }`.

### Step 2: Register New User (No OTP Required)
- **Method**: `POST`
- **URL**: `http://localhost:5001/api/auth/register`
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
  ```json
  {
    "username": "alexdoe",
    "email": "student@example.com",
    "password": "Password123!"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "message": "Registration successful! You can now log in.",
    "token": "eyJhbGciOi...",
    "user": {
      "id": "cea432eb-1e2f-49a0-9698-8e1398e2ab85",
      "username": "alexdoe",
      "email": "student@example.com",
      "name": "alexdoe",
      "profileDone": false,
      "profile": {}
    }
  }
  ```
  *(Notice: The password hash is never exposed in the response).*

### Step 3: Login (Supports Email or Username)
- **Method**: `POST`
- **URL**: `http://localhost:5001/api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON with email OR username):
  ```json
  {
    "email": "student@example.com",
    "password": "Password123!"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "message": "Login successful",
    "token": "eyJhbGciOi...",
    "user": {
      "id": "cea432eb-1e2f-49a0-9698-8e1398e2ab85",
      "username": "alexdoe",
      "email": "student@example.com",
      "profileDone": false
    }
  }
  ```
  *(Copy the `token` value for the subsequent authenticated requests).*
  ```

### Step 6: Save Profile (Authenticated)
- **Method**: `POST`
- **URL**: `http://localhost:5001/api/profile`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <paste_token_here>`
- **Body** (raw JSON):
  ```json
  {
    "name": "Nivashini",
    "qualification": "UG (Graduated)",
    "course": "Computer Science",
    "age": 21,
    "category": "General",
    "state": "Tamil Nadu",
    "exams": ["UPSC", "TNPSC"]
  }
  ```

### Step 7: Create an Alert (Authenticated)
- **Method**: `POST`
- **URL**: `http://localhost:5001/api/alerts`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <paste_token_here>`
- **Body** (raw JSON with future date):
  ```json
  {
    "title": "TNPSC Group II Application Deadline",
    "date": "2026-12-20",
    "category": "Exam",
    "note": "Verify uploaded certificates"
  }
  ```

### Step 8: Get User Alerts
- **Method**: `GET`
- **URL**: `http://localhost:5001/api/alerts`
- **Headers**: `Authorization: Bearer <paste_token_here>`

### Step 9: Update / Mark Alert as Done
- **Method**: `PUT`
- **URL**: `http://localhost:5001/api/alerts/<alert_id>`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <paste_token_here>`
- **Body** (raw JSON):
  ```json
  {
    "completed": true
  }
  ```

### Step 10: Delete Alert
- **Method**: `DELETE`
- **URL**: `http://localhost:5001/api/alerts/<alert_id>`
- **Headers**: `Authorization: Bearer <paste_token_here>`

---

## 🛠️ Summary of Backend Issues Identified and Resolved

1. **Blank Page on Backend URL**:
   - *Problem*: Accessing `http://localhost:5000/` returned 404 or a blank page because no route existed for `GET /`.
   - *Fix*: Added a rich JSON directory endpoint at `GET /` that returns server status, health check links, and a directory of all available endpoints.

2. **Database Initialization & Health**:
   - *Problem*: The database (`db.json`) was never initialized or verified before the server accepted requests, causing potential silent failures, unhandled exceptions if the file was empty or corrupted, and lack of configuration.
   - *Fix*: Built `db.js` with `initDB()` running before `app.listen()`. Implemented automatic schema creation, corruption detection with automated backups, safe reads, atomic writes, and a `/api/health` monitoring endpoint.

3. **CORS Configuration & Port Mismatches**:
   - *Problem*: Backend CORS was hardcoded to `http://localhost:3000`, blocking requests from the Vite frontend running on `http://localhost:5173`.
   - *Fix*: Configured flexible CORS supporting `localhost:5173`, `127.0.0.1:5173`, `localhost:3000`, and `process.env.FRONTEND_URL`, and added a reverse proxy in `vite.config.js`.

4. **Environment Variables**:
   - *Problem*: Missing `.env` support; ports, salts, and secrets were hardcoded.
   - *Fix*: Added `.env` and `.env.example` support with configurable `PORT`, `NODE_ENV`, `FRONTEND_URL`, `DB_FILE`, `SALT`, and `JWT_SECRET`.

5. **Alerts CRUD String ID Matching Bug**:
   - *Problem*: `PUT` and `DELETE /api/alerts/:id` failed with "Alert not found" whenever alert IDs were numeric due to strict comparison (`a.id === req.params.id`).
   - *Fix*: Standardized on string comparison `String(a.id) === String(req.params.id)` and supported both `PUT` and `PATCH`.

6. **Date Timezone Inconsistency**:
   - *Problem*: Date validation comparing `new Date(date)` against local time resulted in valid dates being rejected as past dates due to UTC conversion offsets.
   - *Fix*: Standardized on timezone-neutral ISO date string comparison (`YYYY-MM-DD`).

7. **Expired Opportunities Bug**:
   - *Problem*: Backend static opportunities had fixed historical dates (May-July 2026), which caused `endDate >= today` to filter out every opportunity and return an empty array `[]`.
   - *Fix*: Created dynamic, rolling opportunity generation ensuring active opportunities are always returned while expired opportunities are properly filtered.

8. **Frontend-Backend Decoupling**:
   - *Problem*: The frontend `App.jsx` was hardcoded to use `localStorage` and was calling `api.anthropic.com` directly instead of calling the backend `/api/auth/*`, `/api/profile`, and `/api/alerts` endpoints.
   - *Fix*: Connected all frontend authentication, profile setup, alerts CRUD, and opportunities directly to the Express backend APIs via `fetch` with Bearer tokens and offline resilience.
