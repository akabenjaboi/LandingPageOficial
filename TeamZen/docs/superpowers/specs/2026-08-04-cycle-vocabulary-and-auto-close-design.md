# Evaluation-round vocabulary, real 7-day auto-close, and merged reports view

Status: approved by user, pending implementation plan.

## Context

While reviewing the team invite-flow work, the user asked for an honest opinion on the "ciclo" (cycle)
and "lanzar" (launch) concept in the MBI evaluation flow — whether it reads as confusing to a
non-technical team leader. Investigating the actual code surfaced three concrete, verified problems, not
just a naming preference:

1. **Jargon-y vocabulary.** "Ciclo" and "Lanzar" read as internal/technical terms that leaked into
   user-facing copy, rather than words a team leader would use naturally.
2. **A promise the code doesn't keep.** `LaunchMBIModal.jsx` and `evaluaciones.jsx` both tell the leader
   an evaluation round "se cerrará automáticamente después de 7 días" — but no code anywhere enforces
   this. `mbi_evaluation_cycles` rows are inserted with only `{team_id, status:'active'}` (no `end_at`,
   no expiry scheduling), and `end_at` is only ever set when a human explicitly closes the cycle (via
   "Terminar ciclo" or by launching a replacement, which force-closes the previous one). A round can sit
   "active" indefinitely with no system-enforced deadline, directly contradicting the UI's own claim.
3. **Two report views showing near-identical data.** `reportes.jsx`'s "Por Ciclos" and "Semanal" tabs
   both produce one row per cycle (confirmed by reading `aggregated` and `getWeeklyData` — "Semanal"
   despite its name does NOT group by calendar week, it iterates `teamCycles` exactly like "Por Ciclos"
   does) with the same columns (Resp., AE, D, RP, Bienestar, Estado dominante, Distribución). After
   today's earlier fix unifying their classification logic, the two tabs now show the same numbers for
   the same cycle — the only real difference is that "Semanal"'s first column has friendlier per-row
   status labels ("En curso" / "Cerrado anticipadamente" / "Completado") that "Por Ciclos" lacks.

## Scope

Three changes, approved individually with the user during brainstorming:

1. Rename "ciclo" → "ronda" / "ronda de evaluación" and "lanzar" → "iniciar" across all user-facing copy
   (JSX text, button labels, alert/error messages, AI-prompt text sent to Groq). Database/API identifiers
   (`mbi_evaluation_cycles`, `cycle_id`, `activeCycleId`, `launchMBI`, etc.) are **not** renamed — this is
   copy only, not a schema or code-identifier change.
2. Implement a real 7-day auto-close so the UI's existing promise becomes true, without duplicating the
   "has it been 7 days" check across the 4 page files that touch cycles.
3. Merge `reportes.jsx`'s "Por Ciclos" and "Semanal" tabs into one "Historial de rondas" view, keeping
   `aggregated`'s data (the classification-correct source) and adopting "Semanal"'s friendlier per-row
   status label.

Explicitly kept as-is (confirmed with the user): the existing manual "Terminar ciclo" → "Terminar ronda"
early-close button stays — auto-close is a maximum duration, not a replacement for ending a round early
once everyone has responded.

## 1. Vocabulary

Mapping used everywhere in user-facing copy:

| Old | New |
|---|---|
| ciclo / Ciclo | ronda / Ronda (or "ronda de evaluación" for the fuller first-mention form, e.g. a page subtitle) |
| lanzar / Lanzar | iniciar / Iniciar |
| "Lanzando..." | "Iniciando..." |
| "Ciclo activo" | "Ronda activa" |
| "Sin ciclo" / "Sin ciclo activo" | "Sin ronda" / "Sin ronda activa" |
| "Terminar ciclo" | "Terminar ronda" |
| "Crear nuevo ciclo" / "Nuevo ciclo MBI" | "Iniciar nueva ronda" |
| "Ciclo #{id}" (row label) | "Ronda #{id}" |

Files affected (full line-by-line inventory already gathered for the implementation plan — not repeated
here in full to keep this spec focused on intent, not execution detail): `LaunchMBIModal.jsx`,
`dashboard.jsx`, `evaluaciones.jsx`, `mbi.jsx`, `reportes.jsx` (including the inline `CycleHelp` help
panel), and the Groq AI prompt-building strings in `src/utils/groqClient.js` — included because the AI's
generated advice text would otherwise say "ciclo" while the surrounding UI says "ronda", recreating
exactly the kind of view-to-view inconsistency this session already spent time eliminating elsewhere.

Database table/column names (`mbi_evaluation_cycles`, `cycle_id`, `status`) and JS
identifiers/state-variable names (`activeCycleId`, `launchMBI`, `handleEndCycle`, `teamCycles`, etc.) are
unchanged — renaming those would be a much larger, riskier refactor for zero user-visible benefit, and
isn't what was asked for.

## 2. Real 7-day auto-close

A single Postgres function, following the same `SECURITY DEFINER` pattern already established this
session for `regenerate_team_invite_code`/`transfer_team_leadership`:

```sql
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
```

Called via `supabase.rpc('close_expired_mbi_cycles')` from the client, once, at the start of each of the
4 places that currently load a team's active cycle(s): `dashboard.jsx`'s `init()` (both the leader and
member branches), `evaluaciones.jsx`'s cycle-loading effect, `reportes.jsx`'s `loadCyclesAndScores`, and
`mbi.jsx`'s active-cycle lookup. This is a cheap, idempotent, single-statement `UPDATE` — safe to call on
every page load.

**Why this approach over the alternatives considered:**
- **A scheduled `pg_cron` job** (the extension exists on this Supabase project but is not currently
  enabled) was considered and rejected: it would add new infrastructure for no real benefit here, since
  nothing time-critical needs to happen at the exact 7-day boundary — a round that expires while nobody
  has the app open simply gets closed the next time anyone touches it, with no visible lag to any real
  user.
- **Duplicating the `start_at < now() - 7 days` date check inline in every query's `WHERE` clause**
  (instead of a single function) was rejected because it's exactly the kind of logic-copied-across-4-files
  drift this session already fixed twice today (MBI classification, error handling) — centralizing it in
  one function is consistent with that same lesson.

This also fixes the "Cerrado anticipadamente" vs "Completado" status distinction already computed in
`reportes.jsx` (`cycleEndedEarly = !!cycle.end_at` before the round's natural end) — once
`close_expired_mbi_cycles` actually sets `end_at`, a round that expired naturally will correctly show
"Completado" (its `end_at` lands exactly 7 days after `start_at`) rather than staying indefinitely
ambiguous.

## 3. Merged "Historial de rondas" view

Removes the `viewMode` tab toggle (`Por Ciclos` / `Semanal`) entirely. The single remaining table is
driven by `aggregated` (unchanged data logic — already fixed today to use the correct classification),
with its first column upgraded to include the friendlier status label currently only computed in
`getWeeklyData`/the "Semanal" branch: "En curso" (no `end_at` yet), "Cerrado anticipadamente" (`end_at`
exists but landed before the natural 7-day mark), "Completado" (`end_at` at or after the 7-day mark, i.e.
closed by `close_expired_mbi_cycles` or manually at/after the deadline).

`getWeeklyData` (the `calculateWeekStats`-based memo) is deleted entirely, along with the `viewMode`
state and both toggle buttons. `AdvicePanel` and `StrategicInsightsDropdown` — which today accept a
`viewMode` prop and branch their copy/data source between `aggregated` and `getWeeklyData` — are
simplified to always use `aggregated` and drop the `viewMode`-conditional text (the `'por ciclos'` /
`'por semana'` / `'ciclo(s)'` / `'semana(s)'` string branches called out in the vocabulary inventory
collapse to a single wording each).

## Error handling / edge cases

- `close_expired_mbi_cycles()` is a plain `UPDATE`, always succeeds unless the database itself is
  unreachable (in which case the existing page-level error handling from earlier today already surfaces
  a connectivity error) — no new failure mode to design for.
- A round with zero responses that expires still correctly transitions to `status='closed'` with a real
  `end_at` — nothing in the aggregation logic assumes at least one response exists before an expiry.
- Concurrent calls (two users opening the app at nearly the same moment) are safe: the `UPDATE` is a
  plain idempotent set-based statement, not a read-then-write, so no race condition to guard against.

## Verification plan

1. Apply the migration (new function only, no schema change) via `apply_migration`, verified the same
   way as today's earlier RLS/invite-flow work: impersonate a real user via `execute_sql` with `set local
   role authenticated; set local request.jwt.claims = '...'`, manually backdate a test cycle's `start_at`
   to 8 days ago inside a rolled-back transaction, call the function, confirm it flips to `closed` with
   the correct `end_at`, confirm an also-present non-expired active cycle is untouched.
2. `npm run build` after the vocabulary/merged-view frontend changes — must succeed with no new errors.
3. **Out of scope for automated/AI verification**: an actual 7-day-real-time wait to observe natural
   expiry end-to-end, and the full visual/copy review of every renamed string in the running app — both
   need the user's own manual pass, consistent with every other feature built this session.
