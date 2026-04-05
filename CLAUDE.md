# One Repair Solutions — Claude Code Instructions

## Project Overview
One Repair Solutions is a SaaS Field Service Management (FSM) tool.

**Stack:**
- **Backend:** Django (REST API via Django REST Framework)
- **Frontend:** Next.js (React, TypeScript)
- **Database:** Supabase (PostgreSQL)

---

## Architecture Conventions

### Backend (Django)
- Models live in `backend/apps/<app_name>/models.py`
- Serializers in `backend/apps/<app_name>/serializers.py`
- Views/ViewSets in `backend/apps/<app_name>/views.py`
- URL routing in `backend/apps/<app_name>/urls.py`
- Use `uuid` primary keys on all models
- All models should include `created_at` and `updated_at` timestamps

### Frontend (Next.js)
- TypeScript strict mode enabled
- Components in `frontend/components/`
- Pages/routes in `frontend/app/` (App Router)
- API calls via a centralized client in `frontend/lib/api.ts`

### Database (Supabase/PostgreSQL)
- Schema changes driven by Django migrations (not raw SQL unless necessary)
- Each tenant identified by `organization_id` (UUID) on all relevant tables

---

## General Coding Rules

- **No auto-commit** — never commit or push without explicit user instruction
- **Migrations** — always generate and review Django migrations before applying; never edit migration files manually
- **Environment variables** — never hardcode secrets, API keys, or Supabase URLs; use `.env` / Django settings
- **DRY but not over-engineered** — share logic when it's clearly reused; don't create abstractions for one-off cases
- **Keep it minimal** — only add what is asked for; do not add unrequested features, comments, or docstrings

---

## FSM Domain Glossary

| Term | Meaning |
|---|---|
| Ticket | A service job assigned to a technician to diagnose/repair equipment |
| Service Report | The tech's writeup after completing a job — notes, parts used, labor |
| Asset | A piece of equipment being serviced |
| Organization | A tenant (customer company) using the SaaS platform |
| Store | A location belonging to an Organization |
| ORS Admin | One Repair Solutions staff — full system access |
| Manager | Store/client manager — can view their own tickets and invoices |
| Tech | Field technician — sees and works their assigned tickets |
