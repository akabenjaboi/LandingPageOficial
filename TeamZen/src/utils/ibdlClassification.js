// Utilidades de clasificación para el Inventario Breve de Desgaste Laboral,
// versión corta (IBDL-6) — ver inventario-breve-burnout.md en la raíz del repo.
// Reemplaza al MBI de 22 ítems como formulario de evaluación periódica.
// Escala por ítem: 1-5. Tres dimensiones, 2 ítems cada una:
//   AG (Agotamiento) y CI (Cinismo/distanciamiento): suma directa, rango 2-10.
//   EF (Eficacia percibida): ítems en positivo, se invierte (6-valor por ítem,
//   o 12-suma) al calcular el riesgo — mayor EF crudo = mejor.

export const IBDL_ITEM_COUNTS = { AG: 2, CI: 2, EF: 2 };
export const IBDL_SUBSCALE_MAX = { AG: 10, CI: 10, EF: 10 };
export const IBDL_TOTAL_RANGE = { min: 6, max: 30 };

// Riesgo total = AG + CI + (12 - EF), rango 6-30.
export function computeIbdlTotalRisk(ag, ci, ef) {
  if ([ag, ci, ef].some((v) => v == null)) return null;
  return ag + ci + (12 - ef);
}

// Bandas de interpretación del inventario (provisionales, ver notas del .md).
export function classifyIbdlTotal(total) {
  if (total == null) return null;
  if (total <= 12) return 'Bajo';
  if (total <= 18) return 'Moderado';
  if (total <= 24) return 'Alto';
  return 'Muy alto';
}

export function classifyIbdl(agRaw, ciRaw, efRaw) {
  const total = computeIbdlTotalRisk(agRaw, ciRaw, efRaw);
  return { total, level: classifyIbdlTotal(total) };
}

// Índice de bienestar 0-100 análogo al de MBI (computeWellbeingFromScores):
// AG y CI invertidos (mayor puntaje = peor), EF directo (mayor = mejor),
// normalizados 0..1 y promediados. Mismo shape que el índice anterior para
// poder reutilizar el dashboard, el gráfico de tendencia y sus zonas de
// riesgo (0-40 / 40-70 / 70-100) sin cambios.
export function computeWellbeingFromIbdlScores(ag, ci, ef) {
  if ([ag, ci, ef].some((v) => v == null)) return null;
  const { AG: maxAG, CI: maxCI, EF: maxEF } = IBDL_SUBSCALE_MAX;
  const minAG = 2, minCI = 2, minEF = 2;
  const agWell = 1 - ((ag - minAG) / ((maxAG - minAG) || 1));
  const ciWell = 1 - ((ci - minCI) / ((maxCI - minCI) || 1));
  const efWell = (ef - minEF) / ((maxEF - minEF) || 1);
  return ((agWell + ciWell + efWell) / 3) * 100;
}

export function formatRawWithDenominator(ag, ci, ef) {
  return {
    ag: ag != null ? `${ag} / ${IBDL_SUBSCALE_MAX.AG}` : '—',
    ci: ci != null ? `${ci} / ${IBDL_SUBSCALE_MAX.CI}` : '—',
    ef: ef != null ? `${ef} / ${IBDL_SUBSCALE_MAX.EF}` : '—',
  };
}

export const IBDL_CLASSIFICATION_NOTE =
  'Nivel de riesgo según el Inventario Breve de Desgaste Laboral (IBDL-6): suma de Agotamiento + Cinismo + Eficacia percibida (invertida), rango 6-30. 6-12 Bajo, 13-18 Moderado, 19-24 Alto, 25-30 Muy alto. No es un instrumento diagnóstico — sirve para screening/monitoreo, con bandas provisionales a recalibrar con datos piloto.';
