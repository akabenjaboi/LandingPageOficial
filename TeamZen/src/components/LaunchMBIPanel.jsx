// ===================================================================
// PANEL DE LANZAMIENTO DE CICLO MBI (en línea, no modal)
// ===================================================================
// Convertido desde LaunchMBIModal.jsx: lanzar una ronda de evaluación es
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
import React from 'react';
import InlinePanel from './InlinePanel';

export default function LaunchMBIPanel({ isOpen, context, launching, onClose, onConfirm }) {
  if (!context) return null;

  const { teamId, activeCycleId, pendingMembers = [], totalMembers = 0 } = context;

  return (
    <InlinePanel
      isOpen={isOpen}
      onClose={launching ? undefined : onClose}
      title={activeCycleId ? 'Iniciar nuevo ciclo MBI' : 'Lanzar MBI'}
      tone="mint"
    >
      {/* Información sobre duración del ciclo */}
      <div className="mb-4 bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-[#2C7B64] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-[#2E2E3A] mb-1">Duración del ciclo</p>
            <p className="text-sm text-[#5B5B6B]">
              El ciclo se <strong className="text-[#2E2E3A]">cerrará automáticamente después de 7 días</strong> desde su inicio.
              Los miembros que no respondan en este período no podrán participar hasta el próximo ciclo.
            </p>
          </div>
        </div>
      </div>

      {activeCycleId && (
        <div className="mb-4 bg-gradient-to-r from-[#9D83C6]/10 to-[#DAD5E4]/20 border border-[#9D83C6]/30 rounded-xl p-4 text-sm text-[#2E2E3A]">
          Ya existe un ciclo activo. Crear uno nuevo cerrará el ciclo actual y permitirá que todos respondan nuevamente.
        </div>
      )}

      <div className="mb-4">
        <h4 className="text-xs font-medium text-[#5B5B6B] uppercase tracking-wide mb-3">
          Participación actual
        </h4>
        {totalMembers === 0 ? (
          <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl">
            <p className="text-sm text-orange-700">
              Este equipo no tiene miembros aún. Puedes lanzar el MBI de todas formas, pero recuerda invitar miembros para que participen.
            </p>
          </div>
        ) : pendingMembers.length === 0 ? (
          <p className="text-sm text-[#2C7B64] font-medium">Todos los miembros han respondido el ciclo actual.</p>
        ) : (
          <div className="max-h-40 overflow-y-auto border border-[#DAD5E4] rounded-xl p-3 bg-gradient-to-br from-[#FAF9F6] to-[#DAD5E4]/20">
            <p className="text-sm text-[#5B5B6B] mb-2 font-medium">Miembros que aún no han respondido ({pendingMembers.length} / {totalMembers}):</p>
            <ul className="space-y-2">
              {pendingMembers.map(m => (
                <li key={m.user_id} className="text-sm text-[#2E2E3A] flex items-center gap-3">
                  <span className="w-6 h-6 bg-gradient-to-br from-[#9D83C6] to-[#55C2A2] rounded-full flex items-center justify-center text-xs font-medium text-white">
                    {m.profiles?.first_name?.charAt(0) || 'U'}
                  </span>
                  <span>{m.profiles?.first_name && m.profiles?.last_name ? `${m.profiles.first_name} ${m.profiles.last_name}` : 'Usuario sin nombre'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-[#DAD5E4]">
        <button
          onClick={onClose}
          className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-[#5B5B6B] hover:text-[#2E2E3A] transition-colors duration-200 rounded-xl hover:bg-[#DAD5E4]/30"
          disabled={launching}
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(teamId)}
          disabled={launching}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AA690] hover:to-[#8B6FB8] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center"
        >
          {launching ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Lanzando...
            </span>
          ) : (activeCycleId ? 'Crear nuevo ciclo' : 'Lanzar ahora')}
        </button>
      </div>
    </InlinePanel>
  );
}
