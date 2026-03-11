# One Repair Solutions — Claude Code Instructions

## Project Overview
One Repair Solutions is a SaaS Field Service Management (FSM) tool.

**Stack:**
- **Backend:** Django (REST API via Django REST Framework)
- **Frontend:** Next.js (React, TypeScript)
- **Database:** Supabase (PostgreSQL)

---

## Rule #1 — No Free-Text for Symptoms or Resolutions (AI Training Requirement)

> **This is the most important rule in the project. Never violate it.**

All diagnostic, symptom, and resolution data MUST be captured as structured Enum/Choice fields — never as free-text strings. This ensures every work order record is machine-readable and suitable for future AI/ML model training.

**Forbidden patterns:**
```python
# NEVER do this
symptom = models.TextField()
resolution = models.TextField()
notes = models.CharField(max_length=500)  # if used for symptom/resolution data
```

**Required patterns:**
```python
# ALWAYS do this
class SymptomCode(models.TextChoices):
    NO_POWER = "NO_POWER", "No Power"
    OVERHEATING = "OVERHEATING", "Overheating"
    ERROR_CODE = "ERROR_CODE", "Error Code Displayed"
    # ... extend as needed

class ResolutionCode(models.TextChoices):
    REPLACED_PART = "REPLACED_PART", "Replaced Part"
    ADJUSTED_SETTINGS = "ADJUSTED_SETTINGS", "Adjusted Settings"
    FIRMWARE_UPDATE = "FIRMWARE_UPDATE", "Firmware Update"
    # ... extend as needed

symptom_code = models.CharField(max_length=50, choices=SymptomCode.choices)
resolution_code = models.CharField(max_length=50, choices=ResolutionCode.choices)
```

**Frontend (Next.js/TypeScript):**
- All symptom/resolution inputs MUST be `<select>` dropdowns or radio groups bound to the canonical enum values
- Never use `<input type="text">` or `<textarea>` for symptom or resolution capture
- TypeScript enums/union types must mirror the Django choice values exactly

**When adding new symptom or resolution types:**
1. Add the new value to the Django `TextChoices` enum first
2. Create and apply a migration
3. Update the corresponding TypeScript type/enum in the frontend
4. Update any API serializers/validators if needed

---

## Architecture Conventions

### Backend (Django)
- Use `TextChoices` (not `IntegerChoices`) for all enum fields — human-readable values aid debugging and AI training data inspection
- Models live in `backend/apps/<app_name>/models.py`
- Serializers in `backend/apps/<app_name>/serializers.py`
- Views/ViewSets in `backend/apps/<app_name>/views.py`
- URL routing in `backend/apps/<app_name>/urls.py`
- Use `uuid` primary keys on all models
- All models should include `created_at` and `updated_at` timestamps

### Frontend (Next.js)
- TypeScript strict mode enabled
- Components in `frontend/src/components/`
- Pages/routes in `frontend/src/app/` (App Router)
- API calls via a centralized client in `frontend/src/lib/api.ts`
- Enum values imported from `frontend/src/types/enums.ts` — this file is the single source of truth for all choice values on the frontend

### Database (Supabase/PostgreSQL)
- Schema changes driven by Django migrations (not raw SQL unless necessary)
- Row Level Security (RLS) policies managed in Supabase for multi-tenant isolation
- Each tenant identified by `organization_id` (UUID) on all relevant tables

---

## General Coding Rules

- **No free-text for structured data** — use enums/choices everywhere possible, not just symptoms/resolutions
- **No auto-commit** — never commit or push without explicit user instruction
- **Migrations** — always generate and review Django migrations before applying; never edit migration files manually
- **Environment variables** — never hardcode secrets, API keys, or Supabase URLs; use `.env` / Django settings
- **DRY but not over-engineered** — share logic when it's clearly reused; don't create abstractions for one-off cases
- **Keep it minimal** — only add what is asked for; do not add unrequested features, comments, or docstrings

---

## FSM Domain Glossary

| Term | Meaning |
|---|---|
| Work Order | A job assigned to a technician to diagnose/repair equipment |
| Symptom Code | Structured enum describing what the customer reported or tech observed |
| Resolution Code | Structured enum describing how the issue was resolved |
| SLA | Service Level Agreement — time targets attached to work orders |
| Asset | A piece of equipment being serviced |
| Organization | A tenant (customer company) using the SaaS platform |
