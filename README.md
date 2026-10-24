# Kanban Task Management — Full-Stack MERN Application

A role-based Kanban task management application with a React (Vite) frontend and a Node.js/Express/MongoDB backend. Features include drag-and-drop task boards, JWT authentication, admin task assignment, PDF reports with white-labelling, email notifications, an Event-Driven Architecture (SSE + async jobs), AI task insights (Groq), Docker containerization, and a GitHub Actions CI pipeline.

## Features

- **Kanban board** — Pending / In-Progress / Completed columns with drag & drop, quick-move buttons, search, and priority filters
- **Auth & roles** — JWT login/register, password reset via email, `admin` vs `user` roles (admins assign and reassign tasks)
- **Completed-task immutability** — completed tasks are locked and cannot move back
- **Email alerts** — Nodemailer notifies the admin when a task is completed (simulated to console when SMTP isn't configured)
- **Reports & white-labelling** — employee/company PDF reports (jsPDF) with configurable branding
- **Event-Driven Architecture** — SSE live event stream, background async jobs (CSV export, retry/failure demos) with HTTP 202 acceptance, telemetry stats, and a dead-letter queue
- **AI task insights** — Groq-powered priority/due-date/description suggestions with graceful rule-based fallback (the API key stays backend-only)
- **Docker Compose** — one-command stack: MongoDB + backend (Node) + frontend (Nginx)
- **CI** — GitHub Actions runs lint, unit tests, and a frontend build on every push/PR

## Project Structure

```
project/
├── src/                     # React frontend (Vite)
│   ├── components/          # Navbar, EdaPanel (event stream drawer), etc.
│   ├── pages/               # Auth, Tasks (Kanban), Reports, ResetPassword, ...
│   ├── context/             # AuthContext (JWT in localStorage)
│   └── config.js            # API origin (VITE_API_URL)
├── server/                  # Express backend
│   ├── config/db.js         # Mongoose connection
│   ├── middleware/          # auth (protect/adminOnly), validate (Zod)
│   ├── models/              # User, Task, Settings (Mongoose schemas)
│   ├── routes/              # auth, tasks, reports, settings, events, jobs, ai
│   ├── services/            # mailService (Nodemailer), aiService (Groq)
│   ├── events/              # eventBus + eventTypes (EDA core)
│   ├── jobs/                # in-memory async job queue + workers
│   ├── validators/          # Zod schemas per route
│   ├── exports/             # CSV artifacts from the csv-export job
│   └── index.js             # App entrypoint, routes, graceful shutdown
├── tests/                   # Node.js built-in test runner (node --test)
├── docker/                  # nginx.conf for the frontend container
├── .github/workflows/ci.yml # CI pipeline
├── Dockerfile.backend
├── Dockerfile.frontend
└── docker-compose.yml
```

## Quick Start (local dev)

Prerequisites: Node.js 20+, MongoDB running on `mongodb://127.0.0.1:27017`.

```bash
npm install
cp .env.example .env         # then fill in your values
npm run seed                 # optional: seed demo users + tasks
npm run dev:all              # runs Vite (5173) + Express (5000) together
```

Frontend: http://localhost:5173 — Backend health: http://localhost:5000/api/health

### Environment Variables (`.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | yes | Backend port (default `5000`) |
| `NODE_ENV` | yes | `development` / `production` |
| `MONGODB_URI` | yes | Mongo connection string |
| `JWT_SECRET` | yes | Secret for signing JWTs |
| `EMAIL_USER` / `EMAIL_PASS` | no | Gmail + App Password for Nodemailer (simulated if blank) |
| `ADMIN_EMAIL` | yes | Receives completion alerts |
| `GROQ_API_KEY` | no | Groq key for AI insights (see https://console.groq.com/keys); falls back to rules if blank |
| `GROQ_MODEL` | no | Groq model (default `llama-3.3-70b-versatile`) |
| `VITE_API_URL` | no | Frontend API origin (default `http://localhost:5000`; `/api` in Docker) |

## API Endpoints

All routes are prefixed with `/api`. Authenticated routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| POST | `/auth/register` | — | Register |
| POST | `/auth/login` | — | Login (returns JWT) |
| POST | `/auth/forgot-password` | — | Send reset email |
| POST | `/auth/reset-password/:token` | — | Reset password |
| GET | `/auth/users` | admin | List users |
| GET | `/tasks` | yes | List tasks (role-filtered; supports `status`, `priority`, `search`, `assignedTo`) |
| POST | `/tasks` | yes | Create task |
| PUT | `/tasks/:id` | yes | Update task (completion triggers email + events) |
| DELETE | `/tasks/:id` | yes | Delete task |
| GET | `/reports/*` | yes | Report data |
| GET/PUT | `/settings/*` | yes | White-label settings |
| GET | `/events/stream` | yes | SSE live event stream (supports `Last-Event-ID`) |
| GET | `/events/stats` | yes | Telemetry (event counts, avg duration, listeners) |
| GET | `/events/dlq` | yes | Dead-letter queue |
| POST | `/jobs` | yes | Submit async job → **202 Accepted** (`csv-export`, `simulate-retry`, `simulate-failure`) |
| GET | `/jobs` | yes | List jobs |
| GET | `/jobs/:id` | yes | Job status |
| GET | `/jobs/:id/artifact` | yes | Download CSV artifact |
| POST | `/ai/insights` | yes | AI task insights (Groq or rule-based fallback) |

## Event-Driven Architecture

Task CRUD, job lifecycle, notifications, and AI suggestions all publish events to a central `EventBus` (`server/events/`). Subscribers bind to topics (`task:*`, `job:*`, `notification:sent`, `ai:insight-generated`) independently:

- The **SSE stream** (`/events/stream`) fans events out to the browser live.
- **Telemetry** counters and the **dead-letter queue** are maintained on the bus.
- **Async jobs** are accepted with `202`, run in background workers, retry with exponential backoff, and dead-letter after max attempts — isolated from the request path.

Open **Tasks → "Event Stream & Async Jobs"** to watch the live stream, trigger jobs (CSV export produces a downloadable artifact; simulate-failure demonstrates retries → DLQ), and view telemetry.

## AI Task Insights (responsible AI)

The **Create Task** modal has an "AI Task Insights" panel. The backend calls Groq with the task title/description and returns a JSON suggestion (priority, due date, description, action steps, reasoning). The API key is read from the backend `.env` and never reaches the browser. If the key is missing or the call fails/timeouts, a rule-based generator provides a graceful fallback so the feature never blocks task creation.

## Testing

Uses the Node.js built-in test runner (no extra dependencies):

```bash
npm test        # node --test tests/
```

Covers Zod validators, the event bus (IDs, telemetry, replay, listeners), the async job queue (retries, DLQ, scoping), and the AI service (fallback, response validation).

## Docker

```bash
docker compose up --build
```

| Service | Port | Notes |
|---|---|---|
| frontend (Nginx) | `8080` | Serves the built SPA; proxies `/api` to the backend |
| backend (Node) | `3000` | REST API + SSE + job workers |
| mongodb | `27017` | Persistent volume `kanban_mongodb_data` |

The frontend is built with `VITE_API_URL=/api` so the browser calls same-origin `/api`, which Nginx reverse-proxies to the `backend` service (buffering disabled for SSE). CSV artifacts persist in the `kanban_backend_exports` volume.

## CI/CD

`.github/workflows/ci.yml` runs two jobs on every push/PR to `master`/`main`:

1. **Backend Lint & Test** — `npm ci`, `npm run lint`, `npm test`
2. **Frontend Build** — `npm ci`, `npm run build`
