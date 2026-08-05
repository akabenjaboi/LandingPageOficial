# TeamZen — Especificación funcional de pantallas

<!-- Documento de referencia de contenido y función, no de diseño visual.
Objetivo: que sirva de base para maquetar distintas disposiciones de
los mismos elementos, sin heredar el layout actual. No describe
colores, tipografía ni espaciado — eso vive en DESIGN.md. -->

Este documento describe, pantalla por pantalla, **qué elementos existen y qué hacen** — no cómo se ven ni cómo están distribuidos hoy. La idea es que sirva de checklist de contenido al maquetar layouts alternativos: cualquier disposición nueva debe seguir dando lugar a cada elemento y función listados acá (salvo que se decida deliberadamente eliminar o rediseñar esa función).

Reconstruido leyendo el código actual (rama `redesign-reconciled`), no la documentación de diseño previa.

---

## 0. Roles y navegación compartida

TeamZen tiene dos roles de perfil: **líder** (`profile.role === "leader"`) y **miembro** (`profile.role === "user"`). El rol es una propiedad guardada del perfil, no una propiedad calculada — un usuario que dejó de liderar cualquier equipo sigue viendo la experiencia de "líder" hasta que alguien cambie ese campo. Un líder también puede unirse a otros equipos como miembro; los dos roles no son excluyentes en cuanto a qué equipos integra una persona.

### Barra de navegación de la app (todas las pantallas autenticadas excepto Login)

Elemento compartido, no específico de una pantalla.

- **Logo + wordmark "TeamZen"** — lleva a `/dashboard`.
- **Links de navegación** (ocultos en mobile, visibles desde tablet/desktop): Dashboard, Evaluaciones, Reportes. El link activo se resalta según la ruta actual.
- **Texto de bienvenida** (oculto en mobile): "Bienvenido," + nombre completo del perfil, o el email si el perfil no tiene nombre cargado.
- **Botón de perfil (avatar circular)**: muestra la inicial del nombre (o del email). Al hacer clic abre/cierra un menú desplegable; se cierra solo al hacer clic afuera.
  - **Contenido del menú**: nombre completo + email, badge de rol ("Líder de Equipo" / "Miembro de Equipo"), botón **"Editar perfil"** (abre el modal de perfil) y botón **"Cerrar sesión"** (cierra sesión y navega a `/login`).
- **Barra de navegación inferior en mobile** (reemplaza a los links de arriba por debajo del breakpoint tablet): mismos 3 destinos (Dashboard, Evaluaciones, Reportes) como íconos + etiqueta, con indicación de cuál está activo.

### Modal de perfil (compartido, se abre desde el avatar o automáticamente en el primer login)

Se dispara automáticamente si no existe un registro de perfil para el usuario. Campos:

| Campo | Tipo | Notas |
|---|---|---|
| Nombre* | texto | requerido |
| Apellido* | texto | requerido |
| "¿Vas a crear y liderar equipos?"* | selector (líder / miembro) | define `profile.role`; una vez que es "líder" queda bloqueado (no se puede revertir a "miembro"), pero sí se puede pasar de "miembro" a "líder" más adelante |
| Fecha de nacimiento* | fecha | requerido |
| Tipo de empleo* | selector (Tiempo completo / Medio tiempo) | requerido |
| Cargo/Puesto* | texto | requerido |
| Fecha de inicio en el cargo* | fecha | requerido |
| Descripción del trabajo | textarea, máx. 500 caracteres, contador en vivo | opcional |

Al guardar: crea o actualiza el registro de perfil. Si era un perfil nuevo, la página se recarga para volver a cargar el flujo inicial con el rol recién definido.

---

## 1. Login

**Propósito**: único punto de entrada para iniciar sesión o crear cuenta. Si ya existe una sesión válida, el usuario nunca ve el formulario — se redirige directo al dashboard (con un estado intermedio breve de "Redirigiendo al dashboard...").

**Elementos:**

- **Marca**: wordmark "TeamZen" + tagline "Mide y reduce el burnout en tu equipo".
- **Encabezado del panel de auth**: "Inicia sesión o regístrate".
- **Widget de autenticación** (componente de Supabase Auth UI, con textos localizados al español):
  - Email + contraseña (método principal), con vista de inicio de sesión y vista de registro (toggle entre ambas).
  - Login con **Google** (único proveedor OAuth habilitado).
  - Flujo de "olvidé mi contraseña" (pide email, envía instrucciones).
  - *Nota funcional*: la vista de "magic link" está localizada en el widget pero no está conectada/alcanzable en la configuración actual — ningún link la expone. Es un cabo suelto a resolver (conectarla o quitar esos textos).
  - Links para alternar entre "¿No tienes cuenta? Crea una aquí" / "¿Ya tienes una cuenta? Inicia sesión aquí".
- **Texto legal estático**: "Al continuar, aceptas nuestros términos de servicio y política de privacidad" — es solo texto informativo, no hay checkbox ni links funcionando hoy.
- **Botón flotante "Volver al landing"**: siempre visible, lleva a la página de marketing (`/`), no al dashboard.

**Después de un login/registro exitoso**: redirección a `/dashboard`.

---

## 2. Dashboard

**Propósito**: pantalla principal después de loguearse. Vista completamente distinta según el rol.

### 2.1 Encabezado de página

- **Título**: "Panel de Líder" (si `role === "leader"`) o "Mis Equipos" (si no).
- **Subtítulo**: "Gestiona tus equipos y monitorea el bienestar" (líder) / "Visualiza los equipos de los que formas parte" (miembro).
- **Botón "Crear Equipo"**: solo para líderes. Abre el panel inline de creación de equipo (no navega a otra página).
- **Botón "Unirse a Equipo"**: para todos (incluidos líderes). Navega a `/unirse-equipo`.
- **Banner de perfil incompleto**: aparece si falta nombre o apellido en el perfil. Solo texto instructivo — la acción real está en el avatar del navbar, no en el banner.

### 2.2 Sección "Requiere tu atención"

Lista calculada (no es una tabla propia; se arma a partir de datos ya cargados para otros fines). Si no hay ítems, se muestra un banner de éxito "Todo al día". Cada ítem tiene un tono (mint = acción operativa disponible ahora; púrpura = hallazgo analítico).

Condiciones que generan un ítem (evaluadas por equipo):

- **Respuestas pendientes en la ronda activa**: "{equipo}: {N} de {total} aún no han respondido la ronda activa" → CTA "Ver equipo" (hace scroll a la tarjeta del equipo).
- **Sin ronda activa** (equipo con miembros pero sin ciclo activo): "{equipo} no tiene una ronda de evaluación activa" → CTA "Iniciar MBI" (abre el panel de lanzamiento para ese equipo).
- **Bienestar bajo** (promedio &lt;50/100 en la ronda activa): "{equipo}: bienestar promedio bajo ({avg}/100)" → CTA "Ver reporte" (navega a `/reportes?team={id}`).
- **Código de invitación vencido**: "{equipo}: el código de invitación expiró" → CTA "Regenerar código" (regenera el código sin pedir confirmación, ya que el problema ya está detectado).
- **Evaluación propia pendiente** (para equipos donde el usuario es miembro): "Tienes una evaluación MBI pendiente en '{equipo}'" → CTA "Completar MBI" (navega a `/mbi?team={id}`).

### 2.3 Tarjeta de equipo — vista líder

**Datos mostrados:**
- Avatar con inicial + nombre del equipo (truncado) + "Creado el {fecha}".
- Badge "Líder" (siempre) y badge "Líder excluido" (solo si `include_leader_in_metrics === false`, con tooltip explicando que el líder no cuenta en las métricas).
- **Stat "Miembros"**: cantidad total de participantes (miembros + el líder, salvo que esté excluido).
- **Stat "Ronda"**: "Activo" o "Sin ronda" según si hay un ciclo MBI activo.
- **Stat "Participación"**: % de respondidos vs. total, con barra de progreso (colores por umbral 80%/50%) y leyenda "{respondidos} / {total}". Muestra "—" si no hay ronda activa.
- **Stat "Bienestar"**: índice 0-100 calculado (normaliza/invierte AE y D, normaliza RP, promedia), con barra de progreso y "{n} resp.". Muestra "—" si no hay ronda activa o respuestas puntuadas.
- **Bloque de código de invitación**: código enmascarado por defecto, botón "Mostrar/Ocultar" para revelarlo. Muestra "Sin código" si no existe. Si el código venció, muestra un aviso rojo "Expirado — genera uno nuevo" en vez de la fecha de expiración.
- **Lista de miembros expandible** (botón chevron): al expandir, muestra cada miembro con avatar, nombre (o "Usuario sin nombre"), etiqueta de rol, y — si hay ronda activa — badge "Respondió"/"Pendiente" (o "Sin ronda" si no la hay).

**Acciones disponibles:**
- **Copiar código de invitación** (al portapapeles, confirmación transitoria "Copiado").
- **Regenerar código** (confirmación nativa antes de invalidar el código actual).
- **Menú de opciones (⋮)**: "Editar equipo" (abre panel de edición inline dentro de la misma tarjeta), "Transferir liderazgo" (abre modal, ver 2.6), "Eliminar equipo" (confirmación nativa, borrado irreversible).
- **Expandir/colapsar miembros** (solo UI, no cambia datos).
- **Expulsar miembro** (ícono X en cada fila del listado expandido, excepto la del propio líder): confirmación nativa, elimina la membresía (el historial de evaluaciones de esa persona se conserva).
- **Botón principal de ronda** (mutuamente excluyente):
  - Sin ronda activa: **"Iniciar ronda"** → abre el panel de lanzamiento inline (ver 2.5) para confirmar antes de arrancar nada.
  - Con ronda activa: **"Terminar ronda"** (rojo, sin confirmación) → cierra el ciclo activo inmediatamente.
  - Pill informativo junto al botón (solo desktop): "Todos respondieron" o "Ronda activa" — no es clickeable.
- **"Generar Reporte"**: navega a `/reportes?team={id}`.

### 2.4 Tarjeta de equipo — vista miembro

Más simple, sin controles de gestión del equipo:

- Avatar + nombre del equipo + leyenda estática "Miembro desde que te uniste al equipo".
- Badge "Miembro".
- **Stat "Miembros"**: cantidad total real (la privacidad solo afecta el listado expandido, no este número).
- **Stat "Ronda"**: "Activo"/"Sin ronda".
- **Banner de estado propio** (solo con ronda activa): "Ya respondiste este ciclo" o "Evaluación pendiente".
- **Lista de miembros expandible**, sujeta a las reglas de privacidad (ver 2.7): marca "(Tú)" y "(Líder)" en las filas correspondientes.
- **Menú de opciones (⋮)**: "Configurar privacidad" (abre modal personal, ver abajo) y "Salir del equipo" (modal de confirmación, borrado irreversible de la propia membresía).
- **Botón principal** (mutuamente excluyente): pill no-clickeable "Sin ronda activa" / pill no-clickeable "Respondido" / botón clickeable **"Completar MBI"** → navega a `/mbi?team={id}`.
- **"Ver Historial"**: botón presente pero sin acción implementada todavía (cabo suelto a resolver).

**Modal "Configurar privacidad" (personal, por miembro)**: un único checkbox — **"Compartir mis resultados de evaluación con el líder"** (`share_results_with_leader`). También muestra, solo de lectura, las dos configuraciones de privacidad que controla el líder a nivel de equipo (no editables desde acá).

**Modal "Salir del equipo"**: confirmación de que la salida es irreversible y hace perder acceso a los datos del equipo.

### 2.5 Panel inline "Iniciar ronda" (Launch MBI)

Se abre dentro de la tarjeta del equipo que lo dispara (no es un modal flotante).

- Info: la ronda se cierra automáticamente a los 7 días; quienes no respondan en ese período quedan fuera hasta la próxima ronda.
- Si ya hay una ronda activa: aviso de que iniciar una nueva cierra la actual y resetea la participación (todos, incluso quienes ya respondieron, pueden volver a responder).
- Vista previa de participación (tres estados posibles): equipo sin miembros (aviso) / todos ya respondieron (mensaje) / lista scrolleable de quienes faltan responder, con "{pendientes} / {total}".
- Botones: "Cancelar" y "Iniciar ahora" / "Iniciar nueva ronda" (según haya o no ronda activa ya).

### 2.6 Modal "Transferir liderazgo"

Modal flotante real (no inline), abierto desde el menú de opciones de la tarjeta líder.

- Lista de radio buttons con los miembros actuales del equipo (nombre completo o "Usuario sin nombre"); mensaje aparte si no hay otros miembros.
- Botón "Transferir liderazgo" deshabilitado hasta elegir a alguien; confirmación nativa antes de ejecutar.
- Al confirmar: transfiere el liderazgo vía función del servidor y **recarga la página completa** (porque el rol del usuario actual respecto a ese equipo cambió).

### 2.7 Reglas de privacidad (funcionales, no de estilo)

Tres configuraciones independientes:

1. **`members_can_see_others`** (nivel equipo, default true): si es falso, el listado expandido de un miembro solo se muestra a sí mismo, con la nota "Solo puedes verte a ti mismo". No afecta la vista del líder, que siempre ve el roster completo.
2. **`members_can_see_responses`** (nivel equipo): controla si un miembro ve el badge "Respondió/Pendiente" de sus compañeros. Si es falso, cada quien ve su propio estado ("Respondiste"/"Pendiente") pero el de los demás aparece como "Privado". No afecta la vista del líder.
3. **`share_results_with_leader`** (nivel individual, configurado por cada miembro en su propio modal de privacidad): controla si el líder puede ver los resultados/puntajes individuales de esa persona en Reportes (ver 5.8). Es independiente de las dos anteriores.
4. **`include_leader_in_metrics`** (nivel equipo): no es una regla de "quién ve qué", sino de qué cuenta en las métricas — excluye o incluye al líder del total de participantes, % de participación y promedio de bienestar.

### 2.8 Estados vacíos / carga / error

- **Usuario nuevo sin perfil ni equipos**: pantalla de bienvenida centrada (logo, texto explicativo, botón "Configurar mi perfil").
- **Líder sin equipos creados**: tarjeta vacía dedicada con botón "Crear mi primer equipo".
- **Miembro sin equipos**: tarjeta vacía dedicada con botón "Unirse a un equipo".
- **Carga inicial**: spinner de página completa "Cargando tu dashboard...". Cargas parciales: "Cargando tus equipos...", "Cargando miembros...".
- **Error general**: banner rojo "Error al cargar datos" (no bloquea lo que sí cargó bien).

---

## 3. Evaluaciones

**Propósito**: para líderes, lanzar rondas MBI en sus equipos; para todos, ver el propio historial de respuestas MBI.

### 3.1 Encabezado

- Título único: "Evaluaciones" (no cambia por rol). Banners transitorios de error/éxito según corresponda.

### 3.2 Sección "Iniciar ronda MBI en un equipo" (solo líderes)

- Nota informativa fija sobre la duración de 7 días de las rondas.
- Estado vacío: "No tienes equipos. Crea uno primero."
- **Una tarjeta por equipo del líder**, cada una con:
  - Nombre del equipo.
  - Botón principal cuyo label indica el estado: "Iniciar ronda MBI" (sin ronda activa) o "Nueva ronda MBI" (con ronda activa) — el estado se comunica a través del label, no de un badge separado.
  - Link secundario **"Responder como líder"**: lleva directo al cuestionario MBI ya preseleccionado para ese equipo.
- Al hacer clic en el botón principal se abre el mismo panel inline "Iniciar ronda" descrito en 2.5 (mismo componente reutilizado).

### 3.3 Sección "Mi historial MBI" (todos los roles, incluidos líderes viendo su propio historial personal)

- Estado vacío: "Aún no has enviado respuestas MBI."
- **Lista de respuestas pasadas** (más reciente primero), cada una con:
  - Fecha/hora de envío.
  - Equipo asociado (o "Individual" si no fue para un equipo).
  - Badge de estado general (ver tabla de clasificación abajo), si se puede calcular.
  - Tres chips numéricos: "AE {puntaje} · {categoría}", "D {puntaje} · {categoría}", "RP {puntaje} · {categoría}".
- Nota explicativa fija al pie sobre cómo se calculan las categorías y el estado general.
- Botón **"Responder MBI"**: navega al cuestionario personal (sin equipo asociado).

### 3.4 Tabla de clasificación (regla funcional, no visual)

| Subescala | Rango | Bajo | Medio | Alto |
|---|---|---|---|---|
| AE (Agotamiento Emocional) | 0–54 | 0–18 | 19–26 | 27–54 |
| D (Despersonalización) | 0–30 | 0–6 | 7–9 | 10–30 |
| RP (Realización Personal) | 0–48 | 40–48 (bajo riesgo) | 34–39 | 0–33 (alto riesgo) |

Nota: en RP la relación es inversa — un puntaje **alto** de RP es bueno (bajo riesgo).

**Estado general derivado** de las tres categorías:
- **Burnout**: las tres subescalas en "Alto".
- **Riesgo Alto**: dos subescalas en "Alto".
- **Riesgo**: una subescala en "Alto".
- **Sin indicios**: ninguna en "Alto".
- Sin badge si falta algún puntaje.

---

## 4. MBI (Cuestionario, 22 ítems)

**Propósito**: formulario de respuesta del inventario. Puede abrirse en contexto de un equipo (`?team=`) o de forma personal (sin equipo).

### 4.1 Encabezado

- Título fijo: "Cuestionario MBI (22 ítems)".
- **Indicador de progreso** junto al título: % de preguntas respondidas sobre 22, en vivo.
- Línea de instrucción sobre responder según la experiencia reciente.

### 4.2 Escala de respuesta (igual para las 22 preguntas)

| Valor | Etiqueta |
|---|---|
| 0 | Nunca |
| 1 | Pocas veces al año |
| 2 | Una vez al mes o menos |
| 3 | Pocas veces al mes |
| 4 | Una vez a la semana |
| 5 | Pocas veces a la semana |
| 6 | Todos los días |

Selección única por pregunta.

### 4.3 Organización de las preguntas

Lista plana de las 22 preguntas en un orden fijo (no agrupadas visualmente por subescala), pero cada pregunta muestra debajo de su texto a qué subescala pertenece (AE, D o RP) — 9 ítems AE, 5 D, 8 RP. Sin pestañas, sin paginación.

### 4.4 Guardado de borrador (regla funcional importante)

- Autoguardado continuo en almacenamiento local del navegador mientras se responde (no requiere acción explícita).
- **Aislamiento del borrador**: la clave de guardado combina usuario + equipo + ronda específica (si es en contexto de equipo) o usuario + "personal" (si no lo es) — así un borrador nunca se mezcla entre usuarios en un dispositivo compartido, entre equipos, ni entre rondas distintas del mismo equipo. Si la ronda se cierra y empieza una nueva, el borrador viejo deja de aplicar.
- Se borra automáticamente al enviar con éxito.

### 4.5 Envío

- Botón "Enviar respuestas" deshabilitado hasta que las 22 preguntas tengan respuesta (y mientras se envía, o si no hay ronda activa, o si ya se respondió esta ronda).
- Revalida en el servidor, justo antes de insertar, que la ronda siga activa y que no se haya respondido ya (defensivo ante cambios de estado entre que se cargó la página y se envió).
- Éxito: guarda las 22 respuestas + los 3 totales de subescala, borra el borrador, muestra mensaje de agradecimiento y redirige al dashboard.
- Error: mensaje inline, el formulario queda editable/reenviable.

### 4.6 Estados especiales

- **"Ya respondiste esta evaluación"**: si ya existe una respuesta del usuario para la ronda activa actual, el formulario se bloquea por completo (todas las opciones deshabilitadas) y el botón de envío se reemplaza por un estado fijo "Ya enviado".
- **"No hay ronda activa"**: si se abre en contexto de equipo y ese equipo no tiene ronda activa, aviso + formulario completamente deshabilitado. No aplica al modo personal (siempre respondible).
- Botón secundario **"Guardar borrador y salir"**: en la práctica solo navega de vuelta al dashboard (el guardado ya es continuo).

---

## 5. Reportes

**Propósito**: pantalla de análisis. Vista completamente distinta según rol — líder ve reportes agregados por equipo; miembro ve su propio historial personal con análisis de IA.

### 5.1 Encabezado

**Vista líder:**
- Título "Reportes estratégicos", subtítulo sobre tendencias por ronda.
- **Selector de equipo** (dropdown, solo si el líder tiene ≥1 equipo): cambia el equipo activo y re-dispara todas las cargas de datos de la pantalla. Puede prefijarse vía `?team=` en la URL.

**Vista miembro:**
- Título "Mi Análisis Personal de Bienestar" (sin selector, es siempre sobre uno mismo).

### 5.2 Resumen de rondas (solo líder)

- Sección "Análisis de evaluaciones".
- Botón **"Refrescar"**: recarga rondas/agregados/miembros del equipo activo.
- **Panel de ayuda colapsable** ("¿Qué son las rondas y las dimensiones del MBI?"): contenido puramente explicativo (qué es una ronda, qué mide cada dimensión, escalas oficiales, cómo se calcula el índice de bienestar 0-100). No es un elemento de datos, es documentación in-app.

### 5.3 Tabla de historial MBI (solo líder)

Una fila por ronda del equipo activo (más reciente primero). Todos los datos vienen de una función agregada del backend, **nunca calculados en el cliente desde respuestas individuales** (salvaguarda de privacidad deliberada).

Columnas: Inicio/Fin/Duración (+ estado "En curso"/"Completado"/"Cerrado anticipadamente"), Resp. (cantidad de respondientes), AE promedio, D promedio, RP promedio, Bienestar (barra + valor 0-100), Estado dominante (oculto en mobile), Distribución de estados (oculto en mobile/tablet, solo desktop). Filas no clickeables — es de solo lectura, sin drill-down.

### 5.4 Gráfico de tendencia

Gráfico de líneas (SVG) con hasta 4 series: AE (↓ mejor), D (↓ mejor), RP (↑ mejor), Bienestar (↑ mejor). Eje X = rondas en orden cronológico (más antigua a más reciente); eje Y se autoajusta según las series visibles. **Leyenda con 4 chips toggle** (mostrar/ocultar cada serie, todas activas por defecto) — es el único control interactivo, no hay zoom ni tooltip por punto. Si hay menos de 2 rondas con datos, se reemplaza por un mensaje pidiendo al menos 2 rondas.

Nota: esta vista de tendencia siempre es a nivel equipo — no existe un gráfico de tendencia personal equivalente para un miembro individual (su historial se presenta en texto, ver 5.7).

### 5.5 Panel de sugerencias de IA (solo líder)

Se genera automáticamente apenas hay datos de al menos una ronda (no requiere clic manual, aunque también puede regenerarse a mano).

- **Toggle de modo**: "Local" (heurística instantánea, sin red, siempre disponible como respaldo) vs. "IA + Tendencias" (llamada a un modelo externo con timeout de 15s; si falla, cae automáticamente a Local con aviso).
- **Botón de regenerar** (🔄): fuerza una nueva llamada de IA ignorando el caché (solo visible en modo IA).
- **Contenido mostrado**: resumen (1-2 líneas de la clasificación actual + tendencia vs. ronda anterior), análisis de tendencia (solo modo IA, solo con historial), lista de "Riesgos identificados" (máx. 4), lista de "Acciones recomendadas" (máx. 6 — estas son las que alimentan el seguimiento de acciones, ver 5.6), pronóstico a corto plazo (solo modo IA, solo con historial).
- **Indicador de origen**: "Desde caché" (con fecha) o "Recién generado" — visible, no decorativo.
- **Regla de caché**: el resultado de IA se cachea 7 días por equipo+ronda, y se invalida antes si los datos subyacentes cambiaron (detectado por hash), no solo por tiempo.

### 5.6 Seguimiento de acciones (Action Tracking)

Registro persistente, por equipo y por ronda, de las acciones sugeridas por la IA — independiente de las sugerencias del modo "Local" (esas son aleatorias en cada render y no se pueden trackear).

- **Qué es una "acción"**: texto de la recomendación + equipo + ronda a la que pertenece + **estado**: pendiente (⚪) / en curso (🔵) / hecha (✅).
- **Cómo se crean**: apenas se genera/muestra el consejo de IA para la ronda actual, sus acciones se "siembran" automáticamente en el registro de seguimiento (no hay que agregarlas a mano).
- **Cómo se cambia el estado**: un botón junto a cada acción cicla el estado en secuencia fija (pendiente → en curso → hecha → pendiente) — no hay un selector directo, solo se avanza de a un paso por clic.
- **Dónde se muestra**: dos listas dentro del mismo panel de IA —
  1. **"Acciones de la ronda anterior"**: acciones trackeadas de la ronda inmediatamente anterior (si existen), cada una con su botón de estado — así se ve si lo sugerido la vez pasada realmente se hizo.
  2. **"Acciones recomendadas"** (ronda actual): con botón de estado solo si se está viendo consejo de IA real (no en modo Local, donde las acciones son texto no interactivo).
- **Regla de seguridad al cambiar de equipo/ronda**: antes de sembrar acciones nuevas, se revalida que la ronda a sembrar realmente pertenezca al equipo actualmente seleccionado — evita que acciones de un equipo se escriban por error contra la ronda de otro durante el cambio de contexto.

### 5.7 Vista miembro — Historial personal

- **Fila de estadísticas rápidas** (si hay ≥1 respuesta): Total Evaluaciones, Última Evaluación, Cargo Actual (del perfil, no de las respuestas MBI).
- **Panel "Análisis Inteligente"** (equivalente personal del panel de IA del líder):
  - Se auto-genera al cargar el historial.
  - Botón "Actualizar" (regenerar ignorando caché).
  - Toggle "Ver Detalles"/"Contraer": el resumen y el badge de nivel de burnout siempre están visibles; el resto (análisis de tendencia, fortalezas/riesgos, sugerencia de próxima evaluación, metadatos de caché) solo se ve expandido.
  - Contenido: resumen personal, análisis de tendencia (solo con ≥2 respuestas históricas), lista de "Fortalezas" (máx. 5), lista de "Áreas de Atención" (máx. 5), lista de recomendaciones personalizadas (cada una con categoría Inmediato/Corto plazo/Largo plazo + acción + por qué), badge de nivel de burnout (Alto/Medio/Bajo), sugerencia de cuándo repetir la evaluación.
  - Indicador de origen: "Desde caché" / "Recién generado" / "Análisis local (heurístico)" (respaldo cuando la IA falla o hace timeout, calculado en el cliente comparando el puntaje actual con el anterior).
- **Regla de caché personal**: una fila por usuario, sin vencimiento por tiempo — se invalida solo si cambian los datos de entrada (cargo, historial de puntajes, etc.), detectado por hash.
- **Estado vacío** (sin respuestas): tarjeta centrada "Sin evaluaciones aún" + botón "Completar primera evaluación" → `/mbi`.

### 5.8 Reglas de privacidad en Reportes

- **`members_can_see_others`**: si es falso, toda la sección "Miembros del equipo" se reemplaza por un aviso de que el líder configuró los perfiles como privados — sin nombres ni estados individuales.
- **Opt-in individual `share_results_with_leader`**: incluso con el roster visible, el badge de clasificación de burnout de cada miembro (y la leyenda "Resultados compartidos"/"Resultados privados") solo se muestra para quienes respondieron **y** activaron ese permiso. Quienes no lo activaron igual aparecen como "ha respondido" (la participación nunca se oculta), pero su puntaje/clasificación no. Esto se refuerza también a nivel de base de datos (RLS), no solo en el cliente.
- **La tabla/gráfico/consejo de IA agregados son siempre anónimos**, independientemente de estas configuraciones — nunca muestran un desglose por persona, solo promedios y conteos del equipo. Esa es la salvaguarda de privacidad principal del sistema (no hay un umbral numérico explícito tipo "ocultar si hay menos de N respuestas" — la protección viene de que el agregado nunca expone filas por persona).

### 5.9 Estados vacíos / carga / error

- Carga de página completa: "Cargando reportes...".
- Líder sin equipos: "No tienes equipos aún. Crea uno para generar reportes."
- Sin rondas creadas: "Sin rondas creadas todavía." + link "Actualizar".
- Rondas creadas pero sin respuestas puntuadas aún: mensaje + link "Reintentar".
- Gráfico con menos de 2 rondas: mensaje pidiendo más datos.
- Miembro sin respuestas: estado vacío dedicado con CTA a completar la primera evaluación.
- Errores de carga en cualquier sección: banner rojo puntual, no bloquea el resto de la pantalla.

---

## 6. Crear equipo

Existen **dos implementaciones** con el mismo propósito pero distinto alcance — importante tenerlo presente al maquetar, porque hoy no son idénticas:

### 6.1 Página standalone (`/crear-equipo`)

- Encabezado con logo + botón "Volver al Dashboard" (navegación real de página, no cierre de panel).
- Ilustración + título "Crear Nuevo Equipo" + subtítulo.
- **Campos**: Nombre del equipo* (texto), Descripción (textarea, máx. 200 caracteres con contador, nota de que alimenta el análisis de IA), checkbox "Incluir al líder en métricas" (default activado).
- **"¿Cómo se unirán los miembros?"**: radio group con "Con código de invitación" (única opción funcional, seleccionada por defecto) y "Solicitud al líder" (deshabilitada, etiquetada "Próximamente" — placeholder de una función futura).
- **No tiene** los dos toggles de privacidad de miembros que sí tiene el panel inline (ver 6.2) — sería bueno decidir si esta página debería tenerlos también.
- Al enviar: verifica que el usuario sea líder, crea el equipo, genera el código de invitación.
- **Vista de éxito** (reemplaza el formulario): ícono de check, "¡Equipo Creado!", código de invitación en formato grande/destacado, botón "Copiar Código" (sin confirmación visual todavía — cabo suelto), botón "Ir al Dashboard".
- Errores: alerta inline con el mensaje específico (no es líder / falla al crear / falla al generar código).

### 6.2 Panel inline (usado dentro del Dashboard)

Mismos campos base que la versión standalone, más:
- Los dos toggles de privacidad: "Los miembros pueden ver a otros integrantes" y "Los miembros pueden ver si otros ya respondieron" (ambos default activado, con texto explicativo de qué pasa si se desactivan).
- No tiene selector de método de unión — siempre usa código de invitación, solo con una nota informativa.
- El cierre es "in place" (vuelve a la tarjeta/sección que lo abrió), no una navegación de página.
- Se resetea a valores por defecto cada vez que se vuelve a abrir (es un componente persistente reutilizable, no una carga de página nueva).

---

## 7. Unirse a equipo

**Propósito**: flujo de 3 pasos secuenciales dentro de una sola tarjeta — (1) ingresar código, (2) confirmar/consentir, (3) éxito.

### 7.1 Elementos comunes

- Encabezado con logo + botón "Volver al Dashboard".
- Ilustración + título "Unirse a un Equipo" + subtítulo.
- Si no hay sesión activa, redirige a login antes de mostrar cualquier paso.

### 7.2 Paso 1 — Ingresar código

- Campo de código de invitación: una línea, mayúsculas automáticas, máximo 6 caracteres, placeholder "ABC123", ayuda "Los códigos tienen 6 letras".
- Botón "Continuar" deshabilitado hasta completar los 6 caracteres; muestra "Verificando código..." mientras valida.
- La validez/expiración se verifica enteramente en el servidor.

### 7.3 Paso 2 — Confirmar / pantalla de consentimiento previo a unirse

- Encabezado "Antes de unirte a {nombre del equipo}".
- Texto de contexto: el equipo usa TeamZen para medir bienestar vía evaluaciones periódicas.
- **Lista informativa** (no interactiva): se puede responder de forma privada; las respuestas individuales NO se muestran al líder por defecto (solo el promedio del equipo, y ese promedio nunca se muestra si respondieron menos de 3 personas); se puede elegir compartir los resultados propios con el líder, y esa elección se puede cambiar después.
- **Checkbox real**: "Compartir mis resultados individuales con el líder de este equipo" (default desactivado) — es la única decisión de datos que se toma en esta pantalla.
- Botones: "Cancelar" (vuelve al paso 1, código en blanco) y "Unirme al equipo" (envía código + preferencia de compartir; ambos botones deshabilitados mientras se procesa).

### 7.4 Paso 3 — Éxito

- Ícono de check, "¡Bienvenido al equipo!".
- **Lista "¿Qué sigue?"**: vas a poder ver a los otros miembros; vas a poder completar evaluaciones de bienestar (marcado como "próximamente" en el texto actual — revisar si sigue siendo así); vas a recibir consejos personalizados según tus resultados.
- Botón "Ir al Dashboard" (única acción).

### 7.5 Sección "¿No tienes un código?"

Bloque informativo persistente, visible en cualquiera de los 3 pasos: pedir el código al líder/administrador; los códigos son únicos por equipo y se generan automáticamente (no hay autoservicio para conseguirlo acá).

### 7.6 Errores

Una sola alerta inline ("Error al unirse al equipo") reutilizada para: código inválido/inexistente, cualquier otra falla de verificación previa, y falla al unirse (ya es miembro, el código se invalidó entre la verificación y la confirmación, etc.) — todos muestran el mensaje que devuelve el servidor, sin diferenciación visual por tipo de error hoy.

---

## Notas para quien maquete

- Varios elementos están **marcados como pendientes/inconsistentes** en el código actual, no como decisión de diseño — vale la pena resolverlos al maquetar en vez de heredarlos: el link "Ver Historial" del dashboard (miembro) sin acción; el botón "Copiar Código" en Crear Equipo sin confirmación visual; el flujo de "magic link" en Login localizado pero inalcanzable; la opción "Solicitud al líder" para unirse a un equipo, deshabilitada como placeholder.
- **Crear equipo tiene dos implementaciones con distinto alcance** (página standalone vs. panel inline) — decidir si conviene unificarlas antes de maquetar, ya que hoy difieren en qué controles de privacidad ofrecen.
- Los **botones de "editar" tipo texto** (varios "Editar perfil", "Editar equipo") abren paneles/modales **inline**, no páginas nuevas — la única transferencia de liderazgo y algunas confirmaciones destructivas (eliminar equipo, expulsar miembro, salir del equipo, transferir liderazgo) usan diálogos de confirmación nativos del navegador o un modal flotante real, a propósito, porque son acciones irreversibles o de alto impacto.
