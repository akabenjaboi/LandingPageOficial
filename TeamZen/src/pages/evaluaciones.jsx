import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import LaunchMBIModal from '../components/LaunchMBIModal';
import { classifyMBI, computeBurnoutStatus, CLASSIFICATION_NOTE } from '../utils/mbiClassification';

export default function EvaluacionesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState([]);
  const [launching, setLaunching] = useState(false);
  const [teams, setTeams] = useState([]);
  const [activeCycles, setActiveCycles] = useState({}); // {team_id: cycle_id}
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchContext, setLaunchContext] = useState(null); // {teamId, teamName, activeCycleId, pendingMembers, totalMembers}
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Usamos rangos fijos proporcionados para clasificar

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      if (!currentUser) { navigate('/login'); return; }
      setUser(currentUser);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      setProfile(prof);

      // Load personal MBI history (scores join)
      const { data: respData } = await supabase
        .from('mbi_responses')
        .select('id, created_at, team_id, teams(name), mbi_scores(ae_score,d_score,rp_score)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
      setResponses(respData || []);

      if (prof?.role === 'leader') {
        const { data: leaderTeams } = await supabase
          .from('teams')
          .select('id,name')
          .eq('leader_id', currentUser.id);
        setTeams(leaderTeams || []);
        if (leaderTeams && leaderTeams.length > 0) {
          try {
            const { data: cycles } = await supabase
              .from('mbi_evaluation_cycles')
              .select('id, team_id, status')
              .in('team_id', leaderTeams.map(t => t.id))
              .eq('status', 'active');
            const map = {};
            (cycles || []).forEach(c => { map[c.team_id] = c.id; });
            setActiveCycles(map);
          } catch (e) {
            console.warn('No se pudieron cargar ciclos activos', e);
          }
        }
      }

      setLoading(false);
    };
    init();
  }, [navigate]);

  const prepareLaunch = async (team) => {
    setError(''); setSuccess('');
    const teamId = team.id;
    const activeCycleId = activeCycles[teamId];
    // Obtener miembros
    let members = [];
    try {
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id, profiles(first_name,last_name)')
        .eq('team_id', teamId);
      members = teamMembers || [];
    } catch (e) {
      console.warn('No se pudieron cargar miembros', e);
    }
    let pendingMembers = members.slice();
    if (activeCycleId) {
      try {
        const { data: responded } = await supabase
          .from('mbi_responses')
          .select('user_id')
          .eq('cycle_id', activeCycleId);
        const respondedSet = new Set((responded || []).map(r => r.user_id));
        pendingMembers = members.filter(m => !respondedSet.has(m.user_id));
      } catch (e) {
        console.warn('No se pudieron cargar respuestas de ciclo', e);
      }
    }
    setLaunchContext({
      teamId,
      teamName: team.name,
      activeCycleId: activeCycleId || null,
      pendingMembers,
      totalMembers: members.length
    });
    setShowLaunchModal(true);
  };

  const launchMBIForTeam = async (teamId) => {
    setError(''); setSuccess('');
    setLaunching(true);
    try {
      // Cerrar ciclo activo previo
      await supabase
        .from('mbi_evaluation_cycles')
        .update({ status: 'closed' })
        .eq('team_id', teamId)
        .eq('status', 'active');
      // Crear nuevo
      const { data: newCycle, error } = await supabase
        .from('mbi_evaluation_cycles')
        .insert([{ team_id: teamId, status: 'active' }])
        .select('id, team_id')
        .single();
      if (error) throw error;
      setActiveCycles(prev => ({ ...prev, [teamId]: newCycle.id }));
      setSuccess('Nuevo ciclo MBI creado correctamente.');
      setShowLaunchModal(false);
      setLaunchContext(null);
    } catch (e) {
      setError(e.message || 'Error al lanzar MBI');
    } finally {
      setLaunching(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Cargando...</div>;
  }

  // Utilizamos la versión centralizada (clasificación + estado)

  const statusColor = (status) => {
    switch (status) {
      case 'Burnout': return 'bg-red-100 text-red-700';
      case 'Riesgo Alto': return 'bg-orange-100 text-orange-700';
      case 'Riesgo': return 'bg-yellow-100 text-yellow-700';
      case 'Sin indicios': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={`${import.meta.env.BASE_URL}/img/pandalogo.png`} alt="TeamZen" className="w-8 h-8" />
            <span className="font-semibold">Evaluaciones</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">Dashboard</button>
            <button onClick={() => navigate('/mbi')} className="text-gray-600 hover:text-gray-900">Responder MBI</button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {profile?.role === 'leader' && (
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Lanzar MBI a un equipo</h2>
            </div>
            {teams.length === 0 && (
              <p className="text-sm text-gray-500">No tienes equipos. Crea uno primero.</p>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {teams.map(t => (
                <div key={t.id} className="border rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-800">{t.name}</h3>
                  </div>
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded disabled:opacity-50"
                    disabled={launching}
                    onClick={() => prepareLaunch(t)}
                  >
                    {activeCycles[t.id] ? (launching ? 'Lanzando...' : 'Nuevo ciclo MBI') : (launching ? 'Lanzando...' : 'Lanzar MBI')}
                  </button>
                  <button
                    className="text-blue-600 text-xs underline"
                    onClick={() => navigate(`/mbi?team=${t.id}`)}
                  >Responder como líder</button>
                </div>
              ))}
            </div>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            {success && <p className="mt-4 text-sm text-green-600">{success}</p>}
          </section>
        )}

        <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Mi Historial MBI</h2>
            {responses.length === 0 && (
              <p className="text-sm text-gray-500">Aún no has enviado respuestas MBI.</p>
            )}
            <div className="space-y-3">
              {responses.map(r => {
                const ae = r.mbi_scores?.ae_score; const d = r.mbi_scores?.d_score; const rp = r.mbi_scores?.rp_score;
                const { catAE, catD, catRP } = classifyMBI(ae, d, rp);
                const status = computeBurnoutStatus({catAE, catD, catRP});
                return (
                  <div key={r.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{new Date(r.created_at).toLocaleString()}</p>
                        <p className="text-xs text-gray-500">Equipo: {r.team_id ? (r.teams?.name || '—') : 'Individual'}</p>
                      </div>
                      {status && (
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${statusColor(status)}`}>{status}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium">AE {ae ?? '—'} {catAE && `· ${catAE}`}</span>
                      <span className="px-2 py-1 rounded bg-yellow-50 text-yellow-700 font-medium">D {d ?? '—'} {catD && `· ${catD}`}</span>
                      <span className="px-2 py-1 rounded bg-green-50 text-green-700 font-medium">RP {rp ?? '—'} {catRP && `· ${catRP}`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 text-[10px] text-gray-500 space-y-1">
              <p>{CLASSIFICATION_NOTE}</p>
              <p>Estado: Burnout (orientativo) si al menos dos subescalas en Alto incluyendo AE. Riesgo Alto = 2 (sin AE) o AE + otra Altas antes de síndrome; Riesgo = 1 Alto; Sin indicios = 0.</p>
              <p>RP se invierte solo para evaluar riesgo (puntajes bajos en RP reflejan mayor riesgo).</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => navigate('/mbi')} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Responder MBI</button>
            </div>
        </section>
      </main>
      <LaunchMBIModal 
        open={showLaunchModal} 
        context={launchContext} 
        launching={launching} 
        onClose={() => { setShowLaunchModal(false); setLaunchContext(null); }}
        onConfirm={launchMBIForTeam}
      />
    </div>
  );
}
