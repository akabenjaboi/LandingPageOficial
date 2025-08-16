import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from '../../supabaseClient';
import { Card, Button, Input, Alert } from "../components/UIComponents";
import LoadingSpinner from "../components/LoadingSpinner";

export default function CrearEquipo() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [joinPolicy, setJoinPolicy] = useState("code");
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [error, setError] = useState(null);
  const [includeLeader, setIncludeLeader] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const generateCode = (length = 6) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInviteCode(null);

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError || profile?.role !== "leader") {
        throw new Error("No tienes permisos para crear un equipo.");
      }

      const { data: newTeam, error: teamError } = await supabase
        .from("teams")
        .insert([{ 
          name: teamName,
          description: description, 
          leader_id: userId, 
          join_policy: joinPolicy,
          include_leader_in_metrics: includeLeader
        }])
        .select()
        .single();

      if (teamError || !newTeam?.id) {
        throw new Error("Error al crear el equipo.");
      }

      const code = generateCode();
      const { error: codeError } = await supabase
        .from("team_invite_codes")
        .insert([{ code, team_id: newTeam.id }]);

      if (codeError) {
        throw new Error("Equipo creado, pero ocurrió un error al generar el código.");
      }

      setInviteCode(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <header className="bg-white border-b border-[#DAD5E4] shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <img 
                src={`${import.meta.env.BASE_URL}/img/pandalogo.png`} 
                alt="TeamZen Logo" 
                className="w-8 h-8 sm:w-10 sm:h-10"
              />
              <h1 className="text-lg sm:text-2xl font-bold text-[#2E2E3A]">
                Team<span className="text-[#55C2A2]">Zen</span>
              </h1>
            </div>
            <Button 
              variant="ghost" 
              onClick={() => navigate("/dashboard")}
              className="text-sm sm:text-base px-2 sm:px-4"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Volver al Dashboard</span>
              <span className="sm:hidden">Volver</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="text-center mb-6 sm:mb-8">
          <img 
            src={`${import.meta.env.BASE_URL}/img/pandapintando.png`} 
            alt="Panda creativo" 
            className="w-20 h-20 sm:w-32 sm:h-32 mx-auto mb-4 sm:mb-6"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2E2E3A] mb-2">Crear Nuevo Equipo</h1>
          <p className="text-[#5B5B6B] text-base sm:text-lg px-4">
            Crea un espacio colaborativo para monitorear el bienestar de tu equipo
          </p>
        </div>

        <Card className="max-w-lg mx-auto">
          {!inviteCode ? (
            <form onSubmit={handleCreateTeam} className="space-y-4 sm:space-y-6">
              <Input
                label="Nombre del equipo"
                type="text"
                required
                placeholder="Ej: Equipo de Desarrollo, Marketing Team..."
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="text-base sm:text-lg"
              />

              <div className="space-y-2">
                <label className="font-semibold text-[#2E2E3A] text-sm">
                  Descripción del equipo
                </label>
                <textarea
                  placeholder="Describe brevemente el área, departamento o función del equipo..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-[#DAD5E4] rounded-lg focus:ring-2 focus:ring-[#55C2A2] focus:border-[#55C2A2] resize-none text-sm sm:text-base"
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-[#5B5B6B]">
                  {description.length}/200 caracteres - Esta información ayuda a la IA a generar análisis más precisos
                </p>
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-[#2E2E3A] text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeLeader}
                    onChange={(e) => setIncludeLeader(e.target.checked)}
                    className="w-4 h-4 text-[#55C2A2] focus:ring-[#55C2A2] rounded"
                  />
                  Incluir al líder en métricas (participación y bienestar)
                </label>
                <p className="text-xs text-[#5B5B6B] ml-6 -mt-1">
                  Si lo desmarcas, las métricas excluirán las respuestas del líder para evitar sesgos.
                </p>
              </div>

              <div className="space-y-3">
                <label className="font-semibold text-[#2E2E3A] text-sm">
                  ¿Cómo se unirán los miembros? <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-start sm:items-center gap-3 p-3 border border-[#DAD5E4] rounded-lg hover:bg-[#FAF9F6] cursor-pointer">
                    <input
                      type="radio"
                      name="joinPolicy"
                      value="code"
                      checked={joinPolicy === "code"}
                      onChange={(e) => setJoinPolicy(e.target.value)}
                      className="w-4 h-4 text-[#55C2A2] focus:ring-[#55C2A2] mt-0.5 sm:mt-0 flex-shrink-0"
                    />
                    <div>
                      <div className="font-medium text-[#2E2E3A] text-sm sm:text-base">Con código de invitación</div>
                      <div className="text-xs sm:text-sm text-[#5B5B6B]">Los usuarios se unen automáticamente con un código</div>
                    </div>
                  </label>
                  {/* Opción deshabilitada por ahora */}
                  <label className="flex items-start sm:items-center gap-3 p-3 border border-[#DAD5E4] rounded-lg opacity-50 cursor-not-allowed">
                    <input
                      type="radio"
                      name="joinPolicy"
                      value="request"
                      disabled
                      className="w-4 h-4 text-[#55C2A2] focus:ring-[#55C2A2] mt-0.5 sm:mt-0 flex-shrink-0"
                    />
                    <div>
                      <div className="font-medium text-[#2E2E3A] text-sm sm:text-base">Solicitud al líder</div>
                      <div className="text-xs sm:text-sm text-[#5B5B6B]">Próximamente - Los usuarios envían solicitudes</div>
                    </div>
                  </label>
                </div>
              </div>

              <Button 
                type="submit" 
                loading={loading} 
                className="w-full" 
                size="large"
              >
                {loading ? "Creando equipo..." : "Crear Equipo"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4 sm:space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#2E2E3A] mb-2">¡Equipo Creado!</h2>
                <p className="text-[#5B5B6B] text-sm sm:text-base">Tu equipo ha sido creado exitosamente</p>
              </div>

              <div className="bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-lg p-4 sm:p-6">
                <h3 className="font-semibold text-[#2E2E3A] mb-3 text-sm sm:text-base">Código de Invitación</h3>
                <div className="bg-white border-2 border-dashed border-[#55C2A2] rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                  <div className="text-2xl sm:text-3xl font-bold text-[#2E2E3A] font-mono tracking-wider text-center">
                    {inviteCode}
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-[#5B5B6B] text-center px-2">
                  Comparte este código con los miembros de tu equipo para que puedan unirse
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    navigator.clipboard.writeText(inviteCode);
                    // Podrías agregar un toast aquí
                  }}
                  className="w-full sm:flex-1 text-sm sm:text-base"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copiar Código
                </Button>
                <Button onClick={() => navigate("/dashboard")} className="w-full sm:flex-1 text-sm sm:text-base">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v1H8V5z" />
                  </svg>
                  Ir al Dashboard
                </Button>
              </div>
            </div>
          )}

          {error && (
            <Alert type="error" title="Error al crear equipo" className="mt-4">
              {error}
            </Alert>
          )}
        </Card>
      </div>
    </div>
  );
}
