// Utilidades centralizadas de clasificación MBI según estándar psicométrico oficial
// Escala: cada ítem 0-6, sumas directas por subescala
// AE: 9 ítems (0-54), D: 5 ítems (0-30), RP: 8 ítems (0-48)

export const MBI_ITEM_COUNTS = { AE: 9, D: 5, RP: 8 };
export const MBI_MAX = { AE: 54, D: 30, RP: 48 };

// RANGOS OFICIALES DE BURNOUT (según literatura MBI):
// AGOTAMIENTO EMOCIONAL: 0-18 Bajo burnout, 19-26 Medio burnout, 27-54 Alto burnout
// DESPERSONALIZACIÓN: 0-6 Bajo burnout, 7-9 Medio burnout, 10-30 Alto burnout  
// REALIZACIÓN PERSONAL: 40-48 Bajo burnout, 34-39 Medio burnout, 0-33 Alto burnout
// 
// NOTA IMPORTANTE: Para RP, mayor puntaje = menor burnout (es inverso)
// Por eso 40-48 puntos = "Bajo burnout" = BUENA realización personal

export function classifyMBI(aeRaw, dRaw, rpRaw) {
  // Clasificación directa según rangos de burnout oficiales
  const catAE = aeRaw == null ? null : (aeRaw <= 18 ? 'Bajo' : aeRaw <= 26 ? 'Medio' : 'Alto');
  const catD  = dRaw == null ? null : (dRaw <= 6 ? 'Bajo' : dRaw <= 9 ? 'Medio' : 'Alto');
  const catRP = rpRaw == null ? null : (rpRaw >= 40 ? 'Bajo' : rpRaw >= 34 ? 'Medio' : 'Alto');
  return { catAE, catD, catRP };
}

// Interpretación clara: "Bajo/Medio/Alto" se refiere al nivel de BURNOUT en esa dimensión
export function interpretBurnoutLevel(category, dimension) {
  if (!category) return null;
  
  if (dimension === 'RP') {
    // Para Realización Personal: Alto burnout = baja realización = MALO
    return {
      'Bajo': 'Alta realización personal (saludable)',
      'Medio': 'Realización personal moderada (atención)', 
      'Alto': 'Baja realización personal (riesgo)'
    }[category];
  } else {
    // Para AE y D: Alto burnout = alto agotamiento/despersonalización = MALO
    return {
      'Bajo': `${dimension === 'AE' ? 'Poco agotamiento' : 'Poca despersonalización'} (saludable)`,
      'Medio': `${dimension === 'AE' ? 'Agotamiento' : 'Despersonalización'} moderado (atención)`,
      'Alto': `${dimension === 'AE' ? 'Alto agotamiento' : 'Alta despersonalización'} (riesgo)`
    }[category];
  }
}

export function computeBurnoutStatus({ catAE, catD, catRP }) {
  if (!catAE || !catD || !catRP) return null;
  const flags = [catAE === 'Alto', catD === 'Alto', catRP === 'Alto'];
  const count = flags.filter(Boolean).length;
  if (count >= 2 && catAE === 'Alto') {
    // Criterio: síndrome si puntúa "alto" en al menos dos subescalas siendo AE una de ellas
    if (count === 3) return 'Burnout';
    return 'Riesgo Alto';
  }
  if (count === 2 || count === 1) {
    return count === 2 ? 'Riesgo Alto' : 'Riesgo';
  }
  return 'Sin indicios';
}

export function formatRawWithDenominator(ae, d, rp) {
  return {
    ae: ae != null ? `${ae} / ${MBI_MAX.AE}` : '—',
    d: d != null ? `${d} / ${MBI_MAX.D}` : '—',
    rp: rp != null ? `${rp} / ${MBI_MAX.RP}` : '—'
  };
}

export const WELLBEING_NORMALIZATION = {
  MIN_AE: 0, MAX_AE: 54,
  MIN_D: 0, MAX_D: 30,
  MIN_RP: 0, MAX_RP: 48
};

export function computeWellbeingFromScores(ae, d, rp) {
  // ae y d invertidos, rp directo, todos normalizados 0..1 y luego promedio *100
  const { MIN_AE, MAX_AE, MIN_D, MAX_D, MIN_RP, MAX_RP } = WELLBEING_NORMALIZATION;
  if ([ae,d,rp].some(v => v == null)) return null;
  const aeWell = 1 - ((ae - MIN_AE) / ((MAX_AE - MIN_AE) || 1));
  const dWell  = 1 - ((d - MIN_D) / ((MAX_D - MIN_D) || 1));
  const rpWell = (rp - MIN_RP) / ((MAX_RP - MIN_RP) || 1);
  return ((aeWell + dWell + rpWell) / 3) * 100; // 0..100
}

export const CLASSIFICATION_NOTE = 'Clasificación de burnout según rangos oficiales MBI. AE: 0-18 Bajo, 19-26 Medio, 27-54 Alto. D: 0-6 Bajo, 7-9 Medio, 10-30 Alto. RP: 40-48 Bajo, 34-39 Medio, 0-33 Alto. Para RP: mayor puntaje = menor burnout.';
