# EduAlert - Full Stack Setup Guide

## Project Structure
```
edualert-project/
├── backend/
│   ├── server.js        ← Node.js + Express API
│   └── package.json
└── frontend/
    └── src/
        └── App.jsx      ← React frontend
```

---

## 1. Backend Setup

```bash
cd backend
npm install
node server.js
# ✅ Runs on http://localhost:5000
```

The backend stores all data in `db.json` (auto-created on first run).

### API Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/send-otp | Send OTP to email |
| POST | /api/auth/verify-otp | Verify OTP |
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/profile | Get user profile |
| POST | /api/profile | Save profile |
| GET | /api/alerts | Get all alerts |
| POST | /api/alerts | Create alert (blocks past dates) |
| PUT | /api/alerts/:id | Update alert |
| DELETE | /api/alerts/:id | Delete alert |
| GET | /api/opportunities | Get active opportunities only |

---

## 2. Frontend Setup

```bash
cd frontend
npx create-react-app . --template minimal
# Replace src/App.js with the provided App.jsx
npm start
# ✅ Runs on http://localhost:3000
```

Or with Vite:
```bash
npm create vite@latest . -- --template react
# Replace src/App.jsx with the provided App.jsx
npm install && npm run dev
```

---

## 3. Real Email OTP (Production)

Install nodemailer and configure in server.js:

```bash
npm install nodemailer
```

```js
// In server.js, replace the OTP section:
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: 'your@gmail.com', pass: 'your-app-password' }
});

await transporter.sendMail({
  from: 'EduAlert <your@gmail.com>',
  to: email,
  subject: 'Your EduAlert OTP',
  html: `<h2>Your OTP: <strong>${otp}</strong></h2><p>Valid for 10 minutes.</p>`
});
```

---

## Bugs Fixed in This Version

1. **Save Alert not working** → Fixed: alerts now POST to backend `/api/alerts` with proper auth token, and the list reloads after every create/update/delete.

2. **Past dates showing add option** → Fixed: 
   - Calendar cells with `date < today` are greyed out with `cursor: not-allowed`
   - Clicking them does nothing
   - The date input in the modal has `min={todayStr}` 
   - The Save button is disabled if the selected date is in the past
   - The backend also validates and rejects past dates

3. **Expired opportunities still showing** → Fixed: backend filters opportunities where `endDate >= today` before sending to frontend.
