# Railway Deployment Checklist

**Current Status:**
- ✅ MySQL - Online (production environment)
- ❌ Backend Service - Not deployed
- ❌ Frontend Service - Not deployed

---

## Phase 1: Backend Service Setup

### Step 1.1: Add Backend Service to Railway

1. In Railway dashboard, click **+ Add** button
2. Select **Deploy from GitHub**
3. Select your `otp-website-mvp` repository
4. Railway will auto-detect Node.js
5. Confirm deployment

### Step 1.2: Configure Backend Environment Variables

Once backend service is created, go to **Variables** tab and set these:

**Database Variables** (auto-linked from MySQL):
```env
DB_HOST=${{MYSQLHOST}}
DB_PORT=${{MYSQLPORT}}
DB_NAME=${{MYSQL_DATABASE}}
DB_USER=${{MYSQLUSER}}
DB_PASSWORD=${{MYSQLPASSWORD}}
```

**Required Secrets** (get from your local .env.production):
```env
JWT_SECRET=your_super_secret_jwt_key_here
SMSDIGITS_API_KEY=ab12a6805698ad32e6310cda1bb4a3f1
SMSDIGITS_API_BASE_URL=https://smsdigits.com/api/v1
FLUTTERWAVE_SECRET_KEY=your_flutterwave_production_key
FLUTTERWAVE_REDIRECT_URL=https://your-frontend-domain.com/wallet
NUMPOOL_API_KEY=np_live_6a8e76a6cc1505127ce77c13e9f21cbc9a3addc4708178a1
PORT=4000
USE_MOCK_DATA=false
```

### Step 1.3: Test Backend Deployment

1. Railway will auto-run: `npm run migrate`
2. Then start server: `node server/index.js`
3. Get public backend URL from Railway (e.g., `https://your-backend-service.up.railway.app`)
4. Test endpoint: `curl https://your-backend-service.up.railway.app/api/balance`

---

## Phase 2: Frontend Service Setup

### Step 2.1: Create Frontend Service

1. Click **+ Add** in Railway
2. Select **Deploy from GitHub** 
3. Select same repository (we'll deploy different branch or folder)
4. Railway should detect static build

**OR** use Static Build Config:

Create `railway.json` in project root:
```json
{
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "builder": "dockerfile",
    "dockerfile": "Dockerfile.frontend"
  }
}
```

### Step 2.2: Create Frontend Dockerfile

Create `Dockerfile.frontend`:
```dockerfile
# Build stage
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Serve stage
FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

### Step 2.3: Configure Frontend Environment Variables

**Frontend vars** (for src/api/client.js):
```env
VITE_API_BASE_URL=https://your-backend-service.up.railway.app/api
PORT=3000
```

Update your frontend to read the API URL:

**In src/api/client.js:**
```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
```

### Step 2.4: Test Frontend Deployment

1. Frontend will build and serve on Railway URL
2. Test: Visit frontend URL → should show login page
3. Test API: Open browser DevTools → Network tab → Try login
4. Should see API calls to your backend

---

## Environment Variables Summary

### MySQL (auto-managed by Railway)
| Variable | Value | Used By |
|----------|-------|---------|
| `MYSQLHOST` | Private domain | Backend DB connection |
| `MYSQLPORT` | 3306 | Backend DB connection |
| `MYSQL_DATABASE` | railway | Backend DB selection |
| `MYSQLUSER` | root | Backend auth |
| `MYSQLPASSWORD` | *** | Backend auth |

### Backend Service
| Variable | Value | Source |
|----------|-------|--------|
| `JWT_SECRET` | Your secret | .env.production |
| `DB_*` | MySQL vars | Auto-linked |
| `SMSDIGITS_API_KEY` | API key | Your account |
| `FLUTTERWAVE_SECRET_KEY` | Secret key | Your account |
| `NUMPOOL_API_KEY` | API key | Your account |
| `FLUTTERWAVE_REDIRECT_URL` | Frontend URL | Your domain |
| `PORT` | 4000 | default |
| `USE_MOCK_DATA` | false | Production setting |

### Frontend Service
| Variable | Value | Usage |
|----------|-------|-------|
| `VITE_API_BASE_URL` | Backend URL | API calls |
| `PORT` | 3000 | Serve port |

---

## Verification Checklist

- [ ] Backend service deployed to Railway
- [ ] Backend can connect to MySQL (check logs)
- [ ] Frontend service deployed to Railway
- [ ] Frontend can reach backend API
- [ ] Login flow works end-to-end
- [ ] Database migrations ran successfully
- [ ] All sensitive env vars set in Railway (not in code)

---

## Common Issues & Fixes

### Backend can't connect to MySQL
**Problem:** `Error: connect ECONNREFUSED`
**Fix:** 
- Verify `DB_HOST=${{MYSQLHOST}}` in Variables
- Check MySQL service is online
- Check credentials match

### Frontend can't reach backend
**Problem:** CORS error or 404 on API calls
**Fix:**
- Verify `VITE_API_BASE_URL` is set correctly
- Backend CORS is enabled (`app.use(cors())`)
- Backend URL is public (check Railway logs)

### Migrations failed
**Problem:** Database schema not created
**Fix:**
- Check `npm run migrate` runs successfully
- Verify migration files are in `migrations/` folder
- Check MySQL is online before migration runs

---

## Useful Commands

**View backend logs:**
```bash
railway logs --service backend
```

**View frontend logs:**
```bash
railway logs --service frontend
```

**Redeploy service:**
```bash
railway redeploy
```

**SSH into service (debugging):**
```bash
railway shell
```
