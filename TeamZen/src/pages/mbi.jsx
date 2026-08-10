import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import AppNavbar from '../components/AppNavbar';
import { Alert, Notice } from '../components/app-ui';

// Minimal MBI-HSS (22 items). Subscales: AE (Agotamiento Emocional), D (Despersonalización), RP (Realización Personal)
// Note: The exact copyrighted item texts are not included. Use placeholders; replace with licensed content if you have rights.
const ITEMS = [
  { id: 1, sub: 'AE', text: 'Me siento emocionalmente defraudado en mi trabajo' },
  { id: 2, sub: 'AE', text: 'Cuando termino mi jornada de trabajo me siento agotado' },
  { id: 3, sub: 'AE', text: 'Cuando me levanto por la mañana y me enfrento a otra jornada de trabajo me siento agotado' },
  { id: 4, sub: 'RP', text: 'Siento que puedo entender fácilmente a las personas que tengo que atender ' },
  { id: 5, sub: 'D', text: 'Siento que estoy tratando a algunos beneficiados de mí, como si fuesen objetos impersonales ' },
  { id: 6, sub: 'AE', text: 'Siento que trabajar todo el día con la gente me cansa ' },
  { id: 7, sub: 'RP', text: 'Siento que trato con mucha efectividad los problemas de las personas a las que tengo que atender' },
  { id: 8, sub: 'AE', text: 'Siento que mi trabajo me está desgastando ' },
  { id: 9, sub: 'RP', text: 'Siento que estoy influyendo positivamente en las vidas de otras personas a través de mi trabajo ' },
  { id: 10, sub: 'D', text: 'Siento que me he hecho más duro con la gente ' },
  { id: 11, sub: 'D', text: 'Me preocupa que este trabajo me está endureciendo emocionalmente' },
  { id: 12, sub: 'RP', text: 'Me siento muy enérgico en mi trabajo' },
  { id: 13, sub: 'AE', text: 'Me siento frustrado por el trabajo' },
  { id: 14, sub: 'AE', text: 'Siento que estoy demasiado tiempo en mi trabajo ' },
  { id: 15, sub: 'D', text: 'Siento que realmente no me importa lo que les ocurra a las personas a las que tengo que atender profesionalmente ' },
  { id: 16, sub: 'AE', text: 'Siento que trabajar en contacto directo con la gente me cansa' },
  { id: 17, sub: 'RP', text: 'Siento que puedo crear con facilidad un clima agradable en mi trabajo ' },
  { id: 18, sub: 'RP', text: 'Me siento estimulado después de haber trabajado íntimamente con quienes tengo que atender ' },
  { id: 19, sub: 'RP', text: 'Creo que consigo muchas cosas valiosas en este trabajo' },
  { id: 20, sub: 'AE', text: 'Me siento como si estuviera al límite de mis posibilidades ' },
  { id: 21, sub: 'RP', text: 'Siento que en mi trabajo los problemas emocionales son tratados de forma adecuada ' },
  { id: 22, sub: 'D', text: 'Me parece que los beneficiarios de mi trabajo me culpan de algunos problemas' },
];

const SUBSCALE_LABEL = { AE: 'Agotamiento emocional', D: 'Despersonalización', RP: 'Realización personal' };

// Escala oficial 0–6
const SCALE = [
  { value: 0, label: 'Nunca' },
  { value: 1, label: 'Pocas veces al año' },
  { value: 2, label: 'Una vez al mes o menos' },
  { value: 3, label: 'Pocas veces al mes' },
  { value: 4, label: 'Una vez a la semana' },
  { value: 5, label: 'Pocas veces a la semana' },
  { value: 6, label: 'Todos los días' },
];

export default function MBIPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [answers, setAnswers] = useState({});
  const [draftKey, setDraftKey] = useState(null);
  const [activeCycle, setActiveCycle] = useState(null);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [teamName, setTeamName] = useState('');
  // Guarda de re-entrancia sincrónica: `submitting` (estado de React) no basta
  // para bloquear un doble clic/doble submit muy rápido, porque el botón no
  // se deshabilita hasta el siguiente render. Esta ref se marca de inmediato,
  // antes de cualquier await, cerrando esa ventana de carrera por completo.
  const submittingRef = useRef(false);

  const teamId = searchParams.get('team');

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const u = data?.session?.user;
      if (!u) {
        navigate('/login');
        return;
      }
      setUser(u);

      const { error: closeExpiredError } = await supabase.rpc('close_expired_mbi_cycles');
      if (closeExpiredError) {
        console.warn('No se pudieron cerrar rondas vencidas', closeExpiredError);
      }

      // If answering for a team, require an active cycle
      if (teamId) {
        const { data: teamRow } = await supabase.from('teams').select('name').eq('id', teamId).maybeSingle();
        if (teamRow) setTeamName(teamRow.name);

        try {
          // Simplified: any cycle with status='active' counts. We ignore start/end windows to avoid blocking selection.
          const { data: cycle, error: cycleErr } = await supabase
            .from('mbi_evaluation_cycles')
            .select('*')
            .eq('team_id', teamId)
            .eq('status', 'active')
            .order('start_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (cycleErr) {
            setError('No se pudo verificar la ronda de evaluación activa. Intenta de nuevo.');
            return;
          }

          // If there's an end_at in the past, treat as no active cycle (defensive)
            if (!cycle || (cycle?.end_at && new Date(cycle.end_at) <= new Date())) {
              setError('No hay una evaluación MBI activa para este equipo.');
              return;
            }
            setActiveCycle(cycle);

            // Scope the draft key by user + team + cycle so answers never
            // leak across users on a shared machine, across teams, or
            // across evaluation rounds for the same team.
            const key = `mbi_draft_${u.id}_${teamId}_${cycle.id}`;
            setDraftKey(key);
            const saved = localStorage.getItem(key);
            if (saved) {
              try {
                setAnswers(JSON.parse(saved));
              } catch {
                // Corrupt/old draft — ignore and start fresh.
              }
            }

            // Check if user already responded in this active cycle
            const { data: existing, error: existingErr } = await supabase
              .from('mbi_responses')
              .select('id')
              .eq('user_id', u.id)
              .eq('cycle_id', cycle.id)
              .limit(1);
            if (existingErr) {
              setError('No se pudo verificar si ya respondiste esta evaluación. Intenta de nuevo.');
              setActiveCycle(null);
              return;
            }
            if (existing && existing.length > 0) {
              setAlreadyAnswered(true);
            }
        } catch {
          setError('Error verificando ronda activa.');
        }
      } else {
        const key = `mbi_draft_${u.id}_personal`;
        setDraftKey(key);
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            setAnswers(JSON.parse(saved));
          } catch {
            // Corrupt/old draft — ignore and start fresh.
          }
        }
      }
    };
    init();
  }, [navigate]);

  useEffect(() => {
    if (!draftKey) return;
    localStorage.setItem(draftKey, JSON.stringify(answers));
  }, [answers, draftKey]);

  const scores = useMemo(() => {
    const ae = ITEMS.filter(i => i.sub === 'AE').reduce((acc, i) => acc + (answers[i.id] != null ? answers[i.id] : 0), 0);
    const d = ITEMS.filter(i => i.sub === 'D').reduce((acc, i) => acc + (answers[i.id] != null ? answers[i.id] : 0), 0);
    const rp = ITEMS.filter(i => i.sub === 'RP').reduce((acc, i) => acc + (answers[i.id] != null ? answers[i.id] : 0), 0);
    return { ae, d, rp };
  }, [answers]);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === ITEMS.length;
  const disabled = alreadyAnswered || (teamId ? !activeCycle : false) || submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return; // ya hay un envío en curso — ignora clics/submits repetidos
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      if (!currentUser) throw new Error('Sesión no válida.');

      // Re-validar ciclo activo para evitar FK roto (ciclo borrado o reiniciada DB)
      let cycleId = null;
      if (teamId) {
        if (!activeCycle) throw new Error('No hay ronda activa.');
        // Comprobar que el ciclo todavía existe en la BD
        const { data: cycleExists, error: cycleCheckErr } = await supabase
          .from('mbi_evaluation_cycles')
          .select('id,status')
          .eq('id', activeCycle.id)
          .maybeSingle();
        if (cycleCheckErr) throw cycleCheckErr;
        if (!cycleExists || cycleExists.status !== 'active') {
          throw new Error('La ronda activa ya no existe o fue cerrada. Refresca e inténtalo de nuevo.');
        }
        cycleId = cycleExists.id;
      }
      if (alreadyAnswered) throw new Error('Ya respondiste esta evaluación.');

      // Defensa adicional al gate visual de "allAnswered": nunca crear una
      // respuesta en el servidor si falta algún ítem, para no dejar una fila
      // huérfana en mbi_responses (sin mbi_answers/mbi_scores) que después
      // bloquee cualquier reintento con un error de llave duplicada.
      const missingItems = ITEMS.filter((it) => answers[it.id] == null);
      if (missingItems.length > 0) {
        throw new Error(`Faltan ${missingItems.length} respuesta(s) por completar. Revisa el cuestionario antes de enviar.`);
      }

      const { data: resp, error: insertRespErr } = await supabase
        .from('mbi_responses')
        .insert([{ user_id: currentUser.id, team_id: teamId || null, cycle_id: cycleId }])
        .select('id')
        .single();
      if (insertRespErr) {
        // Violación de la restricción única (cycle_id, user_id): esta respuesta
        // ya se había guardado antes (p. ej. un doble clic mandó dos envíos, o
        // la página quedó abierta en dos pestañas). El envío en sí NO falló
        // desde la perspectiva del usuario — sus respuestas ya están guardadas
        // — así que se trata igual que un envío exitoso en vez de mostrar el
        // error crudo de Postgres y dejarlo varado sin redirigir.
        if (insertRespErr.code === '23505') {
          setAlreadyAnswered(true);
          if (draftKey) localStorage.removeItem(draftKey);
          setSuccess('Ya habías enviado esta evaluación. ¡Gracias por tu participación!');
          setTimeout(() => navigate('/dashboard'), 1500);
          return;
        }
        throw insertRespErr;
      }

      const responseId = resp.id;

      // Insert answers
      const answersRows = ITEMS.map((it) => ({
        response_id: responseId,
        item_index: it.id,
        subscale: it.sub,
        value: answers[it.id] ?? null,
      }));
      const { error: insertAnsErr } = await supabase
        .from('mbi_answers')
        .insert(answersRows);
      if (insertAnsErr) throw insertAnsErr;

      // Insert aggregate scores
      const { error: insertScoreErr } = await supabase
        .from('mbi_scores')
        .insert([{ response_id: responseId, ae_score: scores.ae, d_score: scores.d, rp_score: scores.rp }]);
      if (insertScoreErr) throw insertScoreErr;

      if (draftKey) localStorage.removeItem(draftKey);
      setSuccess('¡Gracias! Tu respuesta fue enviada correctamente.');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo enviar la respuesta. Verifica que las tablas MBI existan.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <AppNavbar user={user} />

      <main className="mx-auto flex max-w-[860px] flex-col gap-[22px] px-4 pb-[140px] pt-6 sm:px-6 sm:pt-8">
        <div className="flex flex-col gap-2.5">
          {teamId && teamName && (
            <span className="self-start rounded-full bg-[#DAD5E4]/55 px-3.5 py-1.5 font-['Poppins',_Arial,_sans-serif] text-xs font-semibold uppercase tracking-[.08em] text-[#8B6FB8]">
              {teamName}
            </span>
          )}
          <h1 className="font-['Poppins',_Arial,_sans-serif] text-[26px] font-bold tracking-[-.02em] text-[#2E2E3A] sm:text-[30px]">Cuestionario MBI (22 ítems)</h1>
          <p className="text-base text-[#5B5B6B]">
            Responde según tu experiencia de las últimas semanas. No hay respuestas correctas; tus respuestas individuales no se comparten con tu líder.
          </p>
        </div>

        <div className="sticky top-[76px] z-30 flex items-center gap-4 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6]/95 px-5 py-4 shadow-teamzen backdrop-blur-md">
          <div className="h-2.5 flex-1 overflow-hidden rounded-md bg-[#DAD5E4]">
            <div
              className="h-full rounded-md bg-[linear-gradient(90deg,#55C2A2,#9D83C6)] transition-[width] duration-250"
              style={{ width: `${(answeredCount / ITEMS.length) * 100}%` }}
            />
          </div>
          <span className="whitespace-nowrap font-['Poppins',_Arial,_sans-serif] text-sm font-semibold tabular-nums text-[#2E2E3A]">
            {answeredCount} / {ITEMS.length}
          </span>
          <span className="hidden text-[13px] text-[#5B5B6B] sm:inline">Borrador guardado</span>
        </div>

        {teamId && !activeCycle && !error && (
          <Notice tone="purple">No hay una ronda activa en este momento para este equipo.</Notice>
        )}
        {alreadyAnswered && <Notice>Ya has respondido esta evaluación. Gracias por tu participación.</Notice>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {ITEMS.map((it, qi) => (
            <div key={it.id} className="flex flex-col gap-3.5 rounded-[20px] border border-[#DAD5E4] bg-white p-[22px] shadow-teamzen">
              <div className="flex items-start gap-3.5">
                <span className="min-w-[26px] font-['Poppins',_Arial,_sans-serif] text-[13px] font-bold text-[#9D83C6]">
                  {String(qi + 1).padStart(2, '0')}
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <h3 className="font-['Poppins',_Arial,_sans-serif] text-[17px] font-semibold leading-snug text-[#2E2E3A]">{it.text}</h3>
                  <span className="text-xs font-bold uppercase tracking-[.06em] text-[#5B5B6B]">{SUBSCALE_LABEL[it.sub]}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {SCALE.map((s) => {
                  const on = answers[it.id] === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      aria-pressed={on}
                      disabled={disabled}
                      onClick={() => setAnswers((a) => ({ ...a, [it.id]: s.value }))}
                      className={`flex min-h-[74px] flex-col items-center justify-center gap-[5px] rounded-[14px] px-1.5 py-[11px] transition disabled:cursor-not-allowed ${
                        on
                          ? 'bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] text-white shadow-[0_10px_20px_rgba(85,194,162,.26)]'
                          : disabled
                            ? 'border-[1.5px] border-[#DAD5E4] bg-[#DAD5E4]/30 text-[#5B5B6B]'
                            : 'border-[1.5px] border-[#DAD5E4] bg-[#FAF9F6] text-[#5B5B6B] hover:bg-white hover:border-[#9D83C6]/50'
                      }`}
                    >
                      <span className="font-['Poppins',_Arial,_sans-serif] text-base font-bold">{s.value}</span>
                      <span className="text-center text-[10.5px] leading-tight">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {error && <Alert>{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}

          <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center bg-[linear-gradient(180deg,rgba(250,249,246,0),rgba(250,249,246,.96)_40%)] px-4 py-4 sm:px-6">
            <div className="flex w-full max-w-[860px] flex-wrap items-center gap-3.5 rounded-[20px] border border-[#DAD5E4] bg-white px-5 py-4 shadow-teamzen-strong">
              <span className="min-w-[200px] flex-1 text-sm text-[#5B5B6B]">
                {alreadyAnswered
                  ? 'Ya enviaste tus respuestas para esta ronda.'
                  : allAnswered
                    ? 'Todo listo — puedes enviar tus respuestas.'
                    : `Responde las ${ITEMS.length} preguntas para poder enviar.`}
              </span>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                disabled={submitting}
                className="rounded-xl bg-[#DAD5E4] px-[22px] py-[13px] font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold text-[#2E2E3A] transition hover:bg-[#cdc6db] disabled:opacity-60"
              >
                Guardar y salir
              </button>
              <button
                type="submit"
                disabled={submitting || !allAnswered || (teamId && !activeCycle) || alreadyAnswered}
                className="rounded-xl bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] px-[22px] py-[13px] font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold text-white shadow-[0_12px_26px_rgba(85,194,162,.28)] transition hover:scale-[1.02] hover:bg-[linear-gradient(135deg,#4AA690,#8B6FB8)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
              >
                {alreadyAnswered ? 'Ya enviado' : submitting ? 'Enviando...' : 'Enviar respuestas'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
