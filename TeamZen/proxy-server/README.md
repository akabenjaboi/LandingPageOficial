# 🔒 CONFIGURACIÓN SEGURA - TeamZen Proxy Server

## ⚠️ PASOS CRÍTICOS DE SEGURIDAD

### 1. **REGENERAR TODAS LAS API KEYS INMEDIATAMENTE**

#### Groq API Key:
1. Ve a https://console.groq.com/keys
2. **Elimina la key actual**: `***REMOVED-LEAKED-GROQ-KEY***`
3. Genera una nueva key
4. Actualiza `proxy-server/.env` con la nueva key

#### Supabase (si es necesario):
1. Ve a tu proyecto Supabase
2. Settings → API → Reset anon key (si quieres ser extra precavido)
3. La anon key es pública por diseño, pero asegúrate de que RLS esté configurado

### 2. **CONFIGURAR VARIABLES DE ENTORNO**

#### Frontend (TeamZen/.env):
```bash
# Solo estas variables (ya configuradas)
VITE_SUPABASE_URL=https://alzjmlnoaxqlkdtvwisr.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
VITE_PROXY_URL=http://localhost:3001
```

#### Proxy Server (proxy-server/.env):
```bash
# Actualiza con tus nuevas keys
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
GROQ_API_KEY=tu_nueva_groq_key_aqui
SUPABASE_URL=https://alzjmlnoaxqlkdtvwisr.supabase.co
SUPABASE_SERVICE_KEY=opcional_service_key_si_necesitas
```

### 3. **INSTALACIÓN Y EJECUCIÓN**

#### Proxy Server:
```bash
cd proxy-server
npm install
npm start
```

#### Frontend:
```bash
cd ../
npm run dev
```

### 4. **VERIFICACIÓN DE SEGURIDAD**

1. Abre el navegador en http://localhost:5173
2. Presiona F12 → Network tab
3. Realiza cualquier acción que use IA
4. **VERIFICA**: No debe aparecer ninguna API key de Groq en las requests
5. Solo debe aparecer la anon key de Supabase (que es pública)

### 5. **PRODUCCIÓN**

#### Variables de entorno de producción:
- Frontend: Solo `VITE_PROXY_URL=https://tu-servidor-proxy.com`
- Proxy: Todas las API keys como variables de entorno del servidor

#### Despliegue:
- Frontend: Vercel, Netlify, etc.
- Proxy: Railway, Render, Heroku, VPS, etc.

## 🛡️ MEJORES PRÁCTICAS

1. **Nunca** uses el prefijo `VITE_` para API keys sensibles
2. **Siempre** usa un proxy/server para API keys de terceros
3. **Rota** las API keys periódicamente
4. **Monitorea** el uso de APIs para detectar abuso
5. **Documenta** qué keys son públicas vs privadas

## 🔍 MONITOREO

- **Groq**: Revisa usage en https://console.groq.com/usage
- **Supabase**: Dashboard → API → Logs
- **GitHub**: Revisa notifications de secrets expuestos

## 🚨 EN CASO DE COMPROMISO

1. Regenera inmediatamente todas las keys
2. Revisa logs de acceso
3. Cambia contraseñas si es necesario
4. Notifica al equipo
