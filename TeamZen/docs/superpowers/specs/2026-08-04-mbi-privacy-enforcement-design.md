# MBI leader-visibility privacy enforcement (real opt-out, not cosmetic)

Status: approved by user, pending implementation plan.

## Context

While reviewing TeamZen's product logic and privacy model, an investigation of the k-anonymity/opt-out
feature (built earlier this session) surfaced a real gap between what it promises and what it enforces:

- The product decision on record is: a member who sets `team_members.share_results_with_leader = false`
  should have their scores still count anonymously toward the team's aggregate, but never be shown to the
  leader as an identified individual.
- In practice, `reportes.jsx`'s leader view fetches **one** query (`scoresByCycle`, built from
  `mbi_scores` joined to `mbi_responses(cycle_id, user_id)`) that returns every respondent's raw
  `{user_id, ae, d, rp}` tuple for a cycle, with **no filter on `share_results_with_leader`** at all. The
  opt-out flag only controls whether a named badge is *rendered* in the member list
  (`memberBurnoutStates`, gated on `member.share_results_with_leader === true` — a plain JS conditional).
  The same already-fetched raw data also feeds the team-wide `aggregated` memo.
- Consequence: the identified row for an opted-out member is already sitting in the leader's browser
  memory and in the network response the moment the report page loads. A leader who opens the Network tab
  or inspects React state — no special access required, just default browser devtools — can read exactly
  which `user_id` produced which AE/D/RP scores, regardless of that member's choice. The RLS policies that
  gate leader access to `mbi_responses`/`mbi_scores` (`responses_select_as_leader_kanon`,
  `scores_select_as_leader_kanon`) only check that the caller leads the team and that the cycle has ≥3
  respondents (`mbi_cycle_respondent_count(cycle_id) >= 3`) — they never reference
  `share_results_with_leader`. The opt-out is enforced nowhere below the UI layer.

This spec closes that gap: the leader's *aggregate* view keeps including opted-out members' numbers
(per the existing product decision), but their identified row must never be transmitted to the leader's
client at all, from any query, under any circumstance — enforced by RLS, not by what the frontend chooses
to render.

## Scope

In scope:
- A new Postgres helper function that centralizes the three conditions that must all hold before a
  leader can see one *identified* MBI response/score row (team leadership, k-anonymity floor, and the
  respondent's own opt-in), and rewriting the two existing "leader" SELECT policies on `mbi_responses` and
  `mbi_scores` to use it.
- A new Postgres `SECURITY DEFINER` function that computes the team-wide aggregate (averages, category
  distribution, dominant status) across **all** respondents in a cycle — opted-in and opted-out alike —
  returning only summary numbers, never a per-respondent row.
- Updating `reportes.jsx`'s `aggregated` memo to source from that new function instead of computing
  locally over raw rows.

Explicitly out of scope (deferred, per the user's own sequencing — this is the first of three issues
being worked one at a time):
- Leader-role assignment / team-creation gating (next item in the sequence).
- Closed-loop tracking of whether advice leads to measurable improvement (third item).
- MBI instrument validity/licensing (explicitly deferred "for much later" by the user).
- `memberBurnoutStates`/the per-member badge UI itself — its data source (`scoresByCycle`) is unchanged in
  shape; it will simply, as a side effect of the RLS fix, only ever contain opted-in respondents going
  forward. No frontend changes are needed there beyond what's already correct.
- The team-level toggles `members_can_see_others`/`members_can_see_responses` (teammate-to-teammate
  visibility) — unrelated to the leader-visibility gap this spec addresses.

## Architecture

Two separate data paths replace today's single raw-row fetch for the leader's report view:

1. **Identified path (unchanged shape, now actually enforced):** `scoresByCycle` keeps querying
   `mbi_scores`/`mbi_responses` exactly as today. The RLS policies gating that query are tightened so that,
   regardless of what the client asks for, the database itself never returns a row for a respondent whose
   `share_results_with_leader` is `false`. This feeds `memberBurnoutStates` (the per-member badge) — no
   frontend change required there.
2. **Anonymous aggregate path (new):** a `SECURITY DEFINER` function,
   `mbi_team_cycle_aggregates(p_team_id uuid)`, runs with elevated privileges *internally* (so it can read
   every respondent's row regardless of opt-out) but returns only pre-aggregated numbers — per-cycle
   respondent count, AE/D/RP averages, and a count-by-category distribution. No `user_id`, no raw score
   row, no way to correlate a number back to a person, ever leaves the function. `reportes.jsx`'s
   `aggregated` memo calls this instead of computing over `scoresByCycle`.

The k-anonymity floor (`mbi_cycle_respondent_count(cycle_id) >= 3`) is preserved in both paths — it isn't
weakened or strengthened by this change, just enforced in one more place.

## Database changes

**1. Centralizing the leader-visibility check into one helper function**, following the existing
`SECURITY DEFINER` helper pattern in this project (`is_team_leader`, `team_allows_member_visibility`):

```sql
create or replace function public.mbi_response_leader_visible(p_response_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from mbi_responses r
    join mbi_evaluation_cycles c on c.id = r.cycle_id
    join teams t on t.id = c.team_id
    join team_members tm on tm.team_id = t.id and tm.user_id = r.user_id
    where r.id = p_response_id
      and is_team_leader(t.id)
      and mbi_cycle_respondent_count(r.cycle_id) >= 3
      and tm.share_results_with_leader = true
  );
$$;

revoke all on function public.mbi_response_leader_visible(uuid) from public, anon;
grant execute on function public.mbi_response_leader_visible(uuid) to authenticated;
```

**2. Rewriting the two existing "leader" SELECT policies to call it**, replacing their current
`t.leader_id = auth.uid() AND mbi_cycle_respondent_count(...) >= 3` conditions (which say nothing about
opt-in) with a single call to the helper:

```sql
drop policy responses_select_as_leader_kanon on public.mbi_responses;
create policy responses_select_as_leader_kanon on public.mbi_responses
  for select
  using (mbi_response_leader_visible(id));

drop policy scores_select_as_leader_kanon on public.mbi_scores;
create policy scores_select_as_leader_kanon on public.mbi_scores
  for select
  using (mbi_response_leader_visible(response_id));
```

(`mbi_responses.responses_select_own`/`mbi_scores.scores_select_own` and the teammate-visibility policies
are untouched — this only changes what a *leader* can see.)

**3. The anonymized aggregate function.** Classification thresholds are the official MBI ranges already
centralized in `src/utils/mbiClassification.js` (`classifyMBI`/`computeBurnoutStatus`) — reproduced here
in SQL because this is the one place they must run over *every* respondent's raw values, including
opted-out ones, without any of those raw values (or their per-row classification) ever leaving the
function. A code comment marks this function as the SQL mirror of that file, so a future change to the
official thresholds is a reminder to update both.

`computeBurnoutStatus` reduces to a pure function of "how many of the 3 subscales are `Alto`" (0→"Sin
indicios", 1→"Riesgo", 2→"Riesgo Alto", 3→"Burnout" — verified by tracing its branches, the `catAE`-specific
branch never actually changes the outcome for a given count), which is what's implemented below:

```sql
create or replace function public.mbi_team_cycle_aggregates(p_team_id uuid)
returns table (
  cycle_id uuid,
  respondent_count int,
  ae_avg numeric,
  d_avg numeric,
  rp_avg numeric,
  burnout_count int,
  riesgo_alto_count int,
  riesgo_count int,
  sin_indicios_count int,
  dominant text
)
language sql
security definer
set search_path = public
as $$
  with authorized as (
    select 1 where is_team_leader(p_team_id)
  ),
  classified as (
    select
      r.cycle_id,
      s.ae_score, s.d_score, s.rp_score,
      (
        (case when s.ae_score > 26 then 1 else 0 end) +
        (case when s.d_score  > 9  then 1 else 0 end) +
        (case when s.rp_score < 34 then 1 else 0 end)
      ) as alto_count
    from mbi_responses r
    join mbi_scores s on s.response_id = r.id
    join mbi_evaluation_cycles c on c.id = r.cycle_id
    where c.team_id = p_team_id
      and exists (select 1 from authorized)
  ),
  status_per_row as (
    select cycle_id,
      case alto_count when 3 then 'Burnout' when 2 then 'Riesgo Alto' when 1 then 'Riesgo' else 'Sin indicios' end as status,
      ae_score, d_score, rp_score
    from classified
  ),
  per_cycle as (
    select
      cycle_id,
      count(*) as respondent_count,
      avg(ae_score) as ae_avg,
      avg(d_score) as d_avg,
      avg(rp_score) as rp_avg,
      count(*) filter (where status = 'Burnout') as burnout_count,
      count(*) filter (where status = 'Riesgo Alto') as riesgo_alto_count,
      count(*) filter (where status = 'Riesgo') as riesgo_count,
      count(*) filter (where status = 'Sin indicios') as sin_indicios_count
    from status_per_row
    group by cycle_id
  )
  select
    c.id as cycle_id,
    coalesce(pc.respondent_count, 0) as respondent_count,
    case when coalesce(pc.respondent_count, 0) >= 3 then pc.ae_avg else null end as ae_avg,
    case when coalesce(pc.respondent_count, 0) >= 3 then pc.d_avg else null end as d_avg,
    case when coalesce(pc.respondent_count, 0) >= 3 then pc.rp_avg else null end as rp_avg,
    case when coalesce(pc.respondent_count, 0) >= 3 then pc.burnout_count else null end as burnout_count,
    case when coalesce(pc.respondent_count, 0) >= 3 then pc.riesgo_alto_count else null end as riesgo_alto_count,
    case when coalesce(pc.respondent_count, 0) >= 3 then pc.riesgo_count else null end as riesgo_count,
    case when coalesce(pc.respondent_count, 0) >= 3 then pc.sin_indicios_count else null end as sin_indicios_count,
    case when coalesce(pc.respondent_count, 0) < 3 then null else (
      case greatest(pc.burnout_count, pc.riesgo_alto_count, pc.riesgo_count, pc.sin_indicios_count)
        when pc.burnout_count then 'Burnout'
        when pc.riesgo_alto_count then 'Riesgo Alto'
        when pc.riesgo_count then 'Riesgo'
        else 'Sin indicios'
      end
    ) end as dominant
  from mbi_evaluation_cycles c
  left join per_cycle pc on pc.cycle_id = c.id
  where c.team_id = p_team_id
    and exists (select 1 from authorized)
  order by c.start_at desc;
$$;

revoke all on function public.mbi_team_cycle_aggregates(uuid) from public, anon;
grant execute on function public.mbi_team_cycle_aggregates(uuid) to authenticated;
```

Notes on this function:
- If the caller doesn't lead `p_team_id`, `authorized` is empty and every row's `exists (select 1 from
  authorized)` check is false, so the function returns zero rows — same "just empty" behavior RLS would
  give, without needing a separate authorization error path.
- Below the n≥3 floor, the function still returns one row per cycle with the real `respondent_count`
  (1 or 2) but every stat field `null` — this matches today's *effective* behavior (a cycle under the
  floor already renders as "0 respondents" / no stats in the current RLS-blocked flow), it's a
  drop-in replacement, not a UX change. Improving that message (e.g. showing "2 respuestas, faltan para
  ver el resumen" instead of treating it identically to zero) is a reasonable future idea but is not part
  of this fix — noted here so it isn't lost, not undertaken now.
- `dominant`'s tie-breaking (when two categories have the exact same count) prefers the more severe
  category, via `greatest(...)` picking the first matching `when` in severity order. The original JS
  (`Object.keys(counts).sort(...)`) had its own implicit, insertion-order-dependent tie-break that was
  never guaranteed either way — this is a defensible, deterministic choice for a genuinely rare edge case
  (an exact tie across categories), not a behavior regression.
- `ae_avg`/`d_avg`/`rp_avg` are plain linear averages. `wellbeing` is deliberately **not** computed here —
  `computeWellbeingFromScores(ae, d, rp)` in `mbiClassification.js` is a linear function of its inputs
  (each term is an affine transform of one score, averaged), so `wellbeing` computed from the *averaged*
  AE/D/RP is mathematically identical to averaging each respondent's individual wellbeing. The client
  computes it from `ae_avg/d_avg/rp_avg` using the existing shared util, avoiding a second duplication of
  that formula in SQL.

## Frontend changes (`reportes.jsx`)

- The `aggregated` `useMemo` stops computing `count/aeAvg/dAvg/rpAvg/dominant/dist` locally from
  `scoresByCycle`. Instead, it calls `supabase.rpc('mbi_team_cycle_aggregates', { p_team_id: activeTeamId
  })` once per active team and maps each returned row to the exact same shape the rest of the component
  already consumes: `{ cycle, count: respondent_count, aeAvg: ae_avg, dAvg: d_avg, rpAvg: rp_avg, dominant,
  wellbeing: computeWellbeingFromScores(ae_avg, d_avg, rp_avg), dist: { Burnout: burnout_count, 'Riesgo
  Alto': riesgo_alto_count, Riesgo: riesgo_count, 'Sin indicios': sin_indicios_count }, isActiveCycle,
  actualDuration }` — `isActiveCycle`/`actualDuration` keep being derived client-side from
  `cycle.status`/`start_at`/`end_at` exactly as today (Task 3's fix from earlier this session), since
  those are per-cycle metadata, not privacy-sensitive per-respondent data.
- `scoresByCycle` and `memberBurnoutStates` are **unchanged** — same query, same shape, same client-side
  `share_results_with_leader === true` gate on the badge (now a redundant-but-harmless second layer, since
  RLS itself won't return an opted-out row anymore).
- `StrategicInsightsDropdown`, `TrendChart`, and `AdvicePanel` all consume `aggregated`'s existing shape —
  no changes needed there.

## Error handling / edge cases

- If `mbi_team_cycle_aggregates` fails (network error, unexpected RPC error), `aggregated` should surface
  the existing `dataError`/error-banner pattern already used elsewhere in this file, rather than silently
  rendering an empty table — consistent with the error-handling consolidation done earlier this session.
- A team with zero cycles: the function's final `select ... from mbi_evaluation_cycles c ... where
  c.team_id = p_team_id` naturally returns zero rows — same as today.
- A cycle with exactly 2 respondents where one of them opts in and one opts out: `memberBurnoutStates`
  shows a badge only for the opted-in one (as today); `aggregated` shows `count: 2` with all stat fields
  `null` (below the floor) — both members' numbers are excluded from the visible aggregate until a 3rd
  response arrives, matching the existing k-anonymity floor exactly.
- Personal (non-team) MBI responses (`mbi_responses.team_id is null`) are entirely unaffected — the new
  function and tightened policies only ever join through `mbi_evaluation_cycles`/`teams`, which personal
  responses have no `cycle_id` for.

## Verification plan

Same impersonation-based methodology already established this session:

1. Apply the migration (helper function, two rewritten policies, aggregate function) via
   `apply_migration`.
2. Impersonate a real leader (`set local role authenticated; set local request.jwt.claims = '{"sub":
   "<leader_uuid>","role":"authenticated"}'`) inside a rolled-back transaction, and confirm:
   - A direct `select * from mbi_responses where id = '<opted-out member's response id>'` returns zero
     rows, even though the cycle has ≥3 respondents.
   - A direct `select * from mbi_scores where response_id = '<that same response id>'` also returns zero
     rows.
   - `select * from mbi_team_cycle_aggregates('<team_id>')` for that same cycle shows a `respondent_count`
     and `ae_avg`/`d_avg`/`rp_avg` that reflect **all** respondents, including the opted-out one (verified
     by comparing against a service-role query computing the true average directly).
   - The same call for a leader who does **not** lead that team returns zero rows.
3. `npm run build` after the frontend change — must succeed with no new errors.
4. Manual QA (owed by the user, as with every other feature this session): open Reportes as a leader of a
   team with a mix of opted-in/opted-out members and confirm the aggregate numbers and per-member badges
   look sane side by side.
