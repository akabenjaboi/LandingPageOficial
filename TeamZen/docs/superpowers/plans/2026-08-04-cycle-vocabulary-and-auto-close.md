# Evaluation-Round Vocabulary, Real Auto-Close, and Merged Reports View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "ciclo"/"lanzar" to "ronda"/"iniciar" across TeamZen's user-facing copy, make the 7-day
auto-close the UI already promises actually happen, and merge `reportes.jsx`'s two near-identical report
tabs into one.

**Architecture:** One new `SECURITY DEFINER` Postgres function (`close_expired_mbi_cycles`) is the single
source of truth for "has this round expired," called opportunistically from the client at each of the 4
places that load a team's cycles — no client-side date-math duplicated across files. The reports-view
merge deletes the redundant `getWeeklyData`/`calculateWeekStats` machinery and folds its one useful
addition (a friendly per-row status label) into the already-correct `aggregated` memo. Vocabulary is a
pure find-and-replace pass across JSX text and AI-prompt strings, done last so it operates on the final
(post-merge) file structure rather than text that gets deleted in a later task.

**Tech Stack:** React 19 + Vite (JS, no TypeScript), Supabase (Postgres + PostgREST + `supabase-js` v2).
No test framework exists in this repo — do not introduce one. Verification uses the same two mechanisms
established earlier this session: SQL/RLS behavior via `execute_sql` impersonation
(`set local role authenticated; set local request.jwt.claims = '...'`), and frontend changes via
`npm run build` succeeding plus explicit manual-QA notes for what the AI performing this plan cannot
verify itself (no real logged-in browser session available).

## Global Constraints

- SQL changes are applied via the Supabase MCP `apply_migration` tool directly to the production project
  (`alzjmlnoaxqlkdtvwisr`) — there is no local `supabase/migrations` directory in this repo. SQL tasks
  have no `git commit` step (nothing local to commit); the successful `apply_migration` call is the
  persisted change.
- Database/API identifiers are NOT renamed: `mbi_evaluation_cycles`, `cycle_id`, `status`,
  `activeCycleId`, `launchMBI`, `handleEndCycle`, `teamCycles`, and all other JS variable/function names
  stay exactly as they are. Only user-facing copy (JSX text, button labels, alert messages, AI-prompt
  strings) changes.
- Do not touch the header title/action-button role-based ternary in `dashboard.jsx` (~lines 873-911, per
  earlier session notes) beyond the vocabulary words themselves — no structural changes there, that's out
  of scope for this plan.
- Match existing code conventions: Spanish user-facing strings, existing Tailwind color palette, existing
  component patterns (no new UI libraries or abstractions).

---

### Task 1: Migration — `close_expired_mbi_cycles` function

**Files:**
- No local files — applied via `mcp__supabase__apply_migration`.

**Interfaces:**
- Produces: `public.close_expired_mbi_cycles() returns void` — callable via
  `supabase.rpc('close_expired_mbi_cycles')`.

- [ ] **Step 1: Write and run the "before" verification query (expect failure)**

Via `mcp__supabase__execute_sql`:
```sql
begin;
select public.close_expired_mbi_cycles();
rollback;
```
Expected: error — function does not exist.

- [ ] **Step 2: Apply the migration**

Call `mcp__supabase__apply_migration` with `name: "close_expired_mbi_cycles_function"` and this `query`:

```sql
begin;

create or replace function public.close_expired_mbi_cycles()
returns void
language sql
security definer
set search_path = public
as $$
  update public.mbi_evaluation_cycles
  set status = 'closed', end_at = start_at + interval '7 days'
  where status = 'active'
    and start_at < now() - interval '7 days';
$$;

revoke all on function public.close_expired_mbi_cycles() from public, anon;
grant execute on function public.close_expired_mbi_cycles() to authenticated;

commit;
```

- [ ] **Step 3: Verify the happy path — an expired active cycle actually closes**

Find a real team/cycle to test against (or use an existing active cycle from a test team):
```sql
select id, team_id, status, start_at, end_at from public.mbi_evaluation_cycles where status = 'active' limit 5;
```

Then, inside a rolled-back transaction, backdate a real active cycle's `start_at` to simulate expiry,
impersonate an authenticated user, call the function, and confirm the row flips:

```sql
begin;
update public.mbi_evaluation_cycles set start_at = now() - interval '8 days' where id = '<cycle_uuid>';
set local role authenticated;
set local request.jwt.claims = '{"sub":"<any_real_user_uuid>","role":"authenticated"}';
select public.close_expired_mbi_cycles();
select id, status, start_at, end_at from public.mbi_evaluation_cycles where id = '<cycle_uuid>';
-- expect: status = 'closed', end_at = start_at + 7 days (i.e. exactly 1 day before "now" in this test)
rollback;
```

- [ ] **Step 4: Verify a non-expired active cycle is left untouched**

In the same or a separate rolled-back transaction, pick a DIFFERENT active cycle that is NOT backdated,
call the function, and confirm its `status` is still `'active'` and `end_at` is still `null` afterward.

- [ ] **Step 5: Verify grants**

Query `information_schema.role_routine_grants` for `close_expired_mbi_cycles` — confirm `authenticated`
has `EXECUTE` and `anon`/`public` do not.

- [ ] **Step 6: Run `get_advisors(type: "security")`**

Expect only the usual WARN-level `authenticated_security_definer_function_executable` finding for this
new function (same class already accepted for every other SECURITY DEFINER function in this project) —
no new ERROR-level findings.

---

### Task 2: Frontend — wire the auto-close call into all 4 cycle-loading points

**Files:**
- Modify: `src/pages/dashboard.jsx:94` (after `setUser(currentUser);` inside `init()`)
- Modify: `src/pages/evaluaciones.jsx:27` (after `setUser(currentUser);` inside `init()`)
- Modify: `src/pages/reportes.jsx:55` (after `setUser(currentUser);` inside the effect)
- Modify: `src/pages/mbi.jsx:80` (after `setUser(u);` inside `init()`)

**Interfaces:**
- Consumes: `public.close_expired_mbi_cycles()` from Task 1, via `supabase.rpc('close_expired_mbi_cycles')`.

The exact same snippet is inserted at all 4 locations — a non-blocking, best-effort call. A failure here
must NOT stop the page from loading (it's data hygiene, not core functionality): only `console.warn`, no
`setError`/`setDataError`, no `return`.

- [ ] **Step 1: `dashboard.jsx`**

Find (line 94):
```jsx
      setUser(currentUser);

      // Cargar perfil
```
Replace with:
```jsx
      setUser(currentUser);

      // Cierra automáticamente rondas activas que ya pasaron su plazo de 7 días.
      // Best-effort: si falla, no bloquea la carga de la página — es limpieza de
      // datos, no una dependencia funcional de lo que sigue.
      const { error: closeExpiredError } = await supabase.rpc('close_expired_mbi_cycles');
      if (closeExpiredError) {
        console.warn('No se pudieron cerrar rondas vencidas', closeExpiredError);
      }

      // Cargar perfil
```

- [ ] **Step 2: `evaluaciones.jsx`**

Find (line 27):
```jsx
      setUser(currentUser);
      const { data: prof, error: profError } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
```
Replace with:
```jsx
      setUser(currentUser);

      const { error: closeExpiredError } = await supabase.rpc('close_expired_mbi_cycles');
      if (closeExpiredError) {
        console.warn('No se pudieron cerrar rondas vencidas', closeExpiredError);
      }

      const { data: prof, error: profError } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
```

- [ ] **Step 3: `reportes.jsx`**

Find (line 55):
```jsx
      setUser(currentUser);
      const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
```
Replace with:
```jsx
      setUser(currentUser);

      const { error: closeExpiredError } = await supabase.rpc('close_expired_mbi_cycles');
      if (closeExpiredError) {
        console.warn('No se pudieron cerrar rondas vencidas', closeExpiredError);
      }

      const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
```

- [ ] **Step 4: `mbi.jsx`**

Find (line 80):
```jsx
      setUser(u);

      // If answering for a team, require an active cycle
```
Replace with:
```jsx
      setUser(u);

      const { error: closeExpiredError } = await supabase.rpc('close_expired_mbi_cycles');
      if (closeExpiredError) {
        console.warn('No se pudieron cerrar rondas vencidas', closeExpiredError);
      }

      // If answering for a team, require an active cycle
```

- [ ] **Step 5: Build check**

Run `npm run build` (from `TeamZen/`) — must succeed with no new errors (ignore the known pre-existing
groqClient dynamic/static-import warning and chunk-size warning if it reappears).

- [ ] **Step 6: Manual QA note (human required)**

Using the technique from Task 1 (backdate a real cycle's `start_at` via `execute_sql`), confirm that
simply loading any of the 4 pages (dashboard, evaluaciones, reportes, mbi) as a real logged-in user causes
that backdated cycle to flip to `closed` — check via `execute_sql` after loading the page, or via the UI
itself no longer showing it as active.

- [ ] **Step 7: Commit**

```bash
git add src/pages/dashboard.jsx src/pages/evaluaciones.jsx src/pages/reportes.jsx src/pages/mbi.jsx
git commit -m "feat: auto-close MBI evaluation rounds after 7 days"
```

---

### Task 3: Frontend — merge "Por Ciclos"/"Semanal" into one "Historial de rondas" view

**Files:**
- Modify: `src/pages/reportes.jsx` (state, memo, and render sections — see exact locations below)

**Interfaces:**
- Produces: `aggregated` items now also carry `isActiveCycle: boolean`, `cycleEndedEarly: boolean`,
  `actualDuration: number` (in days) — used by this same task's render section and available to any
  future code that reads `aggregated`.
- `AdvicePanel`'s signature changes from `{ data, teamId, viewMode = 'cycles' }` to `{ data, teamId }`.

- [ ] **Step 1: Delete the dead `getWeekStartDate` helper**

Delete (lines 206-212):
```jsx
  // Función auxiliar para obtener el inicio de la semana (lunes)
  const getWeekStartDate = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para que lunes sea día 1
    return new Date(d.setDate(diff));
  };

```
(Confirmed unused anywhere else in the file — it's dead code, never called.)

- [ ] **Step 2: Delete `calculateWeekStats` and `getWeeklyData`**

Delete the entire block from the `calculateWeekStats` comment through the end of the `getWeeklyData`
`useMemo` (originally lines 214-309, now shifted up by the Step 1 deletion — find it by its exact content,
starting at `// Función helper para calcular estadísticas de la semana` and ending at the closing
`}, [teamCycles, scoresByCycle]);` that immediately precedes `const aggregated = useMemo(...)`):

```jsx
  // Función helper para calcular estadísticas de la semana
  const calculateWeekStats = (scores) => {
    // Calcular promedios de subscalas
    const aeAvg = Math.round((scores.reduce((a,s)=>a+(s.ae??0),0)/scores.length)*10)/10;
    const dAvg = Math.round((scores.reduce((a,s)=>a+(s.d??0),0)/scores.length)*10)/10;
    const rpAvg = Math.round((scores.reduce((a,s)=>a+(s.rp??0),0)/scores.length)*10)/10;

    // Calcular estado dominante y bienestar
    // Usa la misma clasificación oficial (classifyMBI/computeBurnoutStatus)
    // que la vista "Por Ciclos" (ver `aggregated` más abajo) — antes esta
    // vista tenía su propio umbral ad-hoc que ignoraba RP y podía mostrar
    // un riesgo distinto para los mismos datos según la vista.
    const statuses = scores.map(s => {
      const cls = classifyMBI(s.ae, s.d, s.rp);
      return computeBurnoutStatus(cls);
    }).filter(Boolean);
    const counts = statuses.reduce((acc,st)=>{acc[st]=(acc[st]||0)+1;return acc;},{});
    const dominant = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0] || 'Sin indicios';

    // Calcular bienestar global
    const MIN_AE=0, MAX_AE=54, MIN_D=0, MAX_D=30, MIN_RP=0, MAX_RP=48;
    const rangeAE=MAX_AE-MIN_AE, rangeD=MAX_D-MIN_D, rangeRP=MAX_RP-MIN_RP;
    const wbSum = scores.reduce((acc,s)=>{
      const aeWell = 1-((s.ae-MIN_AE)/(rangeAE||1));
      const dWell = 1-((s.d-MIN_D)/(rangeD||1));
      const rpWell = ((s.rp-MIN_RP)/(rangeRP||1));
      return acc + (aeWell + dWell + rpWell)/3;
    },0);
    const wellbeing = Math.round((wbSum / scores.length)*100);

    // Distribución de riesgo
    const dist = { Burnout:0, 'Riesgo Alto':0, Riesgo:0, 'Sin indicios':0 };
    statuses.forEach(st => { if(dist[st]!==undefined) dist[st]++; });

    return {
      count: scores.length,
      aeAvg, dAvg, rpAvg,
      dominant, wellbeing, dist
    };
  };

  // Nueva función para obtener datos agrupados por semana (mostrando todos los ciclos)
  const getWeeklyData = useMemo(() => {
    if (!teamCycles.length) return [];
    
    // Crear una entrada por cada ciclo con sus datos
    const cycleEntries = [];
    
    teamCycles.forEach(cycle => {
      const scores = scoresByCycle[cycle.id] || [];
      if (scores.length === 0) return; // Skip ciclos sin respuestas
      
      const cycleStartDate = new Date(cycle.start_at || cycle.created_at);
      const cycleEndDate = cycle.end_at ? new Date(cycle.end_at) : null;
      
      // Calcular duración real del ciclo
      let actualDuration;
      let isSameDay = false;
      let cycleEndedEarly = false;
      
      if (cycleEndDate) {
        actualDuration = Math.max(1, Math.ceil((cycleEndDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24)));
        isSameDay = cycleEndDate.toDateString() === cycleStartDate.toDateString();
        cycleEndedEarly = true;
      } else {
        // Si no hay fecha de fin, asumir que sigue activo (usar fecha actual o 7 días)
        const now = new Date();
        actualDuration = Math.max(1, Math.ceil((now.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24)));
        cycleEndedEarly = false;
      }
      
      // Determinar fechas de inicio y fin para mostrar
      const displayStartDate = cycleStartDate;
      const displayEndDate = cycleEndDate || new Date(cycleStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      
      // Calcular estadísticas del ciclo
      const cycleStats = calculateWeekStats(scores);
      
      cycleEntries.push({
        ...cycleStats,
        weekStart: displayStartDate, // Para mantener compatibilidad con la UI
        weekEnd: displayEndDate,
        actualDuration,
        isSameDay,
        cycleEndedEarly,
        cycleInfo: cycle,
        cycleId: cycle.id,
        cycleName: `Ciclo ${cycle.id?.slice(0, 8) || 'N/A'}`,
        friendlyId: cycle.id?.slice(0, 8) || 'N/A',
        isActiveCycle: !cycleEndDate // true si el ciclo aún está activo
      });
    });
    
    // Ordenar por fecha de inicio (más reciente primero)
    return cycleEntries.sort((a, b) => b.weekStart - a.weekStart);
  }, [teamCycles, scoresByCycle]);

```

- [ ] **Step 3: Delete the `viewMode` state**

Delete (line 44, exact original line — will have shifted up after Steps 1-2, find by content):
```jsx
  const [viewMode, setViewMode] = useState('weekly'); // 'cycles' o 'weekly' - weekly por defecto
```

- [ ] **Step 4: Add status fields to `aggregated`**

Find the `aggregated` memo's map callback:
```jsx
  const aggregated = useMemo(() => {
    if (!teamCycles.length) return [];
    return teamCycles.map(cycle => {
      const scores = scoresByCycle[cycle.id] || [];
      if (!scores.length) return { cycle, count:0 };
```
Replace with (adds the status-field computation right after the early-return guard, before the subscale
math):
```jsx
  const aggregated = useMemo(() => {
    if (!teamCycles.length) return [];
    return teamCycles.map(cycle => {
      const scores = scoresByCycle[cycle.id] || [];
      const cycleStartDate = new Date(cycle.start_at || cycle.created_at);
      const cycleEndDate = cycle.end_at ? new Date(cycle.end_at) : null;
      const isActiveCycle = !cycleEndDate;
      const cycleEndedEarly = !!cycleEndDate;
      const actualDuration = cycleEndDate
        ? Math.max(1, Math.ceil((cycleEndDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24)))
        : Math.max(1, Math.ceil((new Date().getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (!scores.length) return { cycle, count:0, isActiveCycle, cycleEndedEarly, actualDuration };
```
And find the final `return` of the same map callback:
```jsx
      return { cycle, count: scores.length, aeAvg, dAvg, rpAvg, dominant, wellbeing, dist };
    });
  }, [teamCycles, scoresByCycle]);
```
Replace with:
```jsx
      return { cycle, count: scores.length, aeAvg, dAvg, rpAvg, dominant, wellbeing, dist, isActiveCycle, cycleEndedEarly, actualDuration };
    });
  }, [teamCycles, scoresByCycle]);
```

Note: `cycleEndedEarly` here means "has an `end_at`" — it does NOT yet distinguish "closed early by a
human" from "closed by `close_expired_mbi_cycles` at exactly the 7-day mark." Step 6 below computes the
human-readable label using a day-count comparison, matching how `getWeeklyData` used to decide between
"Cerrado anticipadamente" and "Completado" (it never actually distinguished these by exact timestamp
either — it used the same `cycleEndDate` truthiness check for `cycleEndedEarly` and separately compared
`actualDuration` against 7 for the label, which this task preserves exactly).

- [ ] **Step 5: Remove the view-toggle buttons and simplify the section header**

Find:
```jsx
                    <h2 className="text-base sm:text-lg font-semibold text-[#2E2E3A]">Análisis de evaluaciones</h2>
                    {/* Toggle entre vista por ciclos y vista semanal */}
                    <div className="flex items-center gap-1 sm:gap-2 bg-[#DAD5E4]/30 p-1 rounded-xl w-fit">
                      <button
                        onClick={() => setViewMode('cycles')}
                        className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-lg transition-all duration-200 ${
                          viewMode === 'cycles' 
                            ? 'bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white shadow-lg' 
                            : 'text-[#2E2E3A] hover:text-[#55C2A2]'
                        }`}
                      >
                        Por Ciclos
                      </button>
                      <button
                        onClick={() => setViewMode('weekly')}
                        className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-lg transition-all duration-200 ${
                          viewMode === 'weekly' 
                            ? 'bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white shadow-lg' 
                            : 'text-[#2E2E3A] hover:text-[#55C2A2]'
                        }`}
                      >
                        Semanal
                      </button>
                    </div>
```
Replace with:
```jsx
                    <h2 className="text-base sm:text-lg font-semibold text-[#2E2E3A]">Análisis de evaluaciones</h2>
```

- [ ] **Step 6: Simplify the empty-state and table-body conditionals**

Find:
```jsx
                ) : (viewMode === 'cycles' ? aggregated : getWeeklyData).length === 0 ? (
                  viewMode === 'cycles' ? (
                    teamCycles.length === 0 ? (
                      <div className="text-sm text-[#5B5B6B] flex items-center gap-2">
                        <span>Sin ciclos creados todavía.</span>
                        <button 
                          onClick={handleRefresh} 
                          className="text-[#55C2A2] hover:text-[#2E2E3A] underline hover:no-underline 
                                     transition-colors duration-200"
                        >
                          Actualizar
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-[#5B5B6B] flex flex-col gap-2">
                        <span>Hay {teamCycles.length} ciclo(s) pero aún sin respuestas con puntajes.</span>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={handleRefresh} 
                            className="text-[#55C2A2] hover:text-[#2E2E3A] underline hover:no-underline 
                                       transition-colors duration-200"
                          >
                            Reintentar
                          </button>
                          <span className="text-[11px] text-[#9D83C6]">
                            (Si ya respondieron hace segundos, espera y refresca)
                          </span>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="text-sm text-[#5B5B6B] flex items-center gap-2">
                      <span>No hay datos suficientes para mostrar vista semanal.</span>
                      <button 
                        onClick={handleRefresh} 
                        className="text-[#55C2A2] hover:text-[#2E2E3A] underline hover:no-underline 
                                   transition-colors duration-200"
                      >
                        Actualizar
                      </button>
                    </div>
                  )
                ) : (
```
Replace with:
```jsx
                ) : aggregated.length === 0 ? (
                  teamCycles.length === 0 ? (
                    <div className="text-sm text-[#5B5B6B] flex items-center gap-2">
                      <span>Sin rondas creadas todavía.</span>
                      <button 
                        onClick={handleRefresh} 
                        className="text-[#55C2A2] hover:text-[#2E2E3A] underline hover:no-underline 
                                   transition-colors duration-200"
                      >
                        Actualizar
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-[#5B5B6B] flex flex-col gap-2">
                      <span>Hay {teamCycles.length} ronda(s) pero aún sin respuestas con puntajes.</span>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={handleRefresh} 
                          className="text-[#55C2A2] hover:text-[#2E2E3A] underline hover:no-underline 
                                     transition-colors duration-200"
                        >
                          Reintentar
                        </button>
                        <span className="text-[11px] text-[#9D83C6]">
                          (Si ya respondieron hace segundos, espera y refresca)
                        </span>
                      </div>
                    </div>
                  )
                ) : (
```
(Note: this step already applies the "ronda" vocabulary to the two strings it touches, since leaving
literal "ciclo(s)" here only to rename it again one task later would be pure churn — every other
vocabulary occurrence in this file is left untouched for Task 4.)

- [ ] **Step 7: Simplify the table header and body to always use the cycles shape, adding the status label**

Find the header row:
```jsx
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="text-left px-2 sm:px-3 py-2 font-medium text-[10px] sm:text-sm">
                            {viewMode === 'cycles' ? 'Inicio / Fin / Duración' : 'Semana'}
                          </th>
```
Replace with:
```jsx
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="text-left px-2 sm:px-3 py-2 font-medium text-[10px] sm:text-sm">
                            Inicio / Fin / Duración
                          </th>
```

Find the table body (the `.map` over both branches):
```jsx
                        {(viewMode === 'cycles' ? aggregated : getWeeklyData).map((row, index) => {
                          if (viewMode === 'cycles') {
                            // Vista por ciclos (código original)
                            const started = row.cycle.start_at || row.cycle.created_at;
                            const ended = row.cycle.end_at;
                            const startDate = started ? new Date(started) : null;
                            const endDate = ended ? new Date(ended) : null;
                            const fmt = (d) => d?.toLocaleString(undefined,{ dateStyle:'short', timeStyle:'short'}) || '—';
                            const duration = startDate && endDate ? formatDuration(endDate - startDate) : (endDate ? '—' : 'En curso');
                            return (
                              <tr key={row.cycle.id} className="hover:bg-gray-50">
                                <td className="px-2 sm:px-3 py-2">
                                  <div className="text-[10px] sm:text-xs"><span className="font-semibold text-gray-700">Inicio:</span> {fmt(startDate)}</div>
                                  <div className="text-[10px] sm:text-xs"><span className="font-semibold text-gray-700">Fin:</span> {endDate ? fmt(endDate) : 'En curso'}</div>
                                  <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1">Duración: {duration}</div>
                                </td>
                                <td className="px-2 sm:px-3 py-2 text-center">{row.count}</td>
                                <td className="px-2 sm:px-3 py-2">{row.aeAvg != null ? `${row.aeAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">{row.dAvg != null ? `${row.dAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">{row.rpAvg != null ? `${row.rpAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">
                                  {row.wellbeing != null ? (
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <div className="w-12 sm:w-20 h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${row.wellbeing}%`, background: row.wellbeing>=70?'#16a34a':row.wellbeing>=40?'#f59e0b':'#dc2626' }} />
                                      </div>
                                      <span className="text-[10px] sm:text-xs">{row.wellbeing}</span>
                                    </div>
                                  ) : '—'}
                                </td>
                                <td className="px-2 sm:px-3 py-2 hidden sm:table-cell text-[10px] sm:text-xs">{row.dominant || '—'}</td>
                                <td className="px-2 sm:px-3 py-2 text-[9px] sm:text-[10px] leading-tight hidden md:table-cell">
                                  <div>Burnout: {row.dist?.Burnout ?? 0}</div>
                                  <div>Riesgo Alto: {row.dist?.['Riesgo Alto'] ?? 0}</div>
                                  <div>Riesgo: {row.dist?.Riesgo ?? 0}</div>
                                  <div>Sin indicios: {row.dist?.['Sin indicios'] ?? 0}</div>
                                </td>
                              </tr>
                            );
                          } else {
                            // Vista semanal (ahora muestra ciclos individuales)
                            const cycleStart = row.weekStart;
                            const cycleEnd = row.weekEnd;
                            const actualDuration = row.actualDuration || 7;
                            const isSameDay = row.isSameDay || false;
                            const cycleEndedEarly = row.cycleEndedEarly || false;
                            const isActiveCycle = row.isActiveCycle || false;
                            const cycleInfo = row.cycleInfo;
                            
                            const formatDate = (d) => d?.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }) || '—';
                            const formatDateTime = (d) => d?.toLocaleString(undefined, { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) || '—';
                            
                            let periodText;
                            let statusText = '';
                            
                            if (isActiveCycle) {
                              // Ciclo aún activo
                              periodText = `${formatDate(cycleStart)} - Activo`;
                              statusText = 'En curso';
                            } else if (cycleEndedEarly && isSameDay) {
                              // Si terminó el mismo día, mostrar con horas
                              periodText = `${formatDate(cycleStart)} - ${formatDateTime(cycleEnd)}`;
                              statusText = 'Cerrado anticipadamente';
                            } else if (cycleEndedEarly) {
                              // Si terminó antes pero en diferente día
                              periodText = `${formatDate(cycleStart)} - ${formatDate(cycleEnd)}`;
                              statusText = 'Cerrado anticipadamente';
                            } else {
                              // Ciclo completado normalmente
                              periodText = `${formatDate(cycleStart)} - ${formatDate(cycleEnd)}`;
                              statusText = 'Completado';
                            }
                            
                            return (
                              <tr key={`cycle-${row.cycleId}`} className="hover:bg-gray-50">
                                <td className="px-2 sm:px-3 py-2">
                                  <div className="text-[10px] sm:text-xs">
                                    <span className="font-semibold text-gray-700">
                                      Ciclo #{row.friendlyId}:
                                    </span> {periodText}
                                  </div>
                                  <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1">
                                    {actualDuration} día{actualDuration !== 1 ? 's' : ''}
                                    {statusText && (
                                      <span className={`ml-2 ${
                                        isActiveCycle ? 'text-blue-600' : 
                                        cycleEndedEarly ? 'text-orange-600' : 
                                        'text-green-600'
                                      }`}>
                                        • {statusText}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-3 py-2 text-center">{row.count}</td>
                                <td className="px-2 sm:px-3 py-2">{row.aeAvg != null ? `${row.aeAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">{row.dAvg != null ? `${row.dAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">{row.rpAvg != null ? `${row.rpAvg}` : '—'}</td>
                                <td className="px-2 sm:px-3 py-2">
                                  {row.wellbeing != null ? (
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <div className="w-12 sm:w-20 h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${row.wellbeing}%`, background: row.wellbeing>=70?'#16a34a':row.wellbeing>=40?'#f59e0b':'#dc2626' }} />
                                      </div>
                                      <span className="text-[10px] sm:text-xs">{row.wellbeing}</span>
                                    </div>
                                  ) : '—'}
                                </td>
                                <td className="px-2 sm:px-3 py-2 hidden sm:table-cell text-[10px] sm:text-xs">{row.dominant || '—'}</td>
                                <td className="px-2 sm:px-3 py-2 text-[9px] sm:text-[10px] leading-tight hidden md:table-cell">
                                  <div>Burnout: {row.dist?.Burnout ?? 0}</div>
                                  <div>Riesgo Alto: {row.dist?.['Riesgo Alto'] ?? 0}</div>
                                  <div>Riesgo: {row.dist?.Riesgo ?? 0}</div>
                                  <div>Sin indicios: {row.dist?.['Sin indicios'] ?? 0}</div>
                                </td>
                              </tr>
                            );
                          }
                        })}
```
Replace with (single branch, combining the "Por Ciclos" row's raw start/end/duration display with a new
status line adapted from the deleted "Semanal" branch — `cycleEndedEarly`/`isActiveCycle` now come
directly off `aggregated`'s rows per Step 4, and the "same day" nuance from the old `isSameDay` field is
folded into a straightforward duration-based label since it added detail the merged view doesn't need to
preserve verbatim):
```jsx
                        {aggregated.map((row) => {
                          const started = row.cycle.start_at || row.cycle.created_at;
                          const ended = row.cycle.end_at;
                          const startDate = started ? new Date(started) : null;
                          const endDate = ended ? new Date(ended) : null;
                          const fmt = (d) => d?.toLocaleString(undefined,{ dateStyle:'short', timeStyle:'short'}) || '—';
                          const duration = startDate && endDate ? formatDuration(endDate - startDate) : (endDate ? '—' : 'En curso');
                          const statusText = row.isActiveCycle
                            ? 'En curso'
                            : (row.actualDuration < 7 ? 'Cerrado anticipadamente' : 'Completado');
                          const statusColor = row.isActiveCycle
                            ? 'text-blue-600'
                            : (row.actualDuration < 7 ? 'text-orange-600' : 'text-green-600');
                          return (
                            <tr key={row.cycle.id} className="hover:bg-gray-50">
                              <td className="px-2 sm:px-3 py-2">
                                <div className="text-[10px] sm:text-xs"><span className="font-semibold text-gray-700">Inicio:</span> {fmt(startDate)}</div>
                                <div className="text-[10px] sm:text-xs"><span className="font-semibold text-gray-700">Fin:</span> {endDate ? fmt(endDate) : 'En curso'}</div>
                                <div className="text-[9px] sm:text-[10px] text-gray-500 mt-1">
                                  Duración: {duration}
                                  <span className={`ml-2 ${statusColor}`}>• {statusText}</span>
                                </div>
                              </td>
                              <td className="px-2 sm:px-3 py-2 text-center">{row.count}</td>
                              <td className="px-2 sm:px-3 py-2">{row.aeAvg != null ? `${row.aeAvg}` : '—'}</td>
                              <td className="px-2 sm:px-3 py-2">{row.dAvg != null ? `${row.dAvg}` : '—'}</td>
                              <td className="px-2 sm:px-3 py-2">{row.rpAvg != null ? `${row.rpAvg}` : '—'}</td>
                              <td className="px-2 sm:px-3 py-2">
                                {row.wellbeing != null ? (
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <div className="w-12 sm:w-20 h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${row.wellbeing}%`, background: row.wellbeing>=70?'#16a34a':row.wellbeing>=40?'#f59e0b':'#dc2626' }} />
                                    </div>
                                    <span className="text-[10px] sm:text-xs">{row.wellbeing}</span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="px-2 sm:px-3 py-2 hidden sm:table-cell text-[10px] sm:text-xs">{row.dominant || '—'}</td>
                              <td className="px-2 sm:px-3 py-2 text-[9px] sm:text-[10px] leading-tight hidden md:table-cell">
                                <div>Burnout: {row.dist?.Burnout ?? 0}</div>
                                <div>Riesgo Alto: {row.dist?.['Riesgo Alto'] ?? 0}</div>
                                <div>Riesgo: {row.dist?.Riesgo ?? 0}</div>
                                <div>Sin indicios: {row.dist?.['Sin indicios'] ?? 0}</div>
                              </td>
                            </tr>
                          );
                        })}
```

- [ ] **Step 8: Simplify the "Sugerencias personalizadas" heading and `AdvicePanel`/data references**

Find:
```jsx
              {(viewMode === 'cycles' ? aggregated : getWeeklyData).length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    Sugerencias personalizadas ({viewMode === 'cycles' ? 'por ciclos' : 'por semana'})
                  </h2>
                  <AdvicePanel 
                    data={viewMode === 'cycles' ? aggregated : getWeeklyData} 
                    teamId={activeTeamId} 
                    viewMode={viewMode}
                  />
                </div>
              )}
```
Replace with:
```jsx
              {aggregated.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    Sugerencias personalizadas
                  </h2>
                  <AdvicePanel 
                    data={aggregated} 
                    teamId={activeTeamId} 
                  />
                </div>
              )}
```

- [ ] **Step 9: Simplify `AdvicePanel` itself — drop the `viewMode` prop and all its branches**

Find the function signature:
```jsx
function AdvicePanel({ data, teamId, viewMode = 'cycles' }) {
```
Replace with:
```jsx
function AdvicePanel({ data, teamId }) {
```

Find (inside `handleAIFetch`, the `historyData` mapping):
```jsx
    const historyData = valid.slice(0, 5).map(item => ({
      ae: item.aeAvg,
      d: item.dAvg,
      rp: item.rpAvg,
      wellbeing: item.wellbeing,
      date: viewMode === 'cycles' 
        ? (item.cycle.start_at || item.cycle.created_at)
        : item.weekStart.toISOString()
    }));
    
    const mbiPayload = {
      ae: current.aeAvg,
      d: current.dAvg,
      rp: current.rpAvg,
      wellbeing: current.wellbeing,
      previous: prev ? { ae: prev.aeAvg, d: prev.dAvg, rp: prev.rpAvg, wellbeing: prev.wellbeing } : null,
      history: historyData,
      meta: { 
        latestId: viewMode === 'cycles' ? current.cycle.id : `week-${current.weekStart.toISOString().split('T')[0]}`,
        totalPeriods: valid.length,
        viewMode: viewMode,
        analysisScope: viewMode === 'cycles' ? 'Análisis por ciclos de evaluación' : 'Análisis semanal granular'
      }
    };
    
    setLoading(true);
    setError('');
    
    try {
      // Timeout de 15 segundos para evitar esperas largas
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: IA externa tardó más de 15 segundos')), 15000)
      );
      
      const analysisId = viewMode === 'cycles' 
        ? current.cycle.id 
        : `weekly-${current.weekStart.toISOString().split('T')[0]}`;
```
Replace with:
```jsx
    const historyData = valid.slice(0, 5).map(item => ({
      ae: item.aeAvg,
      d: item.dAvg,
      rp: item.rpAvg,
      wellbeing: item.wellbeing,
      date: item.cycle.start_at || item.cycle.created_at
    }));
    
    const mbiPayload = {
      ae: current.aeAvg,
      d: current.dAvg,
      rp: current.rpAvg,
      wellbeing: current.wellbeing,
      previous: prev ? { ae: prev.aeAvg, d: prev.dAvg, rp: prev.rpAvg, wellbeing: prev.wellbeing } : null,
      history: historyData,
      meta: { 
        latestId: current.cycle.id,
        totalPeriods: valid.length,
        analysisScope: 'Análisis por ciclos de evaluación'
      }
    };
    
    setLoading(true);
    setError('');
    
    try {
      // Timeout de 15 segundos para evitar esperas largas
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: IA externa tardó más de 15 segundos')), 15000)
      );
      
      const analysisId = current.cycle.id;
```

Find (the dependency array right after `handleAIFetch`'s closing):
```jsx
  }, [loading, data, viewMode, teamId]);

  // Limpiar análisis de IA cuando cambie el modo de vista
  React.useEffect(() => {
    if (aiAdvice) {
      setAiAdvice(null);
      setMode('ai'); // Mantener en modo IA para regenerar automáticamente
      setError('');
    }
  }, [viewMode]);

  // Auto-generar análisis de IA cuando hay datos válidos
  React.useEffect(() => {
    const valid = data.filter(r => r.count > 0 && r.aeAvg != null && r.dAvg != null && r.rpAvg != null && r.wellbeing != null);
    if (valid.length > 0 && !aiAdvice && !loading && mode === 'ai') {
      handleAIFetch(false);
    }
  }, [data, teamId, viewMode, aiAdvice, loading, mode, handleAIFetch]);
```
Replace with:
```jsx
  }, [loading, data, teamId]);

  // Auto-generar análisis de IA cuando hay datos válidos
  React.useEffect(() => {
    const valid = data.filter(r => r.count > 0 && r.aeAvg != null && r.dAvg != null && r.rpAvg != null && r.wellbeing != null);
    if (valid.length > 0 && !aiAdvice && !loading && mode === 'ai') {
      handleAIFetch(false);
    }
  }, [data, teamId, aiAdvice, loading, mode, handleAIFetch]);
```
(The "clear AI analysis when view mode changes" effect is deleted entirely — with only one view left,
there's no view switch to react to. `data` changing, e.g. from a team switch, is already covered by the
`teamId`/`data` deps on the remaining effect and by `AdvicePanel` being remounted with a fresh key when
its parent's team selection changes, consistent with how this component already behaves today for a
same-view team switch.)

Find the second (render-time, non-callback) copy of the same `historyData`/`mbiPayload` construction —
this is a pre-existing duplication of the `handleAIFetch` logic above, not introduced by this task; only
remove the `viewMode` branches, do not otherwise restructure it:
```jsx
  const historyData = valid.slice(0, 5).map(item => ({
    ae: item.aeAvg,
    d: item.dAvg,
    rp: item.rpAvg,
    wellbeing: item.wellbeing,
    date: viewMode === 'cycles' 
      ? (item.cycle.start_at || item.cycle.created_at)
      : item.weekStart.toISOString()
  }));
  
  const mbiPayload = {
    ae: current.aeAvg,
    d: current.dAvg,
    rp: current.rpAvg,
    wellbeing: current.wellbeing,
    previous: prev ? { ae: prev.aeAvg, d: prev.dAvg, rp: prev.rpAvg, wellbeing: prev.wellbeing } : null,
    history: historyData,
    meta: { 
      latestId: viewMode === 'cycles' ? current.cycle.id : `week-${current.weekStart.toISOString().split('T')[0]}`,
      totalPeriods: valid.length,
      viewMode: viewMode,
      analysisScope: viewMode === 'cycles' ? 'Análisis por ciclos de evaluación' : 'Análisis semanal granular'
    }
  };
```
Replace with:
```jsx
  const historyData = valid.slice(0, 5).map(item => ({
    ae: item.aeAvg,
    d: item.dAvg,
    rp: item.rpAvg,
    wellbeing: item.wellbeing,
    date: item.cycle.start_at || item.cycle.created_at
  }));
  
  const mbiPayload = {
    ae: current.aeAvg,
    d: current.dAvg,
    rp: current.rpAvg,
    wellbeing: current.wellbeing,
    previous: prev ? { ae: prev.aeAvg, d: prev.dAvg, rp: prev.rpAvg, wellbeing: prev.wellbeing } : null,
    history: historyData,
    meta: { 
      latestId: current.cycle.id,
      totalPeriods: valid.length,
      analysisScope: 'Análisis por ciclos de evaluación'
    }
  };
```

Find the 3 remaining `viewMode` ternaries in the render output:
```jsx
        {loading && `🔄 Analizando ${viewMode === 'cycles' ? 'evolución por ciclos' : 'tendencias semanales'} del equipo...`}
```
```jsx
              • {historyData.length} {viewMode === 'cycles' ? 'ciclo(s)' : 'semana(s)'} de historia
```
```jsx
          <span>🧠 Sugerencias {viewMode === 'cycles' ? 'por ciclos' : 'semanales'} basadas en reglas heurísticas</span>
```
Replace respectively with:
```jsx
        {loading && `🔄 Analizando evolución por ciclos del equipo...`}
```
```jsx
              • {historyData.length} ciclo(s) de historia
```
```jsx
          <span>🧠 Sugerencias por ciclos basadas en reglas heurísticas</span>
```
(These 3 keep the word "ciclo" for now — Task 4 renames every remaining vocabulary occurrence across the
whole file in one consistent pass, including these.)

- [ ] **Step 10: Build check**

Run `npm run build` — must succeed with no new errors.

- [ ] **Step 11: Manual QA note (human required)**

As a leader with at least one team that has cycle history, open Reportes and confirm: no tab
toggle is visible, the single table shows the same numbers that "Por Ciclos" used to show, each row's
duration line includes a status label ("En curso" / "Cerrado anticipadamente" / "Completado"), and the
"Sugerencias personalizadas" AI panel still loads without a `viewMode`-related console error.

- [ ] **Step 12: Commit**

```bash
git add src/pages/reportes.jsx
git commit -m "refactor: merge Por Ciclos/Semanal report views into one"
```

---

### Task 4: Frontend — rename "ciclo"/"lanzar" to "ronda"/"iniciar" across user-facing copy

**Files:**
- Modify: `src/components/LaunchMBIModal.jsx`
- Modify: `src/pages/dashboard.jsx`
- Modify: `src/pages/evaluaciones.jsx`
- Modify: `src/pages/mbi.jsx`
- Modify: `src/pages/reportes.jsx`
- Modify: `src/utils/groqClient.js`

**Interfaces:**
- Pure copy change — no props, state, or function signatures are affected. Consumes nothing new from
  earlier tasks; produces nothing later tasks depend on (this is the final task in the plan).

This task is intentionally scheduled last so it operates on the final, post-merge structure of
`reportes.jsx` from Task 3, instead of renaming text in `getWeeklyData`/the old toggle buttons that Task 3
already deleted.

Mapping used throughout: "ciclo"→"ronda", "Ciclo"→"Ronda", "lanzar"→"iniciar", "Lanzar"→"Iniciar",
"Lanzando"→"Iniciando". Do NOT rename: table/column names (`mbi_evaluation_cycles`, `cycle_id`, `status`),
JS identifiers (`activeCycleId`, `launchMBI`, `handleEndCycle`, `teamCycles`, `cycleId`, `viewMode` is
already gone per Task 3, etc.), or anything inside `console.*` calls.

- [ ] **Step 1: `src/components/LaunchMBIModal.jsx`**

Find (line 44):
```jsx
            {activeCycleId ? 'Iniciar nuevo ciclo MBI' : 'Lanzar MBI'}
```
Replace with:
```jsx
            {activeCycleId ? 'Iniciar nueva ronda' : 'Iniciar ronda'}
```

Find (line 68):
```jsx
              <p className="text-sm font-medium text-[#2E2E3A] mb-1">⏰ Duración del ciclo</p>
```
Replace with:
```jsx
              <p className="text-sm font-medium text-[#2E2E3A] mb-1">⏰ Duración de la ronda</p>
```

Find (lines 70-71):
```jsx
                El ciclo se <strong className="text-[#2E2E3A]">cerrará automáticamente después de 7 días</strong> desde su inicio. 
                Los miembros que no respondan en este período no podrán participar hasta el próximo ciclo.
```
Replace with:
```jsx
                La ronda se <strong className="text-[#2E2E3A]">cerrará automáticamente después de 7 días</strong> desde su inicio. 
                Los miembros que no respondan en este período no podrán participar hasta la próxima ronda.
```

Find (line 79):
```jsx
            Ya existe un ciclo activo. Crear uno nuevo cerrará el ciclo actual y permitirá que todos respondan nuevamente.
```
Replace with:
```jsx
            Ya existe una ronda activa. Iniciar una nueva cerrará la ronda actual y permitirá que todos respondan nuevamente.
```

Find (line 90):
```jsx
                Este equipo no tiene miembros aún. Puedes lanzar el MBI de todas formas, pero recuerda invitar miembros para que participen.
```
Replace with:
```jsx
                Este equipo no tiene miembros aún. Puedes iniciar la ronda de todas formas, pero recuerda invitar miembros para que participen.
```

Find (line 94):
```jsx
              <p className="text-sm text-[#55C2A2] font-medium">✅ Todos los miembros han respondido el ciclo actual.</p>
```
Replace with:
```jsx
              <p className="text-sm text-[#55C2A2] font-medium">✅ Todos los miembros han respondido la ronda actual.</p>
```

Find (line 130):
```jsx
                Lanzando...
```
Replace with:
```jsx
                Iniciando...
```

Find (line 132):
```jsx
            ) : (activeCycleId ? 'Crear nuevo ciclo' : 'Lanzar ahora')}
```
Replace with:
```jsx
            ) : (activeCycleId ? 'Iniciar nueva ronda' : 'Iniciar ahora')}
```

- [ ] **Step 2: `src/pages/dashboard.jsx`**

Find (the two identical `setDataError` messages, one in the leader-load path, one in the member-load
path):
```jsx
        setDataError('No se pudieron cargar los ciclos de evaluación. Algunos datos podrían faltar.');
```
Replace BOTH occurrences with:
```jsx
        setDataError('No se pudieron cargar las rondas de evaluación. Algunos datos podrían faltar.');
```

Find:
```jsx
        setDataError("No se pudo cerrar el ciclo anterior. Intenta lanzar el MBI de nuevo.");
```
Replace with:
```jsx
        setDataError("No se pudo cerrar la ronda anterior. Intenta iniciar el MBI de nuevo.");
```

Find:
```jsx
      alert('Error lanzando MBI: ' + (e.message || ''));
```
Replace with:
```jsx
      alert('Error iniciando la ronda: ' + (e.message || ''));
```

Find:
```jsx
      alert('Error terminando ciclo: ' + (e.message || ''));
```
Replace with:
```jsx
      alert('Error terminando ronda: ' + (e.message || ''));
```

Find both occurrences of the member-row badge:
```jsx
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">Sin ciclo</span>
```
Replace with:
```jsx
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">Sin ronda</span>
```

Find:
```jsx
              {ending ? 'Terminando...' : 'Terminar ciclo'}
```
Replace with:
```jsx
              {ending ? 'Terminando...' : 'Terminar ronda'}
```

Find the launch button pair:
```jsx
              {launching ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Lanzando...
                </span>
              ) : (
                'Lanzar MBI'
              )}
```
Replace with:
```jsx
              {launching ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Iniciando...
                </span>
              ) : (
                'Iniciar ronda'
              )}
```

Find:
```jsx
              Ciclo activo
```
Replace with:
```jsx
              Ronda activa
```

Find the member-view badge (a second, distinct `Sin ciclo` occurrence in the member's own team card,
separate from the leader-view one above — confirm you've updated both by searching for the literal string
`Sin ciclo` and updating every remaining match):
```jsx
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">Sin ciclo</span>
```
Replace with:
```jsx
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">Sin ronda</span>
```

Find:
```jsx
                Sin ciclo activo
```
Replace with:
```jsx
                Sin ronda activa
```

- [ ] **Step 3: `src/pages/evaluaciones.jsx`**

Find both occurrences of:
```jsx
        setError('No se pudieron cargar los ciclos activos de tus equipos.');
```
Replace both with:
```jsx
        setError('No se pudieron cargar las rondas activas de tus equipos.');
```

Find:
```jsx
        setError('No se pudo cerrar el ciclo anterior. Intenta lanzar el MBI de nuevo.');
```
Replace with:
```jsx
        setError('No se pudo cerrar la ronda anterior. Intenta iniciar el MBI de nuevo.');
```

Find:
```jsx
        setSuccess('Nuevo ciclo MBI creado correctamente.');
```
Replace with:
```jsx
        setSuccess('Nueva ronda MBI creada correctamente.');
```

Find:
```jsx
      setError(e.message || 'Error al lanzar MBI');
```
Replace with:
```jsx
      setError(e.message || 'Error al iniciar la ronda MBI');
```

Find:
```jsx
        <h2 className="...">Lanzar MBI a un equipo</h2>
```
(match the actual className string as it appears; only the text content changes)
Replace the text content `Lanzar MBI a un equipo` with `Iniciar ronda MBI en un equipo`.

Find:
```jsx
            ℹ️ Gestión de ciclos
```
Replace with:
```jsx
            ℹ️ Gestión de rondas
```

Find:
```jsx
            Los ciclos MBI duran 7 días calendario desde su inicio y se cierran automáticamente. 
                    Puedes ver el progreso y generar reportes en cualquier momento durante este período.
```
Replace with:
```jsx
            Las rondas MBI duran 7 días calendario desde su inicio y se cierran automáticamente. 
                    Puedes ver el progreso y generar reportes en cualquier momento durante este período.
```

Find:
```jsx
                    {activeCycles[t.id] ? (launching ? 'Lanzando...' : 'Nuevo ciclo MBI') : (launching ? 'Lanzando...' : 'Lanzar MBI')}
```
Replace with:
```jsx
                    {activeCycles[t.id] ? (launching ? 'Iniciando...' : 'Nueva ronda MBI') : (launching ? 'Iniciando...' : 'Iniciar ronda MBI')}
```

- [ ] **Step 4: `src/pages/mbi.jsx`**

Find:
```jsx
            setError('No se pudo verificar el ciclo de evaluación activo. Intenta de nuevo.');
```
Replace with:
```jsx
            setError('No se pudo verificar la ronda de evaluación activa. Intenta de nuevo.');
```

Find:
```jsx
      setError('Error verificando ciclo activo.');
```
Replace with:
```jsx
      setError('Error verificando ronda activa.');
```

Find:
```jsx
        throw new Error('No hay ciclo activo.');
```
Replace with:
```jsx
        throw new Error('No hay ronda activa.');
```

Find:
```jsx
        throw new Error('El ciclo activo ya no existe o fue cerrado. Refresca e inténtalo de nuevo.');
```
Replace with:
```jsx
        throw new Error('La ronda activa ya no existe o fue cerrada. Refresca e inténtalo de nuevo.');
```

Find:
```jsx
          No hay un ciclo activo en este momento para este equipo.
```
Replace with:
```jsx
          No hay una ronda activa en este momento para este equipo.
```

- [ ] **Step 5: `src/pages/reportes.jsx`**

Find:
```jsx
                <p className="text-[#5B5B6B] text-sm mt-1">Visualiza tendencias por ciclo y distribución de riesgo de burnout.</p>
```
Replace with:
```jsx
                <p className="text-[#5B5B6B] text-sm mt-1">Visualiza tendencias por ronda y distribución de riesgo de burnout.</p>
```

Find:
```jsx
                    <LoadingSpinner size="small" message="Cargando ciclos..."/>
```
Replace with:
```jsx
                    <LoadingSpinner size="small" message="Cargando rondas..."/>
```

Find:
```jsx
                              Ciclo #{row.friendlyId}:
```
Note: after Task 3's Step 7, `row.friendlyId` no longer exists on `aggregated` rows (it was a
`getWeeklyData`-only field) — if this string still appears anywhere after Task 3, it means Task 3's Step 7
replacement wasn't fully applied; there is no `Ciclo #{row.friendlyId}` line left in the merged single-row
renderer written in Task 3. Skip this entry (nothing to find) and instead verify no such text remains.

Find:
```jsx
                  <p className="text-xs sm:text-sm text-gray-500">Se necesitan al menos 2 ciclos con respuestas para graficar la tendencia.</p>
```
Replace with:
```jsx
                  <p className="text-xs sm:text-sm text-gray-500">Se necesitan al menos 2 rondas con respuestas para graficar la tendencia.</p>
```

Find (member status text in the leader's member list):
```jsx
                        {hasResponded ? 'Ha respondido el último ciclo' : 'No ha respondido el último ciclo'}
```
Replace with:
```jsx
                        {hasResponded ? 'Ha respondido la última ronda' : 'No ha respondido la última ronda'}
```

Find (the `CycleHelp` inline component):
```jsx
        ¿Qué son los ciclos y las dimensiones del MBI?
```
Replace with:
```jsx
        ¿Qué son las rondas y las dimensiones del MBI?
```

Find:
```jsx
          Qué es un ciclo
```
Replace with:
```jsx
          Qué es una ronda
```

Find:
```jsx
          Periodo activo en el que el equipo responde el cuestionario. Al cerrarlo se congelan sus resultados.
```
(no literal "ciclo" here, but confirm this line's wording still reads naturally next to the just-renamed
"Qué es una ronda" heading above it — no text change needed, just verify while you're in this component)

Find:
```jsx
                  {data.length} ciclo{data.length !== 1 ? 's' : ''}
```
Replace with:
```jsx
                  {data.length} ronda{data.length !== 1 ? 's' : ''}
```

Find:
```jsx
          Genera al menos un ciclo para ver insights
```
Replace with:
```jsx
          Genera al menos una ronda para ver insights
```

Find (inside `AdvicePanel`, the 3 strings left as "ciclo" on purpose by Task 3's Step 9):
```jsx
        {loading && `🔄 Analizando evolución por ciclos del equipo...`}
```
Replace with:
```jsx
        {loading && `🔄 Analizando evolución por rondas del equipo...`}
```

```jsx
              • {historyData.length} ciclo(s) de historia
```
Replace with:
```jsx
              • {historyData.length} ronda(s) de historia
```

```jsx
          <span>🧠 Sugerencias por ciclos basadas en reglas heurísticas</span>
```
Replace with:
```jsx
          <span>🧠 Sugerencias por rondas basadas en reglas heurísticas</span>
```

Find:
```jsx
              analysisScope: 'Análisis por ciclos de evaluación'
```
(appears twice, in `handleAIFetch` and in the render-time duplicate — replace both)
Replace with:
```jsx
              analysisScope: 'Análisis por rondas de evaluación'
```

Find:
```jsx
        <p className="text-[10px] text-gray-400">
          {mode === 'ai' && aiAdvice 
            ? `🤖 Análisis evolutivo por Groq AI basado en ${historyData.length} ciclo(s) - Fallback automático a local si falla` 
            : '🧠 Sugerencias heurísticas locales - Pulsa "IA + Tendencias" para análisis histórico avanzado'
          }
        </p>
```
Replace with:
```jsx
        <p className="text-[10px] text-gray-400">
          {mode === 'ai' && aiAdvice 
            ? `🤖 Análisis evolutivo por Groq AI basado en ${historyData.length} ronda(s) - Fallback automático a local si falla` 
            : '🧠 Sugerencias heurísticas locales - Pulsa "IA + Tendencias" para análisis histórico avanzado'
          }
        </p>
```

- [ ] **Step 6: `src/utils/groqClient.js`** (AI prompt text — included so the AI's generated advice
  doesn't say "ciclo" while the surrounding UI says "ronda")

Find:
```js
ESTADO ACTUAL (último ciclo):
```
Replace with:
```js
ESTADO ACTUAL (última ronda):
```

Find:
```js
    prompt += `\n\nEVOLUCIÓN HISTÓRICA (${history.length} ciclos):`;
```
Replace with:
```js
    prompt += `\n\nEVOLUCIÓN HISTÓRICA (${history.length} rondas):`;
```

Find:
```js
      prompt += `\nCiclo ${cycleNum}: AE=${cycle.ae} (${hAE}), D=${cycle.d} (${hD}), RP=${cycle.rp} (${hRP}) → ${hStatus}`;
```
Replace with:
```js
      prompt += `\nRonda ${cycleNum}: AE=${cycle.ae} (${hAE}), D=${cycle.d} (${hD}), RP=${cycle.rp} (${hRP}) → ${hStatus}`;
```

Find:
```js
    prompt += `\n\nCOMPARACIÓN CON CICLO ANTERIOR:`;
```
Replace with:
```js
    prompt += `\n\nCOMPARACIÓN CON RONDA ANTERIOR:`;
```

Find:
```js
- Si es primer ciclo o sin historia, usa "null" en trend_analysis y prognosis
```
Replace with:
```js
- Si es primera ronda o sin historia, usa "null" en trend_analysis y prognosis
```

- [ ] **Step 7: Build check**

Run `npm run build` — must succeed with no new errors.

- [ ] **Step 8: Grep sweep for anything missed**

Run (from `TeamZen/`):
```bash
grep -rn "ciclo\|Ciclo\|[Ll]anzar\|Lanzando" src/components/LaunchMBIModal.jsx src/pages/dashboard.jsx src/pages/evaluaciones.jsx src/pages/mbi.jsx src/pages/reportes.jsx src/utils/groqClient.js
```
Expected: zero remaining matches in JSX text/strings. Any match should be either (a) a code comment
(acceptable, comments were explicitly out of scope), (b) a `console.*` call (acceptable, not user-facing),
or (c) a database/JS identifier like `mbi_evaluation_cycles`/`cycle_id`/`activeCycleId`/`teamCycles`
(acceptable, identifiers are not renamed). If a match is none of these three, it's a miss — fix it.

- [ ] **Step 9: Manual QA note (human required)**

Click through the full round lifecycle as a leader (create/iniciar ronda, view it in Reportes, terminar
ronda) and confirm every visible label reads "ronda"/"iniciar", never "ciclo"/"lanzar", and that nothing
reads awkwardly in context (a mechanical find-replace can occasionally produce a grammatically odd
sentence that only a human reading it in place will catch).

- [ ] **Step 10: Commit**

```bash
git add src/components/LaunchMBIModal.jsx src/pages/dashboard.jsx src/pages/evaluaciones.jsx src/pages/mbi.jsx src/pages/reportes.jsx src/utils/groqClient.js
git commit -m "feat: rename ciclo/lanzar to ronda/iniciar across user-facing copy"
```

---

## Plan self-review notes

- **Spec coverage**: vocabulary → Task 4. Real 7-day auto-close → Tasks 1-2. Merged reports view → Task 3.
  All three spec sections have a corresponding task, in the dependency order the spec's own rationale
  implies (auto-close's DB function first, since Task 2 calls it; report-view merge before vocabulary, so
  vocabulary doesn't touch text Task 3 deletes).
- **Type/name consistency check**: `close_expired_mbi_cycles()` takes no arguments and returns `void` —
  used identically in Task 1's verification and Task 2's 4 call sites. `aggregated`'s new fields
  (`isActiveCycle`, `cycleEndedEarly`, `actualDuration`) are named and computed once in Task 3 Step 4, then
  consumed with those exact names in Task 3 Step 7 — no renaming drift between producer and consumer.
  `AdvicePanel`'s signature change (`{ data, teamId, viewMode = 'cycles' }` → `{ data, teamId }`) is
  applied consistently at both its definition (Task 3 Step 9) and its only call site (Task 3 Step 8).
- **No placeholders**: every step includes literal before/after code or exact grep commands, not
  descriptions of what to do.
