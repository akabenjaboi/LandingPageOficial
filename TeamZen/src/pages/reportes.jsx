import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import TrendChart from '../components/TrendChart';
import { generateAdvice, getAIAdviceWithCache } from '../utils/adviceEngine';
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
  const [viewMode, setViewMode] = useState('weekly'); // 'cycles' o 'weekly' - weekly por defecto

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      if (!currentUser) { navigate('/login'); return; }
      setUser(currentUser);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      setProfile(prof);
      
      if (prof?.role === 'leader') {
        // Cargar equipos para líderes
        const { data: leaderTeams } = await supabase.from('teams').select('id,name,include_leader_in_metrics').eq('leader_id', currentUser.id).order('created_at',{ascending:true});
        setTeams(leaderTeams || []);
      }
      // Tanto líderes como usuarios pueden acceder a reportes
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

  // Función auxiliar para obtener el inicio de la semana (lunes)
  const getWeekStartDate = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para que lunes sea día 1
    return new Date(d.setDate(diff));
  };

  // Nueva función para obtener datos agrupados por semana
  const getWeeklyData = useMemo(() => {
    if (!teamCycles.length) return [];
    
    // Obtener todas las respuestas de MBI con fechas
    const allResponses = [];
    teamCycles.forEach(cycle => {
      const scores = scoresByCycle[cycle.id] || [];
      scores.forEach(score => {
        // Usar la fecha de creación del ciclo como aproximación
        // En una implementación más robusta, deberías tener created_at en las respuestas
        const responseDate = new Date(cycle.created_at);
        allResponses.push({
          ...score,
          cycle_id: cycle.id,
          date: responseDate,
          week: getWeekStartDate(responseDate)
        });
      });
    });

    // Agrupar por semana
    const weeklyGroups = {};
    allResponses.forEach(response => {
      const weekKey = response.week.toISOString().split('T')[0];
      if (!weeklyGroups[weekKey]) {
        weeklyGroups[weekKey] = {
          weekStart: response.week,
          responses: []
        };
      }
      weeklyGroups[weekKey].responses.push(response);
    });

    // Convertir a array y calcular estadísticas por semana
    return Object.entries(weeklyGroups).map(([weekKey, data]) => {
      const scores = data.responses;
      if (!scores.length) return null;

      // Calcular promedios de subscalas
      const aeAvg = Math.round((scores.reduce((a,s)=>a+(s.ae??0),0)/scores.length)*10)/10;
      const dAvg = Math.round((scores.reduce((a,s)=>a+(s.d??0),0)/scores.length)*10)/10;
      const rpAvg = Math.round((scores.reduce((a,s)=>a+(s.rp??0),0)/scores.length)*10)/10;

      // Calcular estado dominante y bienestar
      const statuses = scores.map(s => {
        const ae=s.ae??0, d=s.d??0, rp=s.rp??0;
        if (ae >= 27 && d >= 10) return 'Burnout';
        if (ae >= 16 && d >= 6) return 'Riesgo Alto';
        if (ae >= 10 || d >= 3) return 'Riesgo';
        return 'Sin indicios';
      });
      const counts = statuses.reduce((acc,st)=>{acc[st]=(acc[st]||0)+1;return acc;},{});
      const dominant = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0] || 'Sin indicios';

      // Calcular bienestar global
      const MIN_AE=0, MAX_AE=54, MIN_D=0, MAX_D=30, MIN_RP=0, MAX_RP=48;
      const rangeAE=MAX_AE-MIN_AE, rangeD=MAX_D-MIN_D, rangeRP=MAX_RP-MIN_RP;
      const wbSum = scores.reduce((acc,s)=>{
        const aeWell = 1-((s.ae-MIN_AE)/(rangeAE||1));
        const dWell = 1-((s.d-MIN_D)/(rangeD||1));
        const rpWell = ((s.rp-MIN_RP)/(rangeRP||1));
        return acc + (aeWell + dWell + rpWell)/3;
      },0);
      const wellbeing = Math.round((wbSum / scores.length)*100);

      // Distribución de riesgo
      const dist = { Burnout:0, 'Riesgo Alto':0, Riesgo:0, 'Sin indicios':0 };
      statuses.forEach(st => { if(dist[st]!==undefined) dist[st]++; });

      return {
        weekStart: data.weekStart,
        weekEnd: new Date(data.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
        count: scores.length,
        aeAvg, dAvg, rpAvg,
        dominant, wellbeing, dist
      };
    }).filter(Boolean).sort((a, b) => a.weekStart - b.weekStart);
  }, [teamCycles, scoresByCycle]);

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
    <div className="min-h-screen bg-[#FAF9F6]">
      <nav className="bg-white border-b border-[#DAD5E4] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <img src={`${import.meta.env.BASE_URL}/img/pandalogo.png`} alt="TeamZen" className="w-6 h-6 sm:w-8 sm:h-8" />
            <span className="font-semibold text-[#2E2E3A] text-sm sm:text-base">Reportes</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="text-[#55C2A2] hover:text-[#2E2E3A] font-medium transition-colors duration-200 px-2 py-1"
            >
              Dashboard
            </button>
            <button 
              onClick={() => navigate('/evaluaciones')} 
              className="text-[#5B5B6B] hover:text-[#2E2E3A] font-medium transition-colors duration-200 px-2 py-1"
            >
              Evaluaciones
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {profile?.role === 'leader' ? (
          // Vista para líderes - Reportes de equipos
          <section className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl p-4 sm:p-6 shadow-teamzen">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[#2E2E3A]">Reportes estratégicos</h1>
                <p className="text-[#5B5B6B] text-sm mt-1">Visualiza tendencias por ciclo y distribución de riesgo de burnout.</p>
              </div>
              {!!teams.length && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-[#2E2E3A] font-medium">Equipo</label>
                  <select
                    className="border border-[#DAD5E4] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#55C2A2] 
                               focus:border-[#55C2A2] bg-white text-[#2E2E3A] transition-all duration-200"
                    value={activeTeamId || ''}
                    onChange={e => setActiveTeamId(e.target.value)}
                  >
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            {teams.length === 0 && (
              <p className="text-sm text-[#5B5B6B]">No tienes equipos aún. Crea uno para generar reportes.</p>
            )}
            {teams.length > 0 && (
            <div className="space-y-8">
              {/* Cycles summary */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2 sm:gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <h2 className="text-base sm:text-lg font-semibold text-[#2E2E3A]">Análisis de evaluaciones</h2>
                    {/* Toggle entre vista por ciclos y vista semanal */}
                    <div className="flex items-center gap-1 sm:gap-2 bg-[#DAD5E4]/30 p-1 rounded-xl w-fit">
                      <button
                        onClick={() => setViewMode('cycles')}
                        className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-lg transition-all duration-200 ${
                          viewMode === 'cycles' 
                            ? 'bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white shadow-lg' 
                            : 'text-[#2E2E3A] hover:text-[#55C2A2]'
                        }`}
                      >
                        Por Ciclos
                      </button>
                      <button
                        onClick={() => setViewMode('weekly')}
                        className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-lg transition-all duration-200 ${
                          viewMode === 'weekly' 
                            ? 'bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white shadow-lg' 
                            : 'text-[#2E2E3A] hover:text-[#55C2A2]'
                        }`}
                      >
                        Semanal
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button 
                      onClick={handleRefresh} 
                      className="text-xs px-3 py-1 rounded-lg border border-[#DAD5E4] hover:bg-[#FAF9F6] 
                                 text-[#2E2E3A] transition-colors duration-200"
                    >
                      Refrescar
                    </button>
                  </div>
                </div>
                <CycleHelp />
                {error && !fetching && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                  </div>
                )}
                {fetching ? (
                  <div className="py-8 flex justify-center">
                    <LoadingSpinner size="small" message="Cargando ciclos..."/>
                  </div>
                ) : (viewMode === 'cycles' ? aggregated : getWeeklyData).length === 0 ? (
                  viewMode === 'cycles' ? (
                    teamCycles.length === 0 ? (
                      <div className="text-sm text-[#5B5B6B] flex items-center gap-2">
                        <span>Sin ciclos creados todavía.</span>
                        <button 
                          onClick={handleRefresh} 
                          className="text-[#55C2A2] hover:text-[#2E2E3A] underline hover:no-underline 
                                     transition-colors duration-200"
                        >
                          Actualizar
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-[#5B5B6B] flex flex-col gap-2">
                        <span>Hay {teamCycles.length} ciclo(s) pero aún sin respuestas con puntajes.</span>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={handleRefresh} 
                            className="text-[#55C2A2] hover:text-[#2E2E3A] underline hover:no-underline 
                                       transition-colors duration-200"
                          >
                            Reintentar
                          </button>
                          <span className="text-[11px] text-[#9D83C6]">
                            (Si ya respondieron hace segundos, espera y refresca)
                          </span>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="text-sm text-[#5B5B6B] flex items-center gap-2">
                      <span>No hay datos suficientes para mostrar vista semanal.</span>
                      <button 
                        onClick={handleRefresh} 
                        className="text-[#55C2A2] hover:text-[#2E2E3A] underline hover:no-underline 
                                   transition-colors duration-200"
                      >
                        Actualizar
                      </button>
                    </div>
                  )
                ) : (
                  <div className="overflow-x-auto bg-white rounded-lg border border-[#DAD5E4]">
                    <table className="min-w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="text-left px-2 sm:px-3 py-2 font-medium text-[10px] sm:text-sm">
                            {viewMode === 'cycles' ? 'Inicio / Fin / Duración' : 'Semana'}
                          </th>
                          <th className="text-left px-2 sm:px-3 py-2 font-medium text-[10px] sm:text-sm">Resp.</th>
                          <th className="text-left px-2 sm:px-3 py-2 font-medium text-[10px] sm:text-sm">AE (0–54)</th>
                          <th className="text-left px-2 sm:px-3 py-2 font-medium text-[10px] sm:text-sm">D (0–30)</th>
                          <th className="text-left px-2 sm:px-3 py-2 font-medium text-[10px] sm:text-sm">RP (0–48)</th>
                          <th className="text-left px-2 sm:px-3 py-2 font-medium text-[10px] sm:text-sm">Bienestar (0–100)</th>
                          <th className="text-left px-2 sm:px-3 py-2 font-medium text-[10px] sm:text-sm hidden sm:table-cell">Estado dominante</th>
                          <th className="text-left px-2 sm:px-3 py-2 font-medium text-[10px] sm:text-sm hidden md:table-cell">Distribución de estados</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(viewMode === 'cycles' ? aggregated : getWeeklyData).map((row, index) => {
                          if (viewMode === 'cycles') {
                            // Vista por ciclos (código original)
                            const started = row.cycle.start_at || row.cycle.created_at;
                            const ended = row.cycle.end_at;
                            const startDate = started ? new Date(started) : null;
                            const endDate = ended ? new Date(ended) : null;
                            const fmt = (d) => d?.toLocaleString(undefined,{ dateStyle:'short', timeStyle:'short'}) || '—';
                            const duration = startDate && endDate ? formatDuration(endDate - startDate) : (endDate ? '—' : 'En curso');
                            return (
                              <tr key={row.cycle.id} className="hover:bg-gray-50">
                                <td className="px-2 sm:px-3 py-2">
                                  <div className="text-[10px] sm:text-xs"><span className="font-semibold text-gray-700">Inicio:</span> {fmt(startDate)}</div>
                                  <div className="text-[10px] sm:text-xs"><span className="font-semibold text-gray-700">Fin:</span> {endDate ? fmt(endDate) : 'En curso'}</div>
                                  <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1">Duración: {duration}</div>
                                </td>
                                <td className="px-2 sm:px-3 py-2 text-center">{row.count}</td>
                                <td className="px-2 sm:px-3 py-2">{row.aeAvg != null ? `${row.aeAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">{row.dAvg != null ? `${row.dAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">{row.rpAvg != null ? `${row.rpAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">
                                  {row.wellbeing != null ? (
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <div className="w-12 sm:w-20 h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${row.wellbeing}%`, background: row.wellbeing>=70?'#16a34a':row.wellbeing>=40?'#f59e0b':'#dc2626' }} />
                                      </div>
                                      <span className="text-[10px] sm:text-xs">{row.wellbeing}</span>
                                    </div>
                                  ) : '—'}
                                </td>
                                <td className="px-2 sm:px-3 py-2 hidden sm:table-cell text-[10px] sm:text-xs">{row.dominant || '—'}</td>
                                <td className="px-2 sm:px-3 py-2 text-[9px] sm:text-[10px] leading-tight hidden md:table-cell">
                                  <div>Burnout: {row.dist?.Burnout ?? 0}</div>
                                  <div>Riesgo Alto: {row.dist?.['Riesgo Alto'] ?? 0}</div>
                                  <div>Riesgo: {row.dist?.Riesgo ?? 0}</div>
                                  <div>Sin indicios: {row.dist?.['Sin indicios'] ?? 0}</div>
                                </td>
                              </tr>
                            );
                          } else {
                            // Vista semanal
                            const weekStart = row.weekStart;
                            const weekEnd = row.weekEnd;
                            const fmt = (d) => d?.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }) || '—';
                            return (
                              <tr key={`week-${index}`} className="hover:bg-gray-50">
                                <td className="px-2 sm:px-3 py-2">
                                  <div className="text-[10px] sm:text-xs"><span className="font-semibold text-gray-700">Semana:</span> {fmt(weekStart)} - {fmt(weekEnd)}</div>
                                  <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1">7 días</div>
                                </td>
                                <td className="px-2 sm:px-3 py-2 text-center">{row.count}</td>
                                <td className="px-2 sm:px-3 py-2">{row.aeAvg != null ? `${row.aeAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">{row.dAvg != null ? `${row.dAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">{row.rpAvg != null ? `${row.rpAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">
                                  {row.wellbeing != null ? (
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <div className="w-12 sm:w-20 h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${row.wellbeing}%`, background: row.wellbeing>=70?'#16a34a':row.wellbeing>=40?'#f59e0b':'#dc2626' }} />
                                      </div>
                                      <span className="text-[10px] sm:text-xs">{row.wellbeing}</span>
                                    </div>
                                  ) : '—'}
                                </td>
                                <td className="px-2 sm:px-3 py-2 hidden sm:table-cell text-[10px] sm:text-xs">{row.dominant || '—'}</td>
                                <td className="px-2 sm:px-3 py-2 text-[9px] sm:text-[10px] leading-tight hidden md:table-cell">
                                  <div>Burnout: {row.dist?.Burnout ?? 0}</div>
                                  <div>Riesgo Alto: {row.dist?.['Riesgo Alto'] ?? 0}</div>
                                  <div>Riesgo: {row.dist?.Riesgo ?? 0}</div>
                                  <div>Sin indicios: {row.dist?.['Sin indicios'] ?? 0}</div>
                                </td>
                              </tr>
                            );
                          }
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Strategic insights */}
              <StrategicInsightsDropdown data={aggregated} />

              <div className="bg-white rounded-xl border border-[#DAD5E4] p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3">Tendencia comparativa</h2>
                {aggregated.length < 2 ? (
                  <p className="text-xs sm:text-sm text-gray-500">Se necesitan al menos 2 ciclos con respuestas para graficar la tendencia.</p>
                ) : (
                  <div className="w-full">
                    <TrendChart data={aggregated.slice().reverse().map(c => ({
                      label: new Date(c.cycle.start_at || c.cycle.created_at).toLocaleDateString(),
                      values: { aeAvg: c.aeAvg, dAvg: c.dAvg, rpAvg: c.rpAvg, wellbeing: c.wellbeing }
                    }))} />
                  </div>
                )}
              </div>

              {(viewMode === 'cycles' ? aggregated : getWeeklyData).length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    Sugerencias personalizadas ({viewMode === 'cycles' ? 'por ciclos' : 'por semana'})
                  </h2>
                  <AdvicePanel 
                    data={viewMode === 'cycles' ? aggregated : getWeeklyData} 
                    teamId={activeTeamId} 
                    viewMode={viewMode}
                  />
                </div>
              )}
            </div>
          )}
          </section>
        ) : (
          // Vista para usuarios - Análisis personal
          <UserPersonalReports 
            user={user}
            profile={profile}
          />
        )}
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
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 
                   border border-[#55C2A2]/30 rounded-lg hover:from-[#55C2A2]/15 hover:to-[#9D83C6]/15 
                   transition-all duration-200 group"
      >
        <div className="flex items-center space-x-2">
          <svg 
            className="w-5 h-5 text-[#55C2A2]" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-[#2E2E3A]">
            ¿Qué son los ciclos y las dimensiones del MBI?
          </span>
        </div>
        <svg 
          className={`w-5 h-5 text-[#9D83C6] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="mt-3 p-4 bg-[#FAF9F6] border border-[#DAD5E4] rounded-lg text-xs space-y-3 
                        animate-modal-enter leading-relaxed">
          
          {/* Qué es un ciclo */}
          <div className="space-y-2">
            <h4 className="font-semibold text-[#2E2E3A] flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#55C2A2] rounded-full"></span>
              <span>Qué es un ciclo</span>
            </h4>
            <p className="text-[#5B5B6B] ml-4">
              Periodo activo en el que el equipo responde el cuestionario. Al cerrarlo se congelan sus resultados.
            </p>
          </div>

          {/* Dimensiones del MBI */}
          <div className="space-y-2">
            <h4 className="font-semibold text-[#2E2E3A] flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#9D83C6] rounded-full"></span>
              <span>Dimensiones del MBI</span>
            </h4>
            <div className="ml-4 space-y-2">
              <div className="flex items-start space-x-2">
                <span className="text-[#55C2A2] font-bold">•</span>
                <div>
                  <span className="font-semibold text-[#2E2E3A]">Agotamiento Emocional (AE):</span>
                  <span className="text-[#5B5B6B]"> desgaste y cansancio mental. Menor puntaje es mejor.</span>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#55C2A2] font-bold">•</span>
                <div>
                  <span className="font-semibold text-[#2E2E3A]">Despersonalización (D):</span>
                  <span className="text-[#5B5B6B]"> distancia o frialdad hacia el trabajo. Menor puntaje es mejor.</span>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-[#55C2A2] font-bold">•</span>
                <div>
                  <span className="font-semibold text-[#2E2E3A]">Realización Personal (RP):</span>
                  <span className="text-[#5B5B6B]"> percepción de logro y eficacia. Mayor puntaje es mejor.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Escala */}
          <div className="space-y-2">
            <h4 className="font-semibold text-[#2E2E3A] flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#55C2A2] rounded-full"></span>
              <span>Escala de medición</span>
            </h4>
            <p className="text-[#5B5B6B] ml-4">
              Cada ítem se responde 0–6 (Nunca → Todos los días). Se suman por dimensión: 
              <span className="font-medium text-[#2E2E3A]"> AE (9 ítems, 0–54)</span>, 
              <span className="font-medium text-[#2E2E3A]"> D (5 ítems, 0–30)</span>, 
              <span className="font-medium text-[#2E2E3A]"> RP (8 ítems, 0–48)</span>.
            </p>
          </div>

          {/* Rangos de burnout */}
          <div className="space-y-2">
            <h4 className="font-semibold text-[#2E2E3A] flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#9D83C6] rounded-full"></span>
              <span>Rangos de burnout</span>
            </h4>
            <div className="ml-4 space-y-1">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <div className="font-semibold text-green-700">Bajo</div>
                  <div className="text-green-600">AE: 0-18</div>
                  <div className="text-green-600">D: 0-6</div>
                  <div className="text-green-600">RP: 40-48</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                  <div className="font-semibold text-yellow-700">Medio</div>
                  <div className="text-yellow-600">AE: 19-26</div>
                  <div className="text-yellow-600">D: 7-9</div>
                  <div className="text-yellow-600">RP: 34-39</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <div className="font-semibold text-red-700">Alto</div>
                  <div className="text-red-600">AE: 27-54</div>
                  <div className="text-red-600">D: 10-30</div>
                  <div className="text-red-600">RP: 0-33</div>
                </div>
              </div>
            </div>
          </div>

          {/* Diagnóstico de síndrome */}
          <div className="space-y-2">
            <h4 className="font-semibold text-[#2E2E3A] flex items-center space-x-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span>Diagnóstico de síndrome</span>
            </h4>
            <p className="text-[#5B5B6B] ml-4">
              Se presenta cuando hay <span className="font-semibold text-red-600">"Alto burnout"</span> en al menos 2 dimensiones, 
              siendo el <span className="font-semibold text-[#2E2E3A]">Agotamiento Emocional</span> una de ellas.
            </p>
          </div>

          {/* Bienestar Global */}
          <div className="space-y-2">
            <h4 className="font-semibold text-[#2E2E3A] flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#55C2A2] rounded-full"></span>
              <span>Bienestar Global (0–100)</span>
            </h4>
            <p className="text-[#5B5B6B] ml-4">
              Índice sintético que normaliza e invierte AE y D, y normaliza RP. 
              <span className="font-medium text-[#9D83C6]"> Solo para tendencia general</span>, 
              siempre interpretar las 3 dimensiones por separado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StrategicInsightsDropdown({ data }) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-[#9D83C6]/10 to-[#55C2A2]/10 
                   border border-[#9D83C6]/30 rounded-xl hover:from-[#9D83C6]/15 hover:to-[#55C2A2]/15 
                   transition-all duration-200 group"
      >
        <div className="flex items-center space-x-3">
          <svg 
            className="w-6 h-6 text-[#9D83C6]" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div className="text-left">
            <h2 className="text-lg font-semibold text-[#2E2E3A]">Insights estratégicos</h2>
            <p className="text-sm text-[#5B5B6B]">Tendencias y prioridades de mejora</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {data.length > 0 && (
            <span className="bg-[#55C2A2] text-white text-xs font-medium px-2 py-1 rounded-full">
              {data.length} ciclo{data.length !== 1 ? 's' : ''}
            </span>
          )}
          <svg 
            className={`w-5 h-5 text-[#9D83C6] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {isExpanded && (
        <div className="mt-4 p-6 bg-[#FAF9F6] border border-[#DAD5E4] rounded-xl animate-modal-enter">
          {data.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-[#DAD5E4] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-[#5B5B6B] font-medium">No hay datos disponibles</p>
              <p className="text-sm text-[#9D83C6] mt-1">Genera al menos un ciclo para ver insights</p>
            </div>
          ) : (
            <InsightsPanel data={data} />
          )}
        </div>
      )}
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
      <div className="border border-[#DAD5E4] rounded-xl p-5 bg-gradient-to-br from-[#55C2A2]/5 to-[#55C2A2]/10 
                      hover:shadow-teamzen transition-all duration-200">
        <div className="flex items-center space-x-2 mb-4">
          <svg className="w-5 h-5 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h3 className="font-semibold text-[#2E2E3A]">Tendencias recientes</h3>
        </div>
        <ul className="space-y-3">
          <li className="flex items-center justify-between">
            <span className="text-sm text-[#2E2E3A] font-medium">Agotamiento Emocional</span>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-[#2E2E3A]">{makeTrendLabel(aeT, false)}</span>
              <span className="text-xs text-[#5B5B6B]">(menor es mejor)</span>
            </div>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-sm text-[#2E2E3A] font-medium">Despersonalización</span>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-[#2E2E3A]">{makeTrendLabel(dT, false)}</span>
              <span className="text-xs text-[#5B5B6B]">(menor es mejor)</span>
            </div>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-sm text-[#2E2E3A] font-medium">Realización Personal</span>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-[#2E2E3A]">{makeTrendLabel(rpT, true)}</span>
              <span className="text-xs text-[#5B5B6B]">(mayor es mejor)</span>
            </div>
          </li>
          <li className="flex items-center justify-between border-t border-[#DAD5E4] pt-3">
            <span className="text-sm text-[#2E2E3A] font-semibold">Bienestar Global</span>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-[#55C2A2]">{makeTrendLabel(wbT, true)}</span>
              <span className="text-xs px-2 py-1 bg-[#55C2A2]/20 text-[#2E2E3A] rounded-full">
                {latest.wellbeing}%
              </span>
            </div>
          </li>
        </ul>
      </div>
      
      <div className="border border-[#DAD5E4] rounded-xl p-5 bg-gradient-to-br from-[#9D83C6]/5 to-[#9D83C6]/10 
                      hover:shadow-teamzen transition-all duration-200">
        <div className="flex items-center space-x-2 mb-4">
          <svg className="w-5 h-5 text-[#9D83C6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <h3 className="font-semibold text-[#2E2E3A]">Prioridades sugeridas</h3>
        </div>
        {improvementAreas.length === 0 ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-green-700">Sin alertas críticas</p>
            <p className="text-xs text-green-600 mt-1">Mantener estrategias actuales</p>
          </div>
        ) : (
          <div className="space-y-3">
            {improvementAreas.map((area, index) => (
              <div key={area} className="flex items-start space-x-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-orange-700">{index + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-800">{area}</p>
                  <p className="text-xs text-orange-600 mt-1">Requiere atención prioritaria</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdvicePanel({ data, teamId, viewMode = 'cycles' }) {
  const [mode, setMode] = React.useState('ai'); // 'local' | 'ai' - IA por defecto
  const [loading, setLoading] = React.useState(false);
  const [aiAdvice, setAiAdvice] = React.useState(null);
  const [error, setError] = React.useState('');

  // Función para obtener sugerencias de IA - definida antes para usar en useEffect
  const handleAIFetch = React.useCallback(async (forceRegenerate = false) => {
    if (loading) return;
    
    const valid = data.filter(r => r.count > 0 && r.aeAvg != null && r.dAvg != null && r.rpAvg != null && r.wellbeing != null);
    if (!valid.length) return; // No hay datos válidos
    
    const current = valid[0];
    const prev = valid.length > 1 ? valid[1] : null;
    
    const historyData = valid.slice(0, 5).map(item => ({
      ae: item.aeAvg,
      d: item.dAvg,
      rp: item.rpAvg,
      wellbeing: item.wellbeing,
      date: viewMode === 'cycles' 
        ? (item.cycle.start_at || item.cycle.created_at)
        : item.weekStart.toISOString()
    }));
    
    const mbiPayload = {
      ae: current.aeAvg,
      d: current.dAvg,
      rp: current.rpAvg,
      wellbeing: current.wellbeing,
      previous: prev ? { ae: prev.aeAvg, d: prev.dAvg, rp: prev.rpAvg, wellbeing: prev.wellbeing } : null,
      history: historyData,
      meta: { 
        latestId: viewMode === 'cycles' ? current.cycle.id : `week-${current.weekStart.toISOString().split('T')[0]}`,
        totalPeriods: valid.length,
        viewMode: viewMode,
        analysisScope: viewMode === 'cycles' ? 'Análisis por ciclos de evaluación' : 'Análisis semanal granular'
      }
    };
    
    setLoading(true);
    setError('');
    
    try {
      // Timeout de 15 segundos para evitar esperas largas
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: IA externa tardó más de 15 segundos')), 15000)
      );
      
      const analysisId = viewMode === 'cycles' 
        ? current.cycle.id 
        : `weekly-${current.weekStart.toISOString().split('T')[0]}`;
      
      const result = await Promise.race([
        getAIAdviceWithCache(mbiPayload, teamId, analysisId, forceRegenerate),
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
  }, [loading, data, viewMode, teamId]);

  // Limpiar análisis de IA cuando cambie el modo de vista
  React.useEffect(() => {
    if (aiAdvice) {
      setAiAdvice(null);
      setMode('ai'); // Mantener en modo IA para regenerar automáticamente
      setError('');
    }
  }, [viewMode]);

  // Auto-generar análisis de IA cuando hay datos válidos
  React.useEffect(() => {
    const valid = data.filter(r => r.count > 0 && r.aeAvg != null && r.dAvg != null && r.rpAvg != null && r.wellbeing != null);
    if (valid.length > 0 && !aiAdvice && !loading && mode === 'ai') {
      handleAIFetch(false);
    }
  }, [data, teamId, viewMode, aiAdvice, loading, mode, handleAIFetch]);

  if (!data.length) return null;
  
  // Considerar solo ciclos con respuestas (count > 0) para evitar nulls en clasificación
  const valid = data.filter(r => r.count > 0 && r.aeAvg != null && r.dAvg != null && r.rpAvg != null && r.wellbeing != null);
  if (!valid.length) return null; // No hay datos aún
  
  const current = valid[0];
  const prev = valid.length > 1 ? valid[1] : null;
  
  // Preparar datos históricos para análisis de tendencias (máximo 5 elementos más recientes)
  const historyData = valid.slice(0, 5).map(item => ({
    ae: item.aeAvg,
    d: item.dAvg,
    rp: item.rpAvg,
    wellbeing: item.wellbeing,
    date: viewMode === 'cycles' 
      ? (item.cycle.start_at || item.cycle.created_at)
      : item.weekStart.toISOString()
  }));
  
  const mbiPayload = {
    ae: current.aeAvg,
    d: current.dAvg,
    rp: current.rpAvg,
    wellbeing: current.wellbeing,
    previous: prev ? { ae: prev.aeAvg, d: prev.dAvg, rp: prev.rpAvg, wellbeing: prev.wellbeing } : null,
    history: historyData,
    meta: { 
      latestId: viewMode === 'cycles' ? current.cycle.id : `week-${current.weekStart.toISOString().split('T')[0]}`,
      totalPeriods: valid.length,
      viewMode: viewMode,
      analysisScope: viewMode === 'cycles' ? 'Análisis por ciclos de evaluación' : 'Análisis semanal granular'
    }
  };

  // Generar sugerencias locales (siempre disponibles)
  const localAdvice = generateAdvice(mbiPayload);

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
            className={`px-3 py-1 rounded-xl border transition-colors ${
              mode === 'local' 
                ? 'bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] text-white border-[#55C2A2] shadow-lg' 
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            🧠 Local
          </button>
          <button 
            onClick={() => handleAIFetch(false)}
            disabled={loading}
            className={`px-3 py-1 rounded border transition-colors disabled:opacity-50 ${
              mode === 'ai' 
                ? 'bg-purple-600 text-white border-purple-600' 
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {loading ? '⏳ Analizando...' : '🤖 IA + Tendencias'}
          </button>
          {mode === 'ai' && aiAdvice && !loading && (
            <button 
              onClick={() => handleAIFetch(true)}
              disabled={loading}
              className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Regenerar análisis forzadamente"
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="text-xs text-gray-500 -mt-2">
        {loading && `🔄 Analizando ${viewMode === 'cycles' ? 'evolución por ciclos' : 'tendencias semanales'} del equipo...`}
        {error && <span className="text-red-600">❌ {error} (mostrando sugerencias locales)</span>}
        {mode === 'ai' && aiAdvice && !loading && (
          <div className="flex items-center gap-2">
            {aiAdvice._cacheInfo?.fromCache ? (
              <span className="text-blue-600">
                🔵 Desde caché • Actualizado: {new Date(aiAdvice._cacheInfo.createdAt).toLocaleString()}
              </span>
            ) : (
              <span className="text-green-600">
                🟢 Recién generado • {new Date(aiAdvice._cacheInfo?.createdAt).toLocaleString()}
              </span>
            )}
            <span className="text-gray-400">
              • {historyData.length} {viewMode === 'cycles' ? 'ciclo(s)' : 'semana(s)'} de historia
            </span>
          </div>
        )}
        {mode === 'local' && !loading && !error && (
          <span>🧠 Sugerencias {viewMode === 'cycles' ? 'por ciclos' : 'semanales'} basadas en reglas heurísticas</span>
        )}
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

// ===================================================================
// COMPONENTE DE ANÁLISIS PERSONAL - REPORTES PARA USUARIOS
// ===================================================================

function UserPersonalReports({ user, profile }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mbiHistory, setMbiHistory] = useState([]);
  const [expanded, setExpanded] = useState(false);

  // Cargar historial MBI del usuario
  useEffect(() => {
    if (!user?.id) return;
    
    const loadMBIHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('mbi_responses')
          .select(`
            id,
            created_at,
            team_id,
            teams(name),
            mbi_scores(ae_score, d_score, rp_score)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10); // Últimas 10 evaluaciones
        
        if (error) throw error;
        setMbiHistory(data || []);
      } catch (err) {
        console.error('Error cargando historial MBI:', err);
      }
    };

    loadMBIHistory();
  }, [user?.id]);

  // Generar análisis personal
  const generateAnalysis = async (forceRegenerate = false) => {
    if (!user?.id || !profile || mbiHistory.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { generatePersonalAnalysisWithCache } = await import('../utils/groqClient');
      
      const userData = {
        userId: user.id,
        profile,
        mbiHistory
      };
      
      console.log('🔍 DEBUG: Datos que se envían para análisis:', {
        userId: userData.userId,
        profileExists: !!userData.profile,
        mbiHistoryCount: userData.mbiHistory?.length || 0,
        forceRegenerate
      });
      
      const result = await generatePersonalAnalysisWithCache(userData, forceRegenerate);
      setAnalysis(result);
    } catch (err) {
      console.error('Error generando análisis personal:', err);
      setError(err.message || 'Error generando análisis');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generar análisis cuando tenemos datos
  useEffect(() => {
    if (mbiHistory.length > 0 && !analysis && !loading && !error) {
      generateAnalysis();
    }
  }, [mbiHistory, analysis, loading, error]);

  return (
    <div className="space-y-8">
      {/* Título de la sección */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Mi Análisis Personal de Bienestar</h1>
        <p className="text-gray-600 mt-2">
          Descubre insights personalizados sobre tu bienestar laboral y recibe recomendaciones específicas para tu situación
        </p>
      </div>

      {/* Estadísticas rápidas */}
      {mbiHistory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Evaluaciones</p>
                <p className="text-2xl font-bold text-gray-900">{mbiHistory.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Última Evaluación</p>
                <p className="text-lg font-bold text-gray-900">
                  {new Date(mbiHistory[0]?.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cargo Actual</p>
                <p className="text-lg font-bold text-gray-900">
                  {profile?.job_title || 'No especificado'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje si no hay evaluaciones */}
      {mbiHistory.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Sin evaluaciones aún</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Para ver tu análisis personal, necesitas completar al menos una evaluación MBI. 
            Esto nos permitirá generar insights específicos sobre tu bienestar laboral.
          </p>
          <button
            onClick={() => window.location.href = '/mbi'}
            className="bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow"
          >
            Completar primera evaluación
          </button>
        </div>
      )}

      {/* Análisis Personal */}
      {mbiHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Análisis Inteligente</h3>
                  <p className="text-sm text-gray-600">
                    Basado en {mbiHistory.length} evaluación{mbiHistory.length !== 1 ? 'es' : ''} MBI y tu información laboral
                    {analysis?.fromCache ? (
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                        📋 Desde caché
                      </span>
                    ) : (
                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        ✨ Recién generado
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {expanded ? 'Contraer' : 'Ver Detalles'}
                </button>
                <button
                  onClick={() => generateAnalysis(true)}
                  disabled={loading}
                  className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? 'Analizando...' : 'Actualizar'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-600">Generando análisis personalizado con IA...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Error generando análisis</h4>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {analysis && !loading && (
              <div className="space-y-6">
                {/* Indicador de origen del análisis */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center space-x-2">
                    {analysis.fromCache ? (
                      <>
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-gray-600">
                          <span className="font-medium text-blue-600">Desde caché</span>
                          {analysis.cachedAt && (
                            <span className="text-gray-500"> • Actualizado: {new Date(analysis.cachedAt).toLocaleString()}</span>
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-600">
                          <span className="font-medium text-green-600">Recién generado</span>
                          {analysis.generatedAt && (
                            <span className="text-gray-500"> • {new Date(analysis.generatedAt).toLocaleString()}</span>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    ⚡ Análisis por IA
                  </div>
                </div>

                {/* Resumen Personal */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-2">Resumen de tu Estado Actual</h4>
                  <p className="text-gray-700 leading-relaxed">{analysis.personal_summary}</p>
                  {analysis.burnout_level && (
                    <div className="mt-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        analysis.burnout_level === 'Alto' ? 'bg-red-100 text-red-800' :
                        analysis.burnout_level === 'Medio' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        Nivel de Burnout: {analysis.burnout_level}
                      </span>
                    </div>
                  )}
                </div>

                {/* Análisis de Tendencias */}
                {analysis.trend_analysis && expanded && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-2">Evolución de tu Bienestar</h4>
                    <p className="text-gray-700 leading-relaxed">{analysis.trend_analysis}</p>
                  </div>
                )}

                {/* Fortalezas y Áreas de Riesgo */}
                {expanded && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {analysis.strengths && analysis.strengths.length > 0 && (
                      <div>
                        <h4 className="text-md font-semibold text-green-800 mb-3">Tus Fortalezas</h4>
                        <ul className="space-y-2">
                          {analysis.strengths.map((strength, index) => (
                            <li key={index} className="flex items-start">
                              <svg className="w-4 h-4 text-green-500 mt-1 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm text-gray-700">{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis.risk_areas && analysis.risk_areas.length > 0 && (
                      <div>
                        <h4 className="text-md font-semibold text-orange-800 mb-3">Áreas de Atención</h4>
                        <ul className="space-y-2">
                          {analysis.risk_areas.map((risk, index) => (
                            <li key={index} className="flex items-start">
                              <svg className="w-4 h-4 text-orange-500 mt-1 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm text-gray-700">{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Recomendaciones Personalizadas */}
                {analysis.personalized_recommendations && analysis.personalized_recommendations.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-4">Recomendaciones Personalizadas</h4>
                    <div className="space-y-4">
                      {analysis.personalized_recommendations.map((rec, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-3 ${
                              rec.category === 'Inmediato' ? 'bg-red-100 text-red-800' :
                              rec.category === 'Corto plazo' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {rec.category}
                            </span>
                          </div>
                          <h5 className="font-medium text-gray-900 mb-1">{rec.action}</h5>
                          <p className="text-sm text-gray-600">{rec.why}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Próxima Evaluación */}
                {analysis.next_evaluation_suggestion && expanded && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-md font-semibold text-blue-900 mb-2">Próxima Evaluación</h4>
                    <p className="text-sm text-blue-800">{analysis.next_evaluation_suggestion}</p>
                  </div>
                )}

                {/* Metadatos del análisis */}
                {expanded && (analysis.fromCache || analysis.generatedAt) && (
                  <div className="text-xs text-gray-500 pt-4 border-t border-gray-200 flex justify-between items-center">
                    <div>
                      {analysis.fromCache ? (
                        <span>📋 Análisis desde caché: {new Date(analysis.cachedAt || analysis.generatedAt).toLocaleString()}</span>
                      ) : (
                        <span>✨ Análisis generado: {new Date(analysis.generatedAt).toLocaleString()}</span>
                      )}
                    </div>
                    <div className="text-right">
                      {analysis.fromCache ? (
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">
                          Usando caché inteligente
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs">
                          Procesado por IA
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
