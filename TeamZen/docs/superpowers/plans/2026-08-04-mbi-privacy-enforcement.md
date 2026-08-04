# MBI Leader-Visibility Privacy Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MBI "opt-out" (`team_members.share_results_with_leader`) a real, RLS-enforced access
control instead of a client-side rendering filter, while keeping opted-out members' scores counted
anonymously in the team's aggregate — per the existing product decision.

**Architecture:** A new `SECURITY DEFINER` helper function (`mbi_response_leader_visible`) centralizes the
three conditions that must hold before a leader can see one *identified* MBI row, and the two existing
leader-facing RLS policies on `mbi_responses`/`mbi_scores` are rewritten to call it — closing the gap where
a leader's client currently receives every respondent's raw `{user_id, ae, d, rp}` tuple regardless of
opt-out. A second new function (`mbi_team_cycle_aggregates`) computes the team-wide aggregate server-side,
across all respondents including opted-out ones, returning only summary numbers — never a per-respondent
row. `reportes.jsx`'s `aggregated` memo is switched to source from that function instead of computing
locally over raw rows.

**Tech Stack:** Supabase (Postgres/RLS, applied via MCP `apply_migration` — no local migration files exist
in this repo), React 19 + Vite frontend, no test framework (verification is impersonation-based SQL
testing plus `npm run build`).

## Global Constraints

- SQL changes are applied via the Supabase MCP `apply_migration` tool directly to production
  (`alzjmlnoaxqlkdtvwisr`) — there is no local `supabase/migrations` directory in this repo.
- The k-anonymity floor (`mbi_cycle_respondent_count(cycle_id) >= 3`) must not be weakened or strengthened
  — only enforced in one more place.
- Below the n≥3 floor, `mbi_team_cycle_aggregates` must return `respondent_count: 0` and every stat field
  `null` — this is a drop-in replacement of today's *effective* behavior (RLS already blocks all raw rows
  below the floor), not a UX change. Do not surface the true small count (1 or 2) — that's explicitly
  deferred.
- Classification thresholds in the new SQL function must match `src/utils/mbiClassification.js` exactly:
  AE >26 = Alto (else Medio/Bajo per `classifyMBI`, but only the Alto boundary matters for status), D >9 =
  Alto, RP <34 = Alto (RP is inverted — lower score = worse). Status is purely a function of how many of
  the 3 subscales are "Alto": 0→"Sin indicios", 1→"Riesgo", 2→"Riesgo Alto", 3→"Burnout".
- Do not rename any existing database identifiers, RLS policy names on unrelated tables, or JS
  variable/function names beyond what's specified in each task.
- No test framework exists in this repo — verification is impersonation-based SQL testing (`execute_sql`
  wrapped in `begin; set local role authenticated; set local request.jwt.claims = '...'; ...; rollback;`)
  plus `npm run build` succeeding.

---

### Task 1: RLS lockdown — close the identified-row leak

**Files:**
- No local files — applied via `mcp__supabase__apply_migration`.

**Interfaces:**
- Produces: `public.mbi_response_leader_visible(p_response_id uuid) returns boolean` — used by this task's
  own rewritten policies; not consumed by any later task in this plan.

- [ ] **Step 1: Confirm current (leaky) policy behavior — before state**

Via `mcp__supabase__execute_sql`, find a real cycle with ≥3 respondents and at least one member with
`share_results_with_leader = false`:

```sql
select r.id as response_id, r.cycle_id, r.user_id, tm.share_results_with_leader
from mbi_responses r
join team_members tm on tm.team_id = r.team_id and tm.user_id = r.user_id
where r.cycle_id in (
  select cycle_id from mbi_responses group by cycle_id having count(distinct user_id) >= 3
)
order by r.created_at desc
limit 20;
```

Pick one `response_id` where `share_results_with_leader = false`, and note the `cycle_id`'s team's
`leader_id` (`select leader_id from teams where id = (select team_id from mbi_evaluation_cycles where id =
'<cycle_id>');`). If no real row has `share_results_with_leader = false` among a ≥3-respondent cycle,
create one temporarily inside the verification transaction in Step 4 instead (see fallback note there).

Then, impersonating that team's real leader in a rolled-back transaction, confirm today's leaky behavior:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select id, user_id, cycle_id from mbi_responses where id = '<opted_out_response_id>';
rollback;
```

Expected (before this migration): the row **is** returned — confirming the leak.

- [ ] **Step 2: Apply the migration**

Call `mcp__supabase__apply_migration` with `name: "mbi_leader_visibility_lockdown"` and this `query`:

```sql
begin;

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

drop policy responses_select_as_leader_kanon on public.mbi_responses;
create policy responses_select_as_leader_kanon on public.mbi_responses
  for select
  using (mbi_response_leader_visible(id));

drop policy scores_select_as_leader_kanon on public.mbi_scores;
create policy scores_select_as_leader_kanon on public.mbi_scores
  for select
  using (mbi_response_leader_visible(response_id));

commit;
```

- [ ] **Step 3: Verify the leak is closed for an opted-out respondent**

Re-run the exact same impersonated query from Step 1:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select id, user_id, cycle_id from mbi_responses where id = '<opted_out_response_id>';
select ae_score, d_score, rp_score from mbi_scores where response_id = '<opted_out_response_id>';
rollback;
```

Expected: both queries now return **zero rows**.

- [ ] **Step 4: Verify an opted-in respondent in the same cycle is still visible**

Find a response in the same cycle where `share_results_with_leader = true` (or, if none exists, create one
temporarily inside this rolled-back transaction: `update team_members set share_results_with_leader = true
where team_id = '<team_id>' and user_id = '<some other respondent's user_id>';` before the `select`, then
`rollback` at the end so nothing persists):

```sql
begin;
-- (optional, only if no real opted-in respondent exists in this cycle)
-- update team_members set share_results_with_leader = true where team_id = '<team_id>' and user_id = '<user_id>';
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select id, user_id, cycle_id from mbi_responses where id = '<opted_in_response_id>';
rollback;
```

Expected: the row **is** returned — confirming the fix didn't over-restrict.

- [ ] **Step 5: Verify a non-leader still sees nothing**

Impersonate a random authenticated user who does **not** lead the team in question, using the same
`opted_in_response_id` from Step 4:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<some_other_uuid_not_the_leader>","role":"authenticated"}';
select id, user_id, cycle_id from mbi_responses where id = '<opted_in_response_id>';
rollback;
```

Expected: zero rows.

- [ ] **Step 6: Verify grants and run security advisors**

```sql
select grantee, privilege_type from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'mbi_response_leader_visible';
```

Expected: `authenticated` has `EXECUTE`; no `anon`/`public` row. Then run
`mcp__supabase__get_advisors(type: "security")` — expect only the same WARN-level
`authenticated_security_definer_function_executable` class already accepted for every other
`SECURITY DEFINER` function in this project, no new ERROR-level findings.

---

### Task 2: Anonymized team aggregate function

**Files:**
- No local files — applied via `mcp__supabase__apply_migration`.

**Interfaces:**
- Consumes: `public.is_team_leader(uuid)`, `public.mbi_cycle_respondent_count(uuid)` (both already exist).
- Produces: `public.mbi_team_cycle_aggregates(p_team_id uuid) returns table(cycle_id uuid,
  respondent_count int, ae_avg numeric, d_avg numeric, rp_avg numeric, burnout_count int,
  riesgo_alto_count int, riesgo_count int, sin_indicios_count int, dominant text)` — one row per cycle
  belonging to `p_team_id`, ordered by `start_at desc`. Consumed by Task 3 via
  `supabase.rpc('mbi_team_cycle_aggregates', { p_team_id })`.

- [ ] **Step 1: Apply the migration**

Call `mcp__supabase__apply_migration` with `name: "mbi_team_cycle_aggregates_function"` and this `query`:

```sql
begin;

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
    case when coalesce(pc.respondent_count, 0) >= 3 then pc.respondent_count else 0 end as respondent_count,
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

commit;
```

- [ ] **Step 2: Verify a leader with a ≥3-respondent cycle sees the correct aggregate, including opted-out members**

Using the same cycle/team from Task 1 (which has at least one opted-out respondent among ≥3 total),
impersonate that team's real leader:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select * from mbi_team_cycle_aggregates('<team_id>');
rollback;
```

Then, in a **separate**, non-impersonated `execute_sql` call (full service-role access), independently
compute the true average directly for that same cycle to compare against:

```sql
select
  count(*) as respondent_count,
  avg(s.ae_score) as ae_avg,
  avg(s.d_score) as d_avg,
  avg(s.rp_score) as rp_avg
from mbi_responses r
join mbi_scores s on s.response_id = r.id
where r.cycle_id = '<cycle_id>';
```

Expected: the impersonated call's row for `cycle_id = '<cycle_id>'` has `respondent_count` and
`ae_avg`/`d_avg`/`rp_avg` matching this independent computation (within rounding) — confirming the
opted-out respondent's numbers are genuinely included, even though Task 1 already proved their identified
row is invisible.

- [ ] **Step 3: Verify a cycle below the n≥3 floor returns suppressed (zero/null) stats**

Find or create (inside a rolled-back transaction) a cycle with 1-2 respondents, then:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select * from mbi_team_cycle_aggregates('<team_id_with_below_floor_cycle>');
rollback;
```

Expected: the row for that cycle shows `respondent_count: 0` and every other stat field `null` — NOT the
true small count.

- [ ] **Step 4: Verify a non-leader gets zero rows**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<some_other_uuid_not_the_leader>","role":"authenticated"}';
select * from mbi_team_cycle_aggregates('<team_id>');
rollback;
```

Expected: zero rows.

- [ ] **Step 5: Verify grants and run security advisors**

Same pattern as Task 1 Step 6, for `mbi_team_cycle_aggregates` — confirm `authenticated` has `EXECUTE`,
`anon`/`public` do not, and `get_advisors(type: "security")` shows no new ERROR-level findings.

---

### Task 3: Frontend — source `aggregated` from the anonymized RPC

**Files:**
- Modify: `src/pages/reportes.jsx`

**Interfaces:**
- Consumes: `public.mbi_team_cycle_aggregates(p_team_id uuid)` from Task 2, via
  `supabase.rpc('mbi_team_cycle_aggregates', { p_team_id: activeTeamId })`. Each returned row:
  `{cycle_id, respondent_count, ae_avg, d_avg, rp_avg, burnout_count, riesgo_alto_count, riesgo_count,
  sin_indicios_count, dominant}`.
- Consumes: `computeWellbeingFromScores(ae, d, rp)` from `src/utils/mbiClassification.js` (already exists,
  not yet imported in this file).
- Produces: `aggregated` keeps its existing external shape — `{cycle, count, aeAvg, dAvg, rpAvg, dominant,
  wellbeing, dist, isActiveCycle}` — unchanged for every downstream consumer
  (`StrategicInsightsDropdown`, `TrendChart`, `AdvicePanel`, the table render).

- [ ] **Step 1: Add the `computeWellbeingFromScores` import**

Find (line 7):
```jsx
import { classifyMBI, computeBurnoutStatus, WELLBEING_NORMALIZATION } from '../utils/mbiClassification';
```
Replace with:
```jsx
import { classifyMBI, computeBurnoutStatus, WELLBEING_NORMALIZATION, computeWellbeingFromScores } from '../utils/mbiClassification';
```

- [ ] **Step 2: Add `cycleAggregates` state**

Find (line 40):
```jsx
  const [scoresByCycle, setScoresByCycle] = useState({}); // cycle_id => array of {ae,d,rp,user_id}
```
Replace with:
```jsx
  const [scoresByCycle, setScoresByCycle] = useState({}); // cycle_id => array of {ae,d,rp,user_id} (used only for the per-member badge; never for team aggregates)
  const [cycleAggregates, setCycleAggregates] = useState({}); // cycle_id => anonymized aggregate row from mbi_team_cycle_aggregates
```

- [ ] **Step 3: Fetch the aggregate RPC alongside the existing cycles/scores fetch**

Find (inside `loadCyclesAndScores`, lines 108-118):
```jsx
        if (cyclesErr) throw cyclesErr;
        setTeamCycles(cycles || []);
        if (!cycles || cycles.length === 0) { setScoresByCycle({}); return; }
        const cycleIds = cycles.map(c => c.id);

        // 2. Fetch responses with nested scores (more reliable filtering on cycle_id)
        const { data: scoreRows, error: scoreErr } = await supabase
          .from('mbi_scores')
          .select('ae_score, d_score, rp_score, mbi_responses (cycle_id, user_id)')
          .in('mbi_responses.cycle_id', cycleIds);
        if (scoreErr) throw scoreErr;
```
Replace with:
```jsx
        if (cyclesErr) throw cyclesErr;
        setTeamCycles(cycles || []);
        if (!cycles || cycles.length === 0) { setScoresByCycle({}); setCycleAggregates({}); return; }
        const cycleIds = cycles.map(c => c.id);

        // 2a. Fetch the anonymized team aggregate (includes opted-out members' numbers,
        // never their identified row) — this is the source for `aggregated`, not the
        // raw per-respondent query below.
        const { data: aggRows, error: aggErr } = await supabase.rpc('mbi_team_cycle_aggregates', { p_team_id: activeTeamId });
        if (aggErr) throw aggErr;
        const aggByCycle = {};
        (aggRows || []).forEach(row => { aggByCycle[row.cycle_id] = row; });
        setCycleAggregates(aggByCycle);

        // 2b. Fetch responses with nested scores (more reliable filtering on cycle_id).
        // RLS now only returns rows for respondents who set share_results_with_leader = true —
        // this feeds only the per-member badge (memberBurnoutStates), never the team aggregate.
        const { data: scoreRows, error: scoreErr } = await supabase
          .from('mbi_scores')
          .select('ae_score, d_score, rp_score, mbi_responses (cycle_id, user_id)')
          .in('mbi_responses.cycle_id', cycleIds);
        if (scoreErr) throw scoreErr;
```

- [ ] **Step 4: Rewrite the `aggregated` memo to source from `cycleAggregates`**

Find (the entire `aggregated` `useMemo`, lines 211-250):
```jsx
  const aggregated = useMemo(() => {
    if (!teamCycles.length) return [];
    return teamCycles.map(cycle => {
      const scores = scoresByCycle[cycle.id] || [];
      const cycleEndDate = cycle.end_at ? new Date(cycle.end_at) : null;
      // Prefer the authoritative status column; a cycle only counts as active while
      // status says so AND it hasn't been given an end_at. This also covers legacy
      // rows that were closed without an end_at being recorded (see evaluaciones.jsx),
      // which must be treated as completed, not as permanently "in progress".
      const isActiveCycle = cycle.status === 'active' && !cycleEndDate;
      if (!scores.length) return { cycle, count:0, isActiveCycle };
      // Aggregate subscale means (ya en escala 0–6 por ítem -> sumas reales)
      const aeAvg = Math.round((scores.reduce((a,s)=>a+(s.ae??0),0)/scores.length)*10)/10;
      const dAvg = Math.round((scores.reduce((a,s)=>a+(s.d??0),0)/scores.length)*10)/10;
      const rpAvg = Math.round((scores.reduce((a,s)=>a+(s.rp??0),0)/scores.length)*10)/10;
      // Classification majority status usando cada respuesta individual
      const statuses = scores.map(s => {
        const cls = classifyMBI(s.ae, s.d, s.rp);
        return computeBurnoutStatus(cls);
      }).filter(Boolean);
      const statusCounts = statuses.reduce((acc,st)=>{acc[st]=(acc[st]||0)+1; return acc;},{});
      let dominant = null; let max=0;
      Object.entries(statusCounts).forEach(([st,cnt])=>{ if (cnt>max){max=cnt;dominant=st;} });
      // Wellbeing metric (0–100) con nueva normalización 0–54,0–30,0–48
      const { MIN_AE, MAX_AE, MIN_D, MAX_D, MIN_RP, MAX_RP } = WELLBEING_NORMALIZATION;
      const rangeAE = MAX_AE - MIN_AE, rangeD = MAX_D - MIN_D, rangeRP = MAX_RP - MIN_RP;
      const wbSum = scores.reduce((acc,s)=>{
        if ([s.ae,s.d,s.rp].some(v=>v==null)) return acc;
        const aeWell = 1 - ((s.ae - MIN_AE)/(rangeAE||1));
        const dWell  = 1 - ((s.d - MIN_D)/(rangeD||1));
        const rpWell = ((s.rp - MIN_RP)/(rangeRP||1));
        return acc + (aeWell + dWell + rpWell)/3;
      },0);
      const wellbeing = Math.round((wbSum / scores.length)*100);
      // Risk distribution
      const dist = { Burnout:0, 'Riesgo Alto':0, Riesgo:0, 'Sin indicios':0 };
      statuses.forEach(st => { if(dist[st]!==undefined) dist[st]++; });
      return { cycle, count: scores.length, aeAvg, dAvg, rpAvg, dominant, wellbeing, dist, isActiveCycle };
    });
  }, [teamCycles, scoresByCycle]);
```
Replace with:
```jsx
  const aggregated = useMemo(() => {
    if (!teamCycles.length) return [];
    return teamCycles.map(cycle => {
      const cycleEndDate = cycle.end_at ? new Date(cycle.end_at) : null;
      // Prefer the authoritative status column; a cycle only counts as active while
      // status says so AND it hasn't been given an end_at. This also covers legacy
      // rows that were closed without an end_at being recorded (see evaluaciones.jsx),
      // which must be treated as completed, not as permanently "in progress".
      const isActiveCycle = cycle.status === 'active' && !cycleEndDate;
      const agg = cycleAggregates[cycle.id];
      const count = agg?.respondent_count ?? 0;
      if (!agg || count === 0) return { cycle, count: 0, isActiveCycle };

      const wellbeing = computeWellbeingFromScores(agg.ae_avg, agg.d_avg, agg.rp_avg);
      const dist = {
        Burnout: agg.burnout_count ?? 0,
        'Riesgo Alto': agg.riesgo_alto_count ?? 0,
        Riesgo: agg.riesgo_count ?? 0,
        'Sin indicios': agg.sin_indicios_count ?? 0,
      };
      return {
        cycle,
        count,
        aeAvg: agg.ae_avg != null ? Math.round(agg.ae_avg * 10) / 10 : null,
        dAvg: agg.d_avg != null ? Math.round(agg.d_avg * 10) / 10 : null,
        rpAvg: agg.rp_avg != null ? Math.round(agg.rp_avg * 10) / 10 : null,
        dominant: agg.dominant ?? null,
        wellbeing: wellbeing != null ? Math.round(wellbeing) : null,
        dist,
        isActiveCycle,
      };
    });
  }, [teamCycles, cycleAggregates]);
```

Note: `WELLBEING_NORMALIZATION` is no longer used directly in this file after this change (it was only
used inside the deleted inline wellbeing computation) — leave the import in place regardless, since
removing unused imports is not part of this task's scope and `classifyMBI`/`computeBurnoutStatus` are
still used elsewhere in this same file (by `memberBurnoutStates`, unaffected by this task).

- [ ] **Step 5: Build check**

Run `npm run build` from `C:\Claude\Teamzen\TeamZen` — must succeed with no new errors (the pre-existing
groqClient dynamic/static import warning is expected and fine).

- [ ] **Step 6: Manual QA note (human required)**

As a leader of a team with ≥3 respondents in a cycle where at least one member has opted out, open
Reportes and confirm: the aggregate numbers (AE/D/RP averages, distribution, dominant status) look
reasonable and unchanged from before this fix, while the per-member list still shows a badge only for
opted-in members — exactly as before. This can't be fully distinguished from the pre-fix UI by eye alone
(that's the point — the fix is invisible to a well-behaved leader and only closes what a leader could
extract via devtools); the real proof is Task 1's and Task 2's SQL-level verification already done.

- [ ] **Step 7: Commit**

```bash
git add src/pages/reportes.jsx
git commit -m "fix: source team MBI aggregate from anonymized SQL function, not raw client-side rows"
```

---

## Plan self-review notes

- **Spec coverage:** the spec's 3 in-scope items — (1) centralized leader-visibility helper + rewritten
  policies, (2) anonymized aggregate function, (3) `reportes.jsx` sourcing `aggregated` from it — map
  1:1 to Tasks 1, 2, 3. All explicitly-out-of-scope items (leader-role gating, closed-loop tracking,
  instrument validity, `memberBurnoutStates`/badge UI, team-level visibility toggles) have no task, by
  design.
- **Type/naming consistency:** `mbi_team_cycle_aggregates`'s return columns (`respondent_count`, `ae_avg`,
  `d_avg`, `rp_avg`, `burnout_count`, `riesgo_alto_count`, `riesgo_count`, `sin_indicios_count`,
  `dominant`) are defined once in Task 2 and consumed with those exact names in Task 3's Step 3-4 — no
  drift. `mbi_response_leader_visible(p_response_id uuid)` is defined in Task 1 and not referenced by any
  later task (it's consumed only by the two policies rewritten in that same task).
- **No placeholders:** every step has literal SQL/JS before-after content or exact verification queries,
  not descriptions of what to do.
