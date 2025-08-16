// Motor heurístico de sugerencias sin costo (no usa IA externa)
// Genera recomendaciones basadas en las categorías MBI.

import { classifyMBI, computeBurnoutStatus } from './mbiClassification';

const ACTIONS = {
  AE: {
    Alto: [
      'Revisar cargas y priorizar micro‑pausas de 5–7 min cada 90 min',
      'Rotar tareas emocionalmente demandantes',
      'Bloquear horas sin reuniones para recuperación cognitiva'
    ],
    Medio: [
      'Monitorear horas extra antes de picos',
      'Check‑ins rápidos sobre energía semanal',
      'Introducir prácticas breves de respiración guiada'
    ],
    Bajo: [
      'Mantener hábitos de descanso efectivos',
      'Compartir buenas prácticas con otros equipos'
    ]
  },
  D: {
    Alto: [
      'Espacios de retroalimentación empática entre pares',
      'Rotar exposición a casos difíciles',
      'Debrief corto tras incidentes complejos'
    ],
    Medio: [
      'Recordar propósito en reunión semanal',
      'Reconocimiento específico de contribuciones'
    ],
    Bajo: [
      'Refuerzo del propósito actual',
      'Documentar historias de impacto'
    ]
  },
  RP: {
    Alto: [ // Alto = riesgo (baja realización)
      'Definir metas de corto plazo celebrables',
      'Asignar mentoría cruzada',
      'Eliminar bloqueos estructurales a la autonomía'
    ],
    Medio: [
      'Clarificar criterios de éxito por entregable',
      'Feedback inmediato tras hitos menores'
    ],
    Bajo: [ // Buena realización
      'Difundir prácticas que sostienen la motivación',
      'Prevenir sobrecarga que erosione logro'
    ]
  },
  Global: {
    RiesgoAlto: [
      'Retrospectiva enfocada en salud (30 min)',
      'Definir 1–2 métricas de recuperación (horas foco, pausas)'
    ],
    Burnout: [
      'Plan urgente: redistribuir carga y frenar tareas no críticas',
      'Evaluar soporte profesional externo'
    ]
  }
};

function pick(list, max = 2) {
  if (!list || !list.length) return [];
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(max, list.length));
}

// Importar cliente de Groq
import { generateExternalAdvice, generateAdviceWithCache } from './groqClient';

// Función para IA externa (wrapper legacy)
export async function getAIAdvice(mbiData) {
  return await generateExternalAdvice(mbiData);
}

// Nueva función para IA externa con caché inteligente
export async function getAIAdviceWithCache(mbiData, teamId, analysisId, forceRegenerate = false) {
  return await generateAdviceWithCache(mbiData, teamId, analysisId, forceRegenerate);
}

export function generateAdvice({ ae, d, rp, wellbeing, previous }) {
  if ([ae,d,rp,wellbeing].some(v => v == null)) {
    return { summary: 'Aún no hay suficientes respuestas para generar sugerencias.', keyRisks: [], actions: [], meta: {} };
  }
  const { catAE, catD, catRP } = classifyMBI(ae, d, rp);
  const status = computeBurnoutStatus({ catAE, catD, catRP });

  const trends = previous ? {
    ae: ae > previous.ae ? 'sube' : ae < previous.ae ? 'baja' : 'estable',
    d: d > previous.d ? 'sube' : d < previous.d ? 'baja' : 'estable',
    rp: rp > previous.rp ? 'sube' : rp < previous.rp ? 'baja' : 'estable',
    wellbeing: wellbeing > previous.wellbeing ? 'sube' : wellbeing < previous.wellbeing ? 'baja' : 'estable'
  } : null;

  const keyRisks = [];
  if (catAE === 'Alto') keyRisks.push('Agotamiento Emocional elevado');
  if (catD === 'Alto') keyRisks.push('Despersonalización elevada');
  if (catRP === 'Alto') keyRisks.push('Baja realización personal');

  const actions = new Set();
  pick(ACTIONS.AE[catAE], 2).forEach(a => actions.add(a));
  pick(ACTIONS.D[catD], 2).forEach(a => actions.add(a));
  pick(ACTIONS.RP[catRP], 2).forEach(a => actions.add(a));
  if (status === 'Riesgo Alto') pick(ACTIONS.Global.RiesgoAlto, 2).forEach(a => actions.add(a));
  if (status === 'Burnout') pick(ACTIONS.Global.Burnout, 2).forEach(a => actions.add(a));

  const summaryParts = [];
  summaryParts.push(`Clasificación: AE ${catAE}, D ${catD}, RP ${catRP}. Estado global: ${status || 'N/A'}.`);
  if (trends && previous) {
    const trendTxt = [`AE ${trends.ae}`, `D ${trends.d}`, `RP ${trends.rp}`, `Bienestar ${trends.wellbeing}`].join(', ');
    summaryParts.push(`Tendencias: ${trendTxt}.`);
  }
  if (keyRisks.length) summaryParts.push(`Riesgos clave: ${keyRisks.join('; ')}.`);

  return {
    summary: summaryParts.join(' '),
    keyRisks,
    actions: Array.from(actions).slice(0, 6),
    meta: { catAE, catD, catRP, status }
  };
}
