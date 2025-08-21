import React from "react";
import useInView from "../hooks/useInView";
import Navbar from '../components/navbar.jsx';
import HeroSection from "../components/HeroSection";
import AboutSection from "../components/AboutSection";
import ServicesSection from "../components/ServicesSection";
import TeamSecion from "../components/TeamSecion";
import FooterSection from "../components/FooterSection";
import SEO from "../components/SEO";

export default function Home() {
  // Animación al hacer scroll para "Sobre TeamZen"
  const [sobreRef, sobreInView] = useInView({ threshold: 0.2 });

  return (
    <>
      <SEO 
        title="TeamZen - Mide y reduce el burnout en tu equipo"
        description="TeamZen es la primera plataforma digital chilena para prevenir el burnout e impulsar el bienestar en equipos usando el inventario MBI. Mejora la productividad y cultura organizacional."
        keywords="burnout, bienestar laboral, MBI, equipos, productividad, salud mental, TeamZen, Chile, cultura organizacional"
        canonical="https://teamzen.cl/"
      />
      <Navbar />
      <main className="min-h-screen bg-[#FAF9F6] flex flex-col items-center pt-28 md:pt-36 px-2 sm:px-4 font-sans">
        <a id="top" tabIndex={-1} style={{ position: "absolute", top: 0 }}></a>
        {/* Hero Section */}
        <HeroSection />

        {/* Sobre TeamZen */}
        <AboutSection sobreRef={sobreRef} sobreInView={sobreInView} />

        {/* Servicios */}
        <ServicesSection />

        {/* Equipo */}
        <TeamSecion />

        {/* Footer */}
        <FooterSection />
      </main>
    </>
  );
}
