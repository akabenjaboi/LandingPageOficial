// ===================================================================
// COMPONENTE MODAL - Modal reutilizable con overlay y gestión de estado
// ===================================================================
// Modal base que maneja:
// - Overlay con fondo semitransparente
// - Cierre con ESC o click fuera
// - Prevención de scroll del body
// - Animaciones de entrada/salida
// - Accesibilidad (ARIA)
// ===================================================================

import React, { useEffect } from 'react';

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = "max-w-lg",
  preventCloseOnOutsideClick = false 
}) {
  // ===================================================================
  // GESTIÓN DE EVENTOS Y ACCESIBILIDAD
  // ===================================================================
  
  // Cerrar modal con ESC y gestionar scroll del body
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevenir scroll del body cuando modal está abierto
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // No renderizar si el modal está cerrado
  if (!isOpen) return null;

  // ===================================================================
  // HANDLERS DE INTERACCIÓN
  // ===================================================================
  
  const handleBackdropClick = (e) => {
    // Cerrar solo si se hace click en el backdrop (no en el contenido)
    if (e.target === e.currentTarget && !preventCloseOnOutsideClick) {
      onClose();
    }
  };

  // ===================================================================
  // RENDERIZADO DEL MODAL
  // ===================================================================
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" 
      role="dialog" 
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className={`bg-white rounded-lg shadow-xl ${maxWidth} w-full max-h-[90vh] overflow-y-auto`}>
        {/* Header del modal */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido del modal */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
