import React from "react";
import LazyImage from "./LazyImage";

// The four-step loop is the product's actual mechanism (see PRODUCT.md:
// evaluate -> AI/heuristic recommendations -> track -> re-measure). The
// sequence itself is the information here, so a plain numbered flow earns
// its place instead of reading as decoration.
const steps = [
  {
    n: "1",
    title: "Mide",
    desc: "Tu equipo responde el inventario MBI, la escala de burnout clínicamente validada, en 22 ítems y 3 dimensiones.",
    accent: "purple",
  },
  {
    n: "2",
    title: "Diagnostica",
    desc: "TeamZen calcula el bienestar del equipo y detecta riesgo de agotamiento con datos anónimos y protegidos.",
    accent: "purple",
  },
  {
    n: "3",
    title: "Actúa",
    desc: "La IA sugiere acciones concretas y trackeables, no un reporte que nadie vuelve a abrir.",
    accent: "mint",
  },
  {
    n: "4",
    title: "Mejora",
    desc: "En la próxima ronda, el equipo ve el efecto real de esas acciones sobre su bienestar.",
    accent: "mint",
  },
];

const accentBg = { purple: "bg-[#9D83C6]", mint: "bg-[#55C2A2]" };

const positioningPoints = [
  "Basado en el MBI, la escala de burnout usada por especialistas, no un cuestionario improvisado.",
  "Cierra el ciclo completo: diagnóstico, acciones recomendadas por IA y seguimiento entre rondas.",
];

export default function AboutSection({ sobreRef, sobreInView }) {
  return (
    <section
      id="nosotros"
      ref={sobreRef}
      className="scroll-mt-32 w-full max-w-6xl mx-auto my-16 sm:my-24 px-2 sm:px-4 flex flex-col items-center"
    >
      <h2
        className={`text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2E2E3A] text-center mb-4 tracking-tight transition-all duration-700
          ${sobreInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        Cómo funciona
      </h2>
      <p
        className={`text-base sm:text-lg text-[#5B5B6B] text-center max-w-2xl mb-12 sm:mb-16 leading-relaxed transition-all duration-700 delay-100
          ${sobreInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        Un ciclo continuo, no una encuesta puntual: cada ronda cierra con acciones, y la siguiente ronda mide
        si funcionaron.
      </p>

      {/* The 4-step loop, purple (measure/diagnose) resolving into mint (act/improve) */}
      <div
        className={`w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6 mb-16 transition-all duration-700 delay-150
          ${sobreInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        {steps.map((step, idx) => (
          <div key={step.title} className="relative flex flex-col items-center text-center px-2">
            <div
              className={`w-14 h-14 rounded-full ${accentBg[step.accent]} text-white font-extrabold text-lg flex items-center justify-center mb-4 shadow-teamzen`}
            >
              {step.n}
            </div>
            <h3 className="text-lg font-bold text-[#2E2E3A] mb-1.5">{step.title}</h3>
            <p className="text-sm text-[#5B5B6B] leading-relaxed max-w-[220px]">{step.desc}</p>
            {idx < steps.length - 1 && (
              <svg
                className="hidden lg:block absolute top-7 -right-3 text-[#DAD5E4]"
                width="28"
                height="16"
                viewBox="0 0 28 16"
                fill="none"
                aria-hidden="true"
              >
                <path d="M1 8h22M17 2l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Positioning: why this replaces a generic survey (or a human consultancy) */}
      <div
        className={`w-full grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-12 items-center transition-all duration-700 delay-200
          ${sobreInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#2E2E3A] mb-4">No es otra encuesta de clima.</h3>
          <ul className="space-y-3 mb-4">
            {positioningPoints.map((text) => (
              <li key={text} className="flex items-start gap-3">
                <svg className="shrink-0 mt-0.5" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="#55C2A2" opacity="0.15" />
                  <path d="M8 12.5l2.5 2.5L16 9.5" stroke="#2C7B64" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm sm:text-base text-[#2E2E3A] leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm sm:text-base text-[#2E2E3A] leading-relaxed">
            Y cuesta una fracción de lo que cobra una{" "}
            <span className="text-[#8160B6] font-semibold">consultora organizacional</span> por el mismo
            diagnóstico.
          </p>
        </div>
        <div className="relative flex justify-center">
          <div
            className="absolute -inset-4 bg-gradient-to-br from-[#9D83C6]/15 to-[#55C2A2]/15 rounded-[2rem] blur-2xl"
            aria-hidden="true"
          />
          <LazyImage
            src="/img/pandalogo.png"
            alt="Zenpanda, la mascota de TeamZen"
            className="relative rounded-2xl border-4 border-[#DAD5E4] shadow-teamzen w-full max-w-[280px] object-cover"
            placeholder={
              <div className="relative w-full max-w-[280px] h-56 rounded-2xl border-4 border-[#DAD5E4] bg-gradient-to-br from-[#55C2A2]/20 to-[#9D83C6]/20 animate-pulse" />
            }
          />
        </div>
      </div>
    </section>
  );
}
