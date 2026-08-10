// Primitivas de UI compartidas por las pantallas autenticadas (dashboard, mbi,
// reportes, crear/unirse equipo), traducidas desde design_handoff_teamzen_app.
// Usan valores arbitrarios de Tailwind en vez de theme.extend: los tokens nuevos
// agregados a tailwind.config.js no se compilan en este proyecto (ver memoria de
// sesión sobre el bug de Tailwind v4), y nombres como "bg-teamzen-gradient" ya
// existen con otro significado (gradiente cream->lavender del landing).

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-['Poppins',_Arial,_sans-serif] text-[26px] font-bold tracking-[-.02em] text-[#2E2E3A] sm:text-[32px]">{title}</h1>
        {subtitle && <p className="text-base text-[#5B5B6B]">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-3">{children}</div>}
    </div>
  );
}

export function Card({ children, className = "", pad = "p-6" }) {
  return (
    <section className={`rounded-3xl border border-[#DAD5E4] bg-white ${pad} shadow-teamzen ${className}`}>
      {children}
    </section>
  );
}

export function Btn({ variant = "primary", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold transition disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed";
  const v = {
    primary:
      "bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] px-[22px] py-[13px] text-white shadow-[0_12px_26px_rgba(85,194,162,.28)] hover:scale-[1.03] hover:bg-[linear-gradient(135deg,#4AA690,#8B6FB8)]",
    secondary: "bg-[#DAD5E4] px-[22px] py-[13px] text-[#2E2E3A] hover:bg-[#cdc6db]",
    ghost: "border border-[#DAD5E4] px-[18px] py-[11px] text-[#5B5B6B] hover:border-[#9D83C6] hover:text-[#8B6FB8]",
    danger: "border border-[rgba(192,57,43,.25)] bg-[rgba(192,57,43,.08)] px-[22px] py-[13px] text-[#c0392b] hover:bg-[rgba(192,57,43,.14)]",
  }[variant];
  return <button type="button" className={`${base} ${v} ${className}`} {...props} />;
}

export function Field({ label, as = "input", hint, className = "", ...props }) {
  const cls =
    "rounded-xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-[13px] text-[15px] font-normal text-[#2E2E3A] outline-none transition focus:border-[#55C2A2] focus:bg-white focus:shadow-[0_0_0_3px_rgba(85,194,162,.22)]";
  const Tag = as;
  return (
    <label className="flex flex-col gap-1.5 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]">
      {label}
      <Tag className={`font-['Lato',_Arial,_sans-serif] font-normal ${cls} ${className}`} {...props} />
      {hint && <span className="self-end font-['Lato',_Arial,_sans-serif] text-xs font-normal text-[#5B5B6B]">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, suffix, meter, color = "mint", foot }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-3.5">
      <span className="text-[11px] font-bold uppercase tracking-[.06em] text-[#5B5B6B]">{label}</span>
      <span className={`font-['Poppins',_Arial,_sans-serif] text-2xl font-bold tabular-nums ${color === "purple" ? "text-[#8B6FB8]" : "text-[#2E2E3A]"}`}>
        {value}
        {suffix && <span className="text-base text-[#5B5B6B]">{suffix}</span>}
      </span>
      {meter != null && (
        <div className="h-2 overflow-hidden rounded-[5px] bg-[#DAD5E4]">
          <div className={color === "purple" ? "h-full bg-[#9D83C6]" : "h-full bg-[#55C2A2]"} style={{ width: `${meter}%` }} />
        </div>
      )}
      {foot && <span className="text-xs text-[#5B5B6B]">{foot}</span>}
    </div>
  );
}

export function Badge({ tone = "mint", as = "span", className = "", ...props }) {
  const tones = {
    mint: "text-[#3d8a74] bg-[rgba(85,194,162,.16)]",
    purple: "text-[#6f56a0] bg-[rgba(157,131,198,.18)]",
    neutral: "text-[#5B5B6B] bg-[#DAD5E4]/60",
  };
  const Tag = as;
  return <Tag className={`rounded-full px-3 py-1.5 font-['Poppins',_Arial,_sans-serif] text-[11.5px] font-semibold ${tones[tone]} ${className}`} {...props} />;
}

export function Dot({ tone = "mint", size = 10, className = "" }) {
  const cls = tone === "mint" ? "bg-[#55C2A2]" : tone === "purple" ? "bg-[#9D83C6]" : "border-2 border-[#DAD5E4]";
  return <span className={`shrink-0 rounded-full ${cls} ${className}`} style={{ width: size, height: size }} />;
}

export function Check({ checked, onChange, ...props }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[9px] text-sm font-bold transition ${
        checked ? "bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] text-white" : "border-[1.5px] border-[#DAD5E4] bg-white text-transparent"
      }`}
      {...props}
    >
      ✓
    </button>
  );
}

export function Row({ children, className = "" }) {
  return <div className={`flex items-center gap-3.5 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-3.5 ${className}`}>{children}</div>;
}

export function Notice({ tone = "mint", children }) {
  const cls =
    tone === "mint"
      ? "bg-[rgba(85,194,162,.1)] border-[rgba(85,194,162,.3)]"
      : "bg-[rgba(157,131,198,.12)] border-[rgba(157,131,198,.32)]";
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${cls}`}>
      <Dot tone={tone} className="mt-[7px]" />
      <p className="text-sm text-[#2E2E3A]">{children}</p>
    </div>
  );
}

export function Alert({ tone = "error", title, children, className = "" }) {
  const tones = {
    error: "bg-[rgba(192,57,43,.08)] border-[rgba(192,57,43,.25)] text-[#c0392b]",
    success: "bg-[rgba(85,194,162,.1)] border-[rgba(85,194,162,.3)] text-[#2E2E3A]",
    warning: "bg-[rgba(157,131,198,.12)] border-[rgba(157,131,198,.32)] text-[#2E2E3A]",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]} ${className}`} role={tone === "error" ? "alert" : undefined}>
      {title && <p className="mb-1 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold">{title}</p>}
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function Highlight({ children }) {
  return (
    <div className="flex items-start gap-3.5 rounded-[20px] border border-[#DAD5E4] bg-[linear-gradient(135deg,rgba(85,194,162,.12),rgba(157,131,198,.14))] p-[18px]">
      <Dot tone="mint" className="mt-2" />
      <p className="text-[15px] leading-relaxed text-[#2E2E3A]">{children}</p>
    </div>
  );
}
