# DeepM8 Backend API

Backend seguro para DeepM8 Chess AI que protege el token de OpenAI.

## 🔒 Arquitectura de Seguridad

```
Frontend (React) → Backend API (/api/chat) → OpenAI
                   \\\[Token seguro aquí]
```

El token de OpenAI **NUNCA** se expone al frontend, manteniéndolo seguro de accesos no autorizados.

\---

## 🚀 Inicio Rápido

### 1\. Instalar dependencias

```bash
cd server
npm install
```

### 2\. Configurar variables de entorno

### 3\. Iniciar el servidor

```bash
npm start
```

Deberías ver:

```
🚀 DeepM8 Backend API Server
📡 Server running on http://localhost:3001
🔒 OpenAI API Key: \\\*\\\*\\\*6fA8A
⏰ Started at: \\\[timestamp]

Available endpoints:
  GET  /health       - Health check
  POST /api/chat     - Chat completions
```

\---

## 📡 Endpoints API

### **GET /health**

Health check del servidor.

**Response:**

```json
{
  "status": "ok",
  "service": "DeepM8 Backend API",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

\---

### **POST /api/chat**

Completions de chat con OpenAI (token seguro en backend).

**Request Body:**

```json
{
  "messages": \\\[
    { "role": "system", "content": "Eres un entrenador de ajedrez..." },
    { "role": "user", "content": "¿Cómo mejoro mi apertura?" }
  ],
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

**Response:**

```json
{
  "content": "Para mejorar tu apertura...",
  "model": "gpt-4o-mini",
  "usage": {
    "promptTokens": 50,
    "completionTokens": 200,
    "totalTokens": 250
  }
}
```

**Errores:**

* `400` - Request inválido
* `429` - Rate limit excedido
* `500` - Error interno del servidor

\---

## 🎮 Iniciar Frontend + Backend

### Opción 1: Dos terminales separadas

**Terminal 1 - Backend:**

```bash
cd server
npm start
```

**Terminal 2 - Frontend:**

```bash
cd ..
npm run dev
```

### Opción 2: Script combinado (agregar a package.json raíz)

```json
{
  "scripts": {
    "dev:backend": "cd server \\\&\\\& npm start",
    "dev:frontend": "vite",
    "dev": "concurrently \\\\"npm:dev:backend\\\\" \\\\"npm:dev:frontend\\\\""
  }
}
```

\---

## 🌐 Despliegue en Producción

### Backend (Opciones)

#### **1. Railway.app** (Recomendado - Gratis para empezar)

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Deploy
cd server
railway login
railway init
railway up
```

Railway detectará automáticamente tu `package.json` y variables de entorno.

#### **2. Render.com** (Gratis)

1. Conecta tu repositorio
2. Selecciona "Web Service"
3. Build command: `cd server \\\&\\\& npm install`
4. Start command: `cd server \\\&\\\& npm start`
5. Agrega las variables de entorno en la configuración

#### **3. Vercel Serverless**

Crea `server/api/chat.js`:

```javascript
import { OpenAI } from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI\\\_API\\\_KEY });
  const { messages, model, temperature, maxTokens } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: model || 'gpt-4o-mini',
      messages,
      temperature: temperature || 0.7,
      max\\\_tokens: maxTokens || 1000,
    });

    res.json({
      content: completion.choices\\\[0].message.content,
      model: completion.model,
      usage: {
        promptTokens: completion.usage.prompt\\\_tokens,
        completionTokens: completion.usage.completion\\\_tokens,
        totalTokens: completion.usage.total\\\_tokens,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Frontend

Actualiza `.env` con la URL del backend en producción:

```env
VITE\\\_BACKEND\\\_URL=https://tu-backend-en-produccion.com
```

\---

## 🔧 Desarrollo

### Modo watch (auto-restart en cambios)

```bash
cd server
npm run dev
```

### Testing del endpoint

```bash
# Health check
curl http://localhost:3001/health

# Chat request
curl -X POST http://localhost:3001/api/chat \\\\
  -H "Content-Type: application/json" \\\\
  -d '{
    "messages": \\\[
      {"role": "user", "content": "¿Qué es el gambito de dama?"}
    ]
  }'
```

\---

## 📦 Estructura de Archivos

```
server/
├── index.js           # Servidor Express principal
├── package.json       # Dependencias del backend
├── .env              # Variables de entorno (NO subir a git)
├── .gitignore        # Ignora .env y node\\\_modules
└── README.md         # Esta documentación

Frontend actualizado:
src/services/llmService.ts  # Ahora llama al backend en lugar de OpenAI directo
.env                        # URL del backend
```

\---

## 🔐 Seguridad

✅ **Token protegido**: Nunca se expone al frontend
✅ **CORS configurado**: Solo orígenes permitidos
✅ **Rate limiting**: Previene abuso (básico - mejorar en producción)
✅ **Validación de input**: Verifica requests antes de procesar
✅ **.env en .gitignore**: No se sube al repositorio

### Mejoras de seguridad recomendadas para producción:

1. **Rate limiting robusto**: Usar `express-rate-limit`
2. **Autenticación**: Agregar tokens JWT o API keys por usuario
3. **Logging**: Implementar Winston o similar
4. **Monitoring**: Agregar Sentry o similar
5. **HTTPS**: Forzar SSL en producción

\---

## 📝 Licencia

MIT - DeepM8 Chess AI

