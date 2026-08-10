import { IMG } from "./assets";
import { Dot, Eyebrow } from "./ui";

const PUNTOS = [
  { tone: "mint", titulo: "Solo promedios", texto: "Los reportes agregados nunca exponen una respuesta individual." },
  { tone: "purple", titulo: "Opt-in por persona", texto: "Cada quien decide si su líder puede ver su puntaje. Por defecto, no." },
  { tone: "mint", titulo: "Protegido en la base de datos", texto: "Las reglas de acceso se aplican en el servidor, no solo en la interfaz." },
];

export default function Privacidad() {
  return (
    <section id="privacidad" className="relative mx-auto max-w-[1120px] px-6 py-[76px]">
      <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-3xl border border-[#DAD5E4] shadow-[0_25px_50px_rgba(157,131,198,.2),0_10px_20px_rgba(85,194,162,.12)]">
          <img src={IMG.teamGroup} alt="Equipo trabajando con TeamZen" className="block w-full" />
        </div>
        <div className="flex flex-col gap-[18px]">
          <Eyebrow>Privacidad</Eyebrow>
          <h2 className="font-['Poppins',_Arial,_sans-serif] text-[30px] font-bold leading-[1.14] tracking-[-.02em] text-[#2E2E3A] lg:text-[38px]">
            Nadie ve tus respuestas individuales
          </h2>
          <p className="text-[17px] text-[#5B5B6B] [text-wrap:pretty]">
            Los líderes ven promedios del equipo, nunca filas por persona. Compartir tu resultado
            individual es una decisión tuya, reversible en cualquier momento.
          </p>
          <div className="flex flex-col gap-3">
            {PUNTOS.map((p) => (
              <div key={p.titulo} className="flex items-start gap-3.5 rounded-2xl border border-[#DAD5E4] bg-white p-4">
                <span className="mt-[7px]"><Dot tone={p.tone} size={10} /></span>
                <div>
                  <h3 className="font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#2E2E3A]">{p.titulo}</h3>
                  <p className="mt-0.5 text-sm text-[#5B5B6B]">{p.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
