# Railway Deployment Review & Configuration

**Date:** 2026-06-24  
**Project:** RH OTP MVP  
**Status:** Ready for Backend & Frontend Deployment

---

## Current Setup Status

### ✅ Completed

- [x] MySQL database deployed on Railway (Online)
- [x] Backend code prepared with Procfile
- [x] `.env.production` configured with Railway template variables
- [x] `.railwayignore` created to exclude unnecessary files
- [x] Frontend API client updated to support environment variables
- [x] `package.json` updated with "start" script
- [x] Database migrations set to run on deployment

### ⏳ Next Steps Required

1. **Deploy Backend Service to Railway**
   - Connect GitHub repository to Railway
   - Set environment variables for backend
   - Verify migrations run successfully

2. **Deploy Frontend Service to Railway**
   - Deploy as separate service
   - Set `VITE_API_BASE_URL` to point to backend
   - Verify frontend can reach backend API

3. **Test End-to-End**
   - Login flow
   - API connectivity
   - Database operations

---

## Environment Variables Ready

### Backend Service (Node.js Express)

**Database** (auto-linked from MySQL):
```
DB_HOST=${{MYSQLHOST}}
DB_PORT=${{MYSQLPORT}}
DB_NAME=${{MYSQL_DATABASE}}
DB_USER=${{MYSQLUSER}}
DB_PASSWORD=${{MYSQLPASSWORD}}
```

**Application Secrets** (⚠️ Must set in Railway dashboard):
```
JWT_SECRET=<your-production-jwt-secret>
SMSDIGITS_API_KEY=ab12a6805698ad32e6310cda1bb4a3f1
SMSDIGITS_API_BASE_URL=https://smsdigits.com/api/v1
FLUTTERWAVE_SECRET_KEY=<your-flutterwave-key>
FLUTTERWAVE_REDIRECT_URL=https://<your-frontend-domain>/wallet
NUMPOOL_API_KEY=np_live_6a8e76a6cc1505127ce77c13e9f21cbc9a3addc4708178a1
PORT=4000
USE_MOCK_DATA=false
```

### Frontend Service (React/Vite)

**Configuration**:
```
VITE_API_BASE_URL=https://<your-backend-url>/api
PORT=3000
```

---

## Files Created/Updated

| File | Purpose | Status |
|------|---------|--------|
| `Procfile` | Railway startup command | ✅ Created |
| `.railwayignore` | Exclude files from deploy | ✅ Created |
| `.env.production` | Production env template | ✅ Updated |
| `src/api/client.js` | Support env variables | ✅ Updated |
| `.env.frontend` | Frontend env template | ✅ Created |
| `DEPLOYMENT.md` | Deployment guide | ✅ Created |
| `RAILWAY_DEPLOYMENT_CHECKLIST.md` | Detailed checklist | ✅ Created |

---

## Database Configuration Verified

### MySQL Instance
- **Status:** Online ✅
- **Host:** `${{MYSQLHOST}}`
- **Port:** `${{MYSQLPORT}}`
- **Database:** `railway`
- **User:** `root`
- **Password:** `${{MYSQLPASSWORD}}`

### Connection Methods
| Method | Use Case |
|--------|----------|
| Private (`${{MYSQLHOST}}`) | Backend in same Railway env (no egress costs) |
| Public (`yamabiko.proxy.rlwy.net:26013`) | External tools/local testing |

---

## Backend Deployment Checklist

**Before deploying, ensure:**
- [ ] Git repository is initialized and pushed
- [ ] All environment variables ready in Railway dashboard
- [ ] Backend responds to health check: `GET /api/balance`
- [ ] Migrations complete successfully: `npm run migrate`

**After deploying, verify:**
- [ ] Backend service is online in Railway
- [ ] No errors in deployment logs
- [ ] Public URL is accessible
- [ ] API endpoints respond (test with curl or Postman)

---

## Frontend Deployment Checklist

**Before deploying, ensure:**
- [ ] `VITE_API_BASE_URL` is set correctly
- [ ] Backend service is running and public
- [ ] Frontend builds successfully locally: `npm run build`

**After deploying, verify:**
- [ ] Frontend service is online
- [ ] No build errors in logs
- [ ] Frontend loads at public URL
- [ ] API calls succeed (check DevTools Network tab)
- [ ] Login page appears
- [ ] Can submit login form and reach backend

---

## Security Notes

⚠️ **Never commit these secrets to git:**
```
JWT_SECRET
FLUTTERWAVE_SECRET_KEY
MYSQL_ROOT_PASSWORD
DB_PASSWORD
```

✅ **Always set in Railway dashboard** under Variables tab

✅ **Use template variables** in code for database (e.g., `${{MYSQLHOST}}`)

---

## Testing the Connection

### Test Backend Health
```bash
curl https://your-backend-url/api/balance
```
Should return: `{"success":true,"data":{...}}`

### Test Frontend
1. Open frontend URL in browser
2. Should see login page
3. Open DevTools → Network tab
4. Try login (enter fake credentials)
5. Should see API call to backend
6. Should see auth error or response

---

## Next Action: Backend Deployment

1. Go to Railway Dashboard
2. Go to your RH OTP project
3. Click **+ Add** → **Deploy from GitHub**
4. Select your repository
5. Wait for Railway to auto-detect Node.js
6. Confirm deployment
7. Set environment variables (see Backend section above)
8. Check deployment logs for success

**Estimated time:** 5-10 minutes

---

## Support Resources

- Railway Docs: https://docs.railway.com
- Express.js Docs: https://expressjs.com
- React/Vite Docs: https://vitejs.dev
- Project Deployment Guide: `./DEPLOYMENT.md`
- Detailed Checklist: `./RAILWAY_DEPLOYMENT_CHECKLIST.md`
