import '../index.css'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

// Componente separado para el formulario de login
function LoginForm() {
  return (
    <div className="w-full flex justify-center items-center min-h-screen px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
         
          <h1 className="text-4xl font-bold text-[#2E2E3A] mb-3">
            Team<span className="text-[#55C2A2]">Zen</span>
          </h1>
          <p className="text-[#5B5B6B] text-lg">Mide y reduce el burnout en tu equipo</p>
        </div>
        

        <div
          className="bg-white rounded-3xl shadow-2xl p-10 border border-[#DAD5E4]/50 animate-fadein backdrop-blur-sm"
          style={{
            boxShadow: "0 20px 50px 0 rgba(44, 62, 80, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.8)",
            background: "rgba(250, 249, 246, 0.95)",
          }}
        >
          <h2 className="text-2xl font-bold text-[#2E2E3A] mb-8 text-center">
            Inicia sesión o regístrate
          </h2>
          
          <div className="space-y-6">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: "#55C2A2",
                      brandAccent: "#9D83C6",
                      inputBorder: "#DAD5E4",
                      inputLabelText: "#2E2E3A",
                      inputText: "#2E2E3A",
                      inputPlaceholder: "#5B5B6B",
                      messageText: "#5B5B6B",
                      anchorTextColor: "#9D83C6",
                      buttonText: "white",
                      buttonBg: "#55C2A2",
                      buttonBgHover: "#9D83C6",
                    },
                    radii: {
                      input: "1rem",
                      button: "1rem",
                    },
                    fontSizes: {
                      input: "1rem",
                      button: "1rem",
                    },
                    space: {
                      inputPadding: "12px 16px",
                      buttonPadding: "12px 24px",
                    },
                  },
                },
                className: {
                  button: "transition-all duration-300 font-medium shadow-lg hover:shadow-xl",
                  input: "transition-all duration-200 border-2 hover:border-[#55C2A2]/50 focus:border-[#55C2A2]",
                  container: "space-y-4",
                  label: "font-medium",
                  anchor: "text-[#9D83C6] hover:text-[#55C2A2] font-medium transition-colors duration-200 text-sm underline hover:no-underline",
                  divider: "text-[#5B5B6B] text-sm",
                  message: "text-sm text-center p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700",
                },
              }}
              providers={['google']}
              redirectTo={`${window.location.origin}/dashboard`}
              socialLayout="horizontal"
              showLinks={true}
              view="sign_in"
              localization={{
                variables: {
                  sign_up: {
                    email_label: 'Correo electrónico',
                    password_label: 'Contraseña',
                    email_input_placeholder: 'tu@email.com',
                    password_input_placeholder: 'Tu contraseña',
                    button_label: 'Crear cuenta',
                    loading_button_label: 'Creando cuenta...',
                    social_provider_text: 'Continuar con {{provider}}',
                    link_text: '¿Ya tienes cuenta? Inicia sesión aquí',
                    confirmation_text: 'Revisa tu email para confirmar tu cuenta'
                  },
                  sign_in: {
                    email_label: 'Correo electrónico',
                    password_label: 'Contraseña',
                    email_input_placeholder: 'tu@email.com',
                    password_input_placeholder: 'Tu contraseña',
                    button_label: 'Iniciar sesión',
                    loading_button_label: 'Iniciando sesión...',
                    social_provider_text: 'Continuar con {{provider}}',
                    link_text: '¿No tienes cuenta? Crea una aquí'
                  },
                  magic_link: {
                    email_input_label: 'Correo electrónico',
                    email_input_placeholder: 'tu@email.com',
                    button_label: 'Enviar enlace mágico',
                    loading_button_label: 'Enviando enlace...',
                    link_text: 'Enviar un enlace mágico por email',
                    confirmation_text: 'Revisa tu email para el enlace de inicio de sesión'
                  },
                  forgotten_password: {
                    email_label: 'Correo electrónico',
                    password_label: 'Contraseña',
                    email_input_placeholder: 'tu@email.com',
                    button_label: 'Enviar instrucciones',
                    loading_button_label: 'Enviando...',
                    link_text: '¿Olvidaste tu contraseña?',
                    confirmation_text: 'Revisa tu email para las instrucciones de restablecimiento'
                  }
                }
              }}
            />
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-[#5B5B6B] leading-relaxed">
              Al continuar, aceptas nuestros términos de servicio y política de privacidad
            </p>
          </div>
        </div>
      </div>
      <style>
        {`
          .animate-fadein {
            animation: fadein 1s cubic-bezier(.39,.575,.565,1) both;
          }
          @keyframes fadein {
            0% { 
              opacity: 0; 
              transform: translateY(40px) scale(0.95);
            }
            100% { 
              opacity: 1; 
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
}

function FloatingBackButton() {
  return (
    <a
      href="/"
      className="fixed top-8 right-8 z-50 px-6 py-3 rounded-2xl shadow-2xl bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#9D83C6] hover:to-[#55C2A2] text-white font-bold text-base flex items-center gap-3 transition-all duration-500 animate-float backdrop-blur-sm"
      style={{
        boxShadow: "0 15px 35px 0 rgba(44,62,80,0.2), 0 5px 15px 0 rgba(85, 194, 162, 0.4)",
        letterSpacing: "0.02em",
      }}
      aria-label="Volver al landing"
    >
      <svg
        className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      <span>Volver al landing</span>
      <style>
        {`
          .animate-float {
            animation: floatBtn 3s ease-in-out infinite;
          }
          @keyframes floatBtn {
            0%, 100% { 
              transform: translateY(0) scale(1);
            }
            50% { 
              transform: translateY(-8px) scale(1.02);
            }
          }
        `}
      </style>
    </a>
  );
}

export default function LoginPage() {
  const [session, setSession] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      navigate('/dashboard')
    }
  }, [session, navigate])

  if (!session) {
    return (
      <div
        className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(85, 194, 162, 0.15) 0%, rgba(157, 131, 198, 0.15) 50%, rgba(85, 194, 162, 0.1) 100%), url(/img/cloud.jpg)`,
        }}
      >
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-br from-[#55C2A2]/20 to-[#9D83C6]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-br from-[#9D83C6]/15 to-[#55C2A2]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl"></div>
        </div>
        
        <FloatingBackButton />
        <LoginForm />
      </div>
    )
  } else {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FAF9F6] to-white">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-[#55C2A2] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[#5B5B6B] text-lg">Redirigiendo al dashboard...</p>
        </div>
      </div>
    )
  }
}