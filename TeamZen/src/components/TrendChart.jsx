import React, { useMemo, useState, useRef, useEffect } from 'react';

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
      {/* Legend */}
      <div className="flex flex-wrap gap-1 sm:gap-2 mb-3 justify-center sm:justify-start">
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setVisible(v => v.includes(m.key) ? v.filter(k => k !== m.key) : [...v, m.key])}
            className={`text-[10px] sm:text-xs px-2 py-1 rounded border flex items-center gap-1 transition-all ${visible.includes(m.key) ? 'bg-white border-gray-300' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
            style={{ borderColor: visible.includes(m.key) ? m.color : undefined }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
            <span className="hidden sm:inline">{m.label}</span>
            <span className="sm:hidden">{m.key.toUpperCase()}</span>
          </button>
        ))}
      </div>
      
      {/* Chart Container */}
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height} className="w-full" style={{ minWidth: isMobile ? '280px' : '400px' }}>
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
                <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize={isMobile ? 9 : 10} fill="#6b7280">
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
              <g key={idx}>
                <line x1={x} x2={x} y1={height - padding.bottom} y2={height - padding.bottom + 4} stroke="#9ca3af" />
                <text 
                  x={x} 
                  y={height - padding.bottom + (shouldRotate ? 20 : 14)} 
                  fontSize={isMobile ? 8 : 10} 
                  textAnchor={shouldRotate ? "start" : "middle"} 
                  fill="#6b7280"
                  transform={shouldRotate ? `rotate(-45 ${x} ${height - padding.bottom + 20})` : undefined}
                >
                  {isMobile && labelLength > 8 ? d.label.substring(0, 8) + '...' : d.label}
                </text>
              </g>
            );
          })}
          
          {/* Lines */}
          {series.map(s => {
            const path = s.points.filter(p => p.y != null).map((p,i,arr) => `${i===0?'M':'L'}${xScale(p.x)},${yScale(p.y)}`).join(' ');
            return <path key={s.key} d={path} fill="none" stroke={s.color} strokeWidth={isMobile ? 2.5 : 2} strokeLinejoin="round" strokeLinecap="round" />;
          })}
          
          {/* Points */}
          {series.map(s => s.points.filter(p => p.y != null).map((p,i) => (
            <circle key={s.key+'_'+i} cx={xScale(p.x)} cy={yScale(p.y)} r={isMobile ? 4 : 3} fill="#fff" stroke={s.color} strokeWidth={2} />
          )))}
        </svg>
      </div>
    </div>
  );
}
