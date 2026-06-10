# 🚀 Guía de Despliegue en Railway - DeepM8 Backend

## ✅ Configuración Actual

Tu backend está **listo para Railway** con los siguientes archivos:

- ✅ `Dockerfile` - Build optimizado con Node.js 18 Alpine
- ✅ `railway.json` - Configuración de Railway (usa DOCKERFILE builder)
- ✅ `.dockerignore` - Optimización de build
- ✅ `index.js` - Servidor Express con API de OpenAI
- ✅ `package.json` - Dependencias correctas

---

## 📦 Arquitectura del Build

```
Railway Build Process:
1. Detecta Dockerfile en /server
2. Construye imagen Docker (Node 18 Alpine)
3. Instala dependencias (npm ci --only=production)
4. Copia index.js
5. Health check automático en /health
6. Deploy con usuario no-root (seguridad)
```

---

## 🔧 Pasos de Despliegue

### **Método 1: Railway UI (Recomendado)**

1. **Sube los cambios a Git**:
   ```bash
   cd server
   git add .
   git commit -m "Optimize Railway Dockerfile configuration"
   git push
   ```

2. **Configura el proyecto en Railway**:
   - Ve a [Railway.app](https://railway.app)
   - Click en "New Project" → "Deploy from GitHub repo"
   - Selecciona tu repositorio
   - **Root Directory**: `server` (importante!)
   - Railway detectará automáticamente el Dockerfile

3. **Configura Variables de Entorno**:
   - En el dashboard de Railway, ve a **Variables**
   - Agrega estas variables:
     ```
     OPENAI_API_KEY=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
     NODE_ENV=production
     ```
   - **Nota**: `PORT` se configura automáticamente por Railway

4. **Deploy**:
   - Railway iniciará el build automáticamente
   - Espera ~2-3 minutos
   - Verifica logs en tiempo real

5. **Obtén la URL pública**:
   - Click en "Settings" → "Generate Domain"
   - Copia la URL (ej: `https://deepm8-backend-production.up.railway.app`)

---

### **Método 2: Railway CLI**

```bash
# 1. Instalar Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Crear proyecto (primera vez) o vincular existente
cd server
railway init  # Para nuevo proyecto
# O
railway link  # Para proyecto existente

# 4. Configurar variables de entorno
railway variables set OPENAI_API_KEY="sk-proj-NupS2..."
railway variables set NODE_ENV="production"

# 5. Deploy
railway up

# 6. Ver logs
railway logs
```

---

## 🧪 Verificación Post-Despliegue

### **1. Health Check**
```bash
curl https://TU-URL.railway.app/health
```

**Respuesta esperada**:
```json
{
  "status": "ok",
  "service": "DeepM8 Backend API",
  "timestamp": "2026-06-10T01:23:45.678Z"
}
```

### **2. Test de Chat IA**
```bash
curl -X POST https://TU-URL.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hola, ¿puedes explicarme una apertura de ajedrez?"}
    ]
  }'
```

**Respuesta esperada**:
```json
{
  "content": "¡Claro! Las aperturas de ajedrez son...",
  "model": "gpt-4o-mini",
  "usage": {
    "promptTokens": 25,
    "completionTokens": 150,
    "totalTokens": 175
  }
}
```

---

## 🐛 Solución de Problemas

### **Error: "Build failed"**
- Verifica que `railway.json` tenga `"builder": "DOCKERFILE"`
- Asegúrate de que el archivo `Dockerfile` exista en `/server`
- Revisa los logs de build en Railway dashboard

### **Error: "Cannot find module 'express'"**
- Verifica que `package.json` esté en la misma carpeta que `index.js`
- Railway debe ejecutar `npm ci --only=production`
- Revisa los logs de build

### **Error: "Health check failed"**
- Verifica que el servidor inicie en el puerto correcto: `process.env.PORT`
- Railway asigna el puerto automáticamente
- Revisa logs con `railway logs`

### **Error: "OpenAI API error 401"**
- Verifica que `OPENAI_API_KEY` esté configurado en Railway Variables
- No incluyas comillas adicionales en la variable de entorno
- Verifica que la API key sea válida en https://platform.openai.com

---

## 🔒 Seguridad

✅ **Implementado**:
- Usuario no-root en Docker
- Health checks automáticos
- Variables de entorno protegidas
- CORS configurado para dominios específicos
- Rate limiting básico (50 mensajes por conversación)

⚠️ **Recomendaciones adicionales para producción**:
1. Implementar rate limiting avanzado (ej: express-rate-limit)
2. Agregar autenticación con JWT
3. Configurar monitoreo con Railway Metrics
4. Implementar logging con Winston o similar

---

## 📊 Monitoreo

### **Railway Dashboard**
- **Metrics**: CPU, RAM, Network
- **Logs**: Logs en tiempo real
- **Deployments**: Historial de deploys

### **OpenAI Usage**
- Monitorea uso de API en: https://platform.openai.com/usage
- Configura límites de gasto en OpenAI dashboard

---

## 🔄 Actualizar el Backend

```bash
# 1. Haz cambios en el código
# 2. Commit y push
git add .
git commit -m "Update backend logic"
git push

# Railway re-deploya automáticamente en cada push
```

---

## 💰 Costos Estimados

**Railway (Free Tier)**:
- $5 USD de crédito gratis al mes
- Suficiente para ~500 horas de uptime
- Perfecto para proyectos pequeños/medianos

**Upgrade a Pro ($20/mes)**:
- Recursos ilimitados
- Mejor performance
- Soporte prioritario

---

## 📝 Siguiente Paso

Una vez desplegado el backend, actualiza la URL en el frontend:

```env
# .env en la raíz del proyecto frontend
VITE_BACKEND_URL=https://TU-URL.railway.app
```

---

## 🎯 Checklist Final

- [ ] Dockerfile optimizado
- [ ] railway.json configurado con DOCKERFILE builder
- [ ] Variables de entorno configuradas en Railway
- [ ] Health check responde correctamente
- [ ] API de chat funciona con OpenAI
- [ ] URL pública generada
- [ ] Frontend actualizado con nueva URL
- [ ] CORS configurado para dominio de producción

---

**¡Tu backend está listo para Railway!** 🚀

Para cualquier problema, revisa los logs con:
```bash
railway logs --follow
```
