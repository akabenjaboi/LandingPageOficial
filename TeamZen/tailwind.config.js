/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta de colores TeamZen
        teamzen: {
          'charcoal': '#2E2E3A',      // Deep Charcoal - Texto principal, títulos
          'lavender': '#DAD5E4',      // Lavender Gray - Fondo secciones alternas, botones
          'mint': '#55C2A2',          // Mint Teal - Botones primarios, íconos
          'purple': '#9D83C6',        // Soft Purple - Enlaces, hover, elementos sutiles
          'cream': '#FAF9F6',         // Off White / Cream - Fondo principal
          'gray': '#5B5B6B',          // Textos secundarios
        }
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out',
        'slide-in-left': 'slideInFromLeft 0.6s ease-out',
        'slide-in-right': 'slideInFromRight 0.6s ease-out',
        'scale-in': 'scaleIn 0.5s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s infinite',
        'modal-enter': 'modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'modal-exit': 'modalSlideDown 0.2s ease-in-out',
        'gentle-rotate': 'gentleRotate 20s linear infinite',
        'glow-teamzen': 'glowTeamzen 3s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInFromLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInFromRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(85, 194, 162, 0.7)' },
          '50%': { boxShadow: '0 0 0 10px rgba(85, 194, 162, 0)' },
        },
        modalSlideUp: {
          '0%': { opacity: '0', transform: 'scale(0.9) translateY(20px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        modalSlideDown: {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.9) translateY(20px)' },
        },
        gentleRotate: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        glowTeamzen: {
          '0%, 100%': { 
            boxShadow: '0 0 5px rgba(85, 194, 162, 0.3), 0 0 10px rgba(157, 131, 198, 0.2)' 
          },
          '50%': { 
            boxShadow: '0 0 20px rgba(85, 194, 162, 0.6), 0 0 30px rgba(157, 131, 198, 0.4)' 
          },
        },
      },
      boxShadow: {
        'teamzen': '0 10px 25px rgba(85, 194, 162, 0.15), 0 4px 10px rgba(157, 131, 198, 0.1)',
        'teamzen-strong': '0 25px 50px rgba(85, 194, 162, 0.25), 0 10px 20px rgba(157, 131, 198, 0.15)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      fontSize: {
        'xxs': '0.625rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      transitionTimingFunction: {
        'teamzen': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-in': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
