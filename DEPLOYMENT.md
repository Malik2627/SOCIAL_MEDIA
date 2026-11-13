# Production Deployment Guide

This guide provides step-by-step instructions for deploying the **Social Media Application** (`Malik2627/SOCIAL_MEDIA`) to production using **MongoDB Atlas**, **Cloudinary**, **Render / Railway** (Backend with WebSockets), and **Vercel / Netlify** (Frontend Single Page Application).

---

## Architecture Overview

```
┌─────────────────────────────────┐       REST API (/api/*)       ┌──────────────────────────────────┐
│   Frontend (Vercel / Netlify)   │ ────────────────────────────> │   Backend (Render / Railway)     │
│   React 19 + Vite SPA           │ <───────────────────────────> │   Node.js + Express 5            │
│   (Static CDN + SPA Rewrites)   │      WebSockets (Socket.io)   │   (Reverse Proxy + Rate Limiter) │
└─────────────────────────────────┘                               └─────────────────┬────────────────┘
                                                                                    │
                                               ┌────────────────────────────────────┴────────────────┐
                                               ▼                                                     ▼
                              ┌──────────────────────────────────┐        ┌──────────────────────────────────┐
                              │     MongoDB Atlas (Database)     │        │    Cloudinary (Media Storage)    │
                              │     M0 Free Tier / Production    │        │    Avatars & Post Attachments    │
                              └──────────────────────────────────┘        └──────────────────────────────────┘
```

---

## 1. Database Setup: MongoDB Atlas

The backend requires a cloud-hosted MongoDB database.

1. **Sign Up / Log In**: Visit [MongoDB Atlas](https://www.mongodb.com/atlas) and log in.
2. **Create a Cluster**:
   - Select the **M0 Free Tier** (Shared) in a region closest to your backend hosting (e.g., AWS `us-east-1` or `eu-central-1`).
   - Set the cluster name (e.g., `Cluster0`).
3. **Create Database User**:
   - Go to **Security > Database Access** > **Add New Database User**.
   - Authentication Method: **Password**.
   - Username: e.g. `socialmedia_user`
   - Password: Click **Autogenerate Secure Password** and copy it safely.
   - Database User Privileges: `Read and write to any database`.
4. **Configure Network Access**:
   - Go to **Security > Network Access** > **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`). Cloud platforms like Render and Railway use dynamic outbound IP addresses, which require this rule.
5. **Obtain Connection String**:
   - Go to **Deployments > Database** > click **Connect**.
   - Select **Drivers** (Node.js).
   - Copy the connection URI:
     ```text
     mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/socialmedia?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your created database user credentials, and specify `/socialmedia` as the database name.
   - This value will be used as `MONGODB_URI`.

---

## 2. Media Storage Setup: Cloudinary

Cloudinary is used for uploading and serving user avatars and post images.

1. **Sign Up / Log In**: Visit [Cloudinary](https://cloudinary.com/) and register for a free account.
2. **Retrieve API Credentials**:
   - In the Cloudinary Console Dashboard, locate your **Product Environment Credentials**:
     - **Cloud Name** (`CLOUDINARY_CLOUD_NAME`)
     - **API Key** (`CLOUDINARY_API_KEY`)
     - **API Secret** (`CLOUDINARY_API_SECRET`)
3. **Verify Upload Limits**:
   - Free tier includes generous monthly upload bandwidth and automatic transformations.

---

## 3. Backend Deployment: Render or Railway

The backend uses **Express 5** and **Socket.io** (`engine.io` v4), requiring a hosting platform that supports persistent HTTP connections and WebSockets.

### Option A: Render (Web Service)

1. **Create Web Service**:
   - Log in to [Render Dashboard](https://dashboard.render.com/).
   - Click **New +** > **Web Service**.
   - Connect your GitHub repository: `Malik2627/SOCIAL_MEDIA`.
2. **Configure Service**:
   - **Name**: `social-media-api`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free or Starter
3. **Health Check**:
   - Under **Advanced**, set **Health Check Path** to `/api/health` (or `/health`).
4. **Environment Variables**:
   Add the following environment variables in the Render dashboard under the **Environment** tab:

   | Variable Name | Example / Recommended Value | Description |
   |---------------|-----------------------------|-------------|
   | `PORT` | `5000` | Port listened by the server (Render defaults to `10000` if unset) |
   | `NODE_ENV` | `production` | Enables production security and error handling |
   | `MONGODB_URI` | `mongodb+srv://...` | MongoDB connection string obtained from Atlas |
   | `JWT_SECRET` | `<generated_random_64_char_string>` | Secret key for signing and verifying user JWTs |
   | `JWT_EXPIRES_IN` | `7d` | Token validity duration |
   | `CLIENT_URL` | `https://<your-app>.vercel.app` | Production frontend URL (**NO trailing slash**). Comma-separate if multiple. |
   | `CLOUDINARY_CLOUD_NAME` | `<your_cloud_name>` | Cloudinary Cloud Name |
   | `CLOUDINARY_API_KEY` | `<your_api_key>` | Cloudinary API Key |
   | `CLOUDINARY_API_SECRET` | `<your_api_secret>` | Cloudinary API Secret |

> [!IMPORTANT]
> **CORS & WebSocket Origin (`CLIENT_URL`)**:
> `CLIENT_URL` must match your frontend URL exactly (e.g. `https://my-social.vercel.app` with no trailing slash). Trailing slashes are automatically sanitized by backend `security.js`, but matching the exact browser origin is required for browser CORS and Socket.io handshake approval.

---

### Option B: Railway

1. **Deploy Repository**:
   - Log in to [Railway](https://railway.com/) and click **New Project** > **Deploy from GitHub repo**.
   - Select `Malik2627/SOCIAL_MEDIA`.
2. **Configure Settings**:
   - In the service **Settings**:
     - **Root Directory**: `/backend`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
   - Under **Networking**, click **Generate Domain** to get your public backend URL (e.g., `https://social-api.up.railway.app`).
3. **Environment Variables**:
   - Enter all variables listed in the table above under **Variables**.
   - Set `CLIENT_URL` to your production frontend domain.

---

## 4. Frontend Deployment: Vercel or Netlify

The frontend is a **Vite + React 19** Single Page Application (SPA).

### Option A: Vercel (Recommended)

1. **Import Project**:
   - Go to [Vercel Dashboard](https://vercel.com/) and click **Add New...** > **Project**.
   - Import `Malik2627/SOCIAL_MEDIA`.
2. **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click Edit and select `frontend`.
   - **Build Command**: `npm run build` (or leave default `vite build`)
   - **Output Directory**: `dist` (default)
3. **Environment Variables**:
   - Add the following variable in Vercel:

   | Variable Name | Value |
   |---------------|-------|
   | `VITE_API_URL` | `https://<your-backend-service>.onrender.com/api` |

   > [!NOTE]
   > Notice the `/api` path at the end of `VITE_API_URL`. The frontend Axios client uses this as the base URL, and `SocketContext.jsx` automatically strips `/api` to establish the WebSocket connection to the root server.

4. **Deploy**:
   - Click **Deploy**. Vercel will install dependencies, build the assets, and deploy to a `.vercel.app` URL.
5. **SPA Routing**:
   - `frontend/vercel.json` is already included in the repository. It instructs Vercel to route all non-file paths to `/index.html`, ensuring refreshes on `/profile/:username`, `/messages`, and `/settings` load seamlessly without 404 errors.

---

### Option B: Netlify

1. **Import Project**:
   - Go to [Netlify](https://www.netlify.com/) and click **Add new site** > **Import an existing project**.
   - Select your GitHub repo: `Malik2627/SOCIAL_MEDIA`.
2. **Build Configuration**:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. **Environment Variables**:
   - Add `VITE_API_URL=https://<your-backend-service>.onrender.com/api` under **Site configuration > Environment variables**.
4. **SPA Routing**:
   - `frontend/public/_redirects` (`/* /index.html 200`) is bundled directly into `dist/_redirects` during build, ensuring 100% clean SPA routing on Netlify.

---

## 5. Post-Deployment Configuration Link

Once both backend and frontend are deployed:
1. Copy your deployed frontend URL (e.g. `https://socialmedia-client.vercel.app`).
2. Open your backend dashboard (Render / Railway) and verify that `CLIENT_URL` matches this URL exactly:
   ```text
   CLIENT_URL=https://socialmedia-client.vercel.app
   ```
3. If you use a custom domain later (e.g. `https://social.example.com`), update `CLIENT_URL` to include it, separated by a comma:
   ```text
   CLIENT_URL=https://socialmedia-client.vercel.app,https://social.example.com
   ```
4. Save environment variables and allow the backend service to redeploy.

---

## 6. Post-Deployment Smoke Test Checklist

Execute this smoke test checklist against your live production URL:

- [ ] **1. API Health Check**:
  - Open `https://<your-backend-domain>/api/health` in your browser.
  - Expected: `200 OK` with JSON `{ "status": "ok", "success": true, "environment": "production", ... }`.
- [ ] **2. User Registration**:
  - Open the frontend app and navigate to `/register`.
  - Register a new account (`User A`).
  - Expected: Instant redirection to feed (`/`) and username badge in the navbar.
- [ ] **3. Session Persistence**:
  - Refresh the browser on `/`.
  - Expected: User remains authenticated without flickering to login.
- [ ] **4. Profile & Cloudinary Avatar**:
  - Navigate to `/profile`.
  - Click the avatar upload button and select an image file (PNG/JPEG).
  - Click Save.
  - Expected: Image uploads to Cloudinary, progress completes, and avatar displays across navbar and profile header.
- [ ] **5. Feed & Post Creation**:
  - On the Home page (`/`), create a text post.
  - Create a second post containing both text and an attached image.
  - Expected: Both posts appear immediately at the top of the feed with author avatar and timestamp.
- [ ] **6. Likes & Comments**:
  - Click the Like button (❤️) on a post.
  - Expected: Like counter increments by 1.
  - Click Comment (💬), enter a comment, and submit.
  - Expected: Comment renders immediately under the post with author name.
- [ ] **7. User Search & Public Profiles**:
  - Open an incognito window or second browser and register a second account (`User B`).
  - On User B's account, navigate to `/search` and search for User A's name or handle.
  - Expected: User A appears in search results with follow button.
  - Click User A's name to view `/profile/<UserA_handle>`.
  - Expected: Public profile loads with User A's bio, avatar, and post feed.
- [ ] **8. Follow / Unfollow**:
  - On User A's public profile, click **Follow**.
  - Expected: Follower counter increments to 1 and button changes to **Following** (or **Unfollow** on hover).
- [ ] **9. Real-Time Notifications**:
  - As User B, like User A's post or follow User A.
  - Switch back to User A's browser window.
  - Expected: User A's navbar bell icon displays an unread red badge (`1`), and a real-time toast notification appears. Navigating to `/notifications` shows the interaction.
- [ ] **10. Real-Time Chat (Socket.io)**:
  - Keep User A and User B open side-by-side.
  - In User A's window, navigate to `/messages` and select User B.
  - In User B's window, navigate to `/messages` and select User A.
  - Expected: Both users show a green **Online** status pill.
  - Type a message from User A: User B's window displays real-time typing indicators.
  - Send message: User B receives the message instantly without reloading the page.
- [ ] **11. Account Settings**:
  - Navigate to `/settings`.
  - Test changing account password.
  - Expected: Success banner confirms password update.
- [ ] **12. SPA Refresh Test**:
  - Directly refresh the browser on `/messages`, `/profile`, `/settings`, or `/profile/:username`.
  - Expected: Page loads cleanly without 404 Not Found from static host.

