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
    <div className="relative overflow-hidden bg-[#FAF9F6] font-['Lato',_Arial,_Helvetica,_sans-serif] text-[#2E2E3A]">
      <div aria-hidden className="pointer-events-none absolute -right-[120px] -top-[160px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(85,194,162,.22),rgba(85,194,162,0)_70%)] blur-[20px]" />
      <div aria-hidden className="pointer-events-none absolute -left-[180px] top-[420px] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(157,131,198,.20),rgba(157,131,198,0)_70%)] blur-[20px]" />
      <div aria-hidden className="pointer-events-none absolute -right-[200px] top-[1500px] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(157,131,198,.14),rgba(85,194,162,0)_70%)] blur-[24px]" />

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
