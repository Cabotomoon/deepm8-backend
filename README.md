# 🚂 DeepM8 Backend - Railway Deployment Guide

Backend server for DeepM8 Chess Training Platform with Stockfish analysis, multiplayer, and puzzle generation.

## 🎯 Features

- ✅ **Stockfish Analysis** - Deep position analysis with evaluation
- ✅ **Best Move Recommendations** - AI-powered move suggestions
- ✅ **Puzzle Generation** - Dynamic tactical puzzle creation
- ✅ **Multiplayer** - Real-time chess games with Socket.io
- ✅ **Move Validation** - Verify move quality and accuracy

## 📦 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express + TypeScript
- **WebSockets**: Socket.io
- **Chess Engine**: Stockfish 16
- **Deployment**: Railway (Docker)

---

## 🚀 Deploy to Railway

### Step 1: Prepare Repository

```bash
# Create Git repository
cd deepm8-backend
git init
git add .
git commit -m "Initial commit: DeepM8 Backend"

# Push to GitHub
git remote add origin https://github.com/TU_USUARIO/deepm8-backend.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Railway

1. **Go to [railway.app](https://railway.app)**
2. **Click "New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Choose `deepm8-backend` repository**
5. **Railway will auto-detect Dockerfile and deploy**

### Step 3: Configure Environment Variables

In Railway dashboard, go to **Variables** and add:

```env
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
PORT=3001
```

### Step 4: Get Your Railway URL

After deployment, Railway will provide a URL like:
```
https://deepm8-backend-production.up.railway.app
```

**Copy this URL** - you'll need it for the frontend configuration.

---

## 🌐 Connect Frontend to Backend

### Update Frontend Environment Variables

In your Vercel project, add:

```env
VITE_BACKEND_URL=https://deepm8-backend-production.up.railway.app
VITE_SOCKET_URL=https://deepm8-backend-production.up.railway.app
```

### Update Frontend Code

Update your frontend to use environment variables:

```typescript
// src/config/api.ts
export const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
```

---

## 📡 API Endpoints

### Analysis & Recommendations

```bash
POST /api/analysis/position
Body: { fen: string, depth?: number }
Response: { bestMove, evaluation, depth, pv, mate? }

POST /api/recommendations/best-move
Body: { fen: string, depth?: number }
Response: { move: string, evaluation: number }

POST /api/analysis/validate-move
Body: { fen: string, move: string, depth?: number }
Response: { isCorrect, evaluation, difference, quality }
```

### Puzzle Generation

```bash
POST /api/puzzles/generate
Body: { category: string, count?: number, minDepth?: number }
Response: TacticalPuzzle[]

POST /api/puzzles/validate
Body: { fen: string, move: string, depth?: number }
Response: { isCorrect, bestMove, evaluation, feedback }
```

### Health Check

```bash
GET /health
Response: { status: 'ok', service: 'deepm8-backend', timestamp }
```

---

## 🎮 Socket.io Events (Multiplayer)

### Client → Server

```typescript
socket.emit('join-queue', { rating?, timeControl? });
socket.emit('leave-queue');
socket.emit('make-move', { roomId, move, fen });
socket.emit('resign');
socket.emit('offer-draw');
socket.emit('draw-response', { accept: boolean });
socket.emit('chat-message', { roomId, message });
```

### Server → Client

```typescript
socket.on('queue-joined', { position, playersInQueue });
socket.on('game-started', { roomId, color, opponent, timeControl });
socket.on('opponent-move', { move, fen });
socket.on('move-accepted', { move, fen });
socket.on('game-ended', { result, reason });
socket.on('opponent-disconnected');
socket.on('draw-offered', { from });
socket.on('draw-declined');
socket.on('chat-message', { message, from });
```

---

## 🧪 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## 🐳 Docker (Local Testing)

```bash
# Build image
docker build -t deepm8-backend .

# Run container
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e FRONTEND_URL=http://localhost:5173 \
  deepm8-backend

# Test health endpoint
curl http://localhost:3001/health
```

---

## 📊 Railway Monitoring

### View Logs
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs
```

### Metrics
- Go to Railway Dashboard → Metrics
- Monitor CPU, Memory, Network usage
- Check deployment history

---

## ⚙️ Scaling on Railway

Railway automatically scales based on traffic. For better performance:

1. **Upgrade Plan** - Railway Pro ($20/mo) for better resources
2. **Horizontal Scaling** - Railway can auto-scale instances
3. **Caching** - Add Redis for puzzle caching (optional)

---

## 🔒 Security Best Practices

1. **CORS** - Only allow your Vercel domain
2. **Rate Limiting** - Add express-rate-limit (recommended)
3. **Environment Variables** - Never commit .env files
4. **HTTPS Only** - Railway provides SSL automatically

---

## 🐛 Troubleshooting

### Stockfish not working
```bash
# Verify Stockfish is installed in container
railway run stockfish

# Check logs
railway logs --tail 100
```

### Socket.io connection failed
```bash
# Verify CORS settings in server.ts
# Check VITE_SOCKET_URL in frontend
# Ensure WebSocket support is enabled on Railway
```

### High CPU usage
```bash
# Reduce Stockfish depth in API calls
# Add request throttling
# Monitor with railway metrics
```

---

## 📈 Performance Optimization

1. **Puzzle Caching**
   ```typescript
   // Cache generated puzzles in memory or Redis
   const puzzleCache = new Map<string, Puzzle[]>();
   ```

2. **Stockfish Pool**
   ```typescript
   // Use multiple Stockfish instances for concurrent requests
   class StockfishPool { ... }
   ```

3. **Rate Limiting**
   ```typescript
   import rateLimit from 'express-rate-limit';
   const limiter = rateLimit({ windowMs: 60000, max: 100 });
   app.use('/api/', limiter);
   ```

---

## 🎯 Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Get Railway URL
3. ✅ Configure frontend environment variables
4. ✅ Deploy frontend to Vercel
5. ✅ Test end-to-end integration

---

## 📞 Support

- **Railway Docs**: https://docs.railway.app
- **Socket.io Docs**: https://socket.io/docs/v4
- **Stockfish**: https://stockfishchess.org

---

**Built with ❤️ for DeepM8 Chess Training Platform**
