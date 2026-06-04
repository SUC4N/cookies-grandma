# 🍪 Cookies Grandma — Setup & Run Guide

## Prerequisites
- **Node.js v18+** → https://nodejs.org (LTS version)

---

## ⚡ Quick Start (One Click)

1. Double-click **`START.bat`**
2. Browser opens automatically at `http://localhost:3000`
3. Admin panel at `http://localhost:3000/admin`

**Admin login (change after first use!):**
- Username: `admin`
- Password: `cookiesgrandma2025`

---

## 🔧 Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Setup database & seed data
node database/setup.js

# 3. Start the server
npm start

# Or with auto-reload (development)
npm run dev
```

---

## 📁 Project Structure

```
├── index.html            ← Customer website (front-end)
├── admin.html            ← Admin dashboard
├── server.js             ← Express server (entry point)
├── package.json
├── .env                  ← ⚠️ Your configuration (never commit this)
├── .env.example          ← Template for .env
├── START.bat             ← Windows one-click launcher
│
├── database/
│   ├── db.js             ← SQLite connection singleton
│   ├── setup.js          ← Schema + seeder
│   └── cookiesgrandma.db ← Auto-created SQLite database
│
├── routes/
│   ├── auth.js           ← Login, JWT, change password
│   ├── orders.js         ← Order CRUD + Midtrans webhook
│   └── products.js       ← Products + settings
│
├── middleware/
│   └── authMiddleware.js ← JWT verification
│
├── services/
│   ├── emailService.js   ← Nodemailer (order confirmation emails)
│   └── paymentService.js ← Midtrans Snap payment
│
└── Resources/            ← Product images
```

---

## 🔌 API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/products` | List all products |
| `POST` | `/api/orders` | Place a new order |
| `GET` | `/api/orders/track/:number` | Track order by number |
| `POST` | `/api/orders/payment/notification` | Midtrans webhook |

### Admin (requires JWT Bearer token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Admin login |
| `GET` | `/api/auth/me` | Get current admin |
| `POST` | `/api/auth/change-password` | Change admin password |
| `GET` | `/api/orders/admin/stats` | Dashboard statistics |
| `GET` | `/api/orders/admin/all` | List orders (paginated, filterable) |
| `GET` | `/api/orders/admin/:id` | Order detail |
| `PATCH` | `/api/orders/admin/:id/status` | Update order status |
| `DELETE` | `/api/orders/admin/:id` | Delete order |
| `PATCH` | `/api/products/admin/:id` | Update product |
| `GET` | `/api/products/admin/settings/all` | Get all settings |
| `PATCH` | `/api/products/admin/settings/update` | Update settings |

---

## ⚙️ Configuration (.env)

```env
PORT=3000                          # Server port
JWT_SECRET=your-secret-key         # JWT signing secret (change this!)
ADMIN_USERNAME=admin               # Default admin username
ADMIN_PASSWORD=cookiesgrandma2025  # Default admin password (CHANGE!)

# Email (Gmail)
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password       # Gmail App Password (not your login password)

# WhatsApp
WA_NUMBER=6281234567890            # Without + prefix

# Midtrans Payment Gateway
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false       # Set true for live payments
```

### Getting Gmail App Password
1. Enable 2-Step Verification on your Google account
2. Go to Google Account → Security → App Passwords
3. Create app password for "Mail" → copy the 16-character code
4. Paste into `EMAIL_PASS` in `.env`

### Getting Midtrans Keys
1. Register at https://dashboard.midtrans.com
2. Settings → Access Keys
3. Copy **Server Key** and **Client Key** (Sandbox for testing)
4. Set `MIDTRANS_IS_PRODUCTION=true` when going live

---

## 🚀 Production Deployment

For deploying to a VPS (Ubuntu):

```bash
# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start server.js --name "cookies-grandma"
pm2 startup  # Auto-restart on reboot
pm2 save

# Monitor
pm2 logs cookies-grandma
pm2 status
```

For deploying to **Railway**, **Render**, or **Heroku**:
- Push code to GitHub
- Set environment variables in the platform dashboard
- The `npm start` command starts the server automatically

---

## 📱 Order Flow

1. **Customer** fills order form on website
2. **Server** saves order to SQLite database
3. **Email** sent to customer + admin notification
4. **Customer** confirms payment via WhatsApp
5. **Admin** updates order status in Admin Panel
6. **Customer** can track order using order number

---

## 🔒 Security Notes

- Change `ADMIN_PASSWORD` immediately after first login
- Use a strong `JWT_SECRET` (64+ random characters)
- In production, use HTTPS (set up Nginx + Let's Encrypt)
- The `.env` file must never be committed to Git (already in `.gitignore`)
