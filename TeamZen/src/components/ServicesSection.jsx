import React from "react";
import ServiceCard from "./ServiceCard";
import useInView from "../hooks/useInView";
import useIsMobile from "../hooks/useIsMobile";

// Servicios con paleta de colores TeamZen aplicada
const servicios = [
  {
    icon: "🧠",
    iconColor: "text-[#55C2A2]",
    title: "Evaluación de Bienestar",
    description: "Diagnóstico rápido del bienestar emocional y burnout en tu equipo.",
    badgeIcon: "📊",
    badgeText: "Estado emocional real",
    badgeBg: "bg-gradient-to-r from-[#55C2A2]/10 to-[#55C2A2]/5",
    badgeColor: "text-[#2E2E3A]",
    animationDelay: "0.1s",
  },
  {
    icon: "📊",
    iconColor: "text-[#9D83C6]",
    title: "Dashboard para Líderes",
    description: "Visualiza tendencias y riesgos con datos anónimos y toma mejores decisiones.",
    badgeIcon: "📈",
    badgeText: "Liderazgo con datos",
    badgeBg: "bg-gradient-to-r from-[#9D83C6]/10 to-[#DAD5E4]/20",
    badgeColor: "text-[#2E2E3A]",
    animationDelay: "0.2s",
  },
  {
    icon: "🧘",
    iconColor: "text-[#55C2A2]",
    title: "Recomendaciones Personalizadas",
    description: "Sugerencias prácticas y personalizadas para mejorar el bienestar diario.",
    badgeIcon: "🌿",
    badgeText: "Bienestar diario",
    badgeBg: "bg-gradient-to-r from-[#DAD5E4]/30 to-[#FAF9F6]",
    badgeColor: "text-[#2E2E3A]",
    animationDelay: "0.3s",
  },
  {
    icon: "🤖",
    iconColor: "text-[#9D83C6]",
    title: "Prevención de Burnout con IA",
    description: "Detecta señales de burnout y recibe alertas tempranas gracias a la IA.",
    badgeIcon: "💡",
    badgeText: "IA para tu bienestar",
    badgeBg: "bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10",
    badgeColor: "text-[#2E2E3A]",
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

export default function ServicesSection() {
  const [serviciosRef, serviciosInView] = useInView({ threshold: 0.2 });
  const isMobile = useIsMobile();

  const serviciosToShow = isMobile
    ? [servicios[0], servicios[1], servicios[3]]
    : servicios;

  const getAnimation = (idx, isMobile) => {
    if (isMobile) {
      return "animate-fadein-up";
    }
    if (idx % 3 === 0) return "animate-fadein-left";
    if (idx % 3 === 2) return "animate-fadein-right";
    return "animate-pop-in";
  };

  function AnimatedServiceCard(props) {
    const [ref, inView] = useInView({ threshold: 0.2 });
    const [hasShown, setHasShown] = React.useState(false);

    React.useEffect(() => {
      if (inView && !hasShown) setHasShown(true);
    }, [inView, hasShown]);

    const [animationClass] = React.useState(props.animationClass);

    return (
      <div ref={ref} className="w-full flex justify-center">
        <ServiceCard {...props} show={hasShown} animationClass={animationClass} />
      </div>
    );
  }

  return (
    <section id="servicios" ref={serviciosRef} className="scroll-mt-32 w-full max-w-6xl mt-10 mb-10 px-2">
      <h3
        className={`text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2E2E3A] text-center mb-8 drop-shadow-lg tracking-tight transition-all duration-700
          ${serviciosInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        `}
      >
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
  );
}