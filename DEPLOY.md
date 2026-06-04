# 🚀 Cookies Grandma — Deployment Guide
## Architecture: GitHub → Vercel (Frontend) → Render (Backend) → PostgreSQL

---

## 📁 Final Project Structure

```
cookies-grandma/              ← GitHub repo root
├── frontend/                 ← Vercel deploys this
│   ├── index.html
│   ├── admin.html
│   ├── Resources/            (27 product images)
│   └── vercel.json           (rewrites /api/* → Render)
├── backend/                  ← Render deploys this
│   ├── server.js
│   ├── package.json
│   ├── database/
│   ├── routes/
│   ├── middleware/
│   └── services/
├── render.yaml               ← Render IaC config
└── .gitignore
```

---

## STEP 1 — Push to GitHub

### 1a. Create GitHub account
Go to https://github.com and create a free account.

### 1b. Create a new repository
- Go to https://github.com/new
- Name: `cookies-grandma`
- Set to **Public** (required for free Vercel/Render)
- Do NOT add README (we have our own)
- Click **Create repository**

### 1c. Push your code
Open terminal in `D:\AI_Folder\Mamibell\Claude\` and run:

```bash
git init
git add .
git commit -m "Initial commit — Cookies Grandma e-commerce"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cookies-grandma.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## STEP 2 — Deploy Backend to Render

### 2a. Create Render account
Go to https://render.com and sign up with GitHub.

### 2b. Create PostgreSQL Database
1. Dashboard → **New** → **PostgreSQL**
2. Name: `cookies-grandma-db`
3. Region: **Singapore** (closest to Indonesia)
4. Plan: **Free**
5. Click **Create Database**
6. ⏳ Wait ~2 minutes for it to be ready
7. Copy the **Internal Database URL** — you'll need it

### 2c. Create Web Service (API)
1. Dashboard → **New** → **Web Service**
2. Connect your GitHub repo
3. Settings:
   | Field | Value |
   |-------|-------|
   | Name | `cookies-grandma-api` |
   | Root Directory | `backend` |
   | Runtime | **Node** |
   | Build Command | `npm install` |
   | Start Command | `node database/setup.js && node server.js` |
   | Plan | **Free** |

4. Click **Advanced** → Add Environment Variables:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | *(paste the Internal Database URL from Step 2b)* |
   | `JWT_SECRET` | *(click Generate — any long random string)* |
   | `ADMIN_USERNAME` | `admin` |
   | `ADMIN_PASSWORD` | `YourStrongPassword123!` ← change this! |
   | `WA_NUMBER` | `628xxxxxxxxxx` ← your real WA number |
   | `PRICE_NASTAR` | `95000` |
   | `PRICE_KASTANGEL` | `95000` |
   | `PRICE_GIFT_WRAP` | `15000` |
   | `PRICE_HAMPER_BOX` | `35000` |
   | `MIDTRANS_IS_PRODUCTION` | `false` |

5. Click **Create Web Service**
6. ⏳ Wait ~5 minutes for deploy to finish
7. 🔗 Copy your Render URL → looks like: `https://cookies-grandma-api.onrender.com`

---

## STEP 3 — Deploy Frontend to Vercel

### 3a. Create Vercel account
Go to https://vercel.com and sign up with GitHub.

### 3b. Import project
1. Dashboard → **Add New** → **Project**
2. Import your `cookies-grandma` GitHub repo
3. Settings:
   | Field | Value |
   |-------|-------|
   | Framework Preset | **Other** |
   | Root Directory | `frontend` |
   | Build Command | *(leave empty)* |
   | Output Directory | *(leave empty)* |

4. Click **Deploy**
5. ⏳ Wait ~1 minute
6. 🔗 Copy your Vercel URL → looks like: `https://cookies-grandma.vercel.app`

---

## STEP 4 — Connect Frontend ↔ Backend

### 4a. Update Vercel rewrite with real Render URL
Open `frontend/vercel.json` and replace the placeholder:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://cookies-grandma-api.onrender.com/api/:path*"
    }
  ]
}
```

Replace `cookies-grandma-api.onrender.com` with **your actual Render URL**.

### 4b. Commit and push the update
```bash
git add frontend/vercel.json
git commit -m "Update Render URL in vercel.json"
git push
```

Vercel auto-redeploys in ~30 seconds.

### 4c. Update FRONTEND_URL in Render
1. Go to Render dashboard → your web service → **Environment**
2. Add/update: `FRONTEND_URL` = `https://cookies-grandma.vercel.app`
3. Click **Save Changes** → Render auto-redeploys

---

## STEP 5 — Verify Everything Works

Test these URLs in your browser:

| URL | Expected |
|-----|----------|
| `https://cookies-grandma.vercel.app` | 🍪 Website loads |
| `https://cookies-grandma.vercel.app/admin` | 🔧 Admin panel |
| `https://cookies-grandma.vercel.app/api/health` | `{"status":"running","db":"ok"}` |
| `https://cookies-grandma.vercel.app/api/products` | JSON list of 2 products |
| `https://cookies-grandma-api.onrender.com/api/health` | Same health check |

**Admin login:**
- Username: `admin`
- Password: whatever you set in `ADMIN_PASSWORD`

---

## ⚠️ Important Notes

### Free tier limitations
| Service | Limit |
|---------|-------|
| Render Web Service | Spins down after 15 min inactivity (cold start ~30s) |
| Render PostgreSQL | 1GB storage, expires after 90 days (free plan) |
| Vercel | 100GB bandwidth/month, unlimited deploys |

### For production (paid)
- Upgrade Render to **Starter plan** ($7/mo) → no sleep, persistent DB
- Or switch to **Railway** which has a better free tier for databases

### Updating your site
After any change:
```bash
git add .
git commit -m "Your change description"
git push
```
Both Vercel and Render auto-deploy on push. ✨

---

## 🔑 Admin Panel Features
- View all orders with status + payment
- Update order status (pending → confirmed → processing → shipped → delivered)
- One-click WhatsApp customer from admin panel
- Revenue dashboard with monthly chart
- Product price & stock management
- Settings management (WA number, prices, email)

---

## 📧 Email Setup (Optional)
To send order confirmation emails:
1. Enable Gmail 2-Step Verification
2. Go to Google Account → Security → App Passwords
3. Generate a 16-character App Password for "Mail"
4. Add to Render environment:
   - `EMAIL_USER` = your Gmail address
   - `EMAIL_PASS` = the 16-char app password
   - `EMAIL_FROM` = `Cookies Grandma <your@gmail.com>`

---

## 💳 Midtrans Payment Setup (Optional)
1. Register at https://dashboard.midtrans.com
2. Get Sandbox keys (Settings → Access Keys)
3. Add to Render environment:
   - `MIDTRANS_SERVER_KEY` = `SB-Mid-server-xxx`
   - `MIDTRANS_CLIENT_KEY` = `SB-Mid-client-xxx`
4. Change `MIDTRANS_IS_PRODUCTION=true` when ready for live payments
