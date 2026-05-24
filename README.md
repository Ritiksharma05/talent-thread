# Talent Thread

Talent Thread is a multipage Node.js web app for early-career designers and clients.

It now supports:

- designer and client accounts
- cookie-based login sessions
- SQLite persistence with built-in `node:sqlite`
- AI-backed portfolio review for designers
- challenge progression with XP, levels, and badges
- a role-aware marketplace
- client project posting and applicant review
- designer profile editing, saved projects, and application history

## Pages

- `/` home, signup, login, and session status
- `/review.html` designer assessment and portfolio review
- `/growth.html` designer challenges, badges, and progression
- `/marketplace.html` designer browsing/applying and client posting/review
- `/profile.html` designer profile management and client account summary

## Stack

- Node.js built-in `http` server
- built-in `node:sqlite` for persistence
- Vanilla HTML, CSS, and JavaScript

## Run locally

From PowerShell in `D:\Talent Thread`:

Set the required AI environment variable first:

```powershell
$env:OPENAI_API_KEY="your_openai_api_key"
$env:OPENAI_REVIEW_MODEL="gpt-5.4"
```

Then start the app:

```powershell
node server.js
```

Then open [http://localhost:3000](http://localhost:3000).

## Data storage

- SQLite database: `data/talent-thread.db`
- assessment helpers: `lib/assessment.js`
- AI review pipeline: `lib/ai-review.js`

## Core API routes

- `POST /api/signup`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `GET /api/designer/state`
- `POST /api/assessment`
- `POST /api/profile`
- `POST /api/challenges/:id/complete`
- `GET /api/marketplace/state`
- `POST /api/projects`
- `POST /api/projects/:id/save`
- `POST /api/projects/:id/apply`
- `POST /api/applications/:id/status`

## Tested flow

The current app has been smoke-tested for:

- designer signup and login
- portfolio assessment creation
- challenge completion and marketplace unlock
- client signup and project posting
- designer save and apply actions
- client shortlist action
- page loads for all major routes
"# talent.thread" 
"# talent.thread." 
