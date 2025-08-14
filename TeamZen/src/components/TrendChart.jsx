import React, { useMemo, useState } from 'react';

/*
  Simple multi-line trend chart (pure SVG, responsive) without external deps.
  Props:
    data: Array<{ label:string, values: { aeAvg?:number, dAvg?:number, rpAvg?:number, wellbeing?:number } }>
*/
const METRICS = [
  { key: 'aeAvg', label: 'AE (↓ mejor)', color: '#dc2626', invert: false },
  { key: 'dAvg', label: 'D (↓ mejor)', color: '#fb923c', invert: false },
  { key: 'rpAvg', label: 'RP (↑ mejor)', color: '#6366f1', invert: true },
  { key: 'wellbeing', label: 'Bienestar (↑)', color: '#16a34a', invert: true }
];

export default function TrendChart({ data = [] }) {
  const [visible, setVisible] = useState(() => METRICS.map(m => m.key));

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

  const width = 640; const height = 200; const padding = { left: 40, right: 10, top: 10, bottom: 30 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const xScale = (x) => data.length <= 1 ? padding.left + innerW/2 : padding.left + (x / (data.length -1)) * innerW;
  const yScale = (y) => padding.top + innerH - ((y - minY) / (maxY - minY)) * innerH;

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex flex-wrap gap-2 mb-3">
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setVisible(v => v.includes(m.key) ? v.filter(k => k !== m.key) : [...v, m.key])}
            className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${visible.includes(m.key) ? 'bg-white border-gray-300' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
            style={{ borderColor: m.color }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: m.color }} /> {m.label}
          </button>
        ))}
      </div>
      <svg width={width} height={height} className="max-w-full">
        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#e5e7eb" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#e5e7eb" />
        {/* Y ticks */}
        {Array.from({ length: 5 }).map((_, i) => {
          const yVal = minY + (i / 4) * (maxY - minY);
          const y = yScale(yVal);
          return (
            <g key={i}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#f3f4f6" />
              <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#6b7280">{Math.round(yVal)}</text>
            </g>
          );
        })}
        {/* X labels */}
        {data.map((d, idx) => {
          const x = xScale(idx);
          return (
            <g key={idx}>
              <line x1={x} x2={x} y1={height - padding.bottom} y2={height - padding.bottom + 4} stroke="#9ca3af" />
              <text x={x} y={height - padding.bottom + 14} fontSize={10} textAnchor="middle" fill="#6b7280">{d.label}</text>
            </g>
          );
        })}
        {/* Lines */}
        {series.map(s => {
          const path = s.points.filter(p => p.y != null).map((p,i,arr) => `${i===0?'M':'L'}${xScale(p.x)},${yScale(p.y)}`).join(' ');
          return <path key={s.key} d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
        })}
        {/* Points */}
        {series.map(s => s.points.filter(p => p.y != null).map((p,i) => (
          <circle key={s.key+'_'+i} cx={xScale(p.x)} cy={yScale(p.y)} r={3} fill="#fff" stroke={s.color} strokeWidth={2} />
        )))}
      </svg>
    </div>
  );
}
