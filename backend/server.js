import http from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, getDatabaseStatus } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import postRoutes from './routes/postRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { initSocketServer } from './socket/socketServer.js';
import {
  securityHeaders,
  generalLimiter,
  sanitizeNoSql,
  getAllowedOrigins,
} from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
const allowedOrigins = getAllowedOrigins();

// Security headers (Helmet)
app.use(securityHeaders);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// General API rate limiting (can be skipped in test runs via NODE_ENV=test)
app.use('/api', generalLimiter);

// Parse JSON request body
app.use(express.json({ limit: '10mb' }));

// NoSQL injection sanitization (Express 5 safe)
app.use(sanitizeNoSql);

function healthCheckHandler(_req, res) {
  res.status(200).json({
    status: 'ok',
    success: true,
    message: 'Social Media API is running',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

app.get('/health', healthCheckHandler);
app.get('/api/health', healthCheckHandler);

app.get('/api/health/db', (req, res) => {
  const status = getDatabaseStatus();

  if (status.connected) {
    return res.status(200).json({
      success: true,
      database: status.database,
    });
  }

  return res.status(503).json({
    success: false,
    database: status.database,
    message: status.message,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', chatRoutes);

// Centralized error handling middleware
app.use(errorHandler);

// Create HTTP server explicitly and attach Socket.io
const server = http.createServer(app);
const io = initSocketServer(server, { corsOrigin: allowedOrigins });

async function startServer() {
  try {
    await connectDB();
  } catch (error) {
    if (!process.env.MONGODB_URI?.trim() && !process.env.MONGO_URI?.trim()) {
      console.warn(`MongoDB: Not yet configured (${error.message})`);
    } else {
      console.error(`MongoDB: Connection failed (${error.message})`);
    }
  }

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

export { app, server, io, startServer };
export default app;
