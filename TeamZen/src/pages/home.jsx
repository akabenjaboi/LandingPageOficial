import React from "react";
import SEO from "../components/SEO";
import TeamZenLanding from "../components/landing/TeamZenLanding";

export default function Home() {
  return (
    <>
      <SEO
        title="TeamZen - Mide y reduce el burnout en tu equipo"
        description="TeamZen es la primera plataforma digital chilena para prevenir el burnout e impulsar el bienestar en equipos usando el inventario MBI. Mejora la productividad y cultura organizacional."
        keywords="burnout, bienestar laboral, MBI, equipos, productividad, salud mental, TeamZen, Chile, cultura organizacional"
        canonical="https://teamzen.cl/"
      />
      <TeamZenLanding />
    </>
  );
}
