import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { Card, Button, Input, Alert } from "../components/UIComponents";

export default function UnirseEquipo() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("enter-code"); // 'enter-code' | 'confirm' | 'success'
  const [error, setError] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [shareResults, setShareResults] = useState(false);

  // Obtener usuario autenticado
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
      else navigate("/login");
    });
  }, [navigate]);

  const handlePreview = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // La validación real (código válido, no expirado, política de unión)
      // ocurre en la base de datos (preview_team_invite_code), no en el
      // cliente — este paso solo muestra qué equipo es antes de unirte.
      const { data, error: previewError } = await supabase
        .rpc("preview_team_invite_code", { p_code: code.toUpperCase() })
        .single();

      if (previewError) {
        throw new Error(previewError.message || "No se pudo verificar el código.");
      }

      setTeamName(data.team_name);
      setShareResults(false);
      setStep("confirm");
    } catch (err) {
      console.error("Error al verificar el código:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmJoin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validación + verificación de membresía + insert ocurren atómicamente
      // en la base de datos (join_team_with_code), incluyendo la elección de
      // compartir resultados hecha en esta misma pantalla.
      const { error: joinError } = await supabase
        .rpc("join_team_with_code", { p_code: code.toUpperCase(), p_share_results: shareResults })
        .single();

      if (joinError) {
        throw new Error(joinError.message || "No se pudo unir al equipo.");
      }

      setCode("");
      setStep("success");
    } catch (err) {
      console.error("Error al unirse al equipo:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirm = () => {
    setStep("enter-code");
    setTeamName("");
    setError(null);
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
            src={`${import.meta.env.BASE_URL}/img/formpanda.png`} 
            alt="Panda buscando" 
            className="w-20 h-20 sm:w-32 sm:h-32 mx-auto mb-4 sm:mb-6"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2E2E3A] mb-2">Unirse a un Equipo</h1>
          <p className="text-[#5B5B6B] text-base sm:text-lg px-4">
            Ingresa el código de invitación que te proporcionó tu líder de equipo
          </p>
        </div>

        <Card className="max-w-lg mx-auto">
          {step === "enter-code" && (
            <form onSubmit={handlePreview} className="space-y-4 sm:space-y-6">
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
                {loading ? "Verificando código..." : "Continuar"}
              </Button>
            </form>
          )}

          {step === "confirm" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="text-center">
                <h2 className="text-xl sm:text-2xl font-bold text-[#2E2E3A] mb-2">
                  Antes de unirte a {teamName}
                </h2>
                <p className="text-[#5B5B6B] text-sm sm:text-base">
                  Este equipo usa TeamZen para medir el bienestar del equipo con evaluaciones periódicas (MBI).
                </p>
              </div>

              <ul className="text-xs sm:text-sm text-[#5B5B6B] space-y-2 text-left bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-lg p-4 sm:p-6">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#55C2A2] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Vas a poder responder evaluaciones de forma privada.</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#55C2A2] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Tus respuestas individuales NO se muestran a tu líder por defecto — el líder solo ve un promedio de todo el equipo, y nunca con menos de 3 personas respondiendo (para que nadie pueda ser identificado a partir del promedio).</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#55C2A2] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Podés elegir compartir tus resultados individuales con tu líder si querés. Podés cambiar esta decisión cuando quieras desde tu equipo.</span>
                </li>
              </ul>

              <div className="border border-[#DAD5E4] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="shareResults"
                    checked={shareResults}
                    onChange={(e) => setShareResults(e.target.checked)}
                    className="mt-1 w-4 h-4 text-[#845EC2] border-gray-300 rounded focus:ring-[#845EC2]"
                  />
                  <label htmlFor="shareResults" className="text-sm font-medium text-[#2E2E3A] cursor-pointer">
                    Compartir mis resultados individuales con el líder de este equipo
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={handleCancelConfirm}
                  className="flex-1 text-sm"
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmJoin}
                  loading={loading}
                  className="flex-1 text-sm"
                >
                  {loading ? "Uniéndose..." : "Unirme al equipo"}
                </Button>
              </div>
            </div>
          )}

          {step === "success" && (
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

    </div>
  );
}
