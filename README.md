# Social Media Application

Full-stack social media application built with React, Vite, Node.js, Express, MongoDB, and Socket.io.

## Project Structure

```text
D:\Socialmedia
├── backend/    # Express REST API, Mongoose database config, Socket.io server
├── frontend/   # React + Vite client application
└── README.md
```

## Environment Configuration

Copy the environment templates before configuring local or cloud credentials (never commit `.env` files):

- Frontend template: `frontend/.env.example` -> copy to `frontend/.env`
- Backend template: `backend/.env.example` -> copy to `backend/.env`

## MongoDB Setup

This application uses **MongoDB Atlas** with Mongoose.

1. Create or open your MongoDB Atlas cluster and obtain your database connection string.
2. In `backend/.env`, set:

```env
MONGO_URI=your_mongodb_connection_string
```

3. Never commit `backend/.env` or place real database credentials in source files.
4. Start the backend (`npm.cmd run start` inside `backend/`) and verify:
   - `GET /api/health` for API status
   - `GET /api/health/db` for MongoDB connection status

