import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../supabaseClient";
import { IMG } from "./assets";

const TAMANOS = ["1 – 10 personas", "11 – 50 personas", "51 – 200 personas", "Más de 200"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  "rounded-xl border border-[#DAD5E4] bg-white px-4 py-[13px] text-[15px] text-[#2E2E3A] outline-none transition focus:border-[#55C2A2] focus:shadow-[0_0_0_3px_rgba(85,194,162,.22)] disabled:opacity-60";

export default function DemoModal({ open, onClose }) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({});
  const [form, setForm] = useState({ nombre: "", email: "", tamano: TAMANOS[1] });
  const panelRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setSubmitting(false);
    setError("");
    setTouched({});
    setForm({ nombre: "", email: "", tamano: TAMANOS[1] });

    const focusTimer = setTimeout(() => firstFieldRef.current?.focus(), 0);

    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const markTouched = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const nombreError = form.nombre.trim().length === 0 ? "Ingresa tu nombre y apellido." : "";
  const emailError = !EMAIL_RE.test(form.email.trim()) ? "Ingresa un correo válido." : "";
  const isValid = !nombreError && !emailError;

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ nombre: true, email: true });
    if (!isValid) return;

    setSubmitting(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("demo_requests").insert([
        {
          full_name: form.nombre.trim(),
          email: form.email.trim(),
          team_size: form.tamano,
        },
      ]);
      if (insertError) throw insertError;
      setSent(true);
    } catch (err) {
      setError("No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.");
      console.error("Error al enviar solicitud de demo:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(46,46,58,.42)] p-6 backdrop-blur-[4px]"
      role="dialog"
      aria-modal="true"
      aria-label="Solicitar una demo"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[520px] flex-col gap-[18px] rounded-3xl border border-[#DAD5E4] bg-[#FAF9F6] p-[30px] shadow-teamzen-strong"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img src={IMG.formPanda} alt="" className="h-14 w-14 rounded-2xl object-cover" />
            <div>
              <h2 className="font-['Poppins',_Arial,_sans-serif] text-2xl font-bold tracking-[-.02em] text-[#2E2E3A]">Solicitar una demo</h2>
              <p className="mt-0.5 text-sm text-[#5B5B6B]">Te escribimos dentro de un día hábil.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-xl p-2 text-xl leading-none text-[#5B5B6B] transition hover:bg-[#DAD5E4]/50 hover:text-[#2E2E3A]">
            ×
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3.5 py-[18px] text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(85,194,162,.18)] text-[26px] text-[#3d8a74]">✓</span>
            <h3 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">Solicitud enviada</h3>
            <p className="text-[15px] text-[#5B5B6B]">
              Gracias. Te contactamos al correo que dejaste para coordinar los 15 minutos.
            </p>
            <button type="button" onClick={onClose} className="rounded-xl bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] px-[26px] py-[13px] font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold text-white hover:bg-[linear-gradient(135deg,#4AA690,#8B6FB8)]">
              Cerrar
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
            <label className="flex flex-col gap-1.5 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]">
              Nombre y apellido
              <input
                ref={firstFieldRef}
                className={inputCls}
                value={form.nombre}
                onChange={set("nombre")}
                onBlur={markTouched("nombre")}
                placeholder="Camila Rojas"
                disabled={submitting}
                aria-invalid={touched.nombre && !!nombreError}
                aria-describedby={touched.nombre && nombreError ? "demo-nombre-error" : undefined}
              />
              {touched.nombre && nombreError && (
                <span id="demo-nombre-error" className="text-xs font-normal text-red-600">{nombreError}</span>
              )}
            </label>
            <label className="flex flex-col gap-1.5 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]">
              Correo corporativo
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={set("email")}
                onBlur={markTouched("email")}
                placeholder="camila@empresa.cl"
                disabled={submitting}
                aria-invalid={touched.email && !!emailError}
                aria-describedby={touched.email && emailError ? "demo-email-error" : undefined}
              />
              {touched.email && emailError && (
                <span id="demo-email-error" className="text-xs font-normal text-red-600">{emailError}</span>
              )}
            </label>
            <label className="flex flex-col gap-1.5 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]">
              Tamaño del equipo
              <select className={inputCls} value={form.tamano} onChange={set("tamano")} disabled={submitting}>
                {TAMANOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-1 rounded-xl bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] px-[26px] py-[15px] font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-white shadow-[0_12px_26px_rgba(85,194,162,.28)] transition hover:scale-[1.02] hover:bg-[linear-gradient(135deg,#4AA690,#8B6FB8)] disabled:opacity-60 disabled:hover:scale-100"
            >
              {submitting ? "Enviando..." : "Enviar solicitud"}
            </button>
            <p className="text-center text-[13px] text-[#5B5B6B]">Usamos tus datos solo para coordinar la demo.</p>
          </form>
        )}
      </div>
    </div>
  );
}
