# Railway Backend Deployment Guide

## Prerequisites

- Railway account (https://railway.app)
- Railway CLI installed (`npm install -g @railway/cli`)
- Git repository initialized (or create one)

## Step 1: Prepare Your Project

✅ **Already done:**
- `Procfile` - Tells Railway how to start the server
- `.railwayignore` - Excludes unnecessary files
- `package.json` "start" script - Production entry point
- `.env.production` - Production environment template

## Step 2: Connect to Railway

### Option A: Deploy via Railway Dashboard (Easiest)

1. Go to https://railway.app and sign in
2. Create a new project
3. Click **+ Create** → **Deploy from GitHub**
4. Select your repository
5. Confirm deployment (Railway will auto-detect Node.js)

### Option B: Deploy via CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

## Step 3: Configure Environment Variables

In Railway dashboard for your backend service:

1. Go to **Variables** tab
2. Set these production secrets:
   ```
   JWT_SECRET=your_super_secret_key_here
   SMSDIGITS_API_KEY=your_smsdigits_key
   FLUTTERWAVE_SECRET_KEY=your_flutterwave_key
   NUMPOOL_API_KEY=your_numpool_key
   FLUTTERWAVE_REDIRECT_URL=https://your-frontend-domain.com/wallet
   ```

3. Your MySQL variables are **already auto-populated** by Railway:
   ```
   DB_HOST=${{MYSQLHOST}}
   DB_PORT=${{MYSQLPORT}}
   DB_NAME=${{MYSQL_DATABASE}}
   DB_USER=${{MYSQLUSER}}
   DB_PASSWORD=${{MYSQLPASSWORD}}
   ```

## Step 4: Database Setup

Railway will run the `migrate` command on every deployment:

```bash
npm run migrate
```

This runs all migration files in `migrations/` to set up your database schema.

## Step 5: Get Your Backend URL

Once deployed, Railway assigns a public URL to your backend. Example:
```
https://otp-website-mvp-production.up.railway.app
```

Update your frontend API URL in `src/api/client.js`:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-railway-backend-url/api'
```

## Deployment Checklist

- [ ] Push code to GitHub
- [ ] Create Railway project
- [ ] Connect MySQL plugin to backend service
- [ ] Set production environment variables
- [ ] Verify migrations run successfully
- [ ] Test API endpoints from your frontend
- [ ] Update frontend API URL

## Monitoring & Logs

View deployment logs in Railway:
```bash
railway logs
```

Or in the dashboard → **Deployments** → Click latest → **View Logs**

## Troubleshooting

**Deployment fails at database connection:**
- Verify MySQL variables are set in Railway dashboard
- Check `.env.production` uses `${{VAR_NAME}}` format

**API returns 500 errors:**
- Check backend logs: `railway logs`
- Verify JWT_SECRET is set in Railway
- Check database connectivity

**Frontend can't reach backend:**
- Verify backend is deployed and running
- Update API URL in frontend
- Check CORS settings in `server/index.js`

## Rollback

If deployment breaks:
```bash
railway rollback
```

This reverts to the previous working version.

## Next: Frontend Deployment

After backend is working, deploy frontend separately or on the same Railway project (using Nixpacks build config).
