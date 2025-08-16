import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { Card, Button, Input, Alert } from "../components/UIComponents";

export default function UnirseEquipo() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [joinedTeamId, setJoinedTeamId] = useState(null);
  const [privacyPreferences, setPrivacyPreferences] = useState({
    membersCanSeeResponses: false
  });

  // Obtener usuario autenticado
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
      else navigate("/login");
    });
  }, [navigate]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      // 1. Buscar código
      const { data: invites, error: inviteError } = await supabase
        .from("team_invite_codes")
        .select("team_id")
        .eq("code", code.toUpperCase());

      if (inviteError || !invites || invites.length === 0) {
        throw new Error("Código inválido o no encontrado.");
      }

      const invite = invites[0];

      // 2. Verificar que el equipo permita unirse
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("join_policy")
        .eq("id", invite.team_id)
        .single();

      if (teamError || !team) {
        throw new Error("No se encontró el equipo.");
      }

      if (team.join_policy !== "code") {
        throw new Error("Este equipo no permite unirse directamente.");
      }

      // 3. Verificar si ya es miembro
      const { data: existing, error: existingError } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", invite.team_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingError) {
        throw new Error("Error verificando membresía previa.");
      }

      if (existing) {
        throw new Error("Ya eres miembro de este equipo.");
      }

      // 4. Insertar en team_members con preferencias por defecto
      const { error: insertError } = await supabase
        .from("team_members")
        .insert([{ 
          team_id: invite.team_id, 
          user_id: userId,
          share_results_with_leader: false // Por defecto no compartir
        }]);
        console.log("Insertando en team_members:", {
          team_id: invite.team_id,
          user_id: userId,
        });


      if (insertError) {
        throw new Error("No se pudo unir al equipo.");
        
      }

      setJoinedTeamId(invite.team_id);
      setSuccess("¡Te uniste al equipo correctamente!");
      setShowPrivacyModal(true);
      setCode("");
    } catch (err) {
      console.error("Error al unirse al equipo:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyPreferences = async () => {
    if (!joinedTeamId || !userId) return;
    
    try {
      setLoading(true);
      
      // Actualizar las preferencias de privacidad del miembro individual
      const { error } = await supabase
        .from('team_members')
        .update({
          share_results_with_leader: privacyPreferences.membersCanSeeResponses
        })
        .eq('team_id', joinedTeamId)
        .eq('user_id', userId);

      if (error) throw error;

      setShowPrivacyModal(false);
    } catch (err) {
      console.error('Error actualizando preferencias de privacidad:', err);
      setError('No se pudieron guardar las preferencias de privacidad.');
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
                src="/img/pandalogo.png" 
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
            src="/img/formpanda.png" 
            alt="Panda buscando" 
            className="w-20 h-20 sm:w-32 sm:h-32 mx-auto mb-4 sm:mb-6"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2E2E3A] mb-2">Unirse a un Equipo</h1>
          <p className="text-[#5B5B6B] text-base sm:text-lg px-4">
            Ingresa el código de invitación que te proporcionó tu líder de equipo
          </p>
        </div>

        <Card className="max-w-lg mx-auto">
          {!success ? (
            <form onSubmit={handleJoin} className="space-y-4 sm:space-y-6">
              <div className="space-y-4">
                <Input
                  label="Código de Invitación"
                  type="text"
                  required
                  placeholder="Ej: ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="text-center text-xl sm:text-2xl font-mono tracking-wider"
                  maxLength={6}
                />
                <div className="text-xs sm:text-sm text-[#5B5B6B] text-center">
                  Los códigos tienen 6 letras (ej: ABC123)
                </div>
              </div>

              <Button 
                type="submit" 
                loading={loading} 
                className="w-full text-sm sm:text-base" 
                size="large"
                disabled={code.length < 6}
              >
                {loading ? "Uniéndose al equipo..." : "Unirse al Equipo"}
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
                <h2 className="text-xl sm:text-2xl font-bold text-[#2E2E3A] mb-2">¡Bienvenido al equipo!</h2>
                <p className="text-[#5B5B6B] text-sm sm:text-base">Te has unido exitosamente al equipo</p>
              </div>

              <div className="bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-lg p-4 sm:p-6">
                <h3 className="font-semibold text-[#2E2E3A] mb-2 text-sm sm:text-base">¿Qué sigue?</h3>
                <ul className="text-xs sm:text-sm text-[#5B5B6B] space-y-2 text-left">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-[#55C2A2] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Podrás ver a los demás miembros del equipo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-[#55C2A2] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Próximamente podrás realizar evaluaciones de bienestar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-[#55C2A2] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Recibirás consejos personalizados según tus resultados</span>
                  </li>
                </ul>
              </div>

              <Button onClick={() => navigate("/dashboard")} className="w-full text-sm sm:text-base">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v1H8V5z" />
                </svg>
                Ir al Dashboard
              </Button>
            </div>
          )}

          {error && (
            <Alert type="error" title="Error al unirse al equipo" className="mt-4">
              {error}
            </Alert>
          )}
        </Card>

        {/* Información adicional */}
        <div className="mt-8 sm:mt-12 text-center">
          <h3 className="text-base sm:text-lg font-semibold text-[#2E2E3A] mb-4">¿No tienes un código?</h3>
          <div className="bg-white rounded-lg border border-[#DAD5E4] p-4 sm:p-6 max-w-md mx-auto">
            <p className="text-[#5B5B6B] text-xs sm:text-sm mb-3">
              Solicita el código de invitación a tu líder de equipo o administrador.
            </p>
            <p className="text-[#5B5B6B] text-xs sm:text-sm">
              Los códigos son únicos para cada equipo y se generan automáticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de preferencias de privacidad */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto bg-[#845EC2]/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-[#845EC2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[#2E2E3A] mb-2">Configuración de Privacidad</h2>
                <p className="text-sm text-[#5B5B6B]">
                  Configura qué información quieres compartir con tu equipo
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="border border-[#DAD5E4] rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="responses"
                      checked={privacyPreferences.membersCanSeeResponses}
                      onChange={(e) => setPrivacyPreferences(prev => ({
                        ...prev,
                        membersCanSeeResponses: e.target.checked
                      }))}
                      className="mt-1 w-4 h-4 text-[#845EC2] border-gray-300 rounded focus:ring-[#845EC2]"
                    />
                    <div className="flex-1">
                      <label htmlFor="responses" className="text-sm font-medium text-[#2E2E3A] cursor-pointer">
                        Compartir mis respuestas de evaluación con el líder
                      </label>
                      <p className="text-xs text-[#5B5B6B] mt-1">
                        Permite que el líder del equipo pueda ver tus resultados individuales para brindar mejor apoyo personalizado
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs text-blue-800 font-medium">¿Por qué es importante?</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Estas configuraciones ayudan a los líderes a brindar mejor apoyo y seguimiento sin comprometer tu privacidad.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowPrivacyModal(false)}
                  className="flex-1 text-sm"
                  disabled={loading}
                >
                  Configurar después
                </Button>
                <Button
                  onClick={handlePrivacyPreferences}
                  className="flex-1 text-sm"
                  loading={loading}
                >
                  {loading ? "Guardando..." : "Guardar preferencias"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
