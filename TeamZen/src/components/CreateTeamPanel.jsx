// ===================================================================
// PANEL DE CREACIÓN DE EQUIPO (en línea, no modal)
// ===================================================================
// Envoltorio de InlinePanel alrededor del formulario compartido
// (CreateTeamForm) — crear un equipo es un flujo de configuración
// rutinario, no una decisión destructiva/confirmatoria, así que se
// expande dentro de la página en vez de interrumpir con un overlay.
// ===================================================================
import { useState } from 'react';
import InlinePanel from './InlinePanel';
import CreateTeamForm from './CreateTeamForm';

export default function CreateTeamPanel({ isOpen, onClose, onTeamCreated }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <InlinePanel
      isOpen={isOpen}
      onClose={loading ? undefined : handleClose}
      title={success ? '¡Equipo creado!' : 'Crear un nuevo equipo'}
      description={success ? undefined : 'Un espacio colaborativo para monitorear el bienestar de tu equipo'}
      tone="mint"
    >
      <CreateTeamForm
        resetOn={isOpen}
        onCancel={handleClose}
        onTeamCreated={onTeamCreated}
        onDone={handleClose}
        doneLabel="Continuar"
        onLoadingChange={setLoading}
        onSuccessChange={setSuccess}
      />
    </InlinePanel>
  );
}
