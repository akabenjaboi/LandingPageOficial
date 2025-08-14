import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import TrendChart from '../components/TrendChart';
import { generateAdvice, getAIAdvice } from '../utils/adviceEngine';
import { classifyMBI, computeBurnoutStatus, WELLBEING_NORMALIZATION } from '../utils/mbiClassification';

export default function ReportesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]); // leader teams
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [teamCycles, setTeamCycles] = useState([]); // cycles history for selected team
  const [scoresByCycle, setScoresByCycle] = useState({}); // cycle_id => array of {ae,d,rp,user_id}
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      if (!currentUser) { navigate('/login'); return; }
      setUser(currentUser);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      setProfile(prof);
      if (prof?.role !== 'leader') { navigate('/dashboard'); return; }
      const { data: leaderTeams } = await supabase.from('teams').select('id,name,include_leader_in_metrics').eq('leader_id', currentUser.id).order('created_at',{ascending:true});
      setTeams(leaderTeams || []);
      setLoading(false);
    })();
  }, [navigate]);

  // Handle query param team to pre-select when teams are loaded
  useEffect(() => {
    if (!teams.length) return;
    const params = new URLSearchParams(location.search);
    const teamParam = params.get('team');
    if (teamParam && teams.some(t => t.id === teamParam)) {
      setActiveTeamId(teamParam);
    } else if (!activeTeamId) {
      setActiveTeamId(teams[0].id);
    }
  }, [teams, location.search, activeTeamId]);

  useEffect(() => {
    const loadCyclesAndScores = async () => {
      if (!activeTeamId) return;
      setFetching(true); setError('');
      try {
        // 1. Fetch cycles for team
        const { data: cycles, error: cyclesErr } = await supabase
          .from('mbi_evaluation_cycles')
          .select('id, status, created_at, start_at, end_at')
          .eq('team_id', activeTeamId)
          .order('created_at', { ascending: false });
        if (cyclesErr) throw cyclesErr;
        setTeamCycles(cycles || []);
        if (!cycles || cycles.length === 0) { setScoresByCycle({}); return; }
        const cycleIds = cycles.map(c => c.id);

        // 2. Fetch responses with nested scores (more reliable filtering on cycle_id)
        const { data: scoreRows, error: scoreErr } = await supabase
          .from('mbi_scores')
          .select('ae_score, d_score, rp_score, mbi_responses (cycle_id, user_id)')
          .in('mbi_responses.cycle_id', cycleIds);
        if (scoreErr) throw scoreErr;
        const grouped = {};
        (scoreRows || []).forEach(r => {
          const cId = r.mbi_responses?.cycle_id; if (!cId) return;
          if (!grouped[cId]) grouped[cId] = [];
          grouped[cId].push({ ae: r.ae_score, d: r.d_score, rp: r.rp_score, user_id: r.mbi_responses?.user_id });
        });
        setScoresByCycle(grouped);
      } catch (e) {
        console.error('Error cargando reportes', e);
        setError('No se pudieron cargar los datos del reporte.');
      } finally {
        setFetching(false);
      }
    };
    loadCyclesAndScores();
  }, [activeTeamId, reloadCount]);

  const handleRefresh = () => setReloadCount(c => c + 1);

  const aggregated = useMemo(() => {
    if (!teamCycles.length) return [];
    return teamCycles.map(cycle => {
      const scores = scoresByCycle[cycle.id] || [];
      if (!scores.length) return { cycle, count:0 };
      // Aggregate subscale means (ya en escala 0–6 por ítem -> sumas reales)
      const aeAvg = Math.round((scores.reduce((a,s)=>a+(s.ae??0),0)/scores.length)*10)/10;
      const dAvg = Math.round((scores.reduce((a,s)=>a+(s.d??0),0)/scores.length)*10)/10;
      const rpAvg = Math.round((scores.reduce((a,s)=>a+(s.rp??0),0)/scores.length)*10)/10;
      // Classification majority status usando cada respuesta individual
      const statuses = scores.map(s => {
        const cls = classifyMBI(s.ae, s.d, s.rp);
        return computeBurnoutStatus(cls);
      }).filter(Boolean);
      const statusCounts = statuses.reduce((acc,st)=>{acc[st]=(acc[st]||0)+1; return acc;},{});
      let dominant = null; let max=0;
      Object.entries(statusCounts).forEach(([st,cnt])=>{ if (cnt>max){max=cnt;dominant=st;} });
      // Wellbeing metric (0–100) con nueva normalización 0–54,0–30,0–48
      const { MIN_AE, MAX_AE, MIN_D, MAX_D, MIN_RP, MAX_RP } = WELLBEING_NORMALIZATION;
      const rangeAE = MAX_AE - MIN_AE, rangeD = MAX_D - MIN_D, rangeRP = MAX_RP - MIN_RP;
      const wbSum = scores.reduce((acc,s)=>{
        if ([s.ae,s.d,s.rp].some(v=>v==null)) return acc;
        const aeWell = 1 - ((s.ae - MIN_AE)/(rangeAE||1));
        const dWell  = 1 - ((s.d - MIN_D)/(rangeD||1));
        const rpWell = ((s.rp - MIN_RP)/(rangeRP||1));
        return acc + (aeWell + dWell + rpWell)/3;
      },0);
      const wellbeing = Math.round((wbSum / scores.length)*100);
      // Risk distribution
      const dist = { Burnout:0, 'Riesgo Alto':0, Riesgo:0, 'Sin indicios':0 };
      statuses.forEach(st => { if(dist[st]!==undefined) dist[st]++; });
      return { cycle, count: scores.length, aeAvg, dAvg, rpAvg, dominant, wellbeing, dist };
    });
  }, [teamCycles, scoresByCycle]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="large" message="Cargando reportes..."/></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={`${import.meta.env.BASE_URL}/img/pandalogo.png`} alt="TeamZen" className="w-8 h-8" />
            <span className="font-semibold">Reportes</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">Dashboard</button>
            <button onClick={() => navigate('/evaluaciones')} className="text-gray-600 hover:text-gray-900">Evaluaciones</button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reportes estratégicos</h1>
              <p className="text-gray-600 text-sm mt-1">Visualiza tendencias por ciclo y distribución de riesgo de burnout.</p>
            </div>
            {!!teams.length && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 font-medium">Equipo</label>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  value={activeTeamId || ''}
                  onChange={e => setActiveTeamId(e.target.value)}
                >
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {teams.length === 0 && (
            <p className="text-sm text-gray-500">No tienes equipos aún. Crea uno para generar reportes.</p>
          )}
          {teams.length > 0 && (
            <div className="space-y-8">
              {/* Cycles summary */}
              <div>
                <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
                  <h2 className="text-lg font-semibold text-gray-800">Resumen por ciclo</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={handleRefresh} className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">Refrescar</button>
                  </div>
                </div>
                <CycleHelp />
                {error && !fetching && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
                )}
                {fetching ? (
                  <div className="py-8 flex justify-center"><LoadingSpinner size="small" message="Cargando ciclos..."/></div>
                ) : aggregated.length === 0 ? (
                  teamCycles.length === 0 ? (
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span>Sin ciclos creados todavía.</span>
                      <button onClick={handleRefresh} className="text-blue-600 underline hover:no-underline">Actualizar</button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 flex flex-col gap-2">
                      <span>Hay {teamCycles.length} ciclo(s) pero aún sin respuestas con puntajes.</span>
                      <div className="flex items-center gap-3">
                        <button onClick={handleRefresh} className="text-blue-600 underline hover:no-underline">Reintentar</button>
                        <span className="text-[11px] text-gray-400">(Si ya respondieron hace segundos, espera y refresca)</span>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="text-left px-3 py-2 font-medium">Inicio / Fin / Duración</th>
                          <th className="text-left px-3 py-2 font-medium">Respuestas</th>
                          <th className="text-left px-3 py-2 font-medium">Agotamiento Emocional (0–54)</th>
                          <th className="text-left px-3 py-2 font-medium">Despersonalización (0–30)</th>
                          <th className="text-left px-3 py-2 font-medium">Realización Personal (0–48)</th>
                          <th className="text-left px-3 py-2 font-medium">Bienestar Global (0–100)</th>
                          <th className="text-left px-3 py-2 font-medium">Estado dominante</th>
                          <th className="text-left px-3 py-2 font-medium">Distribución de estados</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {aggregated.map(row => {
          const started = row.cycle.start_at || row.cycle.created_at;
          const ended = row.cycle.end_at;
          const startDate = started ? new Date(started) : null;
          const endDate = ended ? new Date(ended) : null;
          const fmt = (d) => d?.toLocaleString(undefined,{ dateStyle:'short', timeStyle:'short'}) || '—';
          const duration = startDate && endDate ? formatDuration(endDate - startDate) : (endDate ? '—' : 'En curso');
                          return (
                            <tr key={row.cycle.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
            <div className="text-xs"><span className="font-semibold text-gray-700">Inicio:</span> {fmt(startDate)}</div>
            <div className="text-xs"><span className="font-semibold text-gray-700">Fin:</span> {endDate ? fmt(endDate) : 'En curso'}</div>
            <div className="text-[10px] text-gray-500 mt-1">Duración: {duration}</div>
                              </td>
                              <td className="px-3 py-2">{row.count}</td>
                              <td className="px-3 py-2">{row.aeAvg != null ? `${row.aeAvg} / 54` : '—'}</td>
                              <td className="px-3 py-2">{row.dAvg != null ? `${row.dAvg} / 30` : '—'}</td>
                              <td className="px-3 py-2">{row.rpAvg != null ? `${row.rpAvg} / 48` : '—'}</td>
                              <td className="px-3 py-2">
                {row.wellbeing != null ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="h-2 rounded-full" style={{ width: `${row.wellbeing}%`, background: row.wellbeing>=70?'#16a34a':row.wellbeing>=40?'#f59e0b':'#dc2626' }} />
                                    </div>
                  <span>{row.wellbeing} / 100</span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2">{row.dominant || '—'}</td>
                              <td className="px-3 py-2 text-[10px] leading-tight">
                                <div>Burnout: {row.dist?.Burnout ?? 0}</div>
                                <div>Riesgo Alto: {row.dist?.['Riesgo Alto'] ?? 0}</div>
                                <div>Riesgo: {row.dist?.Riesgo ?? 0}</div>
                                <div>Sin indicios: {row.dist?.['Sin indicios'] ?? 0}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Strategic insights */}
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Insights estratégicos</h2>
                {aggregated.length === 0 ? (
                  <p className="text-sm text-gray-500">Genera al menos un ciclo para ver insights.</p>
                ) : (
                  <InsightsPanel data={aggregated} />
                )}
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Tendencia comparativa</h2>
                {aggregated.length < 2 ? (
                  <p className="text-sm text-gray-500">Se necesitan al menos 2 ciclos con respuestas para graficar la tendencia.</p>
                ) : (
                  <TrendChart data={aggregated.slice().reverse().map(c => ({
                    label: new Date(c.cycle.start_at || c.cycle.created_at).toLocaleDateString(),
                    values: { aeAvg: c.aeAvg, dAvg: c.dAvg, rpAvg: c.rpAvg, wellbeing: c.wellbeing }
                  }))} />
                )}
              </div>

              {aggregated.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">Sugerencias personalizadas (heurísticas)</h2>
                  <AdvicePanel data={aggregated} />
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms/1000);
  const days = Math.floor(totalSec/86400);
  const hours = Math.floor((totalSec%86400)/3600);
  const mins = Math.floor((totalSec%3600)/60);
  if (days>0) return `${days}d ${hours}h`;
  if (hours>0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function CycleHelp() {
  return (
    <div className="mb-4 text-xs bg-gray-50 border border-gray-200 rounded p-3 space-y-1 leading-relaxed">
      <p><span className="font-semibold">Qué es un ciclo:</span> periodo activo en el que el equipo responde el cuestionario. Al cerrarlo se congelan sus resultados.</p>
      
      <p><span className="font-semibold">Dimensiones del MBI:</span></p>
      <p>• <span className="font-semibold">Agotamiento Emocional:</span> desgaste y cansancio mental. Menor puntaje es mejor.</p>
      <p>• <span className="font-semibold">Despersonalización:</span> distancia o frialdad hacia el trabajo. Menor puntaje es mejor.</p>
      <p>• <span className="font-semibold">Realización Personal:</span> percepción de logro y eficacia. Mayor puntaje es mejor.</p>
      
      <p><span className="font-semibold">Escala:</span> Cada ítem se responde 0–6 (Nunca → Todos los días). Se suman por dimensión: AE (9 ítems, 0–54), D (5 ítems, 0–30), RP (8 ítems, 0–48).</p>
      
      <p><span className="font-semibold">Rangos de burnout:</span></p>
      <p>• AE: 0-18 Bajo, 19-26 Medio, 27-54 Alto burnout</p>
      <p>• D: 0-6 Bajo, 7-9 Medio, 10-30 Alto burnout</p>
      <p>• RP: 40-48 Bajo, 34-39 Medio, 0-33 Alto burnout</p>
      
      <p><span className="font-semibold">Diagnóstico de síndrome:</span> Se presenta cuando hay "Alto burnout" en al menos 2 dimensiones, siendo el Agotamiento Emocional una de ellas.</p>
      
      <p><span className="font-semibold">Bienestar Global (0–100):</span> índice sintético que normaliza e invierte AE y D, y normaliza RP. Solo para tendencia general, siempre interpretar las 3 dimensiones por separado.</p>
    </div>
  );
}

function InsightsPanel({ data }) {
  // Derive trends (simple linear direction vs previous cycle)
  if (!data.length) return null;
  const sorted = [...data].reverse(); // oldest -> newest
  const trend = (key) => {
    if (sorted.length < 2) return null;
    const prev = sorted[sorted.length-2][key];
    const current = sorted[sorted.length-1][key];
    if (prev == null || current == null) return null;
    if (current > prev) return 'up';
    if (current < prev) return 'down';
    return 'flat';
  };
  const aeT = trend('aeAvg');
  const dT = trend('dAvg');
  const rpT = trend('rpAvg');
  const wbT = trend('wellbeing');

  const makeTrendLabel = (t, positiveHigher=true) => {
    if (!t) return '—';
    if (t==='up') return positiveHigher? '↑' : '↓';
    if (t==='down') return positiveHigher? '↓' : '↑';
    return '→';
  };

  const latest = data[0]; // data mapped newest first earlier (aggregated uses created_at desc)
  const improvementAreas = [];
  if (latest.aeAvg >= 27) improvementAreas.push('Reducir Agotamiento Emocional (AE)');
  if (latest.dAvg >= 10) improvementAreas.push('Mitigar Despersonalización (D)');
  if (latest.rpAvg < 34) improvementAreas.push('Elevar Realización Personal (RP)');
  if (latest.wellbeing < 50) improvementAreas.push('Plan de intervención general');

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-medium text-gray-800 mb-2">Tendencias recientes</h3>
        <ul className="text-sm space-y-1">
          <li>AE: {makeTrendLabel(aeT,false)}<span className="text-gray-500 ml-1 text-xs">(menor es mejor)</span></li>
          <li>D: {makeTrendLabel(dT,false)}<span className="text-gray-500 ml-1 text-xs">(menor es mejor)</span></li>
          <li>RP: {makeTrendLabel(rpT,true)}<span className="text-gray-500 ml-1 text-xs">(mayor es mejor)</span></li>
          <li>Bienestar: {makeTrendLabel(wbT,true)}</li>
        </ul>
      </div>
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-medium text-gray-800 mb-2">Prioridades sugeridas</h3>
        {improvementAreas.length === 0 ? (
          <p className="text-sm text-green-700">Sin alertas críticas. Mantener estrategias actuales.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            {improvementAreas.map(a => <li key={a}>{a}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function AdvicePanel({ data }) {
  const [mode, setMode] = React.useState('local'); // 'local' | 'ai'
  const [loading, setLoading] = React.useState(false);
  const [aiAdvice, setAiAdvice] = React.useState(null);
  const [error, setError] = React.useState('');

  if (!data.length) return null;
  
  // Considerar solo ciclos con respuestas (count > 0) para evitar nulls en clasificación
  const valid = data.filter(r => r.count > 0 && r.aeAvg != null && r.dAvg != null && r.rpAvg != null && r.wellbeing != null);
  if (!valid.length) return null; // No hay datos aún
  
  const current = valid[0];
  const prev = valid.length > 1 ? valid[1] : null;
  
  // Preparar datos históricos para análisis de tendencias (máximo 5 ciclos más recientes)
  const historyData = valid.slice(0, 5).map(cycle => ({
    ae: cycle.aeAvg,
    d: cycle.dAvg,
    rp: cycle.rpAvg,
    wellbeing: cycle.wellbeing,
    date: cycle.cycle.start_at || cycle.cycle.created_at
  }));
  
  const mbiPayload = {
    ae: current.aeAvg,
    d: current.dAvg,
    rp: current.rpAvg,
    wellbeing: current.wellbeing,
    previous: prev ? { ae: prev.aeAvg, d: prev.dAvg, rp: prev.rpAvg, wellbeing: prev.wellbeing } : null,
    history: historyData, // Nuevo: datos históricos para análisis de tendencias
    meta: { latestCycleId: current.cycle.id, totalCycles: valid.length }
  };

  // Generar sugerencias locales (siempre disponibles)
  const localAdvice = generateAdvice(mbiPayload);

  // Función para obtener sugerencias de IA
  const handleAIFetch = async () => {
    if (loading) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Timeout de 15 segundos para evitar esperas largas
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: IA externa tardó más de 15 segundos')), 15000)
      );
      
      const result = await Promise.race([
        getAIAdvice(mbiPayload),
        timeoutPromise
      ]);
      
      setAiAdvice(result);
      setMode('ai');
    } catch (err) {
      console.error('Error IA:', err);
      setError(err.message || 'Error conectando con IA');
      setMode('local'); // Volver a local en caso de error
    } finally {
      setLoading(false);
    }
  };

  // Determinar qué sugerencias mostrar
  const displayAdvice = mode === 'ai' && aiAdvice ? aiAdvice : localAdvice;

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
      {/* Header con controles */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-medium text-gray-800">Sugerencias personalizadas</h3>
        <div className="flex items-center gap-2 text-xs">
          <button 
            onClick={() => {setMode('local'); setError('');}}
            className={`px-3 py-1 rounded border transition-colors ${
              mode === 'local' 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            🧠 Local
          </button>
          <button 
            onClick={handleAIFetch}
            disabled={loading}
            className={`px-3 py-1 rounded border transition-colors disabled:opacity-50 ${
              mode === 'ai' 
                ? 'bg-purple-600 text-white border-purple-600' 
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {loading ? '⏳ Analizando...' : '🤖 IA + Tendencias'}
          </button>
        </div>
      </div>

      {/* Status indicator */}
      <div className="text-xs text-gray-500 -mt-2">
        {loading && '🔄 Analizando evolución histórica del equipo...'}
        {error && <span className="text-red-600">❌ {error} (mostrando sugerencias locales)</span>}
        {mode === 'ai' && aiAdvice && !loading && `✨ Análisis IA con ${historyData.length} ciclo(s) de historia`}
        {mode === 'local' && !loading && !error && '🧠 Sugerencias basadas en reglas heurísticas'}
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-700 leading-relaxed">
            <span className="font-medium">Resumen:</span> {displayAdvice.summary}
          </p>
        </div>

        {/* Análisis de tendencias (solo IA) */}
        {mode === 'ai' && aiAdvice?.trendAnalysis && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs font-semibold text-blue-800 mb-1">📈 Análisis de evolución</p>
            <p className="text-xs text-blue-700 leading-relaxed">{aiAdvice.trendAnalysis}</p>
          </div>
        )}
        
        {displayAdvice.keyRisks?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-800 mb-1">⚠️ Riesgos identificados</p>
            <ul className="list-disc pl-4 text-xs text-gray-600 space-y-0.5">
              {displayAdvice.keyRisks.map((risk, i) => (
                <li key={i}>{risk}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div>
          <p className="text-xs font-semibold text-gray-800 mb-1">💡 Acciones recomendadas</p>
          {!displayAdvice.actions?.length ? (
            <p className="text-xs text-gray-500">Sin acciones prioritarias detectadas.</p>
          ) : (
            <ul className="list-disc pl-4 text-xs text-gray-600 space-y-0.5">
              {displayAdvice.actions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Pronóstico (solo IA) */}
        {mode === 'ai' && aiAdvice?.prognosis && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">🔮 Pronóstico</p>
            <p className="text-xs text-amber-700 leading-relaxed">{aiAdvice.prognosis}</p>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-[10px] text-gray-400">
          {mode === 'ai' && aiAdvice 
            ? `🤖 Análisis evolutivo por Groq AI basado en ${historyData.length} ciclo(s) - Fallback automático a local si falla` 
            : '🧠 Sugerencias heurísticas locales - Pulsa "IA + Tendencias" para análisis histórico avanzado'
          }
        </p>
      </div>
    </div>
  );
}
