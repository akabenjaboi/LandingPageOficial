// ===================================================================
// PANEL DE INICIO DE RONDA MBI (en línea, no modal)
// ===================================================================
// Convertido desde LaunchMBIModal.jsx: iniciar una ronda de evaluación es
// un flujo de configuración rutinario del ciclo de vida normal del
// equipo, no una decisión destructiva — se expande dentro de la propia
// tarjeta del equipo (o sección) que lo dispara.
// Props:
//  isOpen: boolean
//  context: { teamId, teamName, activeCycleId, pendingMembers:[], totalMembers }
//  launching: boolean
//  onClose: fn()
//  onConfirm: fn(teamId)
// ===================================================================
import InlinePanel from './InlinePanel';
import { Btn, Notice } from './app-ui';

export default function LaunchMBIPanel({ isOpen, context, launching, onClose, onConfirm }) {
  if (!context) return null;

  const { teamId, activeCycleId, pendingMembers = [], totalMembers = 0 } = context;

  return (
    <InlinePanel
      isOpen={isOpen}
      onClose={launching ? undefined : onClose}
      title={activeCycleId ? 'Iniciar nueva ronda' : 'Iniciar ronda'}
      tone="mint"
    >
      <div className="flex flex-col gap-4">
        <Notice>
          La ronda se <strong className="font-bold">cerrará automáticamente después de 7 días</strong> desde su inicio.
          Los miembros que no respondan en este período no podrán participar hasta la próxima ronda.
        </Notice>

        {activeCycleId && (
          <Notice tone="purple">
            Ya existe una ronda activa. Iniciar una nueva cerrará la ronda actual y permitirá que todos respondan nuevamente.
          </Notice>
        )}

        <div>
          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[.06em] text-[#5B5B6B]">Participación actual</h4>
          {totalMembers === 0 ? (
            <Notice tone="purple">
              Este equipo no tiene miembros aún. Puedes iniciar la ronda de todas formas, pero recuerda invitar miembros para que participen.
            </Notice>
          ) : pendingMembers.length === 0 ? (
            <p className="text-sm font-medium text-[#3d8a74]">Todos los miembros han respondido la ronda actual.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[#DAD5E4] bg-[#FAF9F6] p-3">
              <p className="mb-2 text-sm font-medium text-[#5B5B6B]">
                Miembros que aún no han respondido ({pendingMembers.length} / {totalMembers}):
              </p>
              <ul className="flex flex-col gap-2">
                {pendingMembers.map(m => (
                  <li key={m.user_id} className="flex items-center gap-3 text-sm text-[#2E2E3A]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(157,131,198,.2)] font-['Poppins',_Arial,_sans-serif] text-xs font-bold text-[#6f56a0]">
                      {m.profiles?.first_name?.charAt(0) || 'U'}
                    </span>
                    <span>{m.profiles?.first_name && m.profiles?.last_name ? `${m.profiles.first_name} ${m.profiles.last_name}` : 'Usuario sin nombre'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#DAD5E4] pt-4 sm:flex-row sm:justify-end">
          <Btn type="button" variant="ghost" onClick={onClose} disabled={launching} className="justify-center">
            Cancelar
          </Btn>
          <Btn type="button" onClick={() => onConfirm(teamId)} disabled={launching} className="justify-center">
            {launching ? 'Iniciando...' : activeCycleId ? 'Iniciar nueva ronda' : 'Iniciar ahora'}
          </Btn>
        </div>
      </div>
    </InlinePanel>
  );
}
