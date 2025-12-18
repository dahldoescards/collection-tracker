# 🚂 Railway Deployment Guide

## Overview

This guide walks you through deploying the Collection Tracker to Railway with automatic daily sales updates at 7:00 AM EST.

---

## Prerequisites

1. A [Railway account](https://railway.app/) (sign up with GitHub for easy integration)
2. A [GitHub account](https://github.com/)
3. Git installed locally

---

## Step 1: Push Code to GitHub

### Option A: Create a new repository

```bash
cd /Users/andrewdahl/collection-tracker

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Collection Tracker"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/collection-tracker.git
git branch -M main
git push -u origin main
```

### Option B: Use GitHub CLI

```bash
cd /Users/andrewdahl/collection-tracker
gh repo create collection-tracker --private --source=. --push
```

---

## Step 2: Deploy to Railway

### 2.1 Create New Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `collection-tracker` repository
5. Railway will auto-detect it's a Next.js app

### 2.2 Configure Environment Variables

In your Railway project settings, add:

| Variable | Value |
|----------|-------|
| `PORT` | `3001` |
| `BASE_URL` | `https://YOUR-APP.railway.app` (after deployment) |

### 2.3 Add Persistent Volume (Critical for SQLite!)

1. In Railway dashboard, go to your service
2. Click **"Settings"** → **"Volumes"**
3. Click **"Add Volume"**
4. Set mount path: `/app/data`
5. Click **"Save"**

### 2.4 Update Database Path (if needed)

If your database path is relative, Railway will handle it. If you see issues, update the DB path in `lib/collection-database.ts` to use:

```typescript
const DB_PATH = process.env.DATABASE_PATH || './collection_data.db';
```

---

## Step 3: Set Up Daily Cron Job

### 3.1 Create Cron Service in Railway

1. In your Railway project, click **"+ New"** → **"Cron Job"**
2. Select your repo again
3. Configure:
   - **Command**: `npm run refresh-all`
   - **Schedule**: `0 12 * * *` (12:00 UTC = 7:00 AM EST)

### 3.2 Verify Cron Schedule

| Timezone | Time |
|----------|------|
| UTC | 12:00 PM |
| EST | 7:00 AM |
| PST | 4:00 AM |

---

## Step 4: Verify Deployment

1. Once deployed, Railway provides a URL like: `https://collection-tracker-production.up.railway.app`
2. Visit the URL to confirm the site loads
3. Check the "Refresh All" button works
4. Monitor Railway logs for the first cron execution

---

## Environment Variables Summary

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Port for Next.js | `3001` |
| `BASE_URL` | Your Railway URL | `https://your-app.railway.app` |
| `DATABASE_PATH` | (Optional) Path to SQLite DB | `./collection_data.db` |

---

## Troubleshooting

### Database not persisting?
- Ensure you added a persistent volume with mount path `/app/data`
- Move your database file to that path

### Cron not running?
- Check Railway logs for cron job execution
- Verify the schedule is correct (use [crontab.guru](https://crontab.guru))

### Build failing?
- Check Railway build logs
- Ensure all dependencies are in `package.json`

---

## Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| Web service | ~$5 |
| Cron job | Included |
| Volume (1GB) | Included |
| **Total** | **~$5/month** |

---

## Support

- [Railway Documentation](https://docs.railway.app/)
- [Railway Discord](https://discord.gg/railway)

---

## Quick Commands Reference

```bash
# Test refresh locally
npm run refresh-all

# Build for production
npm run build

# Start production server
npm run start
```
