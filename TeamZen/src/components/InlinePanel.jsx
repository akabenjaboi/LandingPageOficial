// ===================================================================
// INLINE PANEL - Contenedor de expansión en línea (reemplazo de modal)
// ===================================================================
// Usado para flujos rutinarios de creación/edición/configuración que no
// necesitan interrumpir al usuario con un overlay: el panel se expande
// como parte del flujo de la página (dentro de una card o sección),
// nunca flotando por encima del contenido. Las acciones destructivas o
// confirmatorias (expulsar miembro, transferir liderazgo, eliminar
// equipo) siguen usando Modal.jsx a propósito — esa interrupción sí es
// correcta para un "¿estás seguro?".
// ===================================================================

import React, { useRef, useEffect, useId } from 'react';

export default function InlinePanel({
  isOpen,
  title,
  description,
  onClose,
  children,
  tone = 'default', // 'default' | 'mint' | 'purple'
  className = '',
}) {
  const panelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (isOpen && panelRef.current) {
      // Llevar el panel a la vista sin robar el foco de un input dentro de él
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isOpen]);

  const toneBorder = tone === 'mint' ? 'border-[#55C2A2]/40' : tone === 'purple' ? 'border-[#9D83C6]/40' : 'border-[#DAD5E4]';
  const toneBg = tone === 'mint'
    ? 'bg-gradient-to-br from-[#55C2A2]/[0.06] to-[#FAF9F6]'
    : tone === 'purple'
      ? 'bg-gradient-to-br from-[#9D83C6]/[0.06] to-[#FAF9F6]'
      : 'bg-[#FAF9F6]';

  return (
    <div
      ref={panelRef}
      role="region"
      aria-labelledby={title ? titleId : undefined}
      className={`inline-panel-motion grid ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'} transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out ${className}`}
    >
      <div className="overflow-hidden min-h-0">
        <div className={`rounded-2xl border ${toneBorder} ${toneBg} shadow-teamzen p-4 sm:p-6`}>
          {(title || onClose) && (
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                {title && (
                  <h3 id={titleId} className="text-sm sm:text-base font-semibold text-[#2E2E3A]">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs sm:text-sm text-[#5B5B6B] mt-0.5">{description}</p>
                )}
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar panel"
                  className="text-[#5B5B6B] hover:text-[#2E2E3A] transition-colors duration-200 p-1 rounded-lg hover:bg-[#DAD5E4]/30 flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
