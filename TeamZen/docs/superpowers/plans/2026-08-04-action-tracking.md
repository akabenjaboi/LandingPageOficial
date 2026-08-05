# Action Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a team leader mark AI-generated advice suggestions as pendiente/en curso/hecha, and see the
previous round's tracked actions and their status when a new round's suggestions are shown — closing the
loop between "the platform suggested something" and "did anything happen."

**Architecture:** One new table (`mbi_action_tracking`, gated by the existing `is_team_leader` RLS helper —
no `SECURITY DEFINER` needed, this holds no individual score data) tracks a status per suggested-action
text, scoped to a team+cycle. `AdvicePanel` (`src/pages/reportes.jsx`) seeds a row per AI-generated action
the first time it's shown, lets the leader click through its status, and additionally loads the previous
round's tracked rows into a small block shown above the current suggestions.

**Tech Stack:** Supabase (Postgres/RLS, applied via MCP `apply_migration` — no local migration files exist
in this repo), React 19 + Vite frontend, no test framework (verification is impersonation-based SQL testing
plus `npm run build`).

## Global Constraints

- SQL changes are applied via the Supabase MCP `apply_migration` tool directly to production
  (`alzjmlnoaxqlkdtvwisr`) — there is no local `supabase/migrations` directory in this repo.
- Tracking is leader-only — no member-facing visibility, no change to any member-facing view.
- Tracking applies **only** to AI-generated suggestions (`mode === 'ai' && aiAdvice`). Local-heuristic-mode
  suggestions (`generateAdvice()` in `src/utils/adviceEngine.js`) are never seeded, tracked, or given status
  controls — that engine's `pick()` helper randomly resamples its output on every call, so its text isn't
  stable content to attach a status to. Do not modify `adviceEngine.js` or `generateAdvice()` as part of
  this plan.
- Actions are tracked by exact text match (no stable ID, no semantic matching across regenerations) — an
  accepted v1 simplification. Regenerating AI advice mid-round with different wording seeds fresh,
  independent rows rather than continuing an old row's status.
- No `DELETE` policy/path for tracked rows — orphaned rows from regenerations are harmless clutter, not
  cleaned up in this version.
- No test framework exists in this repo — verification is impersonation-based SQL testing (`execute_sql`
  wrapped in `begin; set local role authenticated; set local request.jwt.claims = '...'; ...; rollback;`)
  plus `npm run build` succeeding.

---

### Task 1: Database — `mbi_action_tracking` table and RLS policies

**Files:**
- No local files — applied via `mcp__supabase__apply_migration`.

**Interfaces:**
- Produces: `public.mbi_action_tracking` table
  (`id uuid, team_id uuid, cycle_id uuid, action_text text, status text, created_at timestamptz, updated_at
  timestamptz`, unique on `(team_id, cycle_id, action_text)`), consumed by Task 2 via ordinary
  `supabase.from('mbi_action_tracking')` calls (`select`/`upsert`/`update`), gated by RLS requiring
  `is_team_leader(team_id)` for every operation.

- [ ] **Step 1: Apply the migration**

Call `mcp__supabase__apply_migration` with `name: "mbi_action_tracking_table"` and this `query`:

```sql
begin;

create table public.mbi_action_tracking (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  cycle_id uuid not null references public.mbi_evaluation_cycles(id) on delete cascade,
  action_text text not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'en_curso', 'hecha')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, cycle_id, action_text)
);

alter table public.mbi_action_tracking enable row level security;

create policy mbi_action_tracking_select_as_leader on public.mbi_action_tracking
  for select
  using (is_team_leader(team_id));

create policy mbi_action_tracking_insert_as_leader on public.mbi_action_tracking
  for insert
  with check (is_team_leader(team_id));

create policy mbi_action_tracking_update_as_leader on public.mbi_action_tracking
  for update
  using (is_team_leader(team_id))
  with check (is_team_leader(team_id));

commit;
```

- [ ] **Step 2: Verify a real team leader can insert a tracking row for their own team**

Find a real team and its leader:

```sql
select id as team_id, leader_id from teams limit 3;
```

Impersonate that leader in a rolled-back transaction:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_id>","role":"authenticated"}';
insert into mbi_action_tracking (team_id, cycle_id, action_text)
values ('<team_id>', (select id from mbi_evaluation_cycles where team_id = '<team_id>' limit 1), 'TEST acción de prueba')
returning id, status;
rollback;
```

Expected: insert succeeds, returned row shows `status = 'pendiente'` (the column default).

If the team has no cycles at all, pick a different team from Step 2's results that does (`select id from
mbi_evaluation_cycles where team_id = '<team_id>' limit 1` returning a real row) — a `cycle_id` value is
required since the column is `not null` with a foreign key.

- [ ] **Step 3: Verify a user who is not that team's leader cannot insert or select**

Find any other real user who isn't `<leader_id>` from Step 2 (`select id from profiles where id !=
'<leader_id>' limit 1;`), impersonate them in a rolled-back transaction:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<other_user_id>","role":"authenticated"}';
insert into mbi_action_tracking (team_id, cycle_id, action_text)
values ('<team_id>', (select id from mbi_evaluation_cycles where team_id = '<team_id>' limit 1), 'TEST should fail');
rollback;
```

Expected: fails with an RLS policy violation (`new row violates row-level security policy`).

- [ ] **Step 4: Verify the real leader can update a row's status**

In a rolled-back transaction, impersonating `<leader_id>` again, insert a row and then update its status in
the same transaction:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_id>","role":"authenticated"}';
insert into mbi_action_tracking (team_id, cycle_id, action_text)
values ('<team_id>', (select id from mbi_evaluation_cycles where team_id = '<team_id>' limit 1), 'TEST update target')
returning id;
update mbi_action_tracking set status = 'en_curso' where team_id = '<team_id>' and action_text = 'TEST update target';
select status from mbi_action_tracking where team_id = '<team_id>' and action_text = 'TEST update target';
rollback;
```

Expected: the final `select` shows `status = 'en_curso'` before rollback.

- [ ] **Step 5: Verify the unique constraint prevents a duplicate seed**

In a rolled-back transaction, impersonating `<leader_id>`, insert the same `(team_id, cycle_id,
action_text)` triple twice via an upsert with `on conflict do nothing` semantics:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_id>","role":"authenticated"}';
insert into mbi_action_tracking (team_id, cycle_id, action_text)
values ('<team_id>', (select id from mbi_evaluation_cycles where team_id = '<team_id>' limit 1), 'TEST dedup')
on conflict (team_id, cycle_id, action_text) do nothing;
insert into mbi_action_tracking (team_id, cycle_id, action_text)
values ('<team_id>', (select id from mbi_evaluation_cycles where team_id = '<team_id>' limit 1), 'TEST dedup')
on conflict (team_id, cycle_id, action_text) do nothing;
select count(*) from mbi_action_tracking where team_id = '<team_id>' and action_text = 'TEST dedup';
rollback;
```

Expected: `count = 1` (the second insert was a no-op, not a duplicate row or an error).

- [ ] **Step 6: Confirm no test data persisted**

```sql
select count(*) from mbi_action_tracking where action_text like 'TEST%';
```

Expected: `0` (every test transaction above was rolled back).

- [ ] **Step 7: Run `get_advisors(type: "security")`**

Expect no new ERROR-level findings. This table has no `SECURITY DEFINER` function of its own, so it
shouldn't add anything to that WARN class either.

---

### Task 2: Frontend — action tracking in `AdvicePanel`

**Files:**
- Modify: `src/pages/reportes.jsx` (the `AdvicePanel` function)

**Interfaces:**
- Consumes: `public.mbi_action_tracking` from Task 1, via `supabase.from('mbi_action_tracking')`
  `.upsert(...)` / `.select(...)` / `.update(...)`.
- No new exports — all changes are internal to `AdvicePanel`.

- [ ] **Step 1: Add tracking state and hoisted cycle-ID lookup, above the component's existing early
  returns**

Find (`src/pages/reportes.jsx`, the start of `AdvicePanel`):
```jsx
function AdvicePanel({ data, teamId }) {
  const [mode, setMode] = React.useState('ai'); // 'local' | 'ai' - IA por defecto
  const [loading, setLoading] = React.useState(false);
  const [aiAdvice, setAiAdvice] = React.useState(null);
  const [error, setError] = React.useState('');
```
Replace with:
```jsx
function AdvicePanel({ data, teamId }) {
  const [mode, setMode] = React.useState('ai'); // 'local' | 'ai' - IA por defecto
  const [loading, setLoading] = React.useState(false);
  const [aiAdvice, setAiAdvice] = React.useState(null);
  const [error, setError] = React.useState('');
  const [currentActionStatuses, setCurrentActionStatuses] = React.useState({}); // action_text -> status, for the current cycle
  const [prevActionStatuses, setPrevActionStatuses] = React.useState([]); // [{action_text, status}], for the previous cycle, oldest-first

  // Hoisted above this component's early returns below (React forbids hooks
  // after a conditional return), purely to learn the current/previous cycle
  // IDs — the render body further down computes its own `valid`/`current`/
  // `prev` again for its own purposes (pre-existing duplication in this
  // file, not introduced by this change).
  const validForTracking = data.filter(r => r.count > 0 && r.aeAvg != null && r.dAvg != null && r.rpAvg != null && r.wellbeing != null);
  const currentForTracking = validForTracking[0];
  const prevForTracking = validForTracking.length > 1 ? validForTracking[1] : null;
```

- [ ] **Step 2: Add the two tracking effects, right after `handleAIFetch`'s definition**

Find (`src/pages/reportes.jsx`, the line right after `handleAIFetch`'s closing and right before the
auto-generate effect):
```jsx
  }, [loading, data, teamId]);

  // Auto-generar análisis de IA cuando hay datos válidos
  React.useEffect(() => {
```
Replace with:
```jsx
  }, [loading, data, teamId]);

  // Sembrar y cargar el estado trackeado de las acciones de la ronda actual —
  // solo cuando se está mostrando IA (el modo local resamplea sus acciones al
  // azar en cada render, no es contenido estable al que asignarle un estado).
  const aiActionsKey = JSON.stringify((mode === 'ai' && aiAdvice?.actions) || []);

  React.useEffect(() => {
    if (mode !== 'ai' || !aiAdvice?.actions?.length || !currentForTracking?.cycle?.id) return;
    const actionsList = aiAdvice.actions;
    let cancelled = false;
    (async () => {
      const rows = actionsList.map(action_text => ({ team_id: teamId, cycle_id: currentForTracking.cycle.id, action_text }));
      const { error: seedError } = await supabase
        .from('mbi_action_tracking')
        .upsert(rows, { onConflict: 'team_id,cycle_id,action_text', ignoreDuplicates: true });
      if (seedError) console.warn('No se pudieron registrar las acciones sugeridas', seedError);

      const { data: loaded, error: loadError } = await supabase
        .from('mbi_action_tracking')
        .select('action_text, status')
        .eq('team_id', teamId)
        .eq('cycle_id', currentForTracking.cycle.id);
      if (cancelled) return;
      if (loadError) { console.warn('No se pudieron cargar los estados de acciones', loadError); return; }
      const map = {};
      (loaded || []).forEach(r => { map[r.action_text] = r.status; });
      setCurrentActionStatuses(map);
    })();
    return () => { cancelled = true; };
  }, [teamId, currentForTracking?.cycle?.id, aiActionsKey]);

  // Cargar (solo lectura hasta que se haga clic) las acciones trackeadas de
  // la ronda anterior — no depende de `mode`/`aiAdvice`, ya que esa ronda
  // pudo haber sido sembrada en su propia sesión de modo IA, independiente
  // del modo que se esté viendo ahora.
  React.useEffect(() => {
    if (!prevForTracking?.cycle?.id) { setPrevActionStatuses([]); return; }
    let cancelled = false;
    (async () => {
      const { data: loaded, error } = await supabase
        .from('mbi_action_tracking')
        .select('action_text, status')
        .eq('team_id', teamId)
        .eq('cycle_id', prevForTracking.cycle.id)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) { console.warn('No se pudieron cargar las acciones de la ronda anterior', error); setPrevActionStatuses([]); return; }
      setPrevActionStatuses(loaded || []);
    })();
    return () => { cancelled = true; };
  }, [teamId, prevForTracking?.cycle?.id]);

  // Auto-generar análisis de IA cuando hay datos válidos
  React.useEffect(() => {
```

- [ ] **Step 3: Add the status-toggle handler, right before the component's `return`**

Find (`src/pages/reportes.jsx`, the line just before `AdvicePanel`'s main JSX return, right after
`const displayAdvice = ...`):
```jsx
  // Determinar qué sugerencias mostrar
  const displayAdvice = mode === 'ai' && aiAdvice ? aiAdvice : localAdvice;

  return (
```
Replace with:
```jsx
  // Determinar qué sugerencias mostrar
  const displayAdvice = mode === 'ai' && aiAdvice ? aiAdvice : localAdvice;

  const STATUS_CYCLE = { pendiente: 'en_curso', en_curso: 'hecha', hecha: 'pendiente' };
  const STATUS_LABEL = { pendiente: '⚪ Pendiente', en_curso: '🔵 En curso', hecha: '✅ Hecha' };

  const handleToggleActionStatus = async (cycleId, actionText, currentStatus, isCurrentCycle) => {
    const nextStatus = STATUS_CYCLE[currentStatus] || 'en_curso';
    const { error: toggleError } = await supabase
      .from('mbi_action_tracking')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('cycle_id', cycleId)
      .eq('action_text', actionText);
    if (toggleError) { console.warn('No se pudo actualizar el estado de la acción', toggleError); return; }
    if (isCurrentCycle) {
      setCurrentActionStatuses(m => ({ ...m, [actionText]: nextStatus }));
    } else {
      setPrevActionStatuses(list => list.map(r => r.action_text === actionText ? { ...r, status: nextStatus } : r));
    }
  };

  return (
```

- [ ] **Step 4: Render the "previous round" block and add status controls to the current actions list**

Find (`src/pages/reportes.jsx`, the "💡 Acciones recomendadas" block):
```jsx
        <div>
          <p className="text-xs font-semibold text-gray-800 mb-1">💡 Acciones recomendadas</p>
          {!displayAdvice.actions?.length ? (
            <p className="text-xs text-gray-500">Sin acciones prioritarias detectadas.</p>
          ) : (
            <ul className="list-disc pl-4 text-xs text-gray-600 space-y-0.5">
              {displayAdvice.actions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          )}
        </div>
```
Replace with:
```jsx
        {prevActionStatuses.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-800 mb-1">📋 Acciones de la ronda anterior</p>
            <ul className="list-disc pl-4 text-xs text-gray-600 space-y-0.5">
              {prevActionStatuses.map((row) => (
                <li key={row.action_text} className="flex items-start justify-between gap-2">
                  <span>{row.action_text}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleActionStatus(prevForTracking.cycle.id, row.action_text, row.status, false)}
                    className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-gray-300 hover:bg-gray-50"
                    title="Click para cambiar el estado"
                  >
                    {STATUS_LABEL[row.status] || STATUS_LABEL.pendiente}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-800 mb-1">💡 Acciones recomendadas</p>
          {!displayAdvice.actions?.length ? (
            <p className="text-xs text-gray-500">Sin acciones prioritarias detectadas.</p>
          ) : (
            <ul className="list-disc pl-4 text-xs text-gray-600 space-y-0.5">
              {displayAdvice.actions.map((action, i) => {
                const isTrackable = mode === 'ai' && !!aiAdvice;
                const status = currentActionStatuses[action] || 'pendiente';
                if (!isTrackable) {
                  return <li key={i}>{action}</li>;
                }
                return (
                  <li key={i} className="flex items-start justify-between gap-2">
                    <span>{action}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleActionStatus(currentForTracking.cycle.id, action, status, true)}
                      className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-gray-300 hover:bg-gray-50"
                      title="Click para cambiar el estado"
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
```

- [ ] **Step 5: Build check**

Run `npm run build` from `C:\Claude\Teamzen\TeamZen` — must succeed with no new errors (the pre-existing
groqClient dynamic/static import warning is expected and fine).

- [ ] **Step 6: Manual QA note (human required)**

As a leader of a team with at least two AI-scored rounds: open Reportes, confirm the "Acciones
recomendadas" list under IA mode shows a status badge per action; click through a badge's states
(pendiente → en curso → hecha → pendiente); refresh the page and confirm the status persisted; confirm
switching to "🧠 Local" mode shows the same actions with no status badges; confirm the "📋 Acciones de la
ronda anterior" block appears above the current suggestions showing the prior round's tracked actions and
statuses.

- [ ] **Step 7: Commit**

```bash
git add src/pages/reportes.jsx
git commit -m "feat: let leaders track status of AI-suggested actions across rounds"
```

---

## Plan self-review notes

- **Spec coverage:** the spec's architecture (new table + RLS, seed/load/toggle in `AdvicePanel`, AI-only
  tracking, previous-round display) maps 1:1 to Task 1 (DB) and Task 2 (frontend). All three accepted v1
  simplifications (exact-text matching, no dedup across regenerations, AI-only tracking) are reflected in
  Task 2's code exactly as specified — no task attempts to build the excluded correlation/analytics layer
  or touch `adviceEngine.js`.
- **Type/naming consistency:** `mbi_action_tracking`'s columns (`team_id`, `cycle_id`, `action_text`,
  `status`) are defined once in Task 1 and referenced with those exact names in every Task 2 query. The
  `STATUS_CYCLE`/`STATUS_LABEL` maps and the `'pendiente' | 'en_curso' | 'hecha'` status values are
  introduced once in Task 2 Step 3 and used consistently in Step 4's render — no drift.
- **No placeholders:** every step has literal SQL/JSX before-after content or exact verification queries.
