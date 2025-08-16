// ===================================================================
// DASHBOARD PRINCIPAL - CENTRO DE CONTROL DE TEAMZEN
// ===================================================================
// Este componente maneja:
// - Autenticación y perfiles de usuario
// - Gestión de equipos (crear, editar, eliminar)
// - Lanzamiento y gestión de ciclos MBI
// - Dashboard diferenciado por rol (líder vs miembro)
// - Métricas y estado en tiempo real
// ===================================================================

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import LoadingSpinner from "../components/LoadingSpinner";
import { Card, Button, Alert, Badge, Input } from "../components/UIComponents";
import LaunchMBIModal from "../components/LaunchMBIModal";
import CreateTeamModal from "../components/CreateTeamModal";
import TeamOptionsMenu from "../components/TeamOptionsMenu";
import EditTeamModal from "../components/EditTeamModal";

export default function Dashboard() {
  // ===================================================================
  // ESTADO - NAVEGACIÓN Y USUARIO
  // ===================================================================
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // ===================================================================
  // ESTADO - PERFIL DE USUARIO
  // ===================================================================
  const [profile, setProfile] = useState(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  
  // ===================================================================
  // ESTADO - EQUIPOS Y MIEMBROS
  // ===================================================================
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState({}); // { team_id: [members] }
  const [membersLoading, setMembersLoading] = useState(false);
  
  // ===================================================================
  // ESTADO - CICLOS MBI Y RESPUESTAS
  // ===================================================================
  const [activeCycles, setActiveCycles] = useState({}); // { team_id: cycle_id }
  const [respondedCycles, setRespondedCycles] = useState({}); // { cycle_id: true }
  const [respondedMembersByTeam, setRespondedMembersByTeam] = useState({}); // { team_id: Set(user_ids) }
  const [wellbeingByTeam, setWellbeingByTeam] = useState({}); // { team_id: { avg: number, count: number } }
  
  // ===================================================================
  // ESTADO - OPERACIONES DE EQUIPOS
  // ===================================================================
  const [launchingTeam, setLaunchingTeam] = useState(null);
  const [endingTeam, setEndingTeam] = useState(null);
  
  // ===================================================================
  // ESTADO - MODALES
  // ===================================================================
  // ===================================================================
  // ESTADO - MODALES
  // ===================================================================
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchContext, setLaunchContext] = useState(null); // {teamId, teamName, activeCycleId, pendingMembers:[], totalMembers}
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  // ===================================================================
  // EFECTO PRINCIPAL - INICIALIZACIÓN Y CARGA DE DATOS
  // ===================================================================

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
        setBirthDate(profileData.birth_date || "");
        setEmploymentType(profileData.employment_type || "");
        setJobTitle(profileData.job_title || "");
        setStartDate(profileData.start_date || "");
        setJobDescription(profileData.job_description || "");

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
              // Obtener el equipo para saber si incluir al líder
              const currentTeam = teamsData.find(t => t.id === teamId);
              
              const { data: team_members, error } = await supabase
                .from("team_members")
                .select("user_id, profiles(first_name, last_name)")
                .eq("team_id", teamId);

              if (error) {
                console.error(`Error cargando miembros para equipo ${teamId}:`, error);
                membersObj[teamId] = [];
                continue;
              }
              
              let finalMembers = team_members || [];
              
              // Si el equipo incluye al líder en métricas, agregar al líder a la lista
              if (currentTeam && currentTeam.include_leader_in_metrics && currentTeam.leader_id) {
                // Verificar si el líder ya está en la lista de miembros
                const leaderAlreadyInMembers = finalMembers.some(m => m.user_id === currentTeam.leader_id);
                
                if (!leaderAlreadyInMembers) {
                  // Obtener información del líder
                  const { data: leaderProfile } = await supabase
                    .from("profiles")
                    .select("id, first_name, last_name")
                    .eq("id", currentTeam.leader_id)
                    .single();
                  
                  if (leaderProfile) {
                    // Agregar al líder con formato consistente
                    finalMembers.push({
                      user_id: leaderProfile.id,
                      profiles: {
                        first_name: leaderProfile.first_name,
                        last_name: leaderProfile.last_name
                      },
                      is_leader: true // Marcador especial para identificar al líder
                    });
                  }
                }
              }
              
              membersObj[teamId] = finalMembers;
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

  // ===================================================================
  // HANDLERS - AUTENTICACIÓN Y NAVEGACIÓN
  // ===================================================================
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ===================================================================
  // HANDLERS - GESTIÓN DE CICLOS MBI
  // ===================================================================
  
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

  // ===================================================================
  // HANDLERS - GESTIÓN DE EQUIPOS (CREAR, EDITAR, ELIMINAR)
  // ===================================================================
  
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

  // ===================================================================
  // HANDLERS - GESTIÓN DE PERFIL DE USUARIO
  // ===================================================================
  
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
        birth_date: birthDate || null,
        employment_type: employmentType || null,
        job_title: jobTitle || null,
        start_date: startDate || null,
        job_description: jobDescription || null,
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

  // ===================================================================
  // RENDERIZADO PRINCIPAL
  // ===================================================================
  
  // Pantalla de carga inicial
  if (loading) return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
      <LoadingSpinner size="large" message="Cargando tu dashboard..." />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header Navigation */}
      <nav className="bg-white border-b border-[#DAD5E4] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <img 
                src={`${import.meta.env.BASE_URL}/img/pandazen_favicon.png`} 
                alt="TeamZen Logo" 
                className="w-8 h-8 sm:w-10 sm:h-10"
              />
              <span className="text-lg sm:text-xl font-bold text-[#2E2E3A]">TeamZen</span>
            </div>
            
            {/* Navigation Links - Hidden on mobile, shown on desktop */}
            <div className="hidden lg:flex items-center space-x-6">
              <button 
                className="text-[#55C2A2] hover:text-[#4AB393] font-medium transition-colors duration-200 px-3 py-2 rounded-lg"
                onClick={() => navigate('/dashboard')}
              >
                Equipos
              </button>
              <button 
                className="text-[#5B5B6B] hover:text-[#2E2E3A] font-medium transition-colors duration-200 px-3 py-2 rounded-lg"
                onClick={() => navigate('/evaluaciones')}
              >
                Evaluaciones
              </button>
              <button 
                className="text-[#5B5B6B] hover:text-[#2E2E3A] font-medium transition-colors duration-200 px-3 py-2 rounded-lg"
                onClick={() => navigate('/reportes')}
              >
                Reportes
              </button>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="text-right hidden md:block">
                <p className="text-xs sm:text-sm text-[#55C2A2]">Bienvenido,</p>
                <p className="font-medium text-sm sm:text-base text-[#2E2E3A] truncate max-w-32">
                  {profile?.first_name && profile?.last_name 
                    ? `${profile.first_name} ${profile.last_name}`
                    : user?.email?.split('@')[0] || user?.email
                  }
                </p>
              </div>
              <div className="relative profile-menu-container">
                <button 
                  className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] rounded-full 
                             flex items-center justify-center text-white font-medium hover:from-[#4AB393] hover:to-[#6ED4B8] 
                             transition-all duration-300 shadow-lg hover:shadow-teamzen-glow text-sm sm:text-base"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                >
                  {profile?.first_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                </button>
                
                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 sm:w-48 bg-white rounded-xl shadow-teamzen-strong 
                                  border border-[#DAD5E4] py-1 z-50 animate-modal-enter">
                    <div className="px-4 py-3 border-b border-[#DAD5E4]">
                      <p className="text-sm font-medium text-[#2E2E3A] truncate">
                        {profile?.first_name && profile?.last_name 
                          ? `${profile.first_name} ${profile.last_name}`
                          : 'Usuario'
                        }
                      </p>
                      <p className="text-xs text-[#55C2A2] truncate">{user?.email}</p>
                      {profile?.role && (
                        <span className="inline-block mt-2 bg-gradient-to-r from-[#55C2A2]/20 to-[#9D83C6]/20 
                                         text-[#2E2E3A] text-xs font-medium px-2 py-1 rounded-full 
                                         border border-[#55C2A2]/30">
                          {profile.role === "leader" ? "Líder" : "Miembro"}
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => {
                        setShowProfileForm(true);
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-[#2E2E3A] hover:bg-[#FAF9F6] flex items-center space-x-2"
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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8"
           id="teams-section">
        {/* Welcome Section & Profile Setup */}
        {(!profile?.first_name || !profile?.last_name) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mb-6 sm:mb-8">
            <div className="flex items-start sm:items-center">
              <svg className="w-5 h-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5 sm:mt-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-amber-800">Completa tu perfil</h3>
                <p className="text-xs sm:text-sm text-amber-700 mt-1">
                  Para aprovechar al máximo TeamZen, completa tu información personal haciendo clic en tu avatar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#2E2E3A]">
                {profile?.role === "leader" ? "Panel de Líder" : "Mis Equipos"}
              </h1>
              <p className="text-sm sm:text-base text-[#5B5B6B] mt-1">
                {profile?.role === "leader" 
                  ? "Gestiona tus equipos y monitorea el bienestar"
                  : "Visualiza los equipos de los que formas parte"
                }
              </p>
            </div>
            
            {/* Action Button */}
            {profile?.role === "leader" ? (
              <button
                onClick={() => setShowCreateTeamModal(true)}
                className="bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] 
                           text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-all duration-300 
                           ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow flex items-center 
                           space-x-1.5 sm:space-x-2 text-sm sm:text-base w-full sm:w-auto justify-center"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Crear Equipo</span>
              </button>
            ) : profile?.role === "user" ? (
              <button
                onClick={() => navigate("/unirse-equipo")}
                className="bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] 
                           text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-all duration-300 
                           ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow flex items-center 
                           space-x-1.5 sm:space-x-2 text-sm sm:text-base w-full sm:w-auto justify-center"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              profile={profile}
              currentUserId={user?.id}
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
            birthDate={birthDate}
            setBirthDate={setBirthDate}
            employmentType={employmentType}
            setEmploymentType={setEmploymentType}
            jobTitle={jobTitle}
            setJobTitle={setJobTitle}
            startDate={startDate}
            setStartDate={setStartDate}
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
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

        {/* Navegación móvil inferior */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#DAD5E4] z-40">
          <div className="flex justify-around py-3">
            {/* Dashboard */}
            <button
              onClick={() => window.location.reload()}
              className="flex flex-col items-center space-y-1 px-3 py-1"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#55C2A2]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#55C2A2]">Dashboard</span>
            </button>

            {/* Evaluaciones */}
            <button
              onClick={() => navigate('/evaluaciones')}
              className="flex flex-col items-center space-y-1 px-3 py-1"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#2E2E3A]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#2E2E3A]">Evaluaciones</span>
            </button>

            {/* Reportes */}
            <button
              onClick={() => navigate('/reportes')}
              className="flex flex-col items-center space-y-1 px-3 py-1"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#2E2E3A]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#2E2E3A]">Reportes</span>
            </button>

            {/* Equipos */}
            <button
              onClick={() => {
                const teamsSection = document.getElementById('teams-section');
                if (teamsSection) {
                  teamsSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="flex flex-col items-center space-y-1 px-3 py-1"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#2E2E3A]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#2E2E3A]">Equipos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// COMPONENTES DE SECCIÓN - VISTAS ESPECIALIZADAS POR ROL
// ===================================================================

// Sección de equipos para líderes - Gestión completa de equipos
function LeaderTeamsSection({ teams, teamsLoading, teamMembers, membersLoading, navigate, activeCycles, onPrepareLaunch, launchingTeam, endingTeam, onEndCycle, respondedMembersByTeam, wellbeingByTeam = {}, onCreateTeam, onEditTeam, onDeleteTeam, profile, currentUserId }) {
  if (teamsLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <LoadingSpinner message="Cargando tus equipos..." />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen p-12 text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-[#55C2A2]/20 to-[#9D83C6]/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-[#2E2E3A] mb-2">No tienes equipos creados</h3>
        <p className="text-[#5B5B6B] mb-6 max-w-md mx-auto">
          Crea tu primer equipo para comenzar a gestionar el bienestar de tu grupo de trabajo.
        </p>
        <button
          onClick={onCreateTeam}
          className="bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow"
        >
          Crear mi primer equipo
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {teams.map((team) => (
        <div key={team.id} className="w-full">
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
            profile={profile}
            currentUserId={currentUserId}
          />
        </div>
      ))}
    </div>
  );
}

// Sección de equipos para usuarios miembros - Vista de participación
function UserTeamsSection({ teams, teamMembers, membersLoading, navigate, userId, activeCycles, respondedCycles, respondedMembersByTeam }) {
  if (teams.length === 0) {
    return (
      <div className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen p-12 text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-[#55C2A2]/20 to-[#9D83C6]/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-[#2E2E3A] mb-2">No perteneces a ningún equipo</h3>
        <p className="text-[#5B5B6B] mb-6 max-w-md mx-auto">
          Únete a un equipo usando un código de invitación para comenzar a participar en evaluaciones de bienestar.
        </p>
        <button
          onClick={() => navigate("/unirse-equipo")}
          className="bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow"
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
    <div className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen p-12 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-[#55C2A2] to-[#9D83C6] rounded-full flex items-center justify-center mx-auto mb-6 shadow-teamzen-glow animate-pulse-glow">
        <img 
          src={`${import.meta.env.BASE_URL}/img/pandalogo.png`} 
          alt="TeamZen Logo" 
          className="w-12 h-12"
        />
      </div>
      <h2 className="text-2xl font-bold text-[#2E2E3A] mb-3">¡Bienvenido a TeamZen!</h2>
      <p className="text-[#5B5B6B] mb-8 max-w-lg mx-auto">
        TeamZen te ayuda a medir y reducir el burnout en equipos de trabajo. 
        Para comenzar, configura tu perfil y selecciona tu rol.
      </p>
      <button
        onClick={onSetupProfile}
        className="bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] text-white px-8 py-3 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow flex items-center gap-2 mx-auto"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
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
  birthDate,
  setBirthDate,
  employmentType,
  setEmploymentType,
  jobTitle,
  setJobTitle,
  startDate,
  setStartDate,
  jobDescription,
  setJobDescription,
  saving, 
  profileMsg, 
  onSubmit, 
  onCancel 
}) {
  const isNewUser = !profile; // Usuario nuevo si no tiene perfil
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Gestionar animaciones de apertura
  useEffect(() => {
    setIsVisible(true);
    setTimeout(() => setIsAnimating(true), 10);
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out
      ${isAnimating ? 'backdrop-blur-sm bg-white/10' : 'backdrop-blur-none bg-white/0'}`}>
      <div className={`bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen-strong max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 transition-all duration-300 ease-out
        ${isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img 
              src={`${import.meta.env.BASE_URL}/img/pandalogo.png`} 
              alt="TeamZen Profile" 
              className="w-10 h-10 object-contain animate-pulse-glow"
            />
            <h3 className="text-xl font-bold text-[#2E2E3A]">
              {isNewUser ? "¡Bienvenido a TeamZen!" : "Actualizar perfil"}
            </h3>
          </div>
          {!isNewUser && (
            <button
              onClick={onCancel}
              className="text-[#5B5B6B] hover:text-[#2E2E3A] transition-colors duration-200 p-1 rounded-lg hover:bg-[#DAD5E4]/30"
              disabled={saving}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {isNewUser && (
          <div className="bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-xl p-4 mb-6">
            <p className="text-[#2E2E3A] text-sm">
              Para comenzar a usar TeamZen, necesitamos algunos datos básicos sobre ti.
            </p>
          </div>
        )}
        
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
                Nombre*
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A] placeholder-[#5B5B6B]"
                placeholder="Tu nombre"
                required
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
                Apellido*
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A] placeholder-[#5B5B6B]"
                placeholder="Tu apellido"
                required
                disabled={saving}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Rol en TeamZen*
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A]"
              required
              disabled={(!isNewUser && profile?.role) || saving}
            >
              <option value="">Selecciona tu rol</option>
              <option value="leader">Líder de equipo - Puedo crear y gestionar equipos</option>
              <option value="user">Miembro de equipo - Me uno a equipos existentes</option>
            </select>
            {!isNewUser && profile?.role && (
              <p className="text-xs text-[#5B5B6B] mt-2">
                El rol no se puede cambiar una vez establecido. Contacta al administrador si necesitas cambiarlo.
              </p>
            )}
          </div>

          {/* Separador visual */}
          <div className="border-t border-[#DAD5E4] pt-6">
            <h4 className="text-lg font-medium text-[#2E2E3A] mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8z" />
              </svg>
              Información laboral
            </h4>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Fecha de nacimiento*
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A]"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Tipo de empleo*
            </label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A]"
              required
              disabled={saving}
            >
              <option value="">Selecciona el tipo de empleo</option>
              <option value="full-time">Tiempo completo</option>
              <option value="part-time">Medio tiempo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Cargo/Puesto*
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ej: Desarrollador Frontend, Gerente de Marketing..."
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A] placeholder-[#5B5B6B]"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Fecha de inicio en el cargo*
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A]"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Descripción del trabajo (opcional)
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Describe brevemente tus responsabilidades principales..."
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A] placeholder-[#5B5B6B] resize-none"
              rows={3}
              maxLength={500}
              disabled={saving}
            />
            <p className="text-xs text-[#5B5B6B] mt-2">
              {jobDescription.length}/500 caracteres
            </p>
          </div>

          {profileMsg && (
            <div className={`rounded-xl p-4 border transition-all duration-300 ${
              profileMsg.includes('Error') 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : 'bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border-[#55C2A2]/30 text-[#2E2E3A]'
            }`}>
              <p className="text-sm">{profileMsg}</p>
            </div>
          )}
          
          <div className={`flex ${isNewUser ? 'justify-center' : 'flex-col sm:flex-row gap-3'} pt-6`}>
            {!isNewUser && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 sm:flex-none bg-white border-2 border-[#DAD5E4] hover:border-[#55C2A2] text-[#2E2E3A] font-medium py-3 px-6 rounded-xl transition-all duration-300 ease-out transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none"
                disabled={saving}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className={`${isNewUser ? 'w-full' : 'flex-1'} bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] disabled:from-[#55C2A2]/50 disabled:to-[#7DDFC7]/50 text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2`}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isNewUser ? "Crear mi perfil" : "Guardar cambios"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================================================================
// COMPONENTES DE TARJETAS - ELEMENTOS DE INTERFAZ ESPECIALIZADOS
// ===================================================================

// Tarjeta de equipo para líderes - Control completo y métricas
function LeaderTeamCard({ team, members, membersLoading, activeCycleId, onLaunch, launching, ending, onEndCycle, respondedMembers, wellbeingMetric, onEdit, onDelete, profile, currentUserId }) {
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

  // Para vista de líder: incluir líder si está habilitado en métricas
  const allMembersForLeader = useMemo(() => {
    const baseMembers = members || [];
    
    // Si el líder debe incluirse y es el usuario actual
    if (leaderCounts && profile && team.leader_id === currentUserId) {
      const leaderAsMember = {
        user_id: currentUserId,
        profiles: {
          first_name: profile.first_name,
          last_name: profile.last_name
        },
        isLeader: true
      };
      
      // Evitar duplicados
      const memberExists = baseMembers.some(m => m.user_id === currentUserId);
      if (!memberExists) {
        return [leaderAsMember, ...baseMembers];
      }
    }
    
    return baseMembers;
  }, [members, leaderCounts, profile, team.leader_id, currentUserId]);
  const respondedCount = Math.min(Math.max(respondedCountRaw, 0), totalParticipantes);
  const participationPct = activeCycleId ? Math.round((respondedCount / (totalParticipantes || 1)) * 100) : 0;

  return (
    <div className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen hover:shadow-teamzen-strong transition-shadow">
      <div className="p-6">
        {/* Header del equipo */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#55C2A2] to-[#9D83C6] rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white font-bold text-sm sm:text-lg">
                {team.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{team.name}</h3>
              <p className="text-xs sm:text-sm text-gray-500">
                Creado el {new Date(team.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 ml-2">
            <span className="bg-gradient-to-r from-[#55C2A2]/20 to-[#9D83C6]/20 text-[#2E2E3A] text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full border border-[#55C2A2]/30">
              Líder
            </span>
            {team.include_leader_in_metrics === false && (
              <span className="bg-[#DAD5E4] text-[#5B5B6B] text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline" title="El líder no se contabiliza en métricas">
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
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg 
                className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <div className="bg-[#FAF9F6] border border-[#DAD5E4] p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Miembros</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-900">{totalParticipantes}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#FAF9F6] border border-[#DAD5E4] p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs sm:text-sm text-[#5B5B6B]">Estado</p>
                <p className="text-sm sm:text-lg font-semibold text-[#55C2A2]">Activo</p>
              </div>
            </div>
          </div>
          <div className="bg-[#FAF9F6] border border-[#DAD5E4] p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#9D83C6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13a4 4 0 014-4h10a4 4 0 110 8H7a4 4 0 01-4-4z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-[#5B5B6B]">Participación</p>
                {activeCycleId ? (
                  <p className="text-sm sm:text-lg font-semibold text-[#2E2E3A]">{participationPct}%</p>
                ) : (
                  <p className="text-sm sm:text-lg font-semibold text-[#5B5B6B]">-</p>
                )}
              </div>
            </div>
            {activeCycleId && (
              <div className="mt-2">
                <div className="w-full h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${participationPct}%`,
                      backgroundColor: participationPct >= 80 ? '#16a34a' : participationPct >= 50 ? '#f59e0b' : '#dc2626'
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] sm:text-[11px] text-gray-500 font-medium">{respondedCount} / {totalParticipantes}</p>
              </div>
            )}
          </div>
          <div className="bg-[#FAF9F6] border border-[#DAD5E4] p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#9D83C6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .843-3 1.882v4.236C9 15.157 10.343 16 12 16s3-.843 3-1.882V9.882C15 8.843 13.657 8 12 8z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-[#5B5B6B]">Bienestar</p>
                {activeCycleId ? (
                  <p className="text-sm sm:text-lg font-semibold text-[#2E2E3A]">
                    {wellbeingMetric && wellbeingMetric.avg != null ? `${wellbeingMetric.avg}` : '—'}
                    <span className="text-xs text-[#5B5B6B] ml-1">/100</span>
                  </p>
                ) : (
                  <p className="text-sm sm:text-lg font-semibold text-[#5B5B6B]">-</p>
                )}
              </div>
            </div>
            {activeCycleId && wellbeingMetric && wellbeingMetric.avg != null && (
              <div className="mt-2">
                <div className="w-full h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${wellbeingMetric.avg}%`,
                      backgroundColor: wellbeingMetric.avg >= 70 ? '#16a34a' : wellbeingMetric.avg >= 40 ? '#f59e0b' : '#dc2626'
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] sm:text-[11px] text-gray-500 font-medium">{wellbeingMetric.count} resp.</p>
              </div>
            )}
          </div>
        </div>

        {/* Código de invitación */}
        <div className="bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 p-3 sm:p-4 rounded-xl mb-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-[#2E2E3A] font-medium flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-[#55C2A2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="flex-1">Código de invitación</span>
                <button
                  onClick={() => setShowInvite(v => !v)}
                  className="text-[10px] sm:text-xs px-2 py-0.5 rounded-lg border border-[#55C2A2]/50 text-[#55C2A2] hover:bg-[#55C2A2]/20 transition-all duration-200 flex-shrink-0"
                >{showInvite ? 'Ocultar' : 'Mostrar'}</button>
              </p>
              <p className="text-sm sm:text-lg font-mono font-bold text-[#2E2E3A] select-all break-all bg-[#FAF9F6] px-2 sm:px-3 py-2 rounded-lg border border-[#DAD5E4]">
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
              className="bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] text-white px-3 py-1.5 sm:py-1 rounded-lg text-xs sm:text-sm transition-all duration-300 ease-out transform hover:scale-105 shadow-md hover:shadow-lg flex-shrink-0 mt-6 sm:mt-0"
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
            ) : allMembersForLeader?.length > 0 ? (
              <div className="space-y-2">
                {allMembersForLeader.map((member) => {
                  const hasResponded = !!(respondedMembers && respondedMembers.has(member.user_id));
                  const isLeaderMember = member.isLeader;
                  return (
                    <div key={member.user_id} className="flex items-center space-x-3 p-2 bg-[#FAF9F6] border border-[#DAD5E4] rounded-xl">
                      <div className={`w-8 h-8 ${isLeaderMember ? 'bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7]' : 'bg-[#DAD5E4]'} rounded-full flex items-center justify-center`}>
                        <span className={`text-sm font-medium ${isLeaderMember ? 'text-white' : 'text-[#2E2E3A]'}`}>
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
                        <p className="text-xs text-gray-500">
                          {isLeaderMember ? 'Líder del equipo' : 'Miembro del equipo'}
                        </p>
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
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t">
          {activeCycleId ? (
            <button
              className="w-full sm:flex-1 bg-red-600 text-white py-2.5 sm:py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
              onClick={onEndCycle}
              disabled={ending}
            >
              {ending ? 'Terminando...' : 'Terminar ciclo'}
            </button>
          ) : (
            <button 
              className="w-full sm:flex-1 bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] disabled:from-[#55C2A2]/50 disabled:to-[#7DDFC7]/50 text-white py-2.5 sm:py-2 px-4 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-sm"
              onClick={onLaunch}
              disabled={launching}
            >
              {launching ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Lanzando...
                </span>
              ) : (
                'Lanzar MBI'
              )}
            </button>
          )}
          {activeCycleId && (
            <div className="hidden sm:block sm:flex-1">
              {participationPct === 100 ? (
                <div className="w-full flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                  Todos respondieron
                </div>
              ) : (
                <div className="w-full flex items-center justify-center px-4 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-medium border border-green-200">
                  Ciclo activo
                </div>
              )}
            </div>
          )}
          <button 
            className="w-full sm:flex-1 border border-[#DAD5E4] text-[#2E2E3A] py-2.5 sm:py-2 px-4 rounded-lg font-medium hover:bg-[#FAF9F6] transition-colors text-sm"
            onClick={() => navigate(`/reportes?team=${team.id}`)}
          >
            Generar Reporte
          </button>
        </div>
      </div>
    </div>
  );
}

// Tarjeta de equipo para usuarios miembros - Vista de participación
function UserTeamCard({ team, members, membersLoading, currentUserId, activeCycleId, respondedCycles, respondedMembers }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const currentMember = members?.find(m => m.user_id === currentUserId);
  
  // Aplicar configuraciones de privacidad
  const canSeeOthers = team.members_can_see_others ?? true;
  const canSeeResponses = team.members_can_see_responses ?? true;
  
  // Filtrar miembros basado en configuración de privacidad
  const visibleMembers = canSeeOthers 
    ? members 
    : members?.filter(m => m.user_id === currentUserId) || [];
  
  // Calcular total de participantes (siempre mostrar el total real)
  const totalParticipantes = members?.length || 0;

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
                <p className="text-lg font-semibold text-gray-900">{totalParticipantes}</p>
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
            <h4 className="text-sm font-medium text-gray-900 mb-3">Miembros del equipo</h4>
            {membersLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="small" />
              </div>
            ) : visibleMembers?.length > 0 ? (
              <div className="space-y-2">
                {visibleMembers.map((member) => {
                  const hasResponded = !!(respondedMembers && respondedMembers.has(member.user_id));
                  const isCurrentUser = member.user_id === currentUserId;
                  const isLeader = member.is_leader || member.user_id === team.leader_id;
                  
                  return (
                    <div key={member.user_id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                      <div className={`w-8 h-8 ${
                        isCurrentUser ? 'bg-green-500' : 
                        isLeader ? 'bg-blue-500' : 
                        'bg-gray-300'
                      } rounded-full flex items-center justify-center`}>
                        <span className={`text-sm font-medium ${
                          isCurrentUser || isLeader ? 'text-white' : 'text-gray-700'
                        }`}>
                          {member.profiles?.first_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {member.profiles?.first_name && member.profiles?.last_name
                            ? `${member.profiles.first_name} ${member.profiles.last_name}`
                            : 'Usuario sin nombre'
                          }
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-green-600 font-semibold">(Tú)</span>
                          )}
                          {isLeader && !isCurrentUser && (
                            <span className="ml-2 text-xs text-[#55C2A2] font-semibold">(Líder)</span>
                          )}
                          {isLeader && isCurrentUser && (
                            <span className="ml-2 text-xs text-[#55C2A2] font-semibold">(Líder)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {isCurrentUser ? 'Tu participación' : 
                           isLeader ? 'Líder del equipo' : 
                           'Miembro del equipo'}
                        </p>
                      </div>
                      {activeCycleId && canSeeResponses ? (
                        // Mostrar estado de respuesta solo si está permitido
                        hasResponded ? (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">Respondió</span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">Pendiente</span>
                        )
                      ) : activeCycleId && !canSeeResponses && isCurrentUser ? (
                        // Para el usuario actual, siempre mostrar su estado
                        hasResponded ? (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">Respondiste</span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">Pendiente</span>
                        )
                      ) : activeCycleId ? (
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">Privado</span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">Sin ciclo</span>
                      )}
                    </div>
                  );
                })}
                {!canSeeOthers && visibleMembers.length === 1 && (
                  <div className="p-3 bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-xl">
                    <p className="text-sm text-[#2E2E3A] flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Configuración de privacidad: Solo puedes verte a ti mismo
                    </p>
                  </div>
                )}
                {canSeeOthers && visibleMembers.filter(m => m.user_id !== currentUserId).length === 0 && (
                  <p className="text-sm text-gray-500 italic">Eres el único miembro del equipo</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Sin otros miembros</p>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t">
          {!activeCycleId ? (
            <div className="w-full sm:flex-1 flex items-center justify-center px-4 py-2.5 sm:py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium border border-gray-200">Sin ciclo activo</div>
          ) : respondedCycles[activeCycleId] ? (
            <div className="w-full sm:flex-1 flex items-center justify-center px-4 py-2.5 sm:py-2 rounded-lg bg-green-50 text-green-600 text-sm font-medium border border-green-200">Respondido</div>
          ) : (
            <button 
              className="w-full sm:flex-1 bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] text-white py-2.5 sm:py-2 px-4 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow text-sm"
              onClick={() => navigate(`/mbi?team=${team.id}`)}
            >
              Completar MBI
            </button>
          )}
          <button className="w-full sm:flex-1 border border-[#DAD5E4] text-[#2E2E3A] py-2.5 sm:py-2 px-4 rounded-lg font-medium hover:bg-[#FAF9F6] transition-colors text-sm">
            Ver Historial
          </button>
        </div>
      </div>
    </div>
  );
}
