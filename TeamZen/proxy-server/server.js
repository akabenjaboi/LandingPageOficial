const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ================================
// MIDDLEWARE DE SEGURIDAD
// ================================
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// ================================
// MIDDLEWARE DE AUTENTICACIÓN
// ================================
const authenticateUser = (req, res, next) => {
  const authToken = req.headers.authorization;
  
  // Aquí deberías validar el token de Supabase
  // Por ahora, ejemplo básico:
  if (!authToken) {
    return res.status(401).json({ error: 'Token de autorización requerido' });
  }
  
  next();
};

// ================================
// RUTAS GROQ API (PROTEGIDAS)
// ================================

/**
 * Endpoint para llamadas a Groq Chat Completions
 * POST /api/groq/chat
 */
app.post('/api/groq/chat', authenticateUser, async (req, res) => {
  try {
    const { messages, model = 'llama3-8b-8192' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array requerido' });
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        model,
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const data = await groqResponse.json();
    res.json(data);

  } catch (error) {
    console.error('Error en Groq proxy:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error procesando solicitud'
    });
  }
});

/**
 * Endpoint para análisis de datos con Groq
 * POST /api/groq/analyze
 */
app.post('/api/groq/analyze', authenticateUser, async (req, res) => {
  try {
    const { prompt, data, analysisType } = req.body;

    const messages = [
      {
        role: 'system',
        content: `Eres un analista experto en ${analysisType || 'datos de equipo'}. 
                 Proporciona análisis claros y accionables.`
      },
      {
        role: 'user',
        content: `${prompt}\n\nDatos: ${JSON.stringify(data)}`
      }
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        model: 'llama3-8b-8192',
        max_tokens: 1024,
        temperature: 0.5
      })
    });

    const result = await groqResponse.json();
    res.json(result);

  } catch (error) {
    console.error('Error en análisis Groq:', error);
    res.status(500).json({ error: 'Error en análisis' });
  }
});

/**
 * Endpoint para análisis personal de usuarios MBI
 * POST /api/groq
 */
app.post('/api/groq', authenticateUser, async (req, res) => {
  try {
    const { messages, model = 'llama3-8b-8192', max_tokens = 2048 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array requerido' });
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        model,
        max_tokens,
        temperature: 0.7
      })
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json().catch(() => ({}));
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await groqResponse.json();
    res.json(data);

  } catch (error) {
    console.error('Error en Groq proxy (análisis personal):', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error procesando solicitud'
    });
  }
});

// ================================
// HEALTH CHECK
// ================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// ================================
// MANEJO DE ERRORES
// ================================
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ================================
// INICIAR SERVIDOR
// ================================
app.listen(PORT, () => {
  console.log(`🚀 Proxy Server ejecutándose en puerto ${PORT}`);
  console.log(`🔒 Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

module.exports = app;
