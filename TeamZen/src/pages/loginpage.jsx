import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

const authInputCls =
  'transition-all duration-200 border hover:border-[#55C2A2]/60 focus:border-[#55C2A2]'

function LoginForm() {
  return (
    <div className="relative flex w-full max-w-[430px] flex-col items-center gap-[22px]">
      <div className="flex flex-col items-center gap-3 text-center">
        <img
          src="/img/pandazen_favicon.png"
          alt=""
          className="h-[72px] w-[72px] rounded-3xl object-cover shadow-[0_16px_30px_rgba(157,131,198,.22)]"
        />
        <h1 className="font-['Poppins',_Arial,_sans-serif] text-[34px] font-bold tracking-[-.02em] text-[#2E2E3A]">TeamZen</h1>
        <p className="text-base text-[#5B5B6B]">Mide y reduce el burnout en tu equipo</p>
      </div>

      <div className="flex w-full flex-col gap-[18px] rounded-3xl border border-[#DAD5E4] bg-white p-7 shadow-[0_25px_50px_rgba(85,194,162,.18),0_10px_20px_rgba(157,131,198,.12)]">
        <h2 className="text-center font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">
          Inicia sesión o regístrate
        </h2>

        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#55C2A2',
                  brandAccent: '#9D83C6',
                  inputBackground: '#FAF9F6',
                  inputBorder: '#DAD5E4',
                  inputBorderFocus: '#55C2A2',
                  inputBorderHover: '#9D83C6',
                  inputLabelText: '#2E2E3A',
                  inputText: '#2E2E3A',
                  inputPlaceholder: '#5B5B6B',
                  messageText: '#5B5B6B',
                  anchorTextColor: '#8B6FB8',
                  buttonText: 'white',
                  buttonBg: '#55C2A2',
                  buttonBgHover: '#9D83C6',
                },
                radii: {
                  input: '12px',
                  button: '12px',
                },
                fontSizes: {
                  input: '15px',
                  button: '16px',
                },
                fonts: {
                  bodyFontFamily: "'Lato', Arial, Helvetica, sans-serif",
                  buttonFontFamily: "'Poppins', Arial, sans-serif",
                  inputFontFamily: "'Lato', Arial, Helvetica, sans-serif",
                  labelFontFamily: "'Poppins', Arial, sans-serif",
                },
                space: {
                  inputPadding: '13px 16px',
                  buttonPadding: '15px',
                },
              },
            },
            className: {
              button: 'font-semibold transition hover:scale-[1.02]',
              input: authInputCls,
              container: 'space-y-4',
              label: 'font-semibold',
              anchor: 'font-semibold hover:text-[#9D83C6] transition-colors text-sm',
              divider: 'text-[#5B5B6B] text-sm',
              message: 'text-sm text-center p-3 rounded-xl bg-[rgba(157,131,198,.1)] border border-[rgba(157,131,198,.3)] text-[#2E2E3A]',
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
                email_input_placeholder: 'tu@empresa.cl',
                password_input_placeholder: 'Tu contraseña',
                button_label: 'Crear cuenta',
                loading_button_label: 'Creando cuenta...',
                social_provider_text: 'Continuar con {{provider}}',
                link_text: '¿No tienes cuenta? Crea una aquí',
                confirmation_text: 'Revisa tu email para confirmar tu cuenta',
              },
              sign_in: {
                email_label: 'Correo electrónico',
                password_label: 'Contraseña',
                email_input_placeholder: 'tu@empresa.cl',
                password_input_placeholder: 'Tu contraseña',
                button_label: 'Iniciar sesión',
                loading_button_label: 'Iniciando sesión...',
                social_provider_text: 'Continuar con {{provider}}',
                link_text: '¿Ya tienes una cuenta? Inicia sesión aquí',
              },
              magic_link: {
                email_input_label: 'Correo electrónico',
                email_input_placeholder: 'tu@empresa.cl',
                button_label: 'Enviar enlace mágico',
                loading_button_label: 'Enviando enlace...',
                link_text: 'Enviar un enlace mágico por email',
                confirmation_text: 'Revisa tu email para el enlace de inicio de sesión',
              },
              forgotten_password: {
                email_label: 'Correo electrónico',
                password_label: 'Contraseña',
                email_input_placeholder: 'tu@empresa.cl',
                button_label: 'Enviar instrucciones',
                loading_button_label: 'Enviando...',
                link_text: '¿Olvidaste tu contraseña?',
                confirmation_text: 'Revisa tu email para las instrucciones de restablecimiento',
              },
            },
          }}
        />
      </div>

      <p className="max-w-[34em] text-center text-[13px] text-[#5B5B6B]">
        Al continuar, aceptas nuestros términos de servicio y política de privacidad.
      </p>
    </div>
  )
}

function FloatingBackButton() {
  return (
    <a
      href="/"
      className="absolute left-[22px] top-[22px] z-10 rounded-xl border border-[#DAD5E4] bg-[#FAF9F6]/90 px-4 py-2.5 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#5B5B6B] shadow-teamzen transition-colors hover:border-[#9D83C6] hover:text-[#8B6FB8]"
      aria-label="Volver al landing"
    >
      ← Volver al landing
    </a>
  )
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

  if (session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#55C2A2] border-t-transparent"></div>
          <p className="text-lg text-[#5B5B6B]">Redirigiendo al dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FAF9F6] px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[120px] -top-[140px] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(85,194,162,.22),rgba(85,194,162,0)_70%)] blur-[20px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[160px] -right-[140px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(157,131,198,.2),rgba(157,131,198,0)_70%)] blur-[20px]"
      />

      <FloatingBackButton />
      <LoginForm />
    </div>
  )
}
