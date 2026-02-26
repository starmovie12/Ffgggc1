# ⚡ MFLIX PRO — Complete Setup Guide

## What's Fixed in This Version

1. ✅ **HubCloud port bug** — Fixed `5000` → `5001` in `lib/solvers.ts`
2. ✅ **Speed** — All links now solved in PARALLEL (not one-by-one)
3. ✅ **Admin Panel** — Full mobile admin at `/admin` with password protection
4. ✅ **24/7 Auto-Pilot** — GitHub Actions cron runs every minute, no phone needed
5. ✅ **vercel.json** — All API routes get max 60s timeout on Vercel

---

## Setup (5 minutes)

### Step 1 — Vercel Environment Variables

Go to: `Vercel Dashboard → Your Project → Settings → Environment Variables`

Add these:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.vercel.app` |
| `ADMIN_SECRET` | Any strong password (for admin panel) |
| `CRON_SECRET` | Any random string (for GitHub cron) |

*(Firebase + Telegram vars should already be there)*

### Step 2 — GitHub Actions (24/7 Auto-Pilot)

1. Go to your GitHub repo → `Settings → Secrets and variables → Actions`
2. Add these secrets:
   - `CRON_SECRET` → same value as Vercel
   - `APP_BASE_URL` → `https://your-app.vercel.app`
3. Push `.github/workflows/auto-pilot.yml` to your repo
4. Done! Auto-Pilot will run every minute, even with phone off

### Step 3 — Admin Panel

Visit: `https://your-app.vercel.app/admin`

Password = value of `ADMIN_SECRET` in Vercel

Features:
- Dashboard: stats for tasks and queue
- Tasks: view/delete/retry all scraping tasks
- Queue: manage movies_queue and webseries_queue

---

## Architecture

```
User adds URL to Firebase queue
    ↓
GitHub Actions (every minute) → /api/cron/process-queue
    ↓
Picks pending item → /api/tasks (extract links)
    ↓
/api/stream_solve (solve ALL links in PARALLEL)
    ↓
Save to Firebase
    ↓
Telegram notification
```
