import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Modal from './Modal';
import { Input, Alert } from './UIComponents';

export default function CreateTeamModal({ isOpen, onClose, onTeamCreated }) {
  const [userId, setUserId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [joinPolicy, setJoinPolicy] = useState("code");
  const [includeLeader, setIncludeLeader] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);

  // Obtener usuario actual cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
    }
  }, [isOpen]);

  // Reset form cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setTeamName("");
      setDescription("");
      setJoinPolicy("code");
      setIncludeLeader(true);
      setLoading(false);
      setError(null);
      setSuccess(false);
      setInviteCode(null);
    }
  }, [isOpen]);

  const generateCode = (length = 6) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
      setSuccess(true);
      
      // Notificar al componente padre que se creó un equipo
      if (onTeamCreated) {
        onTeamCreated(newTeam, code);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      // Podrías agregar un toast aquí para confirmar que se copió
    } catch (err) {
      console.error('Error copiando al portapapeles:', err);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={success ? "¡Equipo Creado!" : "Crear Nuevo Equipo"}
      maxWidth="max-w-2xl"
      preventCloseOnOutsideClick={loading}
    >
      {!success ? (
        // Formulario de creación
        <form onSubmit={handleCreateTeam} className="space-y-6">
          <div className="text-center mb-6">
            <img 
              src={`${import.meta.env.BASE_URL}/img/pandapintando.png`} 
              alt="Panda creativo" 
              className="w-24 h-24 mx-auto mb-4"
            />
            <p className="text-[#5B5B6B]">
              Crea un espacio colaborativo para monitorear el bienestar de tu equipo
            </p>
          </div>

          <Input
            label="Nombre del equipo"
            type="text"
            required
            placeholder="Ej: Equipo de Desarrollo, Marketing Team..."
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            disabled={loading}
          />

          <div className="space-y-2">
            <label className="font-semibold text-[#2E2E3A] text-sm">
              Descripción del equipo
            </label>
            <textarea
              placeholder="Describe brevemente el área, departamento o función del equipo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-lg focus:ring-2 focus:ring-[#55C2A2] focus:border-[#55C2A2] resize-none disabled:opacity-50"
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
                disabled={loading}
                className="w-4 h-4 text-[#55C2A2] focus:ring-[#55C2A2] rounded"
              />
              Incluir al líder en métricas (participación y bienestar)
            </label>
            <p className="text-xs text-[#5B5B6B] ml-6">
              Si lo desmarcas, las métricas excluirán las respuestas del líder para evitar sesgos.
            </p>
          </div>

          <div className="space-y-3">
            <label className="font-semibold text-[#2E2E3A] text-sm">
              ¿Cómo se unirán los miembros? <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-[#DAD5E4] rounded-lg hover:bg-[#FAF9F6] cursor-pointer">
                <input
                  type="radio"
                  name="joinPolicy"
                  value="code"
                  checked={joinPolicy === "code"}
                  onChange={(e) => setJoinPolicy(e.target.value)}
                  disabled={loading}
                  className="w-4 h-4 text-[#55C2A2] focus:ring-[#55C2A2]"
                />
                <div>
                  <div className="font-medium text-[#2E2E3A]">Con código de invitación</div>
                  <div className="text-sm text-[#5B5B6B]">Los usuarios se unen automáticamente con un código</div>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <Alert type="error" title="Error al crear equipo">
              {error}
            </Alert>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !teamName.trim()}
              className="flex-1 bg-[#55C2A2] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#4AA690] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creando equipo..." : "Crear Equipo"}
            </button>
          </div>
        </form>
      ) : (
        // Pantalla de éxito
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-[#2E2E3A] mb-2">¡Equipo "{teamName}" Creado!</h2>
            <p className="text-[#5B5B6B]">Tu equipo ha sido creado exitosamente</p>
          </div>

          <div className="bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-lg p-6">
            <h3 className="font-semibold text-[#2E2E3A] mb-3">Código de Invitación</h3>
            <div className="bg-white border-2 border-dashed border-[#55C2A2] rounded-lg p-4 mb-4">
              <div className="text-2xl font-bold text-[#2E2E3A] font-mono tracking-wider text-center">
                {inviteCode}
              </div>
            </div>
            <p className="text-sm text-[#5B5B6B] text-center">
              Comparte este código con los miembros de tu equipo para que puedan unirse
            </p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={copyToClipboard}
              className="flex-1 border border-[#55C2A2] text-[#55C2A2] px-4 py-2 rounded-lg font-medium hover:bg-[#55C2A2]/5 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar Código
            </button>
            <button 
              onClick={handleClose}
              className="flex-1 bg-[#55C2A2] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#4AA690] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Continuar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
