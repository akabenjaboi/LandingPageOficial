---
name: TeamZen
description: Plataforma de bienestar laboral y prevención de burnout en equipos, basada en el MBI, con recomendaciones de IA.
colors:
  charcoal: "#2E2E3A"
  lavender: "#DAD5E4"
  mint: "#55C2A2"
  mint-deep: "#4AA690"
  purple: "#9D83C6"
  purple-deep: "#8B6FB8"
  cream: "#FAF9F6"
  gray: "#5B5B6B"
typography:
  display:
    fontFamily: "Roboto, Arial, Helvetica, sans-serif"
    fontSize: "clamp(3rem, 6vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 1.05
  headline:
    fontFamily: "Roboto, Arial, Helvetica, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "Roboto, Arial, Helvetica, sans-serif"
    fontSize: "clamp(1.5rem, 2.5vw, 1.875rem)"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Roboto, Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Roboto, Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "32px"
  2xl: "40px"
spacing:
  sm: "1rem"
  md: "1.5rem"
  lg: "2rem"
  xl: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.mint}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.mint-deep}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.purple}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

# Design System: TeamZen

## Overview

**Creative North Star: "El Jardín Zen"**

TeamZen no se ve como un dashboard corporativo de métricas: se ve como un jardín cultivado para respirar. Las superficies son cálidas y redondeadas, los acentos (mint y púrpura) brillan como resplandor difuso en vez de proyectar sombra dura, y el fondo lleva círculos borrosos flotando como si el sistema mismo estuviera en calma. Es una identidad deliberadamente distinta del "SaaS frío" — sin grises planos, sin ángulos rectos agresivos, sin sombras de tarjeta genéricas — porque el producto mide y trata burnout: la interfaz no puede sentirse como otra fuente de estrés corporativo.

El acento mint (#55C2A2) es el color de la acción y el progreso positivo — botones primarios, CTAs, iconografía activa. El púrpura suave (#9D83C6) es el color de la reflexión — enlaces, estados hover, elementos analíticos e introspectivos. Juntos forman un degradado que aparece en botones primarios, en el resplandor de hover de la navegación, y en el scrollbar — es la firma cromática más reconocible del sistema.

Los componentes deben sentirse suaves en reposo pero con respuesta clara al interactuar: un botón o card no es rígido ni seco, responde con un leve scale-up, un resplandor de sombra teñido, un cambio de borde a mint. La calma no significa inercia — significa que la interfaz responde con confianza, no con fricción.

**Key Characteristics:**
- Esquinas redondeadas en todo, nunca ángulos rectos duros.
- Sombras como resplandor teñido de mint/púrpura, nunca gris plano.
- Un solo color de acción (mint) y un solo color de reflexión (púrpura); no hay un tercer acento.
- Roboto como única familia tipográfica; la jerarquía viene de peso y escala, no de mezclar fuentes.
- Fondo crema con círculos decorativos difuminados — el "jardín" literal detrás del contenido.

**Anti-referencia confirmada:** evitar el look "SaaS corporativo genérico" — grises planos, azules corporativos fríos, sombras `shadow-sm`/`shadow-md` sin tinte, navegación `bg-gray-50`/`text-gray-600`. Varias páginas ya tienen restos de este estilo (ver Do's and Don'ts); son deriva a corregir, no una variante válida del sistema.

## Colors

Paleta de seis tonos: dos acentos (mint de acción, púrpura de reflexión) y cuatro neutros cálidos que nunca caen en gris puro de Tailwind.

### Primary
- **Mint Teal** (`#55C2A2`): acento de acción — botones primarios, CTAs, iconografía activa, indicadores de progreso positivo. Hover profundiza a **Mint Deep** (`#4AA690`).

### Secondary
- **Soft Purple** (`#9D83C6`): acento de reflexión — enlaces, hover states, elementos analíticos/introspectivos (reportes, tendencias). Hover profundiza a **Purple Deep** (`#8B6FB8`).

### Neutral
- **Deep Charcoal** (`#2E2E3A`): texto principal, títulos.
- **Lavender Gray** (`#DAD5E4`): fondos de secciones alternas, bordes de cards/inputs, superficies secundarias.
- **Off-White Cream** (`#FAF9F6`): fondo principal de la aplicación.
- **Slate Gray** (`#5B5B6B`): texto secundario, placeholders.

### Named Rules
**The Tinted Glow Rule.** Toda sombra visible lleva tinte mint/púrpura (`rgba(85,194,162,…)` / `rgba(157,131,198,…)`), incluso cuando es sutil. Una sombra gris plana (`shadow-sm`, `shadow-md` de Tailwind sin modificar) es una desviación a corregir, no una variante válida del sistema.

**The Six-Color Rule.** Solo estos seis tonos son parte de la paleta. El código actual contiene dos acentos fuera de marca que deben reconciliarse, no imitarse: un púrpura secundario `#845EC2` (aparece en checkboxes/iconos de privacidad y estado de burnout) y un mint más claro `#7DDFC7` (aparece en algunos degradados de hover de CTA). Ambos deben migrar a `{colors.purple}` / `{colors.mint}`.

## Typography

**Display Font:** Roboto (con fallback Arial, Helvetica, sans-serif)
**Body Font:** Roboto (misma familia)

**Character:** Una sola familia tipográfica funcional y amigable; la jerarquía se construye enteramente con peso (400/600/700/800) y escala responsiva, no con una segunda fuente display.

### Hierarchy
- **Display** (800, `text-5xl sm:text-6xl md:text-7xl`, leading ajustado): titular hero de la landing. Uso único, solo en `HeroSection`.
- **Headline** (800, `text-3xl sm:text-4xl md:text-5xl`, `tracking-tight`, con `drop-shadow-lg`): títulos de sección de marketing ("Sobre nosotros", "Servicios", "Equipo").
- **Title** (700, `text-2xl sm:text-3xl`): encabezados de página dentro de la app (dashboard, crear/unirse equipo).
- **Body** (400, `text-base`, `leading-relaxed`): párrafos de contenido.
- **Label** (600, `text-sm`): links de navegación, etiquetas de formulario, texto de botón.

### Named Rules
**The Monotonic Scale Rule.** Los pasos responsivos de tamaño de texto solo crecen al ensanchar el viewport (`sm:` → `md:` → `lg:`), nunca encogen y luego vuelven a crecer. `ServiceCard.jsx` viola esta regla hoy (`text-5xl sm:text-4xl md:text-6xl` en su ícono; patrón similar en título y cuerpo) — es la única instancia y debe corregirse a una progresión creciente.

## Layout

Dos ritmos espaciales relacionados pero no idénticos, cada uno consistente puertas adentro:

- **Marketing** (`home`, `HeroSection`, `AboutSection`, `ServicesSection`, `FooterSection`): contenedor `max-w-6xl mx-auto`, ritmo vertical generoso (`my-16` entre secciones), animaciones de entrada al hacer scroll.
- **Shell de la app** (`dashboard`, `reportes`, `crear-equipo`, `unirse-equipo`): contenedor `max-w-7xl mx-auto px-3 sm:px-6 lg:px-8`, header `h-14 sm:h-16`, ritmo vertical `py-4 sm:py-8`. Este es el patrón canónico del shell de la app.

**Breakpoints:** `sm` (640px), `md` (768px), `lg` (1024px). `xl` no se usa en ningún lugar del código.

**Deriva conocida a resolver en el audit responsive:** `evaluaciones.jsx` y `mbi.jsx` no siguen el shell canónico — usan `max-w-6xl`/`max-w-5xl`, `px-4` en vez de `px-3`, `py-8` fijo sin paso responsivo, y header `h-16` fijo sin `sm:`. Además, la mayoría de las páginas de la app saltan de `sm:` directo a `lg:`, dejando el rango tablet (~768–1024px) sin tratamiento dedicado — este documento registra el hecho; la corrección específica es tarea del próximo audit, no de este registro.

## Elevation & Depth

El sistema es de **resplandor teñido**, no de sombra dura gris. La profundidad se transmite con sombras difusas coloreadas con mint/púrpura combinadas con un borde de 1px en lavanda sobre fondo crema — nunca con `box-shadow` gris de Tailwind sin modificar.

### Shadow Vocabulary
- **`shadow-teamzen`** (`0 10px 25px rgba(85,194,162,0.15), 0 4px 10px rgba(157,131,198,0.1)`): estado de reposo de cards y contenedores.
- **`shadow-teamzen-strong`** (`0 25px 50px rgba(85,194,162,0.25), 0 10px 20px rgba(157,131,198,0.15)`): estado hover/elevado de cards, paneles de modal.

### Named Rules
**The Tinted Glow Rule** (ver Colors). Instancias de `shadow-sm`/`shadow-md`/`border-gray-200` sin tinte encontradas en partes más antiguas de `dashboard.jsx` y `reportes.jsx` son deriva heredada, no una variante "silenciosa" intencional.

**Clase rota conocida:** `hover:shadow-teamzen-glow` se usa en `dashboard.jsx`, `reportes.jsx`, `mbi.jsx`, `evaluaciones.jsx` y `ServicesSection.jsx`, pero nunca se define en `tailwind.config.js` — no hace nada. Debe definirse (como una variante aún más intensa de `shadow-teamzen-strong`) o eliminarse de esos usos.

## Shapes

Redondeado por defecto; no existen esquinas rectas en el sistema. Escala de radios: `rounded-lg` (8px, uso menor/heredado), `rounded-xl` (12px, botones/inputs/estándar), `rounded-2xl` (16px, cards principales/modales/nav flotante), `rounded-4xl`/`rounded-5xl` (32px/40px, uso decorativo puntual).

### Named Rules
**The No Sharp Corners Rule.** Todo elemento interactivo o contenedor lleva radio ≥8px. `rounded-xl` es el radio por defecto para botones, inputs y componentes interactivos; `rounded-2xl` es el radio por defecto para cards, paneles de modal y contenedores de nivel superior.

## Components

### Buttons
Botones suaves con degradado mint→púrpura como firma del CTA primario; nunca planos ni rígidos.
- **Shape:** `rounded-xl` (12px) es el estándar.
- **Primary:** degradado `from-[#55C2A2] to-[#9D83C6]`, texto blanco, `font-semibold`, hover degradado más profundo (`from-[#4AA690] to-[#8B6FB8]`) + `scale-105` + sombra que crece de `shadow-lg` a `shadow-xl`.
- **Secondary:** fondo `{colors.lavender}` plano, texto charcoal.
- **Ghost:** transparente, texto púrpura, hover `bg-lavender/30`.
- **Outline:** borde mint de 2px, se rellena de mint al hover.
- **Tamaños:** pequeño (`px-4 py-2 text-sm`), estándar (`px-6 py-3 text-base`), grande (`px-8 py-4 text-lg`).

### Don't (deriva encontrada)
El componente `Button` compartido (`UIComponents.jsx`) solo se reutiliza en dos páginas; cada modal (`CreateTeamModal`, `EditTeamModal`, `TransferLeadershipModal`, `LaunchMBIModal`) construye su propio botón "primary" y su propio botón "cancelar" a mano, y ninguno coincide exactamente (unos usan degradado, otros color plano; unos `rounded-xl`, otros `rounded-lg`; los botones "cancelar" van de la paleta TeamZen a gris genérico de Tailwind según el archivo). Además, dos CTAs (`dashboard.jsx`, `reportes.jsx`) usan un mint fuera de paleta (`#7DDFC7`) en vez de `{colors.mint}`.

### Cards / Containers
- **Corner Style:** `rounded-2xl` (16px) es el estándar.
- **Background:** `{colors.cream}` con borde de 1px `{colors.lavender}`.
- **Shadow Strategy:** `shadow-teamzen` en reposo, `shadow-teamzen-strong` al hover; el borde suele virar a mint al hover.
- **Hover:** leve elevación (`-translate-y` o `scale-105`).
- **Internal Padding:** `p-6` como valor típico; `p-3`/`p-4` en subcards de estadísticas.

### Don't (deriva encontrada)
Convive un segundo idioma de card "genérico" (`bg-white`, `rounded-lg`, `border-gray-200`, `shadow-sm`/`shadow-md`) en partes más antiguas de `dashboard.jsx` y `reportes.jsx` — es la misma deriva heredada de Elevation, y debe migrar al idioma TeamZen descrito arriba.

### Inputs / Fields
- **Style:** fondo `{colors.cream}`, `rounded-xl`, texto charcoal, placeholder en slate gray.
- **Focus:** anillo mint de foco (`focus:ring-2 focus:ring-mint`), fondo pasa a blanco, `focus:shadow-lg`.
- **Error:** borde y anillo rojo (`border-red-400`/`focus:ring-red-400`), mensaje en `text-red-500 text-sm` debajo del campo.

### Don't (deriva encontrada)
Los `textarea` (en `CreateTeamModal`, `EditTeamModal`, `crear-equipo`) no reutilizan el componente `Input` — están a mano con `rounded-lg` (no `rounded-xl`) y un anillo de foco parcial que omite el fondo blanco y la sombra de foco. Los checkboxes de `unirse-equipo.jsx` y las secciones de privacidad/estado de burnout usan el púrpura fuera de marca `#845EC2` en vez de `{colors.purple}`.

### Navigation
- **Marketing (desktop):** pill flotante centrada, fondo `cream/80` con blur, borde lavanda, `rounded-2xl`, `shadow-xl`; el hover de cada link dispara un resplandor en capas mint→púrpura detrás del texto.
- **Marketing (mobile):** barra superior delgada + menú fullscreen con entrada escalonada por ítem.
- **App:** sin un nav único — ver Don't.

### Don't (deriva encontrada)
Existen cinco implementaciones de header distintas para páginas internas (`dashboard`, `reportes`, `evaluaciones`, `mbi`, `crear-equipo`/`unirse-equipo`), cada una con su propio breakpoint de colapso (`md:` vs `lg:`) y dos de ellas (`evaluaciones`, `mbi`) usando gris genérico en vez de la paleta TeamZen. Además existe un `AppNavbar.jsx` completo y bien construido que **no se usa en ningún lugar** — es el candidato natural para consolidar el shell de la app antes de seguir agregando páginas.

## Do's and Don'ts

### Do:
- **Do** usar Roboto en los pesos 400/600/700/800 únicamente — no introducir otra familia tipográfica ni otros pesos.
- **Do** teñir toda sombra con mint/púrpura (The Tinted Glow Rule) — nunca `shadow-sm`/`shadow-md` planos.
- **Do** mantener las escalas tipográficas monótonas entre breakpoints (The Monotonic Scale Rule).
- **Do** reutilizar `Button`, `Card`, `Input` de `UIComponents.jsx` en vez de construir variantes ad hoc por modal o página.
- **Do** mantener esquinas redondeadas en todo: `rounded-xl` para interactivos, `rounded-2xl` para contenedores (The No Sharp Corners Rule).
- **Do** usar únicamente los seis colores de la paleta (The Six-Color Rule).

### Don't:
- **Don't** introducir grises planos de Tailwind (`shadow-sm`, `border-gray-200`, `bg-gray-50`, `text-gray-600/900`) — cada instancia encontrada en el código actual es deriva heredada, no una variante "silenciosa" válida.
- **Don't** usar el púrpura fuera de marca `#845EC2` ni el mint fuera de marca `#7DDFC7` — ambos son deriva de la paleta de seis colores.
- **Don't** referenciar clases de utilidad no definidas como `hover:shadow-teamzen-glow` o las animaciones `animate-fadein`/`animate-fadeout`/`animate-slideup` del menú móvil — si se necesitan, deben definirse en `tailwind.config.js`/`index.css`; si no, eliminar las referencias.
- **Don't** construir un nuevo header de app sin antes consolidar los cinco existentes (o adoptar `AppNavbar.jsx`, que ya existe y no se usa).
- **Don't** detener el tratamiento responsivo en `sm:` y saltar directo a `lg:` — la mayoría de las páginas de la app dejan el rango tablet sin diseño dedicado.
