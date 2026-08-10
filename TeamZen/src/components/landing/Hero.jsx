import { IMG } from "./assets";
import { CtaButton, Meter, Pill } from "./ui";

function Stat({ label, value, suffix, meter, color }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-3.5">
      <span className="text-xs font-bold uppercase tracking-[.06em] text-[#5B5B6B]">{label}</span>
      <span className={`font-['Poppins',_Arial,_sans-serif] text-[26px] font-bold tabular-nums ${color === "purple" ? "text-[#8B6FB8]" : "text-[#2E2E3A]"}`}>
        {value}
        <span className="text-base text-[#5B5B6B]">{suffix}</span>
      </span>
      <Meter value={meter} color={color} />
    </div>
  );
}

export default function Hero({ onRequestDemo }) {
  return (
    <section id="top" className="relative mx-auto grid max-w-[1120px] items-center gap-14 px-6 pb-[72px] pt-14 lg:grid-cols-2">
      <div className="flex flex-col gap-[22px]">
        <Pill>Para líderes y People Ops</Pill>
        <h1 className="font-['Poppins',_Arial,_sans-serif] text-[40px] font-bold leading-[1.07] tracking-[-.02em] text-[#2E2E3A] lg:text-[52px]">
          Detecta el burnout antes de que se lleve a tu equipo.
        </h1>
        <p className="max-w-[30em] text-lg leading-[1.65] text-[#5B5B6B] [text-wrap:pretty]">
          Evaluaciones periódicas y anónimas que se convierten en un índice de bienestar por ronda
          — y en acciones concretas que puedes seguir hasta el final.
        </p>
        <div className="flex flex-wrap items-center gap-3.5">
          <CtaButton onClick={onRequestDemo}>Solicitar una demo</CtaButton>
          <span className="text-sm text-[#5B5B6B]">15 minutos, con datos de ejemplo</span>
        </div>
      </div>

      <div className="relative">
        <div className="relative flex flex-col gap-[18px] rounded-3xl border border-[#DAD5E4] bg-white p-6 shadow-[0_25px_50px_rgba(85,194,162,.22),0_10px_20px_rgba(157,131,198,.14)]">
          <img
            src={IMG.pandaDescansando}
            alt=""
            className="animate-tzfloat absolute -top-14 right-4 h-[132px] w-[132px] rounded-full border-[6px] border-cream object-cover shadow-[0_16px_30px_rgba(157,131,198,.22)]"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-['Poppins',_Arial,_sans-serif] text-[17px] font-semibold text-[#2E2E3A]">Equipo Diseño</h3>
              <span className="text-[13px] text-[#5B5B6B]">Ronda 4 · cierra en 3 días</span>
            </div>
            <span className="rounded-full bg-[rgba(85,194,162,.16)] px-3 py-1.5 font-['Poppins',_Arial,_sans-serif] text-xs font-semibold text-[#3d8a74]">
              Activa
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <Stat label="Participación" value="9" suffix="/12" meter={75} color="mint" />
            <Stat label="Bienestar" value="63" suffix="/100" meter={63} color="purple" />
          </div>

          <div className="flex flex-col gap-2.5 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[.06em] text-[#5B5B6B]">Tendencia</span>
              <span className="text-xs font-bold text-[#3d8a74]">+21 en 4 rondas</span>
            </div>
            <svg viewBox="0 0 300 96" className="h-24 w-full">
              <defs>
                <linearGradient id="tzg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#55C2A2" stopOpacity=".28" />
                  <stop offset="100%" stopColor="#55C2A2" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M10,74 L84,64 L158,44 L232,30 L290,22 L290,92 L10,92 Z" fill="url(#tzg)" />
              <polyline points="10,74 84,64 158,44 232,30 290,22" fill="none" stroke="#55C2A2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="10,26 84,34 158,40 232,58 290,66" fill="none" stroke="#9D83C6" strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" />
              <circle cx="290" cy="22" r="5" fill="#55C2A2" />
            </svg>
            <div className="flex gap-[18px]">
              <span className="flex items-center gap-[7px] text-xs text-[#5B5B6B]">
                <span className="h-[3px] w-3.5 rounded-sm bg-[#55C2A2]" />Bienestar
              </span>
              <span className="flex items-center gap-[7px] text-xs text-[#5B5B6B]">
                <span className="h-[3px] w-3.5 rounded-sm bg-[#9D83C6]" />Agotamiento
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
