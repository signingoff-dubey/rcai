# RCAi — Software Failure Root Cause Analysis Platform

Built for **IEEE DataPort Hackathon — Problem Statement #12: Software Failure Root Cause Analysis**.

## Overview

RCAi is a web platform for analysing software crash datasets. It ingests uploaded crash folders, runs them through a Groq AI-powered analysis pipeline, and surfaces root causes, security risk scores, and reproduction paths through a dark-themed dashboard.

## Tech Stack

**Frontend:** React 18 + Tailwind CSS + Framer Motion + React Flow + Recharts + Plotly.js + Lucide + Monaco Editor  
**Backend:** Python 3.11+ + FastAPI + Uvicorn + Groq SDK + scikit-learn + NetworkX + aiosqlite  
**State:** Zustand  
**Dev:** Vite + concurrently

## Getting Started

### 1. Setup Environment

```bash
# Copy and edit environment file
cp .env.example .env
# Add your Groq API key to .env:
# GROQ_API_KEY=gsk_your_key_here
```

### 2. Install Dependencies

```bash
npm run install:all
pip install -r backend/requirements.txt
```

### 3. Run Dev Server

```bash
npm run dev
```

This starts:
- Frontend on http://localhost:5173
- Backend on http://localhost:8000

### 4. Add the Crash Dataset

The crash corpus (~104MB of ELF binaries and PoC trigger files) is **not committed** to
this repository. Download it from IEEE DataPort (Problem Statement #12) and extract the
crash folders into the `dataset/` directory, then upload them via the File Explorer screen.
The local SQLite database (`backend/rcai.db`) is generated on first run and is also gitignored.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/dashboard/summary | Dashboard statistics |
| GET | /api/files | List uploaded files |
| GET | /api/files/{id}/metadata | File metadata |
| POST | /api/upload | Upload a file |
| POST | /api/analyse/{id} | Trigger analysis pipeline |
| GET | /api/pipeline/{id} | Get pipeline stages |
| GET | /api/security/{id} | Security intelligence |
| GET | /api/exploit/{id} | Exploit lab context |
| POST | /api/exploit/{id}/minimise | Minimise PoC |
| POST | /api/exploit/{id}/run | Run reproduction |
| GET | /api/clusters | Crash cluster data |
| GET | /api/timeline | Vulnerability timeline |
| GET | /api/timeline/events | Timeline events |
| GET | /api/cve | List CVEs |
| GET | /api/cve/{cve_id} | CVE details |
| GET | /api/report/{id} | Generate report |
| GET | /api/analyses | List all analyses |

## Security

- **Groq API key is server-side only** — stored in `.env`, never sent to frontend
- No direct Groq proxy endpoint exists
- All AI calls go through feature-specific endpoints
- CORS restricted to frontend origin

## Project Structure

```
├── CLAUDE.md
├── frontend/          React + Vite + Tailwind
│   └── src/
│       ├── screens/   10 dashboard screens
│       ├── components/ Shared UI components
│       ├── api/        Axios client
│       ├── store/      Zustand state
│       └── utils/      Helpers
├── backend/           FastAPI + Python
│   ├── routers/        API route handlers
│   ├── core/           Analysis modules
│   └── db/             SQLite database
└── .claude/skills/     Design skills reference
```

## Screens

1. **Dashboard** — Command centre with stats, charts, activity feed
2. **File Explorer** — Upload and browse crash datasets
3. **Pipeline** — Animated React Flow analysis pipeline
4. **Security Intel** — CVSS scores, CIA impact, NVD data
5. **Exploit Lab** — Root cause analysis with Groq AI
6. **Crash Clusters** — t-SNE scatter plot visualization
7. **Timeline** — Chronological vulnerability view
8. **CVE Lookup** — Search vulnerability database
9. **Report Builder** — Generate and export reports
10. **Settings** — Configuration and about
