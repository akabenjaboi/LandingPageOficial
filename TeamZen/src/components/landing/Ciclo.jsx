import { Badge, Dot, Eyebrow } from "./ui";

const PASOS = [
  { n: "01", titulo: "Medir", texto: "Lanzas una ronda y el equipo responde en privado, desde cualquier dispositivo." },
  { n: "02", titulo: "Analizar", texto: "Índice de bienestar, riesgos detectados y comparación con la ronda anterior." },
  { n: "03", titulo: "Actuar", texto: "Hasta seis acciones recomendadas, priorizadas según lo que muestran los datos." },
  { n: "04", titulo: "Comparar", texto: "La ronda siguiente muestra qué se movió — y qué acciones quedaron pendientes." },
];

const ACCIONES = [
  { texto: "Bloquear dos tardes sin reuniones por semana", tone: "mint", estado: "Hecha" },
  { texto: "Redistribuir la carga del proyecto que concentra dos personas", tone: "purple", estado: "En curso" },
  { texto: "Revisar expectativas de disponibilidad fuera de horario", tone: "neutral", estado: "Pendiente" },
];

export default function Ciclo() {
  return (
    <section id="ciclo" className="relative bg-gradient-to-b from-lavender/30 to-transparent px-6 py-[76px]">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-[34px]">
        <div className="flex max-w-[36em] flex-col gap-3">
          <Eyebrow>Cómo funciona</Eyebrow>
          <h2 className="font-['Poppins',_Arial,_sans-serif] text-[30px] font-bold leading-[1.14] tracking-[-.02em] text-[#2E2E3A] lg:text-[38px]">
            Del diagnóstico a la acción
          </h2>
          <p className="text-[17px] text-[#5B5B6B]">
            Un reporte que nadie ejecuta no cambia nada. Cada ronda termina en acciones concretas, y
            la ronda siguiente dice si funcionaron.
          </p>
        </div>

        <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((p) => (
            <div key={p.n} className="flex flex-col gap-2.5 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-[22px]">
              <span className="font-['Poppins',_Arial,_sans-serif] text-[13px] font-bold text-[#55C2A2]">{p.n}</span>
              <h3 className="font-['Poppins',_Arial,_sans-serif] text-[19px] font-semibold text-[#2E2E3A]">{p.titulo}</h3>
              <p className="text-sm text-[#5B5B6B]">{p.texto}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-[#DAD5E4] bg-white p-[26px] shadow-[0_10px_25px_rgba(85,194,162,.14),0_4px_10px_rgba(157,131,198,.1)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="font-['Poppins',_Arial,_sans-serif] text-[19px] font-semibold text-[#2E2E3A]">
              Seguimiento de acciones · ronda anterior
            </h3>
            <span className="text-[13px] text-[#5B5B6B]">2 de 3 completadas</span>
          </div>
          <div className="flex flex-col gap-3">
            {ACCIONES.map((a) => (
              <div key={a.texto} className="flex items-center gap-3.5 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-3.5">
                <Dot tone={a.tone} />
                <span className="flex-1 text-[15px] text-[#2E2E3A]">{a.texto}</span>
                <Badge tone={a.tone}>{a.estado}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
