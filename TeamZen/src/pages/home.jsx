import React, { useEffect, useState } from "react";
import ServiceCard from "../components/ServiceCard";
import useInView from "../hooks/useInView";
import useIsMobile from "../hooks/useIsMobile";

export default function Home() {
  // Hero section animaciones (se mantienen)
  const [showText, setShowText] = useState(false);
  const [showImage, setShowImage] = useState(false);

  // Animación hero section
  useEffect(() => {
    const textTimeout = setTimeout(() => setShowText(true), 150);
    const imageTimeout = setTimeout(() => setShowImage(true), 400);
    return () => {
      clearTimeout(textTimeout);
      clearTimeout(imageTimeout);
    };
  }, []);

  // Animación al hacer scroll para "Sobre TeamZen"
  const [sobreRef, sobreInView] = useInView({ threshold: 0.2 });

  // Animación al hacer scroll para servicios
  const [serviciosRef] = useInView({ threshold: 0.2 });
  const isMobile = useIsMobile();

  // Array de servicios (en el orden que quieras mostrar)
  const servicios = [
    {
      icon: "🧠",
      iconColor: "text-[#55C2A2]",
      title: "Evaluación de Bienestar",
      description: "Diagnóstico rápido del bienestar emocional y burnout en tu equipo.",
      badgeIcon: "📊",
      badgeText: "Estado emocional real",
      badgeBg: "bg-[#F3F8F6]",
      badgeColor: "text-[#55C2A2]",
      animationDelay: "0.1s",
    },
    {
      icon: "📊",
      iconColor: "text-[#9D83C6]",
      title: "Dashboard para Líderes",
      description: "Visualiza tendencias y riesgos con datos anónimos y toma mejores decisiones.",
      badgeIcon: "📈",
      badgeText: "Liderazgo con datos",
      badgeBg: "bg-[#F6F3FA]",
      badgeColor: "text-[#9D83C6]",
      animationDelay: "0.2s",
    },
    {
      icon: "🧘",
      iconColor: "text-[#F7B801]",
      title: "Recomendaciones Personalizadas",
      description: "Sugerencias prácticas y personalizadas para mejorar el bienestar diario.",
      badgeIcon: "🌿",
      badgeText: "Bienestar diario",
      badgeBg: "bg-[#F9F7F2]",
      badgeColor: "text-[#F7B801]",
      animationDelay: "0.3s",
    },
    {
      icon: "🤖",
      iconColor: "text-[#55C2A2]",
      title: "Prevención de Burnout con IA",
      description: "Detecta señales de burnout y recibe alertas tempranas gracias a la IA.",
      badgeIcon: "💡",
      badgeText: "IA para tu bienestar",
      badgeBg: "bg-[#E6F7F3]",
      badgeColor: "text-[#55C2A2]",
      animationDelay: "0.4s",
    },
    {
      icon: "📅",
      iconColor: "text-[#9D83C6]",
      title: "Seguimiento Continuo",
      description: "Monitoreo periódico del bienestar y alertas tempranas de riesgo.",
      badgeIcon: "⏰",
      badgeText: "Prevención activa",
      badgeBg: "bg-[#F6F3FA]",
      badgeColor: "text-[#9D83C6]",
      animationDelay: "0.5s",
    },
    {
      icon: "💬",
      iconColor: "text-[#F7B801]",
      title: "Soporte 1 a 1",
      description: "Acompañamiento personalizado para miembros del equipo que lo requieran.",
      badgeIcon: "🧑‍💼",
      badgeText: "Apoyo individual",
      badgeBg: "bg-[#FFF9E6]",
      badgeColor: "text-[#F7B801]",
      animationDelay: "0.6s",
    },
  ];

  // En móvil solo muestra las dos primeras y la de IA (índice 0, 1, 3)
  const serviciosToShow = isMobile
    ? [servicios[0], servicios[1], servicios[3]]
    : servicios;

  // Elige animación según la posición (solo para mostrar creatividad)
  const getAnimation = (idx, isMobile) => {
    if (isMobile) {
      // En móvil, todas desde abajo
      return "animate-fadein-up";
    }
    // Desktop: izquierda, centro, derecha, segunda fila igual
    if (idx % 3 === 0) return "animate-fadein-left";
    if (idx % 3 === 2) return "animate-fadein-right";
    return "animate-pop-in";
  };

  function AnimatedServiceCard(props) {
    const [ref, inView] = useInView({ threshold: 0.2 });
    return (
      <div ref={ref} className="w-full flex justify-center">
        <ServiceCard {...props} show={inView} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF9F6] flex flex-col items-center pt-28 md:pt-36 px-2 sm:px-4">
      <a id="top" tabIndex={-1} style={{ position: "absolute", top: 0 }}></a>
      {/* Hero Section */}
      <section id="inicio" className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-0 items-center">
        {/* Text */}
        <div
          className={`flex flex-col items-center md:items-start text-center md:text-left transition-all duration-700 ease-out
            ${showText ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"}`}
        >
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-[#2E2E3A] mb-4 leading-tight tracking-tight drop-shadow-lg">
            Team
            <span className="text-[#55C2A2] drop-shadow-lg">Zen</span>
          </h1>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#2E2E3A] mb-8 md:mb-10 leading-snug max-w-xl">
            Equipos más{" "}
            <span className="text-[#55C2A2]">saludables</span>, trabajo más{" "}
            <span className="text-[#9D83C6]">productivo</span>
          </h2>
          <a
            href="#"
            className="inline-block bg-[#55C2A2] hover:bg-[#9D83C6] text-[#2E2E3A] font-bold px-8 py-3 md:px-10 md:py-4 rounded-xl shadow-lg transition-all duration-300 text-lg md:text-xl"
          >
            Comienza ahora
          </a>
        </div>
        {/* Image */}
        <div
          className={`flex justify-center items-center transition-all duration-700 ease-out
            ${showImage ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <div className="relative w-full max-w-xs sm:max-w-md md:max-w-lg">
            <div className="absolute -inset-4 sm:-inset-6 bg-[#DAD5E4] rounded-3xl blur-2xl opacity-50 z-0"></div>
            <img
              src={`${import.meta.env.BASE_URL}/img/formpanda.png`}
              alt="TeamZen dashboard"
              className="relative w-full rounded-2xl border-4 border-[#DAD5E4] bg-white/70 z-10 animate-float"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </section>

      {/* Sobre TeamZen */}
      <section
        id="nosotros"
        ref={sobreRef}
        className="scroll-mt-32 w-full max-w-6xl mx-auto my-16 px-2 sm:px-4 flex flex-col items-center mt-30"
      >
        <h3
          className={`text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2E2E3A] text-center mb-4 drop-shadow-lg tracking-tight transition-all duration-700
            ${sobreInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
          `}
        >
          Sobre TeamZen
        </h3>
        <p
          className={`text-lg sm:text-xl md:text-2xl font-bold text-[#2E2E3A] text-center max-w-3xl mb-4 leading-snug drop-shadow transition-all duration-700 delay-100
            ${sobreInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
          `}
        >
          TeamZen nació para <span className="text-[#55C2A2]">humanizar el trabajo</span> desde el <span className="text-[#9D83C6]">bienestar emocional</span>.
        </p>
        {/* Responsive collage */}
        <div className="flex flex-col md:flex-row items-center justify-center w-full gap-4 md:gap-0 relative h-auto md:h-[340px] lg:h-[420px] mb-4">
          {/* Imagen izquierda */}
          <img
            src={`${import.meta.env.BASE_URL}/img/pandadescansando.png`}
            alt="TeamZen inspiración 1"
            className={`rounded-2xl shadow-lg object-cover w-full max-w-[320px] h-[140px] sm:h-[180px] md:h-[220px] lg:h-[260px] aspect-[16/9] opacity-90 transition-all duration-700 hover:scale-105
              ${sobreInView ? "opacity-90 md:absolute md:left-1/2 md:-translate-x-[150%] md:top-1/2 md:-translate-y-1/3 -rotate-8" : "opacity-0 md:absolute md:left-1/2 md:-translate-x-[120%] md:top-1/2 md:-translate-y-1/3 -rotate-8"}
            `}
            style={{
              zIndex: 10,
            }}
          />
          {/* Imagen central */}
          <img
            src={`${import.meta.env.BASE_URL}/img/pandalogo.png`}
            alt="TeamZen inspiración 2"
            className={`rounded-2xl shadow-2xl object-cover w-full max-w-[360px] h-[160px] sm:h-[200px] md:h-[270px] lg:h-[340px] aspect-[16/9] transition-all duration-700 hover:scale-105
              ${sobreInView ? "opacity-100 md:relative md:z-20 md:top-1/2 md:-translate-y-1/2" : "opacity-0 translate-y-8"}
            `}
          />
          {/* Imagen derecha */}
          <img
            src={`${import.meta.env.BASE_URL}/img/pandapintando.png`}
            alt="TeamZen inspiración 3"
            className={`rounded-2xl shadow-lg object-cover w-full max-w-[320px] h-[140px] sm:h-[180px] md:h-[220px] lg:h-[260px] aspect-[16/9] opacity-90 transition-all duration-700 hover:scale-105
              ${sobreInView ? "opacity-90 md:absolute md:right-1/2 md:translate-x-[150%] md:top-1/2 md:-translate-y-1/3 rotate-8" : "opacity-0 md:absolute md:right-1/2 md:translate-x-[120%] md:top-1/2 md:-translate-y-1/3 rotate-8"}
            `}
            style={{
              zIndex: 10,
            }}
          />
        </div>
      </section>

      {/* Características principales */}
      <section id="servicios" ref={serviciosRef} className="scroll-mt-32 w-full max-w-6xl mt-30 mb-10 px-2">
        <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2E2E3A] text-center mb-8">
          Servicios
        </h3>
        <div className={`grid ${isMobile ? "grid-cols-1 gap-y-8" : "grid-cols-3 gap-8"} justify-items-center`}>
          {serviciosToShow.map((servicio, idx) => (
            <AnimatedServiceCard
              key={servicio.title}
              {...servicio}
              animationClass={getAnimation(idx, isMobile)}
              animationDelay={servicio.animationDelay}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
