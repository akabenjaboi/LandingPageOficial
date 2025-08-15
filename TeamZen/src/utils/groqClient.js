// ================================
// GROQ CLIENT - VERSIÓN SEGURA VIA PROXY
// ================================
import { classifyMBI, computeBurnoutStatus, interpretBurnoutLevel } from './mbiClassification';
import { supabase } from '../../supabaseClient';

// 🔒 SEGURIDAD: Ahora usamos proxy server en lugar de API key directa
const PROXY_BASE_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';

/**
 * Genera consejos externos usando Groq AI a través de proxy seguro
 * @param {Object} mbiData - Datos del Maslach Burnout Inventory
 * @returns {Promise<Object>} - Consejos estructurados
 */
export async function generateExternalAdvice(mbiData) {
  // ✅ Obtener token de autenticación de Supabase
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    console.warn('⚠️ Usuario no autenticado para acceso a IA');
    throw new Error('Autenticación requerida para acceso a IA externa');
  }
  
  try {
    const prompt = buildPrompt(mbiData);
    
    console.log('🤖 Conectando con Groq via proxy seguro...', { 
      model: 'llama-3.1-8b-instant',
      promptLength: prompt.length 
    });
    
    // 🔒 CAMBIO CRÍTICO: Llamada a proxy en lugar de Groq directo
    const response = await fetch(`${PROXY_BASE_URL}/api/groq/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'Eres un psicólogo organizacional experto en prevención de burnout. Genera sugerencias específicas y prácticas basadas en los puntajes del Maslach Burnout Inventory. Responde siempre en formato JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'llama-3.1-8b-instant'
      })
    });

    console.log('📡 Respuesta del proxy:', { 
      status: response.status, 
      statusText: response.statusText,
      ok: response.ok 
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Error del proxy:', errorData);
      
      if (response.status === 401) {
        throw new Error('Autenticación inválida. Inicia sesión nuevamente.');
      } else if (response.status === 429) {
        throw new Error('Límite de requests excedido. Espera unos minutos e intenta de nuevo.');
      } else if (response.status >= 500) {
        throw new Error('Servidor temporalmente no disponible.');
      } else {
        throw new Error(errorData.error || `Error del servidor: ${response.status}`);
      }
    }

    const result = await response.json();
    console.log('✅ Respuesta exitosa del proxy');
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Respuesta de IA incompleta');
    }
    
    const content = result.choices[0].message.content;
    return parseResponse(content);
    
  } catch (error) {
    console.error('💥 Error completo en Groq proxy:', error);
    
    // Errores específicos más informativos
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Error de conexión con servidor proxy. Verifica que esté ejecutándose.');
    } else if (error.message.includes('JSON')) {
      throw new Error('Error procesando respuesta de IA. Intenta de nuevo.');
    } else {
      throw new Error(error.message || 'Error desconocido conectando con IA externa.');
    }
  }
}

function buildPrompt(mbiData) {
  const { ae, d, rp, wellbeing, previous, history, teamContext } = mbiData;
  
  // Usar EXACTAMENTE la misma lógica de clasificación que el sistema local
  const { catAE, catD, catRP } = classifyMBI(ae, d, rp);
  const burnoutStatus = computeBurnoutStatus({ catAE, catD, catRP });
  
  let prompt = `Analiza estos resultados del Maslach Burnout Inventory:

CONTEXTO DEL EQUIPO:
- Nombre: ${teamContext?.name || 'Equipo'}${teamContext?.description ? `
- Descripción/Área: ${teamContext.description}` : ''}
- Incluye líder en métricas: ${teamContext?.includeLeaderInMetrics ? 'Sí' : 'No'}

ESTADO ACTUAL (último ciclo):
- Agotamiento Emocional: ${ae}/54 → Nivel de burnout: ${catAE}
  * ${interpretBurnoutLevel(catAE, 'AE')}
  
- Despersonalización: ${d}/30 → Nivel de burnout: ${catD}
  * ${interpretBurnoutLevel(catD, 'D')}
  
- Realización Personal: ${rp}/48 → Nivel de burnout: ${catRP}
  * ${interpretBurnoutLevel(catRP, 'RP')}

- Índice de Bienestar: ${wellbeing}/100
- DIAGNÓSTICO ACTUAL: ${burnoutStatus}`;

  // Si hay datos históricos (múltiples ciclos), analizar la evolución
  if (history && history.length > 1) {
    prompt += `\n\nEVOLUCIÓN HISTÓRICA (${history.length} ciclos):`;
    
    history.forEach((cycle, index) => {
      const cycleNum = history.length - index; // Más reciente = mayor número
      const { catAE: hAE, catD: hD, catRP: hRP } = classifyMBI(cycle.ae, cycle.d, cycle.rp);
      const hStatus = computeBurnoutStatus({ catAE: hAE, catD: hD, catRP: hRP });
      
      prompt += `\nCiclo ${cycleNum}: AE=${cycle.ae} (${hAE}), D=${cycle.d} (${hD}), RP=${cycle.rp} (${hRP}) → ${hStatus}`;
    });
    
    // Análisis de tendencias
    const first = history[history.length - 1]; // Más antiguo
    const current = history[0]; // Más reciente
    
    prompt += `\n\nTENDENCIAS GENERALES:`;
    prompt += `\n- Agotamiento Emocional: ${first.ae} → ${current.ae} (${current.ae > first.ae ? 'EMPEORÓ ↑' : current.ae < first.ae ? 'MEJORÓ ↓' : 'ESTABLE →'})`;
    prompt += `\n- Despersonalización: ${first.d} → ${current.d} (${current.d > first.d ? 'EMPEORÓ ↑' : current.d < first.d ? 'MEJORÓ ↓' : 'ESTABLE →'})`;
    prompt += `\n- Realización Personal: ${first.rp} → ${current.rp} (${current.rp > first.rp ? 'MEJORÓ ↑' : current.rp < first.rp ? 'EMPEORÓ ↓' : 'ESTABLE →'})`;
    prompt += `\n- Bienestar Global: ${first.wellbeing} → ${current.wellbeing} (${current.wellbeing > first.wellbeing ? 'MEJORÓ ↑' : current.wellbeing < first.wellbeing ? 'EMPEORÓ ↓' : 'ESTABLE →'})`;
    
  } else if (previous) {
    // Análisis simple con ciclo anterior
    const trendAE = ae > previous.ae ? 'EMPEORÓ ↑' : ae < previous.ae ? 'MEJORÓ ↓' : 'ESTABLE →';
    const trendD = d > previous.d ? 'EMPEORÓ ↑' : d < previous.d ? 'MEJORÓ ↓' : 'ESTABLE →';
    const trendRP = rp > previous.rp ? 'MEJORÓ ↑' : rp < previous.rp ? 'EMPEORÓ ↓' : 'ESTABLE →';
    
    prompt += `\n\nCOMPARACIÓN CON CICLO ANTERIOR:`;
    prompt += `\n- AE: ${previous.ae} → ${ae} (${trendAE})`;
    prompt += `\n- D: ${previous.d} → ${d} (${trendD})`;
    prompt += `\n- RP: ${previous.rp} → ${rp} (${trendRP})`;
    prompt += `\n- Bienestar: ${previous.wellbeing} → ${wellbeing}`;
  }

  prompt += `\n\nResponde ÚNICAMENTE con este JSON exacto (sin texto adicional):
{
  "summary": "Resumen del estado actual ${history ? 'y evolución histórica' : ''} en máximo 2 líneas",
  "trend_analysis": "${history ? 'Análisis detallado de cómo cambió el equipo a lo largo del tiempo' : 'null'}",
  "key_risks": ["riesgo 1", "riesgo 2"],
  "recommended_actions": ["acción 1", "acción 2", "acción 3"],
  "prognosis": "${history ? 'Pronóstico a corto plazo si continúan las tendencias' : 'null'}"
}

REGLAS CRÍTICAS:
- Responde SOLO el JSON, sin explicaciones adicionales
- Usa exactamente los nombres de campos mostrados arriba
- El diagnóstico actual es "${burnoutStatus}" - basa todo en esto
- Si es primer ciclo o sin historia, usa "null" en trend_analysis y prognosis
- Máximo 4 riesgos, máximo 6 acciones
- Considera el contexto del equipo (${teamContext?.description || 'equipo general'}) para sugerencias específicas
- Las acciones deben ser prácticas y adaptadas al tipo de trabajo del equipo`;

  return prompt;
}

function parseResponse(content) {
  try {
    console.log('🔍 Contenido raw de Groq:', content);
    
    // Extraer JSON del contenido (a veces viene con texto adicional)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('⚠️ No se encontró JSON válido, intentando parsear todo el contenido');
      // Intentar parsear todo el contenido como JSON
      const parsed = JSON.parse(content.trim());
      return parseValidatedResponse(parsed);
    }
    
    const jsonString = jsonMatch[0];
    console.log('📝 JSON extraído:', jsonString);
    
    const parsed = JSON.parse(jsonString);
    return parseValidatedResponse(parsed);
    
  } catch (error) {
    console.error('💥 Error parseando respuesta:', error);
    console.error('📄 Contenido problemático:', content);
    
    // Fallback: crear respuesta básica desde el contenido
    return {
      summary: 'Análisis generado por IA externa (formato simplificado)',
      trendAnalysis: null,
      keyRisks: ['Se requiere revisión manual de la respuesta IA'],
      actions: ['Consultar análisis completo con el equipo', 'Revisar métricas en detalle'],
      prognosis: null
    };
  }
}

function parseValidatedResponse(parsed) {
  console.log('🧪 Validando respuesta:', parsed);
  
  // Manejo flexible de diferentes formatos de respuesta
  const summary = parsed.summary || parsed.resumen || parsed.analysis || 'Análisis completado';
  const trendAnalysis = parsed.trend_analysis || parsed.tendencias || parsed.evolution || null;
  const keyRisks = extractArray(parsed.key_risks || parsed.riesgos || parsed.risks || []);
  const actions = extractArray(parsed.recommended_actions || parsed.acciones || parsed.actions || []);
  const prognosis = parsed.prognosis || parsed.pronostico || parsed.forecast || null;
  
  const result = {
    summary: String(summary).trim(),
    trendAnalysis: trendAnalysis ? String(trendAnalysis).trim() : null,
    keyRisks: keyRisks.slice(0, 4),
    actions: actions.slice(0, 6),
    prognosis: prognosis ? String(prognosis).trim() : null
  };
  
  console.log('✅ Respuesta validada:', result);
  return result;
}

function extractArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return [value];
  return [];
}
