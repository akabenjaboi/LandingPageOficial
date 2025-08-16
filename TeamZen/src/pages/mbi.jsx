import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

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

// Escala oficial 0–6
const SCALE = [
  { value: 0, label: 'Nunca' },
  { value: 1, label: 'Pocas veces/año' },
  { value: 2, label: '1 vez/mes o menos' },
  { value: 3, label: 'Pocas veces/mes' },
  { value: 4, label: '1 vez/semana' },
  { value: 5, label: 'Pocas veces/semana' },
  { value: 6, label: 'Todos los días' },
];

export default function MBIPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem('mbi_draft');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeCycle, setActiveCycle] = useState(null);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);

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

      // If answering for a team, require an active cycle
      if (teamId) {
        try {
          // Simplified: any cycle with status='active' counts. We ignore start/end windows to avoid blocking selection.
          const { data: cycle } = await supabase
            .from('mbi_evaluation_cycles')
            .select('*')
            .eq('team_id', teamId)
            .eq('status', 'active')
            .order('start_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // If there's an end_at in the past, treat as no active cycle (defensive)
            if (!cycle || (cycle?.end_at && new Date(cycle.end_at) <= new Date())) {
              setError('No hay una evaluación MBI activa para este equipo.');
              return;
            }
            setActiveCycle(cycle);
            // Check if user already responded in this active cycle
            const { data: existing } = await supabase
              .from('mbi_responses')
              .select('id')
              .eq('user_id', u.id)
              .eq('cycle_id', cycle.id)
              .limit(1);
            if (existing && existing.length > 0) {
              setAlreadyAnswered(true);
            }
        } catch (e) {
          setError('Error verificando ciclo activo.');
        }
      }
    };
    init();
  }, [navigate]);

  useEffect(() => {
    localStorage.setItem('mbi_draft', JSON.stringify(answers));
  }, [answers]);

  const scores = useMemo(() => {
  const ae = ITEMS.filter(i => i.sub === 'AE').reduce((acc, i) => acc + (answers[i.id] != null ? answers[i.id] : 0), 0);
  const d = ITEMS.filter(i => i.sub === 'D').reduce((acc, i) => acc + (answers[i.id] != null ? answers[i.id] : 0), 0);
  const rp = ITEMS.filter(i => i.sub === 'RP').reduce((acc, i) => acc + (answers[i.id] != null ? answers[i.id] : 0), 0);
    return { ae, d, rp };
  }, [answers]);

  const completion = useMemo(() => {
    const answered = Object.keys(answers).length;
    return Math.round((answered / ITEMS.length) * 100);
  }, [answers]);

  const allAnswered = Object.keys(answers).length === ITEMS.length;

  const levelLabel = (sub, score) => {
    // Placeholder thresholds — customize based on your validated instrument version.
    // AE and D: higher is worse; RP: higher is better. We'll just show raw scores for now.
    return `${sub}: ${score}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        if (!activeCycle) throw new Error('No hay ciclo activo.');
        // Comprobar que el ciclo todavía existe en la BD
        const { data: cycleExists, error: cycleCheckErr } = await supabase
          .from('mbi_evaluation_cycles')
          .select('id,status')
          .eq('id', activeCycle.id)
          .maybeSingle();
        if (cycleCheckErr) throw cycleCheckErr;
        if (!cycleExists || cycleExists.status !== 'active') {
          throw new Error('El ciclo activo ya no existe o fue cerrado. Refresca e inténtalo de nuevo.');
        }
        cycleId = cycleExists.id;
      }
      if (alreadyAnswered) throw new Error('Ya respondiste esta evaluación.');

      const { data: resp, error: insertRespErr } = await supabase
        .from('mbi_responses')
        .insert([{ user_id: currentUser.id, team_id: teamId || null, cycle_id: cycleId }])
        .select('id')
        .single();
      if (insertRespErr) throw insertRespErr;

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

      localStorage.removeItem('mbi_draft');
      setSuccess('¡Gracias! Tu respuesta fue enviada correctamente.');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo enviar la respuesta. Verifica que las tablas MBI existan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/img/pandalogo.png" alt="TeamZen" className="w-8 h-8" />
            <span className="font-semibold">MBI</span>
          </div>
          <button
            className="text-sm text-gray-600 hover:text-gray-900"
            onClick={() => navigate('/dashboard')}
            disabled={submitting}
          >
            Volver al panel
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Cuestionario MBI (22 ítems)</h1>
            <div className="text-sm text-gray-600">Completado: {completion}%</div>
          </div>

          <p className="text-gray-600 mb-6">
            Responde según tu experiencia reciente. Esta versión usa textos de ejemplo. Sustituye por el instrumento autorizado cuando corresponda.
          </p>

          {teamId && !activeCycle && !error && (
            <div className="mb-6 p-4 rounded border border-amber-300 bg-amber-50 text-amber-700 text-sm">
              No hay un ciclo activo en este momento para este equipo.
            </div>
          )}
          {alreadyAnswered && (
            <div className="mb-6 p-4 rounded border border-green-300 bg-green-50 text-green-700 text-sm">
              Ya has respondido esta evaluación. Gracias por tu participación.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {ITEMS.map((it) => (
              <div key={it.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{it.id}. {it.text}</p>
                    <p className="text-xs text-gray-500">Subescala: {it.sub}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {SCALE.map((s) => {
                      const disabled = alreadyAnswered || (teamId ? !activeCycle : false);
                      return (
                        <label key={s.value} className={`cursor-pointer px-3 py-1 rounded-xl border transition-all duration-300 ${answers[it.id] === s.value ? 'bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] text-white border-[#55C2A2] shadow-lg' : disabled ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-[#55C2A2]/30'}`}>
                          <input
                            type="radio"
                            name={`item-${it.id}`}
                            value={s.value}
                            className="hidden"
                            disabled={disabled}
                            checked={answers[it.id] === s.value}
                            onChange={() => !disabled && setAnswers((a) => ({ ...a, [it.id]: s.value }))}
                          />
                          <span className="text-sm">{s.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Removed real-time puntajes estimados to simplify UI per request */}

            {error && (
              <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}
            {success && (
              <div className="rounded-lg p-3 bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="text-gray-600 hover:text-gray-900"
                onClick={() => navigate('/dashboard')}
                disabled={submitting}
              >
                Guardar borrador y salir
              </button>
              <button
                type="submit"
                className="bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] disabled:from-[#55C2A2]/50 disabled:to-[#7DDFC7]/50 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2"
                disabled={submitting || !allAnswered || (teamId && !activeCycle) || alreadyAnswered}
              >
                {alreadyAnswered ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Ya enviado
                  </>
                ) : submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Enviando…
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Enviar respuestas
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
