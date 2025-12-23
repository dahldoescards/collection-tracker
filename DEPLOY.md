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

In your Railway project settings, add these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Port for Next.js | `3001` |
| `BASE_URL` | Your Railway URL | `https://your-app.railway.app` |
| `CRON_SECRET` | Secret for cron authentication | `your-secure-random-string-here` |
| `DATABASE_PATH` | (Optional) Path to SQLite DB | `./collection_data.db` |

**Generate a secure CRON_SECRET:**
```bash
openssl rand -hex 32
```

### 2.3 Add Persistent Volume (Critical for SQLite!)

1. In Railway dashboard, go to your service
2. Click **"Settings"** → **"Volumes"**
3. Click **"Add Volume"**
4. Set mount path: `/app/data`
5. Click **"Save"**

---

## Step 3: Set Up Daily Cron Job

Railway offers **two methods** for cron jobs:

### Method A: Direct Script Execution (Recommended)

This method runs the cron script directly, which is more reliable.

1. In your Railway project, click **"+ New"** → **"Cron Job"**
2. Connect to the same repo
3. Configure:
   - **Command**: `npm run cron:refresh`
   - **Schedule**: `0 12 * * *` (12:00 UTC = 7:00 AM EST)
4. Add the same environment variables as your main service

### Method B: HTTP Endpoint (Alternative)

This method calls the API endpoint to trigger refresh.

1. In your Railway project, click **"+ New"** → **"Cron Job"**
2. Configure:
   - **Command**: 
     ```bash
     curl -X POST "https://YOUR-APP.railway.app/api/cron/refresh" \
          -H "Authorization: Bearer YOUR_CRON_SECRET"
     ```
   - **Schedule**: `0 12 * * *`

### Verify Cron Schedule

| Timezone | Time |
|----------|------|
| UTC | 12:00 PM |
| EST | 7:00 AM |
| PST | 4:00 AM |

Use [crontab.guru](https://crontab.guru) to verify your schedule.

---

## Step 4: Verify Deployment

1. Once deployed, Railway provides a URL like: `https://collection-tracker-production.up.railway.app`
2. Visit the URL to confirm the site loads
3. Check the "Refresh All" button works
4. Monitor Railway logs for the first cron execution

### Test the Cron Endpoint Manually

```bash
# Test the cron endpoint
curl -X POST "https://YOUR-APP.railway.app/api/cron/refresh" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"

# Check cron endpoint health
curl "https://YOUR-APP.railway.app/api/cron/refresh"
```

---

## Environment Variables Summary

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | Yes | Port for Next.js | `3001` |
| `BASE_URL` | Yes | Your Railway URL | `https://your-app.railway.app` |
| `CRON_SECRET` | Yes | Secret token for cron auth | 32+ char random string |
| `DATABASE_PATH` | No | Path to SQLite DB | `./collection_data.db` |
| `NODE_ENV` | No | Environment mode | `production` |

---

## Cron Job Options

### Option 1: Standalone Script (Recommended)
```bash
npm run cron:refresh
```
- Runs independently without calling HTTP endpoints
- More reliable and faster
- Self-contained with all scraping logic

### Option 2: API Endpoint
```bash
POST /api/cron/refresh
Authorization: Bearer YOUR_CRON_SECRET
```
- Uses the web service to refresh
- Good if you want centralized logging
- Has timeout limits (4.5 minutes max)

---

## Troubleshooting

### Database not persisting?
- Ensure you added a persistent volume with mount path `/app/data`
- Update DATABASE_PATH to use that path: `/app/data/collection_data.db`

### Cron not running?
- Check Railway logs for cron job execution
- Verify the schedule is correct (use [crontab.guru](https://crontab.guru))
- Make sure CRON_SECRET is set correctly if using HTTP method

### Build failing?
- Check Railway build logs
- Ensure all dependencies are in `package.json`
- Run `npm run build` locally to test

### Cron timeout?
- The cron endpoint has a 4.5-minute safety limit
- If you have many players, consider using the standalone script method

---

## Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| Web service | ~$5 |
| Cron job | Included |
| Volume (1GB) | Included |
| **Total** | **~$5/month** |

---

## Quick Commands Reference

```bash
# Test refresh locally
npm run refresh-all

# Run cron script locally
npm run cron:refresh

# Build for production
npm run build

# Start production server
npm run start
```

---

## Support

- [Railway Documentation](https://docs.railway.app/)
- [Railway Discord](https://discord.gg/railway)
