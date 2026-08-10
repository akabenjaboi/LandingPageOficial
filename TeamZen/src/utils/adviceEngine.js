// Motor heurístico de sugerencias sin costo (no usa IA externa)
// Genera recomendaciones basadas en las dimensiones del IBDL-6
// (Agotamiento / Cinismo / Eficacia percibida).

import { classifyIbdl } from './ibdlClassification';

const ACTIONS = {
  AG: {
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
  CI: {
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
  EF: {
    Alto: [ // Alto = riesgo (baja eficacia percibida)
      'Definir metas de corto plazo celebrables',
      'Asignar mentoría cruzada',
      'Eliminar bloqueos estructurales a la autonomía'
    ],
    Medio: [
      'Clarificar criterios de éxito por entregable',
      'Feedback inmediato tras hitos menores'
    ],
    Bajo: [ // Buena eficacia percibida
      'Difundir prácticas que sostienen la motivación',
      'Prevenir sobrecarga que erosione el logro'
    ]
  },
  Global: {
    Alto: [
      'Retrospectiva enfocada en salud (30 min)',
      'Definir 1–2 métricas de recuperación (horas foco, pausas)'
    ],
    'Muy alto': [
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

// Categorización simple por dimensión (rango 2-10), usada solo para elegir
// qué acciones sugerir — el nivel de riesgo oficial es el total (classifyIbdl).
function categorize(value, invert = false) {
  if (value == null) return null;
  const risk = invert ? (12 - value) : value; // invierte para EF (alto EF = bajo riesgo)
  if (risk >= 8) return 'Alto';
  if (risk >= 5) return 'Medio';
  return 'Bajo';
}

// Importar cliente de Groq
import { generateExternalAdvice, generateAdviceWithCache } from './groqClient';

// Función para IA externa (wrapper legacy)
export async function getAIAdvice(ibdlData) {
  return await generateExternalAdvice(ibdlData);
}

// Nueva función para IA externa con caché inteligente
export async function getAIAdviceWithCache(ibdlData, teamId, analysisId, forceRegenerate = false) {
  return await generateAdviceWithCache(ibdlData, teamId, analysisId, forceRegenerate);
}

export function generateAdvice({ ag, ci, ef, wellbeing, previous }) {
  if ([ag, ci, ef, wellbeing].some(v => v == null)) {
    return { summary: 'Aún no hay suficientes respuestas para generar sugerencias.', keyRisks: [], actions: [], meta: {} };
  }
  const catAG = categorize(ag);
  const catCI = categorize(ci);
  const catEF = categorize(ef, true);
  const { level } = classifyIbdl(ag, ci, ef);

  const trends = previous ? {
    ag: ag > previous.ag ? 'sube' : ag < previous.ag ? 'baja' : 'estable',
    ci: ci > previous.ci ? 'sube' : ci < previous.ci ? 'baja' : 'estable',
    ef: ef > previous.ef ? 'sube' : ef < previous.ef ? 'baja' : 'estable',
    wellbeing: wellbeing > previous.wellbeing ? 'sube' : wellbeing < previous.wellbeing ? 'baja' : 'estable'
  } : null;

  const keyRisks = [];
  if (catAG === 'Alto') keyRisks.push('Agotamiento elevado');
  if (catCI === 'Alto') keyRisks.push('Cinismo / distanciamiento elevado');
  if (catEF === 'Alto') keyRisks.push('Baja eficacia percibida');

  const actions = new Set();
  pick(ACTIONS.AG[catAG], 2).forEach(a => actions.add(a));
  pick(ACTIONS.CI[catCI], 2).forEach(a => actions.add(a));
  pick(ACTIONS.EF[catEF], 2).forEach(a => actions.add(a));
  if (level === 'Alto') pick(ACTIONS.Global.Alto, 2).forEach(a => actions.add(a));
  if (level === 'Muy alto') pick(ACTIONS.Global['Muy alto'], 2).forEach(a => actions.add(a));

  const summaryParts = [];
  summaryParts.push(`Clasificación: AG ${catAG}, CI ${catCI}, EF ${catEF}. Nivel de riesgo: ${level || 'N/A'}.`);
  if (trends && previous) {
    const trendTxt = [`AG ${trends.ag}`, `CI ${trends.ci}`, `EF ${trends.ef}`, `Bienestar ${trends.wellbeing}`].join(', ');
    summaryParts.push(`Tendencias: ${trendTxt}.`);
  }
  if (keyRisks.length) summaryParts.push(`Riesgos clave: ${keyRisks.join('; ')}.`);

  return {
    summary: summaryParts.join(' '),
    keyRisks,
    actions: Array.from(actions).slice(0, 6),
    meta: { catAG, catCI, catEF, level }
  };
}
