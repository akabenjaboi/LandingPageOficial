import React from "react";
import ServiceCard from "./ServiceCard";
import useInView from "../hooks/useInView";
import useIsMobile from "../hooks/useIsMobile";

// Small authored icon set: one consistent stroke (1.75, round caps), no emoji.
const iconProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const IconClipboard = () => (
  <svg {...iconProps}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
    <path d="M9 11l2 2 4-4" />
  </svg>
);
const IconChart = () => (
  <svg {...iconProps}>
    <path d="M4 20V10M12 20V4M20 20v-7" />
    <path d="M2 20h20" />
  </svg>
);
const IconSpark = () => (
  <svg {...iconProps}>
    <path d="M12 3v4M12 17v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M3 12h4M17 12h4M4.2 19.8L7 17M17 7l2.8-2.8" />
  </svg>
);
const IconCalendarCheck = () => (
  <svg {...iconProps}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M9 15l2 2 4-4" />
  </svg>
);
const IconShield = () => (
  <svg {...iconProps}>
    <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const IconUsers = () => (
  <svg {...iconProps}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15.5 15.2c2.4.4 4.5 2 4.5 4.8" />
  </svg>
);

// Real capabilities, drawn from PRODUCT.md rather than generic marketing copy.
const servicios = [
  {
    icon: <IconClipboard />,
    accent: "purple",
    title: "Evaluación MBI validada",
    description: "22 ítems y 3 dimensiones según el Maslach Burnout Inventory, la escala clínica de referencia.",
  },
  {
    icon: <IconChart />,
    accent: "purple",
    title: "Panel para líderes",
    description: "Tendencias y pronóstico de bienestar por equipo, con datos anónimos y protegidos.",
  },
  {
    icon: <IconSpark />,
    accent: "mint",
    title: "Acciones sugeridas por IA",
    description: "Motor heurístico y modelo generativo recomiendan pasos concretos, no solo un diagnóstico.",
  },
  {
    icon: <IconCalendarCheck />,
    accent: "mint",
    title: "Seguimiento entre rondas",
    description: "El estado de cada acción se rastrea de una ronda a la siguiente: nada se pierde.",
  },
  {
    icon: <IconShield />,
    accent: "purple",
    title: "Privacidad por diseño",
    description: "Protecciones tipo k-anonimato y opción de exclusión para datos sensibles de burnout.",
  },
  {
    icon: <IconUsers />,
    accent: "mint",
    title: "Invitaciones y roles",
    description: "Códigos de invitación con expiración, transferencia de liderazgo y control de acceso por equipo.",
  },
];

export default function ServicesSection() {
  const [serviciosRef, serviciosInView] = useInView({ threshold: 0.2 });
  const isMobile = useIsMobile();

  const serviciosToShow = isMobile
    ? [servicios[0], servicios[2], servicios[3]]
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
      <h2
        className={`text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2E2E3A] text-center mb-4 tracking-tight transition-all duration-700
          ${serviciosInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        `}
      >
        Lo que incluye TeamZen
      </h2>
      <p
        className={`text-base sm:text-lg text-[#5B5B6B] text-center max-w-2xl mx-auto mb-12 leading-relaxed transition-all duration-700 delay-100
          ${serviciosInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        `}
      >
        Un mismo sistema, de la medición a la acción.
      </p>
      <div className={`grid ${isMobile ? "grid-cols-1 gap-y-8" : "grid-cols-3 gap-8"} justify-items-center`}>
        {serviciosToShow.map((servicio, idx) => (
          <AnimatedServiceCard
            key={servicio.title}
            {...servicio}
            animationClass={getAnimation(idx, isMobile)}
          />
        ))}
      </div>
    </section>
  );
}
