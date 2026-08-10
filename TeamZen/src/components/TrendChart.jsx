import { useMemo, useState, useRef, useEffect } from 'react';

/*
  Simple multi-line trend chart (pure SVG, responsive) without external deps.
  Props:
    data: Array<{ label:string, values: { agAvg?:number, ciAvg?:number, efAvg?:number, wellbeing?:number } }>
*/
const METRICS = [
  { key: 'wellbeing', label: 'Bienestar ↑', color: '#55C2A2' },
  { key: 'agAvg', label: 'AG ↓', color: '#9D83C6' },
  { key: 'ciAvg', label: 'CI ↓', color: '#8B6FB8' },
  { key: 'efAvg', label: 'EF ↑', color: '#4AA690' },
];

// Bandas de riesgo de burnout, calibradas sobre el índice de Bienestar (0-100)
// — el mismo umbral <50 que ya dispara la alerta "bienestar bajo" en el
// dashboard, con un tercer nivel intermedio para dar más contexto visual.
const RISK_ZONES = [
  { from: 0, to: 40, label: 'Riesgo alto', fill: 'rgba(157,131,198,.16)', textColor: '#6f56a0' },
  { from: 40, to: 70, label: 'Zona de atención', fill: 'rgba(218,213,228,.4)', textColor: '#5B5B6B' },
  { from: 70, to: 100, label: 'Zona saludable', fill: 'rgba(85,194,162,.14)', textColor: '#3d8a74' },
];

export default function TrendChart({ data = [] }) {
  // Bienestar y AE visibles por defecto, D y RP ocultas — coincide con el
  // estado por defecto del panel de reportes del handoff de diseño.
  const [visible, setVisible] = useState(['wellbeing', 'agAvg']);
  const [containerWidth, setContainerWidth] = useState(640);
  const containerRef = useRef(null);

  // Responsive width detection
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(Math.max(280, width - 20)); // Minimum 280px, with padding
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const series = useMemo(() => {
    if (!data.length) return [];
    return METRICS.filter(m => visible.includes(m.key)).map(m => {
      return {
        key: m.key,
        label: m.label,
        color: m.color,
        points: data.map((d, idx) => ({ x: idx, y: d.values[m.key] == null ? null : d.values[m.key] }))
      };
    });
  }, [data, visible]);

  // Las zonas de riesgo están calibradas sobre la escala 0-100 del índice de
  // Bienestar: solo tienen sentido (y solo se dibujan) cuando esa serie está
  // visible. Con ella visible, el eje Y se fija a 0-100 en vez de autoescalar
  // al rango de los datos, para que las bandas sean un marco de referencia
  // estable de una ronda a otra en vez de saltar de tamaño cada vez.
  const showRiskZones = visible.includes('wellbeing');

  // Compute Y domain from existing numeric values
  const { minY, maxY } = useMemo(() => {
    if (showRiskZones) return { minY: 0, maxY: 100 };
    let vals = [];
    series.forEach(s => s.points.forEach(p => { if (p.y != null) vals.push(p.y); }));
    if (!vals.length) return { minY: 0, maxY: 1 };
    let min = Math.min(...vals); let max = Math.max(...vals);
    if (min === max) { max = min + 1; }
    return { minY: Math.floor(min), maxY: Math.ceil(max) };
  }, [series, showRiskZones]);

  // Responsive dimensions
  const isMobile = containerWidth < 640;
  const width = containerWidth;
  const height = isMobile ? 280 : 200;
  const padding = {
    left: isMobile ? 35 : 40,
    right: isMobile ? 15 : 10,
    top: 10,
    bottom: isMobile ? 50 : 30
  };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const xScale = (x) => data.length <= 1 ? padding.left + innerW/2 : padding.left + (x / (data.length -1)) * innerW;
  const yScale = (y) => padding.top + innerH - ((y - minY) / (maxY - minY)) * innerH;

  return (
    <div ref={containerRef} className="w-full">
      {/* Leyenda / chips toggle */}
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        {METRICS.map(m => {
          const on = visible.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={on}
              onClick={() => setVisible(v => v.includes(m.key) ? v.filter(k => k !== m.key) : [...v, m.key])}
              className="rounded-full border-[1.5px] px-3.5 py-2 font-['Poppins',_Arial,_sans-serif] text-[12.5px] font-semibold transition"
              style={on ? { background: m.color, borderColor: 'transparent', color: '#fff' } : { background: '#FAF9F6', borderColor: '#DAD5E4', color: '#5B5B6B' }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Chart Container */}
      <div className="w-full overflow-x-auto rounded-[20px] border border-[#DAD5E4] bg-[#FAF9F6] p-5">
        <svg width={width} height={height} className="w-full" style={{ minWidth: isMobile ? '280px' : '400px' }}>
          {/* Bandas de riesgo de burnout (fondo) */}
          {showRiskZones && RISK_ZONES.map((z) => {
            const yTop = yScale(z.to);
            const yBottom = yScale(z.from);
            const bandH = yBottom - yTop;
            if (bandH <= 0) return null;
            return (
              <g key={z.label}>
                <rect x={padding.left} y={yTop} width={innerW} height={bandH} fill={z.fill} />
                {!isMobile && bandH > 14 && (
                  <text x={width - padding.right - 6} y={yTop + 12} textAnchor="end" fontSize={9.5} fontWeight="700" fill={z.textColor} letterSpacing=".02em">
                    {z.label.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}

          {/* Y grid lines */}
          {Array.from({ length: 5 }).map((_, i) => {
            const yVal = minY + (i / 4) * (maxY - minY);
            const y = yScale(yVal);
            return (
              <g key={i}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#DAD5E4" strokeWidth="1" />
                <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize={isMobile ? 9 : 11} fill="#5B5B6B">
                  {Math.round(yVal)}
                </text>
              </g>
            );
          })}

          {/* X labels */}
          {data.map((d, idx) => {
            const x = xScale(idx);
            const labelLength = d.label.length;
            const shouldRotate = isMobile && data.length > 3;

            return (
              <text
                key={idx}
                x={x}
                y={height - padding.bottom + (shouldRotate ? 20 : 18)}
                fontSize={isMobile ? 8 : 12}
                textAnchor={shouldRotate ? "start" : "middle"}
                fill="#5B5B6B"
                transform={shouldRotate ? `rotate(-45 ${x} ${height - padding.bottom + 20})` : undefined}
              >
                {isMobile && labelLength > 8 ? d.label.substring(0, 8) + '...' : d.label}
              </text>
            );
          })}

          {/* Lines */}
          {series.map(s => {
            const path = s.points.filter(p => p.y != null).map((p,i) => `${i===0?'M':'L'}${xScale(p.x)},${yScale(p.y)}`).join(' ');
            return (
              <path
                key={s.key}
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={s.key === 'wellbeing' ? 3 : 2.5}
                strokeDasharray={s.key === 'agAvg' ? '7 6' : s.key === 'ciAvg' ? '3 5' : s.key === 'efAvg' ? '10 5' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {/* Points (solo en la serie de Bienestar, como en el diseño) */}
          {series.filter(s => s.key === 'wellbeing').map(s => s.points.filter(p => p.y != null).map((p,i) => (
            <circle key={s.key+'_'+i} cx={xScale(p.x)} cy={yScale(p.y)} r={isMobile ? 5 : 4.5} fill={s.color} />
          )))}
        </svg>
      </div>
      {showRiskZones && (
        <p className="mt-2.5 text-[12px] text-[#5B5B6B]">
          Las zonas de fondo muestran el nivel de riesgo según el índice de Bienestar (0-100): morado = riesgo alto (&lt;40), lavanda = zona de atención (40-70), verde = zona saludable (&gt;70).
        </p>
      )}
    </div>
  );
}
