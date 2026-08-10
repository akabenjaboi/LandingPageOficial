export function Eyebrow({ children, tone = "purple", className = "" }) {
  const color = tone === "mint" ? "text-[#3d8a74]" : "text-[#8B6FB8]";
  return (
    <span className={`font-['Poppins',_Arial,_sans-serif] text-xs font-semibold uppercase tracking-[.08em] ${color} ${className}`}>
      {children}
    </span>
  );
}

export function Pill({ children, className = "" }) {
  return (
    <span className={`self-start rounded-full bg-[#DAD5E4]/55 px-3.5 py-[7px] font-['Poppins',_Arial,_sans-serif] text-xs font-semibold uppercase tracking-[.08em] text-[#8B6FB8] ${className}`}>
      {children}
    </span>
  );
}

export function Chip({ children }) {
  return (
    <span className="rounded-full bg-[#DAD5E4]/50 px-3.5 py-2 font-['Poppins',_Arial,_sans-serif] text-[13px] font-semibold text-[#2E2E3A]">
      {children}
    </span>
  );
}

export function Badge({ children, tone = "mint" }) {
  const tones = {
    mint: "text-[#3d8a74] bg-[rgba(85,194,162,.16)]",
    purple: "text-[#6f56a0] bg-[rgba(157,131,198,.18)]",
    neutral: "text-[#5B5B6B] bg-[#DAD5E4]/50",
  };
  return (
    <span className={`rounded-full px-3 py-1.5 font-['Poppins',_Arial,_sans-serif] text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function CtaButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`rounded-xl bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] px-[30px] py-[15px] font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-white shadow-[0_12px_26px_rgba(85,194,162,.3)] transition-transform duration-150 hover:scale-[1.04] hover:bg-[linear-gradient(135deg,#4AA690,#8B6FB8)] hover:shadow-[0_18px_34px_rgba(85,194,162,.36)] disabled:opacity-60 disabled:hover:scale-100 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Meter({ value, color = "mint", height = 8 }) {
  const bg = color === "mint" ? "bg-[#55C2A2]" : "bg-[#9D83C6]";
  return (
    <div className="overflow-hidden rounded-[5px] bg-[#DAD5E4]" style={{ height }}>
      <div className={`h-full ${bg}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function Dot({ tone = "mint", size = 12 }) {
  const style = { width: size, height: size };
  const cls =
    tone === "mint" ? "bg-[#55C2A2]" : tone === "purple" ? "bg-[#9D83C6]" : "border-2 border-[#DAD5E4]";
  return <span className={`shrink-0 rounded-full ${cls}`} style={style} />;
}
