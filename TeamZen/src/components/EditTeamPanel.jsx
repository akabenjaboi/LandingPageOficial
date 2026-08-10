// ===================================================================
// PANEL DE EDICIÓN DE EQUIPO (en línea, no modal)
// ===================================================================
// Convertido desde EditTeamModal.jsx: editar la configuración de un
// equipo ya existente es un flujo rutinario, no una decisión
// destructiva — se expande dentro de la propia tarjeta del equipo en
// vez de flotar por encima de la página.
// ===================================================================
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import InlinePanel from './InlinePanel';
import { Field, Check, Alert, Btn } from './app-ui';

export default function EditTeamPanel({ isOpen, onClose, team, onTeamUpdated }) {
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [includeLeader, setIncludeLeader] = useState(true);
  const [membersCanSeeOthers, setMembersCanSeeOthers] = useState(true);
  const [membersCanSeeResponses, setMembersCanSeeResponses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && team) {
      setTeamName(team.name || "");
      setDescription(team.description || "");
      setIncludeLeader(team.include_leader_in_metrics ?? true);
      setMembersCanSeeOthers(team.members_can_see_others ?? true);
      setMembersCanSeeResponses(team.members_can_see_responses ?? true);
      setError(null);
    }
  }, [isOpen, team]);

  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    if (!team) return;

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("teams")
        .update({
          name: teamName,
          description: description,
          include_leader_in_metrics: includeLeader,
          members_can_see_others: membersCanSeeOthers,
          members_can_see_responses: membersCanSeeResponses,
          updated_at: new Date().toISOString()
        })
        .eq("id", team.id);

      if (updateError) {
        throw new Error("Error al actualizar el equipo.");
      }

      if (onTeamUpdated) {
        onTeamUpdated({
          ...team,
          name: teamName,
          description: description,
          include_leader_in_metrics: includeLeader,
          members_can_see_others: membersCanSeeOthers,
          members_can_see_responses: membersCanSeeResponses
        });
      }

      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <InlinePanel
      isOpen={isOpen}
      onClose={loading ? undefined : handleClose}
      title="Editar equipo"
      description="Actualiza la información y privacidad de tu equipo"
      tone="purple"
    >
      <form onSubmit={handleUpdateTeam} className="flex flex-col gap-5">
        <Field
          label="Nombre del equipo"
          required
          placeholder="Ej: Equipo de Desarrollo, Marketing Team..."
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          disabled={loading}
        />

        <Field
          as="textarea"
          label="Descripción del equipo"
          placeholder="Describe brevemente el área, departamento o función del equipo..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          rows={3}
          maxLength={200}
          hint={`${description.length}/200 caracteres — esta información ayuda a la IA a generar análisis más precisos`}
        />

        <label className="flex items-start gap-3">
          <Check checked={includeLeader} onChange={() => setIncludeLeader((v) => !v)} />
          <span>
            <span className="font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]">Incluir al líder en métricas (participación y bienestar)</span>
            <p className="mt-0.5 text-xs text-[#5B5B6B]">Cambiar esta configuración afecta los cálculos de métricas futuras y reportes.</p>
          </span>
        </label>

        <div className="flex flex-col gap-3 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-4">
          <h4 className="font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]">Configuración de privacidad</h4>

          <label className="flex items-start gap-3">
            <Check checked={membersCanSeeOthers} onChange={() => setMembersCanSeeOthers((v) => !v)} />
            <span>
              <span className="font-['Poppins',_Arial,_sans-serif] text-sm font-medium text-[#2E2E3A]">Los miembros pueden ver a otros integrantes</span>
              <p className="mt-0.5 text-xs text-[#5B5B6B]">Si lo desmarcas, cada miembro solo podrá verse a sí mismo en el equipo.</p>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <Check checked={membersCanSeeResponses} onChange={() => setMembersCanSeeResponses((v) => !v)} />
            <span>
              <span className="font-['Poppins',_Arial,_sans-serif] text-sm font-medium text-[#2E2E3A]">Los miembros pueden ver si otros ya respondieron</span>
              <p className="mt-0.5 text-xs text-[#5B5B6B]">Si lo desmarcas, cada miembro solo verá su propio estado de respuesta.</p>
            </span>
          </label>
        </div>

        {error && <Alert title="Error al actualizar equipo">{error}</Alert>}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
          <Btn type="button" variant="ghost" onClick={handleClose} disabled={loading} className="flex-1 justify-center">
            Cancelar
          </Btn>
          <Btn type="submit" disabled={loading || !teamName.trim()} className="flex-1 justify-center">
            {loading ? "Actualizando..." : "Guardar cambios"}
          </Btn>
        </div>
      </form>
    </InlinePanel>
  );
}
