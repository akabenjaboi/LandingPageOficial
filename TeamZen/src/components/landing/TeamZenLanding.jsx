import { useState } from "react";
import Nav from "./Nav";
import Hero from "./Hero";
import Dimensiones from "./Dimensiones";
import Ciclo from "./Ciclo";
import Privacidad from "./Privacidad";
import CtaFinal from "./CtaFinal";
import Footer from "./Footer";
import DemoModal from "./DemoModal";

export default function TeamZenLanding() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => setDemoOpen(true);

  return (
    <div className="relative bg-[#FAF9F6] font-['Lato',_Arial,_Helvetica,_sans-serif] text-[#2E2E3A]">
      {/* Envoltorio de solo-clip para el sangrado de los círculos decorativos:
          hermano del Nav (no ancestro), para no romper su position:sticky
          (cualquier ancestro con overflow != visible rompe sticky en todos
          los navegadores). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-[70px] -top-[90px] h-[260px] w-[260px] rounded-full bg-[radial-gradient(circle,rgba(85,194,162,.22),rgba(85,194,162,0)_70%)] blur-[10px] sm:-right-[120px] sm:-top-[160px] sm:h-[520px] sm:w-[520px] sm:blur-[20px]" />
        <div className="absolute -left-[100px] top-[300px] h-[230px] w-[230px] rounded-full bg-[radial-gradient(circle,rgba(157,131,198,.20),rgba(157,131,198,0)_70%)] blur-[10px] sm:-left-[180px] sm:top-[420px] sm:h-[460px] sm:w-[460px] sm:blur-[20px]" />
        <div className="absolute -right-[110px] top-[1100px] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(157,131,198,.14),rgba(85,194,162,0)_70%)] blur-[12px] sm:-right-[200px] sm:top-[1500px] sm:h-[560px] sm:w-[560px] sm:blur-[24px]" />
      </div>

      <Nav />
      <Hero onRequestDemo={openDemo} />
      <Dimensiones />
      <Ciclo />
      <Privacidad />
      <CtaFinal onRequestDemo={openDemo} />
      <Footer />

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
