import { IMG } from "./assets";

const LINKS = [
  { href: "#metodo", label: "Qué medimos" },
  { href: "#ciclo", label: "Cómo funciona" },
  { href: "#privacidad", label: "Privacidad" },
];

export default function Nav({ loginHref = "/login" }) {
  return (
    <header className="pointer-events-none sticky top-0 z-40 flex justify-center px-6 py-3.5">
      <nav className="pointer-events-auto flex w-full max-w-[1120px] items-center justify-between gap-5 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6]/80 py-2.5 pl-[18px] pr-3 shadow-teamzen backdrop-blur-md">
        <a href="#top" className="flex items-center gap-2.5 text-[#2E2E3A]">
          <img src={IMG.favicon} alt="" className="h-9 w-9 rounded-xl object-cover" />
          <span className="font-['Poppins',_Arial,_sans-serif] text-[19px] font-bold tracking-[-.02em]">TeamZen</span>
        </a>
        <div className="flex items-center gap-2">
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
          <a
            href={loginHref}
            className="rounded-xl bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] px-5 py-2.5 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-white shadow-[0_8px_18px_rgba(85,194,162,.28)] transition hover:bg-[linear-gradient(135deg,#4AA690,#8B6FB8)] hover:text-white hover:shadow-[0_12px_26px_rgba(85,194,162,.36)]"
          >
            Iniciar sesión
          </a>
        </div>
      </nav>
    </header>
  );
}
