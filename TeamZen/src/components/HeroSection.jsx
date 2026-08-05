import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TeamVignetteCard from "./TeamVignetteCard";

export default function HeroSection() {
  const [showVignette, setShowVignette] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const vignetteTimeout = setTimeout(() => setShowVignette(true), 120);
    const textTimeout = setTimeout(() => setShowText(true), 320);
    return () => {
      clearTimeout(vignetteTimeout);
      clearTimeout(textTimeout);
    };
  }, []);

  return (
    <section
      id="inicio"
      className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center"
    >
      {/* The vignette is the visual lead: it demonstrates the product's actual
          mechanism (assess -> AI actions -> track -> re-measure) before any
          copy explains it. It comes first in DOM order so it's also first on
          mobile, where the grid stacks into a single column. */}
      <div
        className={`w-full flex justify-center lg:justify-start transition-all duration-700 ease-out
          ${showVignette ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        <TeamVignetteCard />
      </div>

      {/* Supporting copy: the brand tagline lives here now, as a subline
          rather than the giant H1 it used to be. */}
      <div
        className={`flex flex-col items-center lg:items-start text-center lg:text-left transition-all duration-700 ease-out
          ${showText ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12"}`}
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2E2E3A] leading-[1.1] tracking-tight mb-5 max-w-xl">
          El bienestar de tu equipo, antes y después de{" "}
          <span className="text-[#2C7B64]">actuar</span>.
        </h1>
        <p className="text-lg sm:text-xl font-semibold text-[#2E2E3A] mb-4 max-w-md">
          Equipos más <span className="text-[#2C7B64]">saludables</span>, trabajo más{" "}
          <span className="text-[#8160B6]">productivo</span>.
        </p>
        <p className="text-base sm:text-lg text-[#5B5B6B] leading-relaxed max-w-md mb-8">
          TeamZen mide el burnout con el inventario MBI, la escala clínica de referencia, y convierte
          cada resultado en acciones concretas que tu equipo sigue ronda a ronda.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
          <Link
            to="/login"
            className="inline-block bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AA690] hover:to-[#8B6FB8] text-white font-bold px-8 py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 text-base sm:text-lg"
          >
            Comienza ahora
          </Link>
          <a
            href="#nosotros"
            className="inline-flex items-center gap-1.5 text-[#8160B6] hover:text-[#2E2E3A] font-semibold px-2 py-2 transition-colors duration-300"
          >
            Ver cómo funciona
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
              <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
