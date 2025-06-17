import React from "react";
import useInView from "../hooks/useInView";
import HeroSection from "../components/HeroSection";
import AboutSection from "../components/AboutSection";
import ServicesSection from "../components/ServicesSection";

export default function Home() {
  // Animación al hacer scroll para "Sobre TeamZen"
  const [sobreRef, sobreInView] = useInView({ threshold: 0.2 });

  return (
    <main className="min-h-screen bg-[#FAF9F6] flex flex-col items-center pt-28 md:pt-36 px-2 sm:px-4">
      <a id="top" tabIndex={-1} style={{ position: "absolute", top: 0 }}></a>
      {/* Hero Section */}
      <HeroSection />

      {/* Sobre TeamZen */}
      <AboutSection sobreRef={sobreRef} sobreInView={sobreInView} />

      {/* Servicios */}
      <ServicesSection />
    </main>
  );
}
