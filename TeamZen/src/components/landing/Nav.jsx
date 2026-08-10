import { useEffect, useRef, useState } from "react";
import { IMG } from "./assets";

const LINKS = [
  { href: "#metodo", label: "Qué medimos" },
  { href: "#ciclo", label: "Cómo funciona" },
  { href: "#privacidad", label: "Privacidad" },
];

export default function Nav({ loginHref = "/login" }) {
  const [open, setOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="pointer-events-none sticky top-0 z-40 flex justify-center px-4 py-3.5 sm:px-6">
      <nav
        ref={navRef}
        className="pointer-events-auto relative flex w-full max-w-[1120px] items-center justify-between gap-2 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6]/80 py-2.5 pl-[14px] pr-2.5 shadow-teamzen backdrop-blur-md sm:gap-5 sm:pl-[18px] sm:pr-3"
      >
        <a href="#top" onClick={() => setOpen(false)} className="flex items-center gap-2 text-[#2E2E3A] sm:gap-2.5">
          <img src={IMG.favicon} alt="" className="h-9 w-9 rounded-xl object-cover" />
          <span className="font-['Poppins',_Arial,_sans-serif] text-[17px] font-bold tracking-[-.02em] sm:text-[19px]">TeamZen</span>
        </a>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-2 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-xl px-3.5 py-2 font-['Poppins',_Arial,_sans-serif] text-sm font-medium text-[#5B5B6B] transition-colors hover:bg-[#DAD5E4]/40 hover:text-[#8B6FB8]"
              >
                {l.label}
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#2E2E3A] transition-colors hover:bg-[#DAD5E4]/40 md:hidden"
          >
            {open ? (
              <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            ) : (
              <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h14M3 10h14M3 14h14" />
              </svg>
            )}
          </button>
          <a
            href={loginHref}
            className="whitespace-nowrap rounded-xl bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] px-3.5 py-2.5 font-['Poppins',_Arial,_sans-serif] text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(85,194,162,.28)] transition hover:bg-[linear-gradient(135deg,#4AA690,#8B6FB8)] hover:text-white hover:shadow-[0_12px_26px_rgba(85,194,162,.36)] sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Iniciar sesión
          </a>
        </div>

        {open && (
          <div
            id="landing-mobile-menu"
            className="animate-slideup absolute left-0 right-0 top-[calc(100%+8px)] flex flex-col gap-1 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-2 shadow-teamzen-strong md:hidden"
          >
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 font-['Poppins',_Arial,_sans-serif] text-[15px] font-medium text-[#2E2E3A] transition-colors hover:bg-[#DAD5E4]/40 hover:text-[#8B6FB8]"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}
