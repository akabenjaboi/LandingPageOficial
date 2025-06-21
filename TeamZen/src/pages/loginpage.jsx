import '../index.css'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

// Componente separado para el formulario de login
function LoginForm() {
  return (
    <div className="w-full flex justify-start">
      <div
        className="bg-white rounded-2xl shadow-lg p-8 md:p-12 border border-[#DAD5E4] w-full max-w-lg ml-0 md:ml-16 animate-fadein"
        style={{
          boxShadow: "0 8px 32px 0 rgba(44, 62, 80, 0.10)",
          background: "#FAF9F6",
        }}
      >
        <h2 className="text-2xl font-extrabold text-[#2E2E3A] mb-6 tracking-tight">
          Inicia sesión o regístrate
        </h2>
        <div className="space-y-4">
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
                    buttonText: "#2E2E3A",
                    buttonBg: "#55C2A2",
                    buttonBgHover: "#9D83C6",
                  },
                  radii: {
                    input: "0.75rem",
                    button: "9999px",
                  },
                  fontSizes: {
                    input: "5xlrem",
                    button: "5xlrem",
                  },
                },
              },
            }}
            className="transition-all duration-300"
          />
        </div>
      </div>
      <style>
        {`
          .animate-fadein {
            animation: fadein 0.8s cubic-bezier(.39,.575,.565,1) both;
          }
          @keyframes fadein {
            0% { opacity: 0; transform: translateY(30px);}
            100% { opacity: 1; transform: translateY(0);}
          }
        `}
      </style>
    </div>
  );
}

function FloatingBackButton() {
  return (
    <a
      href="/LandingPageOficial"
      className="fixed top-6 right-6 z-50 px-6 py-3 rounded-full shadow-xl bg-[#55C2A2] hover:bg-[#9D83C6] text-white font-bold text-base flex items-center gap-2 transition-all duration-300 animate-float"
      style={{
        boxShadow: "0 8px 24px 0 rgba(44,62,80,0.15)",
        letterSpacing: "0.02em",
      }}
      aria-label="Volver al landing"
    >
      <svg
        className="w-5 h-5 mr-1"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Volver al landing
      <style>
        {`
          .animate-float {
            animation: floatBtn 2.5s ease-in-out infinite;
          }
          @keyframes floatBtn {
            0%, 100% { transform: translateY(0);}
            50% { transform: translateY(-10px);}
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
      navigate('/LandingPageOficial/dashboard')
    }
  }, [session, navigate])

  if (!session) {
    return (
      <div
        className="min-h-screen flex items-center bg-cover bg-bottom"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}/img/welcomebg.webp)`,
        }}
      >
        <FloatingBackButton />
        <LoginForm />
      </div>
    )
  } else {
    return null // O un loader si prefieres
  }
}