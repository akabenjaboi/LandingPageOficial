import React from "react";

// Illustrative example data — TeamZen is pre-launch and has no real customer
// results yet. This vignette demonstrates the product's actual mechanism
// (assess -> AI-recommended actions -> track -> re-measure) the way a "here's
// what the report looks like" mockup does, not as a claimed customer result.
const rounds = [
  { label: "Ronda 1", score: 58 },
  { label: "Ronda 2", score: 67 },
  { label: "Ronda 3", score: 81 },
];

function ScoreDial({ score, ringColor, caption }) {
  const angle = Math.round((score / 100) * 360);
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(${ringColor} ${angle}deg, #DAD5E4 0deg)` }}
          aria-hidden="true"
        />
        <div className="absolute inset-[6px] sm:inset-[7px] rounded-full bg-[#FAF9F6] flex flex-col items-center justify-center">
          <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#2E2E3A] leading-none tabular-nums">
            {score}
          </span>
          <span className="text-xs font-semibold text-[#5B5B6B] mt-0.5">
            / 100
          </span>
        </div>
      </div>
      <p className="text-xs font-semibold text-[#5B5B6B] uppercase tracking-wide">
        {caption}
      </p>
    </div>
  );
}

export default function TeamVignetteCard() {
  return (
    <div className="relative w-full max-w-md">
      {/* Tinted ambient glow, echoing the "Jardin Zen" halo language behind the card */}
      <div
        className="absolute -inset-6 bg-gradient-to-br from-[#55C2A2]/15 via-transparent to-[#9D83C6]/15 rounded-[2.5rem] blur-2xl"
        aria-hidden="true"
      />

      <div className="relative bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen-strong p-5 sm:p-7">
        {/* Header: team identity + honesty caption */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#55C2A2] to-[#9D83C6] flex items-center justify-center text-white font-bold text-sm">
              EP
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-[#2E2E3A] leading-tight truncate">Equipo Producto</p>
              <p className="text-xs font-semibold text-[#5B5B6B]">Bienestar por ronda</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 bg-[#DAD5E4]/60 text-[#2E2E3A] text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
            </svg>
            Ejemplo ilustrativo
          </span>
        </div>

        {/* Before / after comparison — the mechanism, made legible at a glance */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <ScoreDial score={58} ringColor="#5B5B6B" caption="Ronda 1" />

          <div className="flex flex-col items-center gap-1 px-1">
            <svg width="30" height="20" viewBox="0 0 30 20" fill="none" className="text-[#55C2A2]" aria-hidden="true">
              <path d="M2 16 Q11 4 27 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M21 3.5 L27 6 L24 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="text-sm sm:text-base font-extrabold text-[#2C7B64]">+23</span>
          </div>

          <ScoreDial score={81} ringColor="#55C2A2" caption="Ronda 3" />
        </div>

        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-xs sm:text-sm font-semibold text-[#2E2E3A]">Riesgo medio</span>
          <span className="text-xs sm:text-sm font-semibold text-[#2C7B64]">Bienestar alto</span>
        </div>

        {/* Trend across rounds + the analytical read: why it moved */}
        <div className="mt-6 pt-5 border-t border-[#DAD5E4]">
          <div className="flex items-end justify-center gap-2 h-12 mb-3" aria-hidden="true">
            {rounds.map((r) => (
              <div
                key={r.label}
                className="w-9 rounded-t-md bg-gradient-to-t from-[#9D83C6]/60 to-[#55C2A2]"
                style={{ height: `${Math.max(10, (r.score / 100) * 48)}px` }}
              />
            ))}
          </div>
          <p className="text-xs sm:text-sm text-center text-[#8160B6] font-medium leading-snug">
            +23 puntos tras completar 3 acciones sugeridas por la IA
          </p>
        </div>
      </div>
    </div>
  );
}
