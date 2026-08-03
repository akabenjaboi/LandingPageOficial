// ================================
// GROQ CLIENT - VERSIÓN SEGURA VIA PROXY CON CACHÉ
// ================================
import { classifyMBI, computeBurnoutStatus, interpretBurnoutLevel } from './mbiClassification';
import { supabase } from '../../supabaseClient';
import { getCachedAnalysis, saveCachedAnalysis } from './aiCacheManager';

// 🔒 SEGURIDAD: llamadas a Groq pasan por la Edge Function "groq-proxy" de
// Supabase (nunca directo desde el navegador). supabase.functions.invoke()
// adjunta el token de sesión automáticamente.

function extractFunctionError(error) {
  const status = error?.context?.status;
  if (status === 401) return 'Autenticación inválida. Inicia sesión nuevamente.';
  if (status === 429) return 'Límite de requests excedido. Espera unos minutos e intenta de nuevo.';
  if (status >= 500) return 'Servidor temporalmente no disponible.';
  return error?.message || 'Error desconocido conectando con IA externa.';
}

/**
 * Genera consejos externos usando Groq AI con sistema de caché inteligente
 * @param {Object} mbiData - Datos del Maslach Burnout Inventory
 * @param {string} teamId - ID del equipo (requerido para caché)
 * @param {string} cycleId - ID del ciclo actual (requerido para caché)
 * @param {boolean} forceRegenerate - Forzar regeneración ignorando caché
 * @returns {Promise<Object>} - Consejos estructurados con metadatos de caché
 */
export async function generateAdviceWithCache(mbiData, teamId, analysisId, forceRegenerate = false) {
  const isWeeklyAnalysis = analysisId.startsWith('weekly-');
  const analysisType = isWeeklyAnalysis ? 'weekly' : 'cycle';
  
  console.log('🤖 Iniciando análisis de IA con caché...', { 
    teamId, 
    analysisId, 
    analysisType,
    forceRegenerate 
  });

  try {
    // 1. Si no se fuerza regeneración, intentar obtener desde caché
    if (!forceRegenerate) {
      const cachedResult = await getCachedAnalysis(teamId, analysisId, mbiData, analysisType);
      if (cachedResult) {
        console.log('✅ Análisis obtenido desde caché');
        return {
          ...cachedResult.analysis,
          // Metadatos de caché
          _cacheInfo: {
            fromCache: true,
            createdAt: cachedResult.createdAt,
            expiresAt: cachedResult.expiresAt,
            isRecent: (Date.now() - new Date(cachedResult.createdAt).getTime()) < 5 * 60 * 1000, // 5 min
            analysisType
          }
        };
      }
    }

    // 2. No hay caché válido o se forzó regeneración - generar nuevo análisis
    console.log('🔄 Generando nuevo análisis de IA...', { 
      analysisType 
    });
    const freshAnalysis = await generateExternalAdvice(mbiData);

    // 3. Guardar en caché (no bloquear si falla)
    try {
      await saveCachedAnalysis(teamId, analysisId, freshAnalysis, mbiData, analysisType);
    } catch (cacheError) {
      console.warn('⚠️ Error guardando en caché (continuando):', cacheError);
    }

    // 4. Retornar análisis fresco con metadatos
    return {
      ...freshAnalysis,
      _cacheInfo: {
        fromCache: false,
        createdAt: new Date().toISOString(),
        isRecent: true,
        regenerated: forceRegenerate,
        analysisType
      }
    };

  } catch (error) {
    console.error('💥 Error en análisis de IA con caché:', error);
    throw error;
  }
}

/**
 * Genera consejos externos usando Groq AI a través de proxy seguro (función original)
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
    
    const { data: result, error } = await supabase.functions.invoke('groq-proxy/chat', {
      body: {
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
      }
    });

    if (error) {
      console.error('❌ Error de la función groq-proxy:', error);
      throw new Error(extractFunctionError(error));
    }

    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Respuesta de IA incompleta');
    }

    const content = result.choices[0].message.content;
    return parseResponse(content);

  } catch (error) {
    console.error('💥 Error completo en Groq proxy:', error);

    if (error.message.includes('JSON')) {
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

/**
 * Genera análisis personal para un usuario específico con caché
 * @param {Object} userData - Datos del usuario (perfil + historial MBI)
 * @param {boolean} forceRegenerate - Forzar regeneración ignorando caché
 * @returns {Promise<Object>} - Análisis personal estructurado
 */
export async function generatePersonalAnalysisWithCache(userData, forceRegenerate = false) {
  const { getCachedUserAnalysis, saveUserAnalysisCache } = await import('./userAnalysisCacheManager');
  
  console.log('🧑 Iniciando análisis personal con caché...', { 
    userId: userData.userId,
    forceRegenerate,
    profileExists: !!userData.profile,
    mbiHistoryCount: userData.mbiHistory?.length || 0
  });

  try {
    // 1. Si no se fuerza regeneración, intentar obtener desde caché
    if (!forceRegenerate) {
      console.log('🔍 Buscando análisis en caché para usuario:', userData.userId);
      const cachedResult = await getCachedUserAnalysis(userData.userId, userData);
      if (cachedResult) {
        console.log('🎉 Análisis personal obtenido desde caché exitosamente');
        return cachedResult;
      } else {
        console.log('❌ No se encontró caché válido, generando nuevo análisis');
      }
    } else {
      console.log('🔄 Regeneración forzada - saltando caché');
    }

    // 2. No hay caché válido - generar nuevo análisis
    console.log('🔄 Generando nuevo análisis personal...');
    const freshAnalysis = await generatePersonalAdvice(userData);

    // 3. Guardar en caché (no bloquear si falla)
    try {
      console.log('💾 Intentando guardar análisis en caché para usuario:', userData.userId);
      await saveUserAnalysisCache(userData.userId, userData, freshAnalysis);
      console.log('✅ Análisis guardado en caché exitosamente');
    } catch (cacheError) {
      console.error('❌ Error guardando análisis personal en caché:', cacheError);
      console.error('📋 Detalles del error:', cacheError.message);
    }

    console.log('🎯 Retornando análisis fresco con fromCache: false');
    return {
      ...freshAnalysis,
      fromCache: false,
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error en análisis personal:', error);
    throw new Error('No se pudo generar el análisis personal: ' + error.message);
  }
}

/**
 * Genera análisis personal usando IA (función principal)
 */
async function generatePersonalAdvice(userData) {
  const { mbiHistory, profile } = userData;
  
  // Validar datos mínimos
  if (!mbiHistory || mbiHistory.length === 0) {
    throw new Error('No hay historial de evaluaciones MBI disponible');
  }

  // Obtener sesión de Supabase para autenticación
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Autenticación requerida para acceso a IA externa');
  }

  const prompt = buildPersonalPrompt(userData);
  
  console.log('📝 Prompt generado para análisis personal:', prompt.substring(0, 200) + '...');

  try {
    const { data, error } = await supabase.functions.invoke('groq-proxy', {
      body: {
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: 0.3
      }
    });

    if (error) {
      throw new Error(extractFunctionError(error));
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Respuesta vacía de la IA');
    }

    return parsePersonalAnalysisResponse(content);

  } catch (error) {
    console.error('❌ Error en generatePersonalAdvice:', error);
    throw error;
  }
}

/**
 * Construye el prompt para análisis personal
 */
function buildPersonalPrompt(userData) {
  const { mbiHistory, profile } = userData;
  
  let prompt = `Eres un psicólogo experto en burnout laboral. Analiza el historial MBI personal de este empleado y genera recomendaciones personalizadas.

INFORMACIÓN DEL EMPLEADO:
- Cargo: ${profile?.job_title || 'No especificado'}
- Tipo de empleo: ${profile?.employment_type === 'full-time' ? 'Tiempo completo' : profile?.employment_type === 'part-time' ? 'Medio tiempo' : 'No especificado'}
- Fecha de inicio: ${profile?.start_date ? new Date(profile.start_date).toLocaleDateString() : 'No especificada'}`;

  if (profile?.job_description) {
    prompt += `\n- Descripción del trabajo: ${profile.job_description}`;
  }

  prompt += `\n\nHISTORIAL DE EVALUACIONES MBI (${mbiHistory.length} evaluaciones):`;
  
  // Mostrar las últimas 6 evaluaciones máximo, ordenadas cronológicamente
  const recentHistory = mbiHistory
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-6);

  recentHistory.forEach((response, index) => {
    const scores = response.mbi_scores;
    if (!scores) return;
    
    const { catAE, catD, catRP } = classifyMBI(scores.ae_score, scores.d_score, scores.rp_score);
    const status = computeBurnoutStatus({ catAE, catD, catRP });
    const date = new Date(response.created_at).toLocaleDateString();
    
    prompt += `\n${index + 1}. ${date}: AE=${scores.ae_score}/54 (${catAE}), D=${scores.d_score}/30 (${catD}), RP=${scores.rp_score}/48 (${catRP}) → ${status}`;
    
    if (response.team_id) {
      prompt += ` [Equipo: ${response.teams?.name || 'Desconocido'}]`;
    } else {
      prompt += ` [Evaluación individual]`;
    }
  });

  // Análisis de tendencias si hay múltiples evaluaciones
  if (recentHistory.length > 1) {
    const first = recentHistory[0].mbi_scores;
    const latest = recentHistory[recentHistory.length - 1].mbi_scores;
    
    prompt += `\n\nTENDENCIAS OBSERVADAS:`;
    prompt += `\n- Agotamiento Emocional: ${first.ae_score} → ${latest.ae_score} (${latest.ae_score - first.ae_score > 0 ? 'Incremento' : latest.ae_score - first.ae_score < 0 ? 'Mejora' : 'Estable'})`;
    prompt += `\n- Despersonalización: ${first.d_score} → ${latest.d_score} (${latest.d_score - first.d_score > 0 ? 'Incremento' : latest.d_score - first.d_score < 0 ? 'Mejora' : 'Estable'})`;
    prompt += `\n- Realización Personal: ${first.rp_score} → ${latest.rp_score} (${latest.rp_score - first.rp_score > 0 ? 'Mejora' : latest.rp_score - first.rp_score < 0 ? 'Declive' : 'Estable'})`;
  }

  prompt += `\n\nResponde ÚNICAMENTE con JSON válido (sin texto antes o después, sin comillas dobles dentro de strings):
{
  "personal_summary": "Resumen del estado personal actual en máximo 2 líneas",
  "trend_analysis": "${recentHistory.length > 1 ? 'Análisis detallado de cómo ha evolucionado tu bienestar laboral' : 'null'}",
  "strengths": ["Fortaleza 1", "Fortaleza 2"],
  "risk_areas": ["Área de riesgo 1", "Área de riesgo 2"],
  "personalized_recommendations": [
    {
      "category": "Inmediato",
      "action": "Técnica o ejercicio que puedes hacer hoy mismo en casa o en el trabajo",
      "why": "Beneficio inmediato que obtendrás"
    },
    {
      "category": "Corto plazo",
      "action": "Hábito personal que puedes implementar en tu rutina diaria",
      "why": "Cómo esto mejorará tu situación específica"
    },
    {
      "category": "Largo plazo", 
      "action": "Estrategia personal de autocuidado y desarrollo que no depende de tu empleador",
      "why": "Impacto a largo plazo en tu bienestar personal"
    }
  ],
  "burnout_level": "Alto/Medio/Bajo",
  "next_evaluation_suggestion": "Recomendación de cuándo hacer la próxima evaluación"
}

REGLAS CRÍTICAS:
- Responde SOLO el JSON, nada más
- NO uses comillas dobles dentro de los strings (usa comillas simples si necesitas)
- NO incluyas saltos de línea dentro de los valores de string
- Todos los consejos deben ser acciones que TÚ puedes hacer por tu cuenta
- NO sugieras tomar días libres, cambiar horarios, o hablar con el jefe
- Enfócate en técnicas de respiración, ejercicios, organización personal, mindfulness, actividades en casa
- Considera que trabajas en: ${profile?.job_title || 'un entorno laboral'} 
- Los consejos deben ser específicos para tu situación laboral actual
- Usa un tono directo y personal (habla en segunda persona)`;

  return prompt;
}

/**
 * Parsea y valida la respuesta del análisis personal
 */
function parsePersonalAnalysisResponse(content) {
  try {
    console.log('🔍 Contenido original recibido:', content);
    
    // Limpiar la respuesta de manera más agresiva
    let cleanContent = content
      .replace(/```json\s*|\s*```/g, '') // Remover markdown
      .replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, '') // Remover saltos de línea al inicio/final
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remover caracteres de control
      .replace(/[""]/g, '"') // Normalizar comillas tipográficas
      .replace(/['']/g, "'") // Normalizar comillas simples tipográficas
      .replace(/\u00A0/g, ' ') // Convertir espacios no rompibles a espacios normales
      .trim();
    
    console.log('🧹 Contenido después de limpieza inicial:', cleanContent);
    
    // Intentar extraer JSON si hay texto adicional
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
      console.log('📊 JSON extraído:', cleanContent);
    }
    
    // Validar que sea JSON válido antes de parsear
    if (!cleanContent.startsWith('{') || !cleanContent.endsWith('}')) {
      throw new Error('Contenido no parece ser JSON válido');
    }
    
    // Intentar reparar comillas problemáticas
    cleanContent = cleanContent
      .replace(/"\s*:\s*"/g, '":"') // Normalizar espacios alrededor de :
      .replace(/",\s*"/g, '","') // Normalizar espacios alrededor de ,
      .replace(/'\s+/g, ' ') // Normalizar espacios múltiples
      .replace(/\s+'/g, ' '); // Normalizar espacios múltiples
    
    console.log('🔧 JSON después de reparaciones:', cleanContent);
    
    const parsed = JSON.parse(cleanContent);
    
    return {
      personal_summary: String(parsed.personal_summary || '').trim(),
      trend_analysis: parsed.trend_analysis && parsed.trend_analysis !== 'null' ? String(parsed.trend_analysis).trim() : null,
      strengths: extractArray(parsed.strengths).slice(0, 5),
      risk_areas: extractArray(parsed.risk_areas).slice(0, 5),
      personalized_recommendations: (parsed.personalized_recommendations || []).slice(0, 5).map(rec => ({
        category: String(rec.category || '').trim(),
        action: String(rec.action || '').trim(),
        why: String(rec.why || '').trim()
      })),
      burnout_level: String(parsed.burnout_level || '').trim(),
      next_evaluation_suggestion: String(parsed.next_evaluation_suggestion || '').trim()
    };
    
  } catch (error) {
    console.error('❌ Error parseando respuesta de análisis personal:', error);
    console.error('📄 Contenido que causó el error:', content);
    
    // Intento de recuperación: extraer datos manualmente si es posible
    try {
      console.log('🚨 Intentando recuperación manual de datos...');
      
      const fallbackData = extractDataManually(content);
      if (fallbackData) {
        console.log('✅ Recuperación exitosa');
        return fallbackData;
      }
    } catch (recoveryError) {
      console.log('❌ Recuperación manual falló:', recoveryError);
    }
    
    // Fallback final: retornar análisis básico
    console.log('🛡️ Usando fallback de análisis básico');
    return {
      personal_summary: 'Error procesando el análisis. Por favor, intenta actualizar.',
      trend_analysis: null,
      strengths: ['Resiliencia ante desafíos'],
      risk_areas: ['Necesita análisis más detallado'],
      personalized_recommendations: [
        {
          category: 'Inmediato',
          action: 'Respira profundo 5 veces cuando sientas estrés',
          why: 'Activa el sistema nervioso parasimpático y reduce la ansiedad'
        },
        {
          category: 'Corto plazo',
          action: 'Establece una rutina de 10 minutos de ejercicio diario',
          why: 'Mejora el estado de ánimo y reduce el estrés laboral'
        },
        {
          category: 'Largo plazo',
          action: 'Desarrolla un hobby fuera del trabajo',
          why: 'Crea un equilibrio vida-trabajo saludable'
        }
      ],
      burnout_level: 'Medio',
      next_evaluation_suggestion: 'Evalúa nuevamente en 2-3 semanas para seguimiento'
    };
  }
}

/**
 * Función de recuperación manual para extraer datos del contenido
 */
function extractDataManually(content) {
  const data = {
    personal_summary: '',
    trend_analysis: null,
    strengths: [],
    risk_areas: [],
    personalized_recommendations: [],
    burnout_level: 'Medio',
    next_evaluation_suggestion: ''
  };
  
  // Extraer resumen personal
  const summaryMatch = content.match(/"personal_summary":\s*"([^"]+)"/);
  if (summaryMatch) data.personal_summary = summaryMatch[1];
  
  // Extraer nivel de burnout
  const burnoutMatch = content.match(/"burnout_level":\s*"([^"]+)"/);
  if (burnoutMatch) data.burnout_level = burnoutMatch[1];
  
  // Extraer sugerencia de próxima evaluación
  const nextEvalMatch = content.match(/"next_evaluation_suggestion":\s*"([^"]+)"/);
  if (nextEvalMatch) data.next_evaluation_suggestion = nextEvalMatch[1];
  
  // Extraer fortalezas (array simple)
  const strengthsMatch = content.match(/"strengths":\s*\[([^\]]+)\]/);
  if (strengthsMatch) {
    const strengthsStr = strengthsMatch[1];
    data.strengths = strengthsStr.split(',').map(s => s.replace(/"/g, '').trim()).filter(s => s);
  }
  
  // Extraer áreas de riesgo
  const riskMatch = content.match(/"risk_areas":\s*\[([^\]]+)\]/);
  if (riskMatch) {
    const riskStr = riskMatch[1];
    data.risk_areas = riskStr.split(',').map(s => s.replace(/"/g, '').trim()).filter(s => s);
  }
  
  return Object.keys(data).some(key => data[key] && data[key] !== '') ? data : null;
}
