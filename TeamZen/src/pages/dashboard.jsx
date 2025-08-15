import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import LoadingSpinner from "../components/LoadingSpinner";
import { Card, Button, Alert, Badge, Input } from "../components/UIComponents";
import LaunchMBIModal from "../components/LaunchMBIModal";
import CreateTeamModal from "../components/CreateTeamModal";
import TeamOptionsMenu from "../components/TeamOptionsMenu";
import EditTeamModal from "../components/EditTeamModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState({});
  const [membersLoading, setMembersLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeCycles, setActiveCycles] = useState({}); // { team_id: cycle_id }
  const [launchingTeam, setLaunchingTeam] = useState(null);
  const [endingTeam, setEndingTeam] = useState(null);
  const [respondedCycles, setRespondedCycles] = useState({}); // { cycle_id: true }
  const [respondedMembersByTeam, setRespondedMembersByTeam] = useState({}); // { team_id: Set(user_ids) }
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchContext, setLaunchContext] = useState(null); // {teamId, teamName, activeCycleId, pendingMembers:[], totalMembers}
  const [wellbeingByTeam, setWellbeingByTeam] = useState({}); // { team_id: { avg: number, count: number } }
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      if (!currentUser) return navigate("/login");
      setUser(currentUser);

      // Cargar perfil
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFirstName(profileData.first_name || "");
        setLastName(profileData.last_name || "");
        setRole(profileData.role || "");

        // Si es líder, cargar equipos creados, códigos y miembros
        if (profileData.role === "leader") {
          setTeamsLoading(true);
          const { data: teamsData } = await supabase
            .from("teams")
            .select("*, team_invite_codes(code)")
            .eq("leader_id", currentUser.id);
          setTeams(teamsData || []);
          setTeamsLoading(false);

          // Fetch active cycles (one per team) and responses of leader (for optional display)
          if (teamsData && teamsData.length > 0) {
            try {
              const teamIds = teamsData.map(t => t.id);
              const { data: cycles } = await supabase
                .from('mbi_evaluation_cycles')
                .select('id, team_id, status')
                .in('team_id', teamIds)
                .eq('status', 'active');
              const cycleMap = {};
              (cycles || []).forEach(c => { cycleMap[c.team_id] = c.id; });
              setActiveCycles(cycleMap);

              // Fetch responses this user has already submitted for active cycles
              const activeCycleIds = Object.values(cycleMap);
              if (activeCycleIds.length > 0) {
                // Fetch all responses for these active cycles
                const { data: allResponses } = await supabase
                  .from('mbi_responses')
                  .select('cycle_id, user_id')
                  .in('cycle_id', activeCycleIds);

                // Map showing if the leader already answered each cycle
                const respMap = {};
                (allResponses || []).filter(r => r.user_id === currentUser.id).forEach(r => {
                  if (r.cycle_id) respMap[r.cycle_id] = true;
                });

                // Build per-team sets of responded member user_ids
                const teamResponded = {};
                (allResponses || []).forEach(r => {
                  const teamId = Object.keys(cycleMap).find(tid => cycleMap[tid] === r.cycle_id);
                  if (teamId && r.user_id) {
                    if (!teamResponded[teamId]) teamResponded[teamId] = new Set();
                    teamResponded[teamId].add(r.user_id);
                  }
                });

                setRespondedCycles(respMap);
                setRespondedMembersByTeam(teamResponded);

                // Fetch scores for wellbeing metric
                const { data: scoreRows, error: scoreErr } = await supabase
                  .from('mbi_scores')
                  .select('response_id, ae_score, d_score, rp_score, mbi_responses (cycle_id, team_id)')
                  .in('mbi_responses.cycle_id', activeCycleIds);
                if (scoreErr) {
                  console.warn('Error obteniendo scores para wellbeing', scoreErr);
                }

                const wb = {}; // team -> {sum: number, count: number}
                // Nueva escala 0–6 por ítem => rangos máximos oficiales
                const MIN_AE = 0, MAX_AE = 54, MIN_D = 0, MAX_D = 30, MIN_RP = 0, MAX_RP = 48;
                const rangeAE = MAX_AE - MIN_AE, rangeD = MAX_D - MIN_D, rangeRP = MAX_RP - MIN_RP;
                (scoreRows || []).forEach(row => {
                  const cycleId = row.mbi_responses?.cycle_id;
                  const teamId = row.mbi_responses?.team_id;
                  if (!teamId || !cycleId) return;
                  // Normalize subscales (AE,D inverted; RP direct)
                  const ae = row.ae_score ?? MIN_AE;
                  const d = row.d_score ?? MIN_D;
                  const rp = row.rp_score ?? MIN_RP;
                  const aeWell = 1 - ((ae - MIN_AE) / (rangeAE || 1));
                  const dWell = 1 - ((d - MIN_D) / (rangeD || 1));
                  const rpWell = (rp - MIN_RP) / (rangeRP || 1);
                  // Equal weights
                  const wellbeing = (aeWell + dWell + rpWell) / 3; // 0..1
                  if (!wb[teamId]) wb[teamId] = { sum: 0, count: 0 };
                  wb[teamId].sum += wellbeing;
                  wb[teamId].count += 1;
                });
                const formatted = {};
                Object.keys(wb).forEach(tid => {
                  formatted[tid] = { avg: Math.round((wb[tid].sum / wb[tid].count) * 100), count: wb[tid].count };
                });
                setWellbeingByTeam(formatted);
              }
            } catch (e) {
              console.warn('Tabla mbi_evaluation_cycles no disponible aún', e);
            }
          }

          // Cargar miembros de cada equipo
          if (teamsData && teamsData.length > 0) {
            setMembersLoading(true);
            const membersObj = {};
            for (const team of teamsData) {
              const { data: team_members, error } = await supabase
                .from("team_members")
                .select("user_id, profiles(first_name, last_name)")
                .eq("team_id", team.id);

              if (error) {
                console.error(`Error cargando miembros para equipo ${team.id}:`, error);
              }
              membersObj[team.id] = team_members || [];
            }
            setTeamMembers(membersObj);
            setMembersLoading(false);
          }
        }

        // Si es usuario, cargar el equipo al que pertenece y sus miembros
  if (profileData.role === "user") {
          // Buscar todas las membresías del usuario
          const { data: memberships, error: membershipsError } = await supabase
            .from("team_members")
            .select("team_id")
            .eq("user_id", currentUser.id);

          if (membershipsError) {
            console.error("Error cargando membresías:", membershipsError);
            setTeams([]);
            setTeamMembers({});
          } else if (memberships && memberships.length > 0) {
            // Obtener todos los equipos a los que pertenece el usuario
            const teamIds = memberships.map((m) => m.team_id);
            const { data: teamsData } = await supabase
              .from("teams")
              .select("*")
              .in("id", teamIds);

            setTeams(teamsData || []);

            // Cargar miembros de cada equipo
            setMembersLoading(true);
            const membersObj = {};
            for (const teamId of teamIds) {
              const { data: team_members, error } = await supabase
                .from("team_members")
                .select("user_id, profiles(first_name, last_name)")
                .eq("team_id", teamId);

              if (error) {
                console.error(`Error cargando miembros para equipo ${teamId}:`, error);
              }
              membersObj[teamId] = team_members || [];
            }
            setTeamMembers(membersObj);
            setMembersLoading(false);

            // Fetch active cycles and which user responded
            try {
              const { data: cycles } = await supabase
                .from('mbi_evaluation_cycles')
                .select('id, team_id, status')
                .in('team_id', teamIds)
                .eq('status', 'active');
              const cycleMap = {};
              (cycles || []).forEach(c => { cycleMap[c.team_id] = c.id; });
              setActiveCycles(cycleMap);
              const cycleIds = Object.values(cycleMap);
              if (cycleIds.length > 0) {
                const { data: respRows } = await supabase
                  .from('mbi_responses')
                  .select('cycle_id, user_id')
                  .in('cycle_id', cycleIds);
                // Map user responded for current user only for respondedCycles
                const respMap = {};
                (respRows || []).filter(r => r.user_id === currentUser.id).forEach(r => { if (r.cycle_id) respMap[r.cycle_id] = true; });
                setRespondedCycles(respMap);
                const teamResponded = {};
                (respRows || []).forEach(r => {
                  const teamId = Object.keys(cycleMap).find(tid => cycleMap[tid] === r.cycle_id);
                  if (teamId) {
                    if (!teamResponded[teamId]) teamResponded[teamId] = new Set();
                    teamResponded[teamId].add(r.user_id);
                  }
                });
                setRespondedMembersByTeam(teamResponded);
              }
            } catch (e) {
              console.warn('Tabla mbi_evaluation_cycles no disponible para miembros', e);
            }
          } else {
            setTeams([]);
            setTeamMembers({});
          }
        }
      }
      setLoading(false);
    };
    init();
  }, [navigate]);

  // Suscripción en tiempo real para actualizar estado de respuestas sin recargar
  useEffect(() => {
    if (!user) return;
    if (!activeCycles || Object.keys(activeCycles).length === 0) return;
    const channel = supabase
      .channel('mbi_responses_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mbi_responses' }, (payload) => {
        const { cycle_id, user_id } = payload.new || {};
        if (!cycle_id || !user_id) return;
        // Encontrar teamId asociado a ese ciclo activo
        const teamId = Object.keys(activeCycles).find(tid => activeCycles[tid] === cycle_id);
        if (!teamId) return; // Puede ser de otro equipo o ciclo no activo
        setRespondedMembersByTeam(prev => {
          const clone = { ...prev };
          const set = new Set(clone[teamId] ? Array.from(clone[teamId]) : []);
          set.add(user_id);
          clone[teamId] = set;
          return clone;
        });
        // Si es este usuario, marcar respondedCycles
        if (user_id === user.id) {
          setRespondedCycles(prev => ({ ...prev, [cycle_id]: true }));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCycles, user]);

  // Mostrar modal de perfil automáticamente si no tiene perfil creado
  useEffect(() => {
    if (!loading && user && !profile) {
      setShowProfileForm(true);
    }
  }, [loading, user, profile]);

  // Cerrar menú de perfil al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileMenu && !event.target.closest('.profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const launchMBI = async (teamId) => {
    setLaunchingTeam(teamId);
    try {
      await supabase
        .from('mbi_evaluation_cycles')
  .update({ status: 'closed', end_at: new Date().toISOString() })
        .eq('team_id', teamId)
        .eq('status', 'active');
      const { data: newCycle, error } = await supabase
        .from('mbi_evaluation_cycles')
        .insert([{ team_id: teamId, status: 'active' }])
        .select('id, team_id')
        .single();
      if (error) throw error;
      setActiveCycles(prev => ({ ...prev, [teamId]: newCycle.id }));
      setRespondedCycles(prev => ({ ...prev }));
  // Reset responded members list for the new active cycle
  setRespondedMembersByTeam(prev => ({ ...prev, [teamId]: new Set() }));
  setWellbeingByTeam(prev => ({ ...prev, [teamId]: { avg: null, count: 0 } }));
      setShowLaunchModal(false);
      setLaunchContext(null);
    } catch (e) {
      alert('Error lanzando MBI: ' + (e.message || ''));
    } finally {
      setLaunchingTeam(null);
    }
  };

  const endCycle = async (teamId) => {
    const cycleId = activeCycles[teamId];
    if (!cycleId) return;
    setEndingTeam(teamId);
    try {
      const { error } = await supabase
        .from('mbi_evaluation_cycles')
  .update({ status: 'closed', end_at: new Date().toISOString() })
        .eq('id', cycleId)
        .eq('status', 'active');
      if (error) throw error;
      setActiveCycles(prev => {
        const clone = { ...prev };
        delete clone[teamId];
        return clone;
      });
    } catch (e) {
      alert('Error terminando ciclo: ' + (e.message || ''));
    } finally {
      setEndingTeam(null);
    }
  };

  const prepareLaunch = async (team) => {
    const teamId = team.id;
    const members = teamMembers[teamId] || [];
    const activeCycleId = activeCycles[teamId];
    let pendingMembers = [];
    if (activeCycleId) {
      try {
        const { data: responded } = await supabase
          .from('mbi_responses')
          .select('user_id')
          .eq('cycle_id', activeCycleId);
        const respondedSet = new Set((responded || []).map(r => r.user_id));
        pendingMembers = members.filter(m => !respondedSet.has(m.user_id));
      } catch (e) {
        console.warn('No se pudieron cargar respuestas del ciclo', e);
      }
    } else {
      // Si no hay ciclo activo, todos son potenciales participantes
      pendingMembers = members.slice();
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

  const handleTeamCreated = async (newTeam, inviteCode) => {
    // Refrescar la lista de equipos
    try {
      const { data: leaderTeams } = await supabase
        .from("teams")
        .select("*, team_invite_codes(code)")
        .eq("leader_id", user.id)
        .order("created_at", { ascending: false });
      
      setTeams(leaderTeams || []);
      
      // Cerrar el modal después de un breve delay para mostrar el éxito
      setTimeout(() => {
        setShowCreateTeamModal(false);
      }, 2000);
    } catch (error) {
      console.error("Error refrescando equipos:", error);
    }
  };

  const handleEditTeam = (team) => {
    setEditingTeam(team);
    setShowEditTeamModal(true);
  };

  const handleTeamUpdated = async (updatedTeam) => {
    // Actualizar el equipo en el estado local
    setTeams(prevTeams => 
      prevTeams.map(team => 
        team.id === updatedTeam.id ? { ...team, ...updatedTeam } : team
      )
    );
    setShowEditTeamModal(false);
    setEditingTeam(null);
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este equipo? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      // Eliminar el equipo (Supabase debería manejar las referencias en cascada)
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", teamId)
        .eq("leader_id", user.id); // Seguridad extra

      if (error) {
        throw error;
      }

      // Actualizar la lista de equipos
      setTeams(prevTeams => prevTeams.filter(team => team.id !== teamId));
      
      // Limpiar datos relacionados
      setTeamMembers(prev => {
        const newMembers = { ...prev };
        delete newMembers[teamId];
        return newMembers;
      });

      setActiveCycles(prev => {
        const newCycles = { ...prev };
        delete newCycles[teamId];
        return newCycles;
      });

      setRespondedMembersByTeam(prev => {
        const newResponded = { ...prev };
        delete newResponded[teamId];
        return newResponded;
      });

      setWellbeingByTeam(prev => {
        const newWellbeing = { ...prev };
        delete newWellbeing[teamId];
        return newWellbeing;
      });

    } catch (error) {
      console.error("Error eliminando equipo:", error);
      alert("Error al eliminar el equipo. Por favor, inténtalo de nuevo.");
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setProfileMsg("");

    try {
      // Verifica si el perfil existe
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      let error;
      const profileData = {
        first_name: firstName,
        last_name: lastName,
        role: role,
      };

      if (existingProfile) {
        // Si existe, actualiza
        ({ error } = await supabase
          .from("profiles")
          .update(profileData)
          .eq("id", user.id));
      } else {
        // Si no existe, inserta
        ({ error } = await supabase
          .from("profiles")
          .insert([{
            id: user.id,
            ...profileData
          }]));
      }

      if (error) {
        throw error;
      }

      // Actualizar estado local
      const newProfile = { 
        id: user.id, 
        ...profileData,
        created_at: existingProfile?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setProfile(newProfile);
      setProfileMsg(existingProfile ? "Perfil actualizado correctamente." : "¡Perfil creado exitosamente! Bienvenido a TeamZen.");
      
      // Cerrar modal después de un momento para mostrar el mensaje
      setTimeout(() => {
        setShowProfileForm(false);
        setProfileMsg("");
        
        // Si es un usuario nuevo, recargar la página para aplicar los cambios
        if (!existingProfile) {
          window.location.reload();
        }
      }, 2000);

    } catch (error) {
      console.error("Error updating profile:", error);
      setProfileMsg(`Error: ${error.message || 'No se pudo guardar el perfil'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <LoadingSpinner size="large" message="Cargando tu dashboard..." />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img 
                src={`${import.meta.env.BASE_URL}/img/pandalogo.png`} 
                alt="TeamZen Logo" 
                className="w-8 h-8"
              />
              <span className="text-xl font-bold text-gray-900">TeamZen</span>
            </div>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <button 
                className="text-blue-600 hover:text-blue-700 font-medium"
                onClick={() => navigate('/dashboard')}
              >
                Equipos
              </button>
              <button 
                className="text-gray-500 hover:text-gray-700 font-medium"
                onClick={() => navigate('/evaluaciones')}
              >
                Evaluaciones
              </button>
              <button 
                className="text-gray-500 hover:text-gray-700 font-medium"
                onClick={() => navigate('/reportes')}
              >Reportes</button>
              <button className="text-gray-500 hover:text-gray-700 font-medium">Configuración</button>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm text-gray-500">Bienvenido,</p>
                <p className="font-medium text-gray-900">
                  {profile?.first_name && profile?.last_name 
                    ? `${profile.first_name} ${profile.last_name}`
                    : user?.email
                  }
                </p>
              </div>
              <div className="relative profile-menu-container">
                <button 
                  className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium hover:bg-blue-700 transition-colors"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                >
                  {profile?.first_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                </button>
                
                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {profile?.first_name && profile?.last_name 
                          ? `${profile.first_name} ${profile.last_name}`
                          : 'Usuario'
                        }
                      </p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                      {profile?.role && (
                        <span className="inline-block mt-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                          {profile.role === "leader" ? "Líder de Equipo" : "Miembro de Equipo"}
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => {
                        setShowProfileForm(true);
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Editar perfil</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section & Profile Setup */}
        {(!profile?.first_name || !profile?.last_name) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-amber-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-amber-800">Completa tu perfil</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Para aprovechar al máximo TeamZen, completa tu información personal haciendo clic en tu avatar en la esquina superior derecha.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {profile?.role === "leader" ? "Panel de Líder" : "Mis Equipos"}
              </h1>
              <p className="text-gray-600 mt-1">
                {profile?.role === "leader" 
                  ? "Gestiona tus equipos y monitorea el bienestar de los miembros"
                  : "Visualiza los equipos de los que formas parte"
                }
              </p>
            </div>
            
            {/* Action Button */}
            {profile?.role === "leader" ? (
              <button
                onClick={() => setShowCreateTeamModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Crear Equipo</span>
              </button>
            ) : profile?.role === "user" ? (
              <button
                onClick={() => navigate("/unirse-equipo")}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Unirse a Equipo</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Teams Section */}
        <div className="space-y-6">
          {profile?.role === "leader" ? (
            <LeaderTeamsSection 
              teams={teams} 
              teamsLoading={teamsLoading}
              teamMembers={teamMembers}
              membersLoading={membersLoading}
              navigate={navigate}
              activeCycles={activeCycles}
              onPrepareLaunch={prepareLaunch}
              launchingTeam={launchingTeam}
              endingTeam={endingTeam}
              onEndCycle={endCycle}
              respondedMembersByTeam={respondedMembersByTeam}
              wellbeingByTeam={wellbeingByTeam}
              onCreateTeam={() => setShowCreateTeamModal(true)}
              onEditTeam={handleEditTeam}
              onDeleteTeam={handleDeleteTeam}
            />
          ) : profile?.role === "user" ? (
            <UserTeamsSection 
              teams={teams} 
              teamMembers={teamMembers}
              membersLoading={membersLoading}
              navigate={navigate}
              userId={user?.id}
              activeCycles={activeCycles}
              respondedCycles={respondedCycles}
              respondedMembersByTeam={respondedMembersByTeam}
            />
          ) : (
            <WelcomeSection onSetupProfile={() => setShowProfileForm(true)} />
          )}
        </div>

        {/* Profile Form Modal */}
        {showProfileForm && (
          <ProfileFormModal 
            profile={profile}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            role={role}
            setRole={setRole}
            saving={saving}
            profileMsg={profileMsg}
            onSubmit={handleProfileUpdate}
            onCancel={() => setShowProfileForm(false)}
          />
        )}
        <LaunchMBIModal
          open={showLaunchModal}
          context={launchContext}
          launching={!!launchingTeam}
          onClose={() => { setShowLaunchModal(false); setLaunchContext(null); }}
          onConfirm={launchMBI}
        />
        
        <CreateTeamModal
          isOpen={showCreateTeamModal}
          onClose={() => setShowCreateTeamModal(false)}
          onTeamCreated={handleTeamCreated}
        />

        <EditTeamModal
          isOpen={showEditTeamModal}
          onClose={() => {
            setShowEditTeamModal(false);
            setEditingTeam(null);
          }}
          team={editingTeam}
          onTeamUpdated={handleTeamUpdated}
        />
      </div>
    </div>
  );
}

// Sección de equipos para líderes
function LeaderTeamsSection({ teams, teamsLoading, teamMembers, membersLoading, navigate, activeCycles, onPrepareLaunch, launchingTeam, endingTeam, onEndCycle, respondedMembersByTeam, wellbeingByTeam = {}, onCreateTeam, onEditTeam, onDeleteTeam }) {
  if (teamsLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <LoadingSpinner message="Cargando tus equipos..." />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No tienes equipos creados</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Crea tu primer equipo para comenzar a gestionar el bienestar de tu grupo de trabajo.
        </p>
        <button
          onClick={onCreateTeam}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Crear mi primer equipo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap -m-3">
      {teams.map((team) => (
        <div key={team.id} className="w-full lg:w-1/2 p-3">
          <LeaderTeamCard 
            team={team} 
            members={teamMembers[team.id] || []}
            membersLoading={membersLoading}
            activeCycleId={activeCycles[team.id]}
            onLaunch={() => onPrepareLaunch(team)}
            launching={launchingTeam === team.id}
            ending={endingTeam === team.id}
            onEndCycle={() => onEndCycle(team.id)}
            respondedMembers={respondedMembersByTeam[team.id]}
            wellbeingMetric={wellbeingByTeam[team.id]}
            onEdit={onEditTeam}
            onDelete={onDeleteTeam}
          />
        </div>
      ))}
    </div>
  );
}

// Sección de equipos para usuarios
function UserTeamsSection({ teams, teamMembers, membersLoading, navigate, userId, activeCycles, respondedCycles, respondedMembersByTeam }) {
  if (teams.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No perteneces a ningún equipo</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Únete a un equipo usando un código de invitación para comenzar a participar en evaluaciones de bienestar.
        </p>
        <button
          onClick={() => navigate("/unirse-equipo")}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Unirse a un equipo
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {teams.map((team) => (
        <UserTeamCard 
          key={team.id} 
          team={team} 
          members={teamMembers[team.id] || []}
          membersLoading={membersLoading}
          currentUserId={userId}
          activeCycleId={activeCycles[team.id]}
          respondedCycles={respondedCycles}
          respondedMembers={respondedMembersByTeam[team.id]}
        />
      ))}
    </div>
  );
}

// Sección de bienvenida para usuarios sin rol
function WelcomeSection({ onSetupProfile }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <img 
          src={`${import.meta.env.BASE_URL}/img/pandalogo.png`} 
          alt="TeamZen Logo" 
          className="w-12 h-12"
        />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">¡Bienvenido a TeamZen!</h2>
      <p className="text-gray-600 mb-8 max-w-lg mx-auto">
        TeamZen te ayuda a medir y reducir el burnout en equipos de trabajo. 
        Para comenzar, configura tu perfil y selecciona tu rol.
      </p>
      <button
        onClick={onSetupProfile}
        className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Configurar mi perfil
      </button>
    </div>
  );
}

// Componente para el formulario de perfil
function ProfileForm({ profile, firstName, setFirstName, lastName, setLastName, role, setRole, saving, profileMsg, onSubmit, onCancel }) {
  const handleSubmit = (e) => {
    console.log("ProfileForm handleSubmit called"); // Debug
    onSubmit(e);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-[#2E2E3A]">
            {!profile?.first_name && !profile?.last_name ? "Completar Perfil" : "Actualizar Perfil"}
          </h3>
          <button onClick={onCancel} className="text-[#5B5B6B] hover:text-[#2E2E3A]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            placeholder="Tu nombre"
          />
          
          <Input
            label="Apellido"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            placeholder="Tu apellido"
          />

          {(!profile?.first_name && !profile?.last_name) && (
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#2E2E3A] text-sm">
                Rol <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                className="w-full border border-[#DAD5E4] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#55C2A2] focus:border-transparent"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="">Selecciona tu rol</option>
                <option value="user">Miembro de Equipo</option>
                <option value="leader">Líder de Equipo</option>
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
            <button
              type="submit"
              disabled={saving}
              className={`
                bg-[#55C2A2] hover:bg-[#9D83C6] text-[#2E2E3A] px-6 py-3 text-base
                rounded-full font-semibold transition-all duration-300 
                flex items-center justify-center gap-2 flex-1
                ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:transform hover:scale-105'}
              `}
            >
              {saving && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              )}
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>

          {profileMsg && (
            <Alert type={profileMsg.includes("Error") ? "error" : "success"}>
              {profileMsg}
            </Alert>
          )}
        </form>
      </Card>
    </div>
  );
}

// Componente para el formulario de perfil en modal
function ProfileFormModal({ 
  profile, 
  firstName, 
  setFirstName, 
  lastName, 
  setLastName, 
  role, 
  setRole, 
  saving, 
  profileMsg, 
  onSubmit, 
  onCancel 
}) {
  const isNewUser = !profile; // Usuario nuevo si no tiene perfil
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">
            {isNewUser ? "¡Bienvenido a TeamZen!" : "Actualizar perfil"}
          </h3>
          {!isNewUser && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
              disabled={saving}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {isNewUser && (
          <p className="text-gray-600 mb-4 text-sm">
            Para comenzar a usar TeamZen, necesitamos algunos datos básicos sobre ti.
          </p>
        )}
        
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apellido
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol en TeamZen *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={!isNewUser && profile?.role} // Solo editable para usuarios nuevos o si no tiene rol
            >
              <option value="">Selecciona tu rol</option>
              <option value="leader">Líder de equipo - Puedo crear y gestionar equipos</option>
              <option value="user">Miembro de equipo - Me uno a equipos existentes</option>
            </select>
            {!isNewUser && profile?.role && (
              <p className="text-xs text-gray-500 mt-1">
                El rol no se puede cambiar una vez establecido. Contacta al administrador si necesitas cambiarlo.
              </p>
            )}
          </div>

          {profileMsg && (
            <div className={`rounded-lg p-3 ${
              profileMsg.includes('Error') ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
            }`}>
              <p className={`text-sm ${
                profileMsg.includes('Error') ? 'text-red-700' : 'text-green-700'
              }`}>{profileMsg}</p>
            </div>
          )}
          
          <div className={`flex ${isNewUser ? 'justify-center' : 'space-x-3'} pt-4`}>
            {!isNewUser && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50"
                disabled={saving}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className={`${isNewUser ? 'w-full' : 'flex-1'} bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50`}
              disabled={saving}
            >
              {saving ? "Guardando..." : isNewUser ? "Crear mi perfil" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Tarjeta de equipo para líderes
function LeaderTeamCard({ team, members, membersLoading, activeCycleId, onLaunch, launching, ending, onEndCycle, respondedMembers, wellbeingMetric, onEdit, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  // Cálculo de participación (incluye al líder como participante potencial)
  const totalBase = members?.length || 0;
  const leaderCounts = team.include_leader_in_metrics !== false; // default true if undefined
  const totalParticipantes = leaderCounts ? totalBase + 1 : totalBase; // +1 leader
  let respondedCountRaw = respondedMembers ? respondedMembers.size : 0;
  if (!leaderCounts && respondedMembers && team.leader_id) {
    // Exclude leader id if present
    respondedCountRaw = respondedCountRaw - (respondedMembers.has(team.leader_id) ? 1 : 0);
  }
  const respondedCount = Math.min(Math.max(respondedCountRaw, 0), totalParticipantes);
  const participationPct = activeCycleId ? Math.round((respondedCount / (totalParticipantes || 1)) * 100) : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header del equipo */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {team.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
              <p className="text-sm text-gray-500">
                Creado el {new Date(team.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              Líder
            </span>
            {team.include_leader_in_metrics === false && (
              <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2.5 py-0.5 rounded-full" title="El líder no se contabiliza en métricas">
                Líder excluido
              </span>
            )}
            <TeamOptionsMenu 
              team={team}
              onEdit={() => onEdit && onEdit(team)}
              onDelete={() => onDelete && onDelete(team.id)}
            />
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg 
                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div>
                <p className="text-sm text-gray-600">Miembros</p>
                <p className="text-lg font-semibold text-gray-900">{members?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                <p className="text-lg font-semibold text-green-600">Activo</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13a4 4 0 014-4h10a4 4 0 110 8H7a4 4 0 01-4-4z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Participación</p>
                {activeCycleId ? (
                  <p className="text-lg font-semibold text-gray-900">{participationPct}%</p>
                ) : (
                  <p className="text-lg font-semibold text-gray-400">-</p>
                )}
              </div>
            </div>
            {activeCycleId && (
              <div className="mt-2">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${participationPct}%`,
                      backgroundColor: participationPct >= 80 ? '#16a34a' : participationPct >= 50 ? '#f59e0b' : '#dc2626'
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-500 font-medium">{respondedCount} / {totalParticipantes}</p>
              </div>
            )}
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .843-3 1.882v4.236C9 15.157 10.343 16 12 16s3-.843 3-1.882V9.882C15 8.843 13.657 8 12 8z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Bienestar</p>
                {activeCycleId ? (
                  <p className="text-lg font-semibold text-gray-900">
                    {wellbeingMetric && wellbeingMetric.avg != null ? `${wellbeingMetric.avg}` : '—'}
                    <span className="text-xs text-gray-500 ml-1">/100</span>
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-gray-400">-</p>
                )}
              </div>
            </div>
            {activeCycleId && wellbeingMetric && wellbeingMetric.avg != null && (
              <div className="mt-2">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${wellbeingMetric.avg}%`,
                      backgroundColor: wellbeingMetric.avg >= 70 ? '#16a34a' : wellbeingMetric.avg >= 40 ? '#f59e0b' : '#dc2626'
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-500 font-medium">{wellbeingMetric.count} resp.</p>
              </div>
            )}
          </div>
        </div>

        {/* Código de invitación */}
        <div className="bg-blue-50 p-3 rounded-lg mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-blue-700 font-medium flex items-center gap-2">
                Código de invitación
                <button
                  onClick={() => setShowInvite(v => !v)}
                  className="text-xs px-2 py-0.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-100"
                >{showInvite ? 'Ocultar' : 'Mostrar'}</button>
              </p>
              <p className="text-lg font-mono font-bold text-blue-900 select-all break-all">
                {team.team_invite_codes?.length > 0 ? (
                  showInvite ? team.team_invite_codes[0].code : '••••••••'
                ) : 'Sin código'}
              </p>
              {copied && <span className="text-[10px] text-green-700 font-medium">Copiado</span>}
            </div>
            <button
              onClick={async () => {
                if (team.team_invite_codes?.length > 0) {
                  try { await navigator.clipboard.writeText(team.team_invite_codes[0].code); setCopied(true); setTimeout(()=>setCopied(false), 2000);} catch(e){}
                }
              }}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Copiar
            </button>
          </div>
        </div>

        {/* Miembros expandidos */}
        {isExpanded && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Miembros del equipo</h4>
            {membersLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="small" />
              </div>
            ) : members?.length > 0 ? (
              <div className="space-y-2">
                {members.map((member) => {
                  const hasResponded = !!(respondedMembers && respondedMembers.has(member.user_id));
                  return (
                    <div key={member.user_id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {member.profiles?.first_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {member.profiles?.first_name && member.profiles?.last_name
                            ? `${member.profiles.first_name} ${member.profiles.last_name}`
                            : 'Usuario sin nombre'
                          }
                        </p>
                        <p className="text-xs text-gray-500">Miembro del equipo</p>
                      </div>
                      {activeCycleId ? (
                        hasResponded ? (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">Respondió</span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">Pendiente</span>
                        )
                      ) : (
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">Sin ciclo</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Sin miembros aún</p>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex space-x-2 pt-4 border-t">
          {activeCycleId ? (
            <button
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              onClick={onEndCycle}
              disabled={ending}
            >
              {ending ? 'Terminando...' : 'Terminar ciclo'}
            </button>
          ) : (
            <button 
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              onClick={onLaunch}
              disabled={launching}
            >
              {launching ? 'Lanzando...' : 'Lanzar MBI'}
            </button>
          )}
          {activeCycleId && (
            participationPct === 100 ? (
              <div className="flex-1 hidden sm:flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                Todos respondieron
              </div>
            ) : (
              <div className="flex-1 hidden sm:flex items-center justify-center px-4 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-medium border border-green-200">
                Ciclo activo
              </div>
            )
          )}
          <button 
            className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            onClick={() => navigate(`/reportes?team=${team.id}`)}
          >
            Generar Reporte
          </button>
        </div>
      </div>
    </div>
  );
}

// Tarjeta de equipo para usuarios
function UserTeamCard({ team, members, membersLoading, currentUserId, activeCycleId, respondedCycles, respondedMembers }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const currentMember = members?.find(m => m.user_id === currentUserId);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header del equipo */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {team.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
              <p className="text-sm text-gray-500">
                Miembro desde que te uniste al equipo
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              Miembro
            </span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg 
                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Información del equipo */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div>
                <p className="text-sm text-gray-600">Miembros</p>
                <p className="text-lg font-semibold text-gray-900">{members?.length || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <div>
                <p className="text-sm text-gray-600">Evaluaciones</p>
                <p className="text-lg font-semibold text-gray-900">0</p>
              </div>
            </div>
          </div>
        </div>

        {/* Próxima evaluación */}
        <div className="bg-yellow-50 p-3 rounded-lg mb-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-yellow-700 font-medium">Próxima evaluación</p>
              <p className="text-sm text-yellow-600">Pendiente de programar</p>
            </div>
          </div>
        </div>

        {/* Miembros expandidos */}
        {isExpanded && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Compañeros de equipo</h4>
            {membersLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="small" />
              </div>
            ) : members?.length > 0 ? (
              <div className="space-y-2">
                {members.filter(m => m.user_id !== currentUserId).map((member) => {
                  const hasResponded = !!(respondedMembers && respondedMembers.has(member.user_id));
                  return (
                    <div key={member.user_id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {member.profiles?.first_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {member.profiles?.first_name && member.profiles?.last_name
                            ? `${member.profiles.first_name} ${member.profiles.last_name}`
                            : 'Usuario sin nombre'
                          }
                        </p>
                        <p className="text-xs text-gray-500">Miembro del equipo</p>
                      </div>
                      {activeCycleId ? (
                        hasResponded ? (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">Respondió</span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">Pendiente</span>
                        )
                      ) : (
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">Sin ciclo</span>
                      )}
                    </div>
                  );
                })}
                {members.filter(m => m.user_id !== currentUserId).length === 0 && (
                  <p className="text-sm text-gray-500 italic">Eres el único miembro del equipo</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Sin otros miembros</p>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex space-x-2 pt-4 border-t">
          {!activeCycleId ? (
            <div className="flex-1 flex items-center justify-center px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium border border-gray-200">Sin ciclo activo</div>
          ) : respondedCycles[activeCycleId] ? (
            <div className="flex-1 flex items-center justify-center px-4 py-2 rounded-lg bg-green-50 text-green-600 text-sm font-medium border border-green-200">Respondido</div>
          ) : (
            <button 
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              onClick={() => navigate(`/mbi?team=${team.id}`)}
            >
              Completar MBI
            </button>
          )}
          <button className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            Ver Historial
          </button>
        </div>
      </div>
    </div>
  );
}
