import React, { useMemo, useState, useRef, useEffect } from 'react';

/*
  Simple multi-line trend chart (pure SVG, responsive) without external deps.
  Props:
    data: Array<{ label:string, values: { aeAvg?:number, dAvg?:number, rpAvg?:number, wellbeing?:number } }>
*/
const METRICS = [
  { key: 'wellbeing', label: 'Bienestar ↑', color: '#55C2A2' },
  { key: 'aeAvg', label: 'AE ↓', color: '#9D83C6' },
  { key: 'dAvg', label: 'D ↓', color: '#8B6FB8' },
  { key: 'rpAvg', label: 'RP ↑', color: '#4AA690' },
];

export default function TrendChart({ data = [] }) {
  // Bienestar y AE visibles por defecto, D y RP ocultas — coincide con el
  // estado por defecto del panel de reportes del handoff de diseño.
  const [visible, setVisible] = useState(['wellbeing', 'aeAvg']);
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

  // Compute Y domain from existing numeric values
  const { minY, maxY } = useMemo(() => {
    let vals = [];
    series.forEach(s => s.points.forEach(p => { if (p.y != null) vals.push(p.y); }));
    if (!vals.length) return { minY: 0, maxY: 1 };
    let min = Math.min(...vals); let max = Math.max(...vals);
    if (min === max) { max = min + 1; }
    return { minY: Math.floor(min), maxY: Math.ceil(max) };
  }, [series]);

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
                strokeDasharray={s.key === 'aeAvg' ? '7 6' : s.key === 'dAvg' ? '3 5' : s.key === 'rpAvg' ? '10 5' : undefined}
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
    </div>
  );
}
