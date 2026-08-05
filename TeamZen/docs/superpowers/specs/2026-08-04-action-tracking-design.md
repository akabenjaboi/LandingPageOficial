# Action tracking — closing the loop on advice

Status: approved by user, pending implementation plan.

## Context

Third of three sequential product/security issues raised while questioning TeamZen's logic (first was MBI
leader-visibility privacy enforcement, second was leader-assignment hardening, both shipped). The
remaining issue: TeamZen measures burnout/wellbeing via MBI evaluation rounds and generates AI/heuristic
advice (`AdvicePanel` in `src/pages/reportes.jsx`) each round, but nothing tracks whether a leader acted on
past suggestions. The loop is purely diagnostic — measure, advise, repeat — with no memory of what was
tried. This is the classic setup for survey fatigue: if members never see their input lead anywhere, they
stop answering honestly or at all.

## Scope

A minimal closed loop, decided during brainstorming:

- **Leader-only.** No member-facing visibility of tracked actions (members already can't see team
  aggregates at all, per the existing product model — this doesn't change that).
- **Tracks only AI/heuristic-generated suggestions** — no freeform custom action entry by the leader. The
  suggestions `AdvicePanel` already generates each round (`displayAdvice.actions`, a `string[]`) gain a
  per-action status (`pendiente` / `en_curso` / `hecha`) that the leader can change with a click.
- **No automatic correlation/trend analysis** between marking an action done and subsequent wellbeing
  changes — explicitly out of scope (statistically fragile with the small number of rounds any real team
  will have, and adds real complexity for unclear benefit at this stage).
- **Carries forward exactly one round of context**: `AdvicePanel` already computes `current` and `prev`
  (the two most recent scored cycles, used today for trend text) — this reuses that same pair. A compact
  "Acciones de la ronda anterior" block shows `prev`'s tracked actions and their status above the current
  round's freshly-generated suggestions, so the leader sees what they committed to before deciding what's
  next.

Three accepted simplifications for this v1, all surfaced and approved during brainstorming:

1. **Actions are tracked by exact text match, not stable ID.** If the leader force-regenerates AI advice
   mid-round and the wording changes, the old text's tracked status doesn't carry over — the new wording is
   a fresh, untracked entry. No semantic matching is attempted.
2. **No deduplication across regenerations within the same round.** Multiple force-regenerations in one
   round can seed multiple, differently-worded rows for what's conceptually the same suggestion; each is
   tracked independently. In the rare case of repeated forced regeneration, the "acciones de la ronda
   anterior" block for the *next* round may show more than one phrasing of a similar idea. Accepted as a
   reasonable v1 trade-off rather than building text-similarity matching.
3. **Only AI-generated suggestions are trackable — the local heuristic mode is not.** Investigating the
   exact code path revealed `generateAdvice()` (`src/utils/adviceEngine.js`) picks its `actions` via a
   `pick()` helper that does `[...list].sort(() => Math.random() - 0.5).slice(...)` — a fresh random
   subset on **every call**, and `AdvicePanel` calls `generateAdvice(mbiPayload)` fresh on every render
   (unmemoized). This means local-mode actions aren't stable content to attach a status to at all — the
   text itself changes randomly from one render to the next, independent of any regeneration action. Fixing
   that randomness would mean touching the heuristic engine, which is explicitly out of scope (the user
   plans to retire local-heuristic mode entirely at some future point, making it not worth engineering
   around now). So: tracking only activates when `mode === 'ai' && aiAdvice` — the AI-generated advice
   object, which is fetched once and held in stable React state until a real re-fetch, is the only
   suggestion source with content stable enough to track. Local mode's action list keeps rendering exactly
   as it does today, with no status controls at all.

Explicitly out of scope: any correlation/analytics layer, any change to how `AdvicePanel` generates
suggestions (AI prompt, local heuristic engine) — this only adds a status label on top of the AI-generated
suggestions that already exist.

## Architecture

One new table, gated by the same `is_team_leader(team_id)` helper already used throughout this project —
no `SECURITY DEFINER` function is needed here, since this table holds no individual MBI scores or
identity-sensitive data, just suggestion text and a status label, so ordinary owner-scoped RLS is
sufficient (unlike the k-anonymity work, which needed to bypass RLS to compute an anonymized aggregate).

`AdvicePanel` gains two effects: one seeds+loads tracked status for the *current* round's suggestions
(keyed off the stringified actions list, so it re-seeds only when the actual suggestion text changes, not
on every render), and one loads (read-only-until-clicked) the *previous* round's tracked actions. A single
click handler updates a row's status and updates the relevant local state map.

## Database

```sql
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
```

No `DELETE` policy — rows are never deleted in this design (an orphaned row from a regeneration, per
accepted simplification #2, is harmless clutter, not something the UI needs to clean up in v1).

## Frontend (`AdvicePanel`, `src/pages/reportes.jsx`)

Tracking only ever activates for AI-generated actions (`mode === 'ai' && aiAdvice`, per accepted
simplification #3) — local-heuristic-mode actions keep rendering exactly as they do today, with no status
controls.

**Rules-of-Hooks constraint that shapes where this code goes:** `AdvicePanel` computes its render-body
`current`/`prev` *after* two early returns (`if (!data.length) return null;` and `if (!valid.length) return
null;`, `reportes.jsx` current lines ~1008-1012). React forbids calling hooks after a conditional return, so
the new effects below cannot depend on those render-body variables directly — they need their own hoisted
`current`/`prev`, computed once, positioned *above* both early returns, alongside the component's two
existing hooks (`handleAIFetch`'s `useCallback` and the auto-generate `useEffect`). This mirrors a
duplication that already exists in this file today (`valid`/`current`/`prev` are already computed once
inside `handleAIFetch` and a second time in the render body) — adding a third, hooks-safe computation
follows the same existing (if inelegant) pattern rather than restructuring it, keeping this change
surgical. Crucially, this hoisted computation is only used to learn the current/previous **cycle IDs** — it
never needs to call `generateAdvice()` itself, since the actions being tracked come from `aiAdvice` (React
state, already declared at the top of the component, safely readable before any early return).

Two new pieces of local state, plus the hoisted cycle-ID lookup, all placed before the two existing early
returns:

```jsx
const [currentActionStatuses, setCurrentActionStatuses] = React.useState({}); // action_text -> status, for current.cycle.id
const [prevActionStatuses, setPrevActionStatuses] = React.useState([]); // [{action_text, status}], for prev.cycle.id, ordered oldest-first

// Hoisted above the early returns below, purely to learn the current/previous
// cycle IDs — the render body further down computes its own `valid`/`current`/
// `prev` again for its own purposes (pre-existing duplication in this file,
// not introduced by this change).
const validForTracking = data.filter(r => r.count > 0 && r.aeAvg != null && r.dAvg != null && r.rpAvg != null && r.wellbeing != null);
const currentForTracking = validForTracking[0];
const prevForTracking = validForTracking.length > 1 ? validForTracking[1] : null;
```

**Seed + load current round's statuses** — only runs when the AI panel is actually showing AI-generated
advice. Keyed off `aiAdvice`'s own `actions` array via a stringified dependency (stable across renders,
since `aiAdvice` itself only changes on a real fetch — no risk of the local-heuristic re-render-random-
resample problem, since `localAdvice`/`generateAdvice()` are never referenced here at all). Placed directly
after the state declarations above, still before both early returns:

```jsx
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
```

**Load previous round's tracked actions** (read-only load; edits happen via the same click handler as the
current round). This one is **not** gated on `mode`/`aiAdvice` — it always tries to load whatever was
tracked for the previous cycle, since that round's own AI-mode session (whenever it happened) is what
seeded those rows, independent of what mode the leader is viewing *this* round in:

```jsx
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
```

**Status click handler**, shared by both lists:

```jsx
const STATUS_CYCLE = { pendiente: 'en_curso', en_curso: 'hecha', hecha: 'pendiente' };
const STATUS_LABEL = { pendiente: '⚪ Pendiente', en_curso: '🔵 En curso', hecha: '✅ Hecha' };

const handleToggleActionStatus = async (cycleId, actionText, currentStatus, isCurrentCycle) => {
  const nextStatus = STATUS_CYCLE[currentStatus] || 'en_curso';
  const { error } = await supabase
    .from('mbi_action_tracking')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .eq('cycle_id', cycleId)
    .eq('action_text', actionText);
  if (error) { console.warn('No se pudo actualizar el estado de la acción', error); return; }
  if (isCurrentCycle) {
    setCurrentActionStatuses(m => ({ ...m, [actionText]: nextStatus }));
  } else {
    setPrevActionStatuses(list => list.map(r => r.action_text === actionText ? { ...r, status: nextStatus } : r));
  }
};
```

**Render changes.** The existing "💡 Acciones recomendadas" block (`reportes.jsx`, inside the `<div
className="space-y-3">` content area) gets a status badge per `<li>`, but only when `mode === 'ai' &&
aiAdvice` — local-mode rendering is untouched:

Before:
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

After:
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

## Error handling / edge cases

- A team with only one scored round: `prev` is `null`, `prevActionStatuses` stays `[]`, the "ronda
  anterior" block simply doesn't render — no error state needed.
- The seed-then-load effect's `upsert` failing (network error, RLS denial for a non-leader — shouldn't
  happen since `AdvicePanel` only renders in the leader's view, but defensive nonetheless): logged via
  `console.warn`, not surfaced as a page-level error — this is non-critical bookkeeping, consistent with
  this session's established pattern of not blocking a page on a non-essential background write.
- Clicking a status button while a previous click's request is still in flight: each click is independent
  (`.eq('action_text', actionText)` scopes the update to exactly one row), so rapid double-clicks just
  issue two sequential updates that both succeed — the UI reflects whichever response resolves last, which
  for a simple 3-state cycle is a rare and low-stakes race (worst case: one extra click's effect is
  visually "undone" by an in-flight earlier click resolving after it, self-correcting on next click).
- A leader viewing a team they no longer lead (already handled elsewhere in this codebase via
  `is_team_leader`): the RLS policies here reuse that exact same helper, so access is consistent with every
  other leader-only view in `reportes.jsx`.
- A leader toggling between "🧠 Local" and "🤖 IA + Tendencias" mode: switching to local mode simply stops
  rendering status controls (per accepted simplification #3) without touching `currentActionStatuses` or
  the underlying tracked rows; switching back to AI mode re-renders the same `aiAdvice` state (unchanged,
  since it's just a display-mode toggle, not a re-fetch) with its statuses intact.

## Verification plan

Same impersonation-based methodology used throughout this session:

1. Apply the migration (table, RLS policies) via `apply_migration`.
2. Impersonate a real team leader (rolled back): confirm inserting a tracking row for their own team
   succeeds; confirm inserting one for a team they don't lead fails; confirm updating a row's `status` for
   their own team's row succeeds; confirm a different (non-leader) user cannot select/insert/update any row
   for that team.
3. Confirm the `unique (team_id, cycle_id, action_text)` constraint actually prevents a duplicate seed
   (insert the same triple twice with `on conflict do nothing` semantics and confirm only one row exists).
4. `npm run build` after the frontend change — must succeed with no new errors.
5. Manual QA (owed by the user, as with every other feature this session): as a leader with at least two
   scored rounds, open Reportes, mark a suggested action "en curso" then "hecha", refresh the page and
   confirm the status persisted; confirm the previous round's actions and their statuses appear correctly
   above the current round's suggestions.
