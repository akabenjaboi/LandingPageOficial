// ===================================================================
// COMPONENTES UI REUTILIZABLES - DESIGN SYSTEM DE TEAMZEN
// ===================================================================
// Este archivo contiene todos los componentes base de la interfaz:
// - Card: Contenedores con bordes redondeados y sombras
// - Button: Botones con variantes y estados
// - Alert: Notificaciones y mensajes
// - Badge: Etiquetas informativas
// - Input: Campos de entrada
// - LoadingSpinner: Indicadores de carga
// Paleta de colores TeamZen aplicada consistentemente
// ===================================================================

import React from 'react';

// ===================================================================
// COMPONENTE CARD - Contenedor base con estilo unificado
// ===================================================================
export function Card({ children, className = "", padding = "p-6", hover = false }) {
  return (
    <div className={`
      bg-[#FAF9F6] rounded-2xl shadow-lg border border-[#DAD5E4] 
      ${padding} ${className}
      ${hover ? 'transition-all duration-300 hover:shadow-2xl hover:scale-105 hover:border-[#55C2A2]' : ''}
    `}>
      {children}
    </div>
  );
}

// ===================================================================
// COMPONENTE BUTTON - Botón reutilizable con múltiples variantes
// ===================================================================
export function Button({ 
  children, 
  variant = "primary", 
  size = "default", 
  disabled = false, 
  loading = false,
  className = "",
  ...props 
}) {
  // Variantes de color y estilo con paleta TeamZen
  const variants = {
    primary: "bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AA690] hover:to-[#8B6FB8] text-white shadow-lg hover:shadow-xl",
    secondary: "bg-[#DAD5E4] hover:bg-gradient-to-r hover:from-[#55C2A2] hover:to-[#9D83C6] text-[#2E2E3A] hover:text-white border border-[#DAD5E4]",
    danger: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg",
    outline: "border-2 border-[#55C2A2] text-[#55C2A2] hover:bg-gradient-to-r hover:from-[#55C2A2] hover:to-[#9D83C6] hover:text-white hover:border-transparent",
    ghost: "text-[#9D83C6] hover:text-[#55C2A2] hover:bg-[#DAD5E4]/30 transition-colors duration-200"
  };

  // Tamaños disponibles
  const sizes = {
    small: "px-4 py-2 text-sm",
    default: "px-6 py-3 text-base",
    large: "px-8 py-4 text-lg"
  };

  return (
    <button
      className={`
        ${variants[variant]} 
        ${sizes[size]} 
        rounded-xl font-semibold transition-all duration-300 
        flex items-center justify-center gap-2
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'hover:transform hover:scale-105'}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      )}
      {children}
    </button>
  );
}

// ===================================================================
// COMPONENTE INPUT - Campo de entrada con label y validación
// ===================================================================
export function Input({ 
  label, 
  error, 
  className = "", 
  required = false,
  ...props 
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="font-semibold text-[#2E2E3A] text-sm">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        className={`
          w-full border rounded-xl px-4 py-3 transition-all duration-200
          bg-[#FAF9F6] text-[#2E2E3A] placeholder-[#5B5B6B]
          focus:outline-none focus:ring-2 focus:ring-[#55C2A2] focus:border-transparent
          focus:bg-white focus:shadow-lg
          ${error ? 'border-red-400 focus:ring-red-400' : 'border-[#DAD5E4] hover:border-[#9D83C6]'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="text-red-500 text-sm font-medium">{error}</span>
      )}
    </div>
  );
}

// ===================================================================
// COMPONENTE ALERT - Notificaciones con diferentes tipos
// ===================================================================
export function Alert({ type = "info", title, children, className = "" }) {
  // Estilos por tipo de alerta con gradientes TeamZen
  const types = {
    success: {
      bg: "bg-gradient-to-r from-[#55C2A2]/10 to-[#55C2A2]/5",
      border: "border-[#55C2A2]/30",
      text: "text-[#2E2E3A]",
      icon: "✓",
      iconColor: "text-[#55C2A2]"
    },
    error: {
      bg: "bg-gradient-to-r from-red-50 to-red-100/50", 
      border: "border-red-200",
      text: "text-red-800",
      icon: "✕",
      iconColor: "text-red-600"
    },
    warning: {
      bg: "bg-gradient-to-r from-yellow-50 to-orange-50/50",
      border: "border-yellow-200", 
      text: "text-yellow-800",
      icon: "⚠",
      iconColor: "text-yellow-600"
    },
    info: {
      bg: "bg-gradient-to-r from-[#9D83C6]/10 to-[#DAD5E4]/20",
      border: "border-[#9D83C6]/30",
      text: "text-[#2E2E3A]",
      icon: "ℹ",
      iconColor: "text-[#9D83C6]"
    }
  };

  const typeStyles = types[type];

  return (
    <div className={`
      ${typeStyles.bg} ${typeStyles.border} ${typeStyles.text}
      border rounded-xl p-4 ${className}
    `}>
      <div className="flex items-start gap-3">
        <span className={`text-lg font-bold ${typeStyles.iconColor}`}>{typeStyles.icon}</span>
        <div className="flex-1">
          {title && <h4 className="font-semibold mb-1 text-[#2E2E3A]">{title}</h4>}
          <div className="text-[#5B5B6B]">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// COMPONENTE BADGE - Etiquetas informativas con colores
// ===================================================================
export function Badge({ children, variant = "default", className = "" }) {
  // Variantes de color para badges con paleta TeamZen
  const variants = {
    default: "bg-[#DAD5E4] text-[#2E2E3A] border border-[#DAD5E4]",
    primary: "bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white shadow-md",
    success: "bg-gradient-to-r from-[#55C2A2]/20 to-[#55C2A2]/10 text-[#2E2E3A] border border-[#55C2A2]/30",
    warning: "bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 border border-yellow-200",
    error: "bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-200",
    info: "bg-gradient-to-r from-[#9D83C6]/20 to-[#DAD5E4]/30 text-[#2E2E3A] border border-[#9D83C6]/30"
  };

  return (
    <span className={`
      ${variants[variant]} 
      px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200
      ${className}
    `}>
      {children}
    </span>
  );
}

// ===================================================================
// COMPONENTE LOADING SPINNER - Indicador de carga con animación
// ===================================================================
export function LoadingSpinner({ size = "default", message, className = "" }) {
  const sizes = {
    small: "w-4 h-4",
    default: "w-8 h-8", 
    large: "w-12 h-12"
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`
        ${sizes[size]} 
        border-3 border-[#DAD5E4] border-t-[#55C2A2] rounded-full animate-spin
      `}></div>
      {message && (
        <p className="text-[#5B5B6B] text-sm font-medium">{message}</p>
      )}
    </div>
  );
}
