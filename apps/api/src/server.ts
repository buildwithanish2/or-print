import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';

import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { WebSocketService } from './services/socket.service';
import { storageService } from './services/storage.service';
import { prisma } from './prisma';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production') {
  const requiredHttpsUrls = ['PUBLIC_API_URL', 'CUSTOMER_PORTAL_URL', 'SHOP_PORTAL_URL', 'ADMIN_PORTAL_URL'];
  const invalidUrls = requiredHttpsUrls.filter((name) => {
    const value = process.env[name];
    if (!value) return true;
    try { return new URL(value).protocol !== 'https:'; } catch { return true; }
  });
  const origins = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length || origins.includes('*') || origins.some((origin) => {
    try { return new URL(origin).protocol !== 'https:'; } catch { return true; }
  })) {
    throw new Error('Production CORS_ORIGIN must contain only explicit HTTPS portal origins');
  }
  if (invalidUrls.length) throw new Error(`Production URLs must be configured as HTTPS: ${invalidUrls.join(', ')}`);
}

// 1. Security & Core Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : NODE_ENV === 'production' ? [] : '*';

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Free-Print-Token'],
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buffer) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 2. Rate Limiting for Public APIs
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});
app.use('/api', apiLimiter);

// 3. Static Uploads Serving
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// 4. API Endpoints
app.use('/api', routes);

// 5. Global Error Handling
app.use(errorHandler);

// 6. Socket.IO Real-time Server
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 15000,
});

WebSocketService.initialize(io);

// 7. Start Server
server.listen(PORT, async () => {
  console.log(`🚀 [AnishNova Print API Engine] Server running on http://localhost:${PORT}`);
  console.log(`📡 [WebSocket] Socket.IO server initialized on port ${PORT}`);
  console.log(`📁 [Storage] Upload directory configured at: ${uploadsDir}`);
  storageService.startEphemeralShredder();
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing HTTP server and database connections...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Server gracefully terminated.');
    process.exit(0);
  });
});
