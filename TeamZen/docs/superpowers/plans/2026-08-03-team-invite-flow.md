# Team Invite-Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give TeamZen leaders the ability to manage their team's membership lifecycle: invite codes that expire and can be regenerated, removing a member, and transferring leadership to another member.

**Architecture:** Hybrid backend approach — a plain RLS `DELETE` policy for kicking a member (simple permission check, no extra state), and two `SECURITY DEFINER` Postgres functions for regenerating the invite code and transferring leadership (both are multi-step atomic operations that also need to deliberately bypass an existing anti-hijacking RLS restriction). Frontend changes thread new handlers through the existing `LeaderTeamsSection` → `LeaderTeamCard` prop chain in `dashboard.jsx`, following the same pattern already used for `onEdit`/`onDelete`.

**Tech Stack:** React 19 + Vite (JS, no TypeScript), Supabase (Postgres + PostgREST + `supabase-js` v2), Tailwind CSS. No test framework exists in this repo (confirmed: no vitest/jest, no `test` script in `package.json`) — do not introduce one as a side effect of this feature. Verification uses two mechanisms already established in this project: (1) SQL/RLS behavior is verified by impersonating a real user via `execute_sql` with `set local role authenticated; set local request.jwt.claims = '...'` before/after each migration; (2) frontend changes are verified by `npm run build` succeeding, plus a manual browser QA step that the AI performing this plan CANNOT run itself (no real logged-in session available) — each frontend task ends with an explicit manual-QA note for the human to perform.

## Global Constraints

- All SQL changes are applied via the Supabase MCP `apply_migration` tool directly to the production
  project (`alzjmlnoaxqlkdtvwisr`) — there is **no local `supabase/migrations` directory** in this repo;
  migrations are tracked server-side only (confirmed via `list_migrations` — prior migrations this session
  were `rls_redesign_and_enable`, `rls_lockdown_followups`, `fix_team_members_rls_recursion`,
  `fix_team_teams_rls_recursion_v2`, none of which exist as local files). Because of this, SQL tasks have
  **no `git commit` step** — there is no local file to commit. The "commit" for a SQL task is the
  successful `apply_migration` call itself, which Supabase records automatically.
- Database branching is unavailable through this MCP connection (no `confirm_cost` tool exposed) — SQL
  changes go directly to production, verified via impersonation queries before being considered done.
- Do not touch `profiles.role` self-assignment, notifications, or per-team-configurable TTL — explicitly
  out of scope per the spec at `docs/superpowers/specs/2026-08-03-team-invite-flow-design.md`.
- Match existing code conventions exactly: Spanish user-facing strings, the existing Tailwind color
  palette (`#55C2A2`, `#9D83C6`, `#2E2E3A`, `#5B5B6B`, `#DAD5E4`, `#FAF9F6`), `window.confirm(...)` for
  destructive-action confirmation (not a custom dialog), and the existing `Modal.jsx` component for new
  modals.
- The helper functions `public.is_team_leader(uuid)` and `public.is_team_member(uuid)` already exist in
  the database (created earlier this session) — reuse them, do not redefine them.

---

### Task 1: Migration — invite code expiry column + kick-member policy

**Files:**
- No local files — applied via the `mcp__supabase__apply_migration` tool.

**Interfaces:**
- Produces: `public.team_invite_codes.expires_at` (timestamptz, not null, default `now() + interval '30
  days'`), and RLS policy `team_members_delete_as_leader` on `public.team_members`.

- [ ] **Step 1: Write and run the "before" verification query (expect failure)**

Run via `mcp__supabase__execute_sql`, substituting a real leader's user id and a real team they lead and
a real member's user id from that team (query `select id, leader_id from teams limit 3;` and `select
team_id, user_id from team_members limit 3;` first if you don't have these handy):

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select column_name from information_schema.columns
where table_name = 'team_invite_codes' and column_name = 'expires_at';
-- expect: 0 rows (column does not exist yet)
delete from public.team_members where team_id = '<team_uuid>' and user_id = '<member_uuid>';
-- expect: 0 rows affected (no policy permits this yet — RLS blocks it silently)
rollback;
```

Expected: the `information_schema` query returns no rows, and the `delete` affects 0 rows (confirm by
re-selecting the row still exists after — do not actually rely on the delete "erroring", RLS silently
filters rows it won't touch).

- [ ] **Step 2: Apply the migration**

Call `mcp__supabase__apply_migration` with `name: "invite_expiry_and_kick_policy"` and this `query`:

```sql
begin;

alter table public.team_invite_codes
  add column expires_at timestamptz not null default (now() + interval '30 days');

-- Backfill existing codes so they don't retroactively look expired
update public.team_invite_codes set expires_at = now() + interval '30 days';

create policy "team_members_delete_as_leader" on public.team_members
  for delete to authenticated
  using (public.is_team_leader(team_members.team_id));

commit;
```

- [ ] **Step 3: Re-run the verification query (expect success)**

Same impersonation pattern as Step 1, but now:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select id, team_id, user_id from public.team_members where team_id = '<team_uuid>' and user_id = '<member_uuid>';
-- expect: 1 row (confirm the member still exists before deleting)
delete from public.team_members where team_id = '<team_uuid>' and user_id = '<member_uuid>';
select id, team_id, user_id from public.team_members where team_id = '<team_uuid>' and user_id = '<member_uuid>';
-- expect: 0 rows (the delete worked)
rollback;
```

Expected: the delete succeeds and the row is gone within the transaction (the `rollback` at the end
undoes it so you haven't actually kicked a real member — this is purely a permission check).

Also confirm a **non-leader cannot** delete another member's row:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<some_other_member_uuid_not_the_leader>","role":"authenticated"}';
delete from public.team_members where team_id = '<team_uuid>' and user_id = '<member_uuid>';
select id from public.team_members where team_id = '<team_uuid>' and user_id = '<member_uuid>';
-- expect: 1 row (the delete affected nothing, row still there)
rollback;
```

- [ ] **Step 4: Run `get_advisors(type: "security")` and confirm no new ERROR-level findings**

Only pre-existing WARN-level findings (Postgres version, OTP expiry, etc. — already known from earlier
this session) should be present. If a new ERROR appears, stop and investigate before continuing.

---

### Task 2: Migration — `regenerate_team_invite_code` function

**Files:**
- No local files — applied via `mcp__supabase__apply_migration`.

**Interfaces:**
- Consumes: `public.is_team_leader(uuid)` (existing helper).
- Produces: `public.regenerate_team_invite_code(p_team_id uuid) returns table (code text, expires_at
  timestamptz)` — callable via `supabase.rpc("regenerate_team_invite_code", { p_team_id })`.

- [ ] **Step 1: Write and run the "before" verification query (expect failure)**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select public.regenerate_team_invite_code('<team_uuid>');
rollback;
```

Expected: error — `function public.regenerate_team_invite_code(uuid) does not exist`.

- [ ] **Step 2: Apply the migration**

Call `mcp__supabase__apply_migration` with `name: "regenerate_invite_code_function"` and this `query`:

```sql
begin;

create or replace function public.regenerate_team_invite_code(p_team_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_expires_at timestamptz := now() + interval '30 days';
begin
  if not public.is_team_leader(p_team_id) then
    raise exception 'No eres el líder de este equipo';
  end if;

  delete from public.team_invite_codes where team_id = p_team_id;

  v_code := array_to_string(
    array(select chr(65 + floor(random() * 26)::int) from generate_series(1, 6)), ''
  );

  insert into public.team_invite_codes (team_id, code, expires_at)
  values (p_team_id, v_code, v_expires_at);

  return query select v_code, v_expires_at;
end;
$$;

revoke all on function public.regenerate_team_invite_code(uuid) from public, anon;
grant execute on function public.regenerate_team_invite_code(uuid) to authenticated;

commit;
```

- [ ] **Step 3: Re-run the verification query (expect success) and confirm old code is gone**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select code as old_code from public.team_invite_codes where team_id = '<team_uuid>';
select * from public.regenerate_team_invite_code('<team_uuid>');
select code from public.team_invite_codes where team_id = '<team_uuid>';
-- expect: exactly 1 row, and its code is DIFFERENT from old_code above
rollback;
```

Also confirm a non-leader is rejected:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<non_leader_uuid>","role":"authenticated"}';
select public.regenerate_team_invite_code('<team_uuid>');
rollback;
```

Expected: error `No eres el líder de este equipo`.

- [ ] **Step 4: Run `get_advisors(type: "security")`**

Expect the usual `authenticated_security_definer_function_executable` WARN for this new function (same
class already seen for `join_team_with_code`, `is_team_leader`, etc.) — no ERROR-level findings.

---

### Task 3: Migration — `transfer_team_leadership` function

**Files:**
- No local files — applied via `mcp__supabase__apply_migration`.

**Interfaces:**
- Consumes: `public.is_team_leader(uuid)` (existing helper).
- Produces: `public.transfer_team_leadership(p_team_id uuid, p_new_leader_id uuid) returns void` —
  callable via `supabase.rpc("transfer_team_leadership", { p_team_id, p_new_leader_id })`.

- [ ] **Step 1: Write and run the "before" verification query (expect failure)**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select public.transfer_team_leadership('<team_uuid>', '<member_uuid>');
rollback;
```

Expected: error — function does not exist.

- [ ] **Step 2: Apply the migration**

Call `mcp__supabase__apply_migration` with `name: "transfer_leadership_function"` and this `query`:

```sql
begin;

create or replace function public.transfer_team_leadership(p_team_id uuid, p_new_leader_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_leader_id uuid := auth.uid();
begin
  if not public.is_team_leader(p_team_id) then
    raise exception 'No eres el líder de este equipo';
  end if;

  if p_new_leader_id = v_old_leader_id then
    raise exception 'Ya eres el líder de este equipo';
  end if;

  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_new_leader_id
  ) then
    raise exception 'El usuario no es miembro de este equipo';
  end if;

  update public.teams set leader_id = p_new_leader_id, updated_at = now()
  where id = p_team_id;

  delete from public.team_members
  where team_id = p_team_id and user_id = p_new_leader_id;

  insert into public.team_members (team_id, user_id, share_results_with_leader)
  values (p_team_id, v_old_leader_id, false)
  on conflict do nothing;
end;
$$;

revoke all on function public.transfer_team_leadership(uuid, uuid) from public, anon;
grant execute on function public.transfer_team_leadership(uuid, uuid) to authenticated;

commit;
```

- [ ] **Step 3: Re-run verification — happy path**

Pick a team, its current leader, and one of its real members, then:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select public.transfer_team_leadership('<team_uuid>', '<member_uuid>');
select leader_id from public.teams where id = '<team_uuid>';
-- expect: leader_id is now <member_uuid>
select user_id from public.team_members where team_id = '<team_uuid>' and user_id = '<leader_uuid>';
-- expect: 1 row (old leader is now a regular member)
select user_id from public.team_members where team_id = '<team_uuid>' and user_id = '<member_uuid>';
-- expect: 0 rows (new leader no longer has a team_members row)
rollback;
```

- [ ] **Step 4: Re-run verification — rejection paths**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_uuid>","role":"authenticated"}';
select public.transfer_team_leadership('<team_uuid>', '<leader_uuid>');
-- expect: error 'Ya eres el líder de este equipo'
select public.transfer_team_leadership('<team_uuid>', '00000000-0000-0000-0000-000000000000');
-- expect: error 'El usuario no es miembro de este equipo'
rollback;
```

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<non_leader_uuid>","role":"authenticated"}';
select public.transfer_team_leadership('<team_uuid>', '<member_uuid>');
-- expect: error 'No eres el líder de este equipo'
rollback;
```

- [ ] **Step 5: Run `get_advisors(type: "security")`**

Expect only the usual WARN class, no ERROR.

---

### Task 4: Migration — `join_team_with_code` respects expiry, distinct error messages

**Files:**
- No local files — applied via `mcp__supabase__apply_migration`.

**Interfaces:**
- Modifies: `public.join_team_with_code(p_code text)` (existing function, created earlier this session).

- [ ] **Step 1: Write and run the "before" check (confirm current behavior)**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<some_uuid_not_yet_a_member>","role":"authenticated"}';
select public.join_team_with_code('ZZZZZZ');
-- expect: error 'Código de invitación inválido' (unchanged — sanity check the function still works pre-migration)
rollback;
```

- [ ] **Step 2: Apply the migration**

Call `mcp__supabase__apply_migration` with `name: "join_with_code_expiry_check"` and this `query`:

```sql
begin;

create or replace function public.join_team_with_code(p_code text)
returns table (team_id uuid, team_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_join_policy text;
  v_expires_at timestamptz;
begin
  select tic.team_id, tic.expires_at into v_team_id, v_expires_at
  from public.team_invite_codes tic
  where tic.code = upper(p_code);

  if v_team_id is null then
    raise exception 'Código de invitación no encontrado';
  end if;

  if v_expires_at <= now() then
    raise exception 'Este código ya expiró. Pide uno nuevo al líder del equipo';
  end if;

  select t.join_policy into v_join_policy
  from public.teams t
  where t.id = v_team_id;

  if v_join_policy is distinct from 'code' then
    raise exception 'Este equipo no permite unirse directamente';
  end if;

  if exists (
    select 1 from public.team_members tm
    where tm.team_id = v_team_id and tm.user_id = auth.uid()
  ) then
    raise exception 'Ya eres miembro de este equipo';
  end if;

  insert into public.team_members (team_id, user_id, share_results_with_leader)
  values (v_team_id, auth.uid(), false);

  return query
    select t.id, t.name from public.teams t where t.id = v_team_id;
end;
$$;

commit;
```

(Grants are unchanged from the original function — `revoke`/`grant` was already applied when this
function was first created.)

- [ ] **Step 3: Re-run verification — distinct messages**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<some_uuid_not_yet_a_member>","role":"authenticated"}';
select public.join_team_with_code('ZZZZZZ');
-- expect: error 'Código de invitación no encontrado' (distinct from the expired-code message now)
rollback;
```

Then manually expire a real code to test the other branch:

```sql
begin;
update public.team_invite_codes set expires_at = now() - interval '1 day' where team_id = '<team_uuid>';
set local role authenticated;
set local request.jwt.claims = '{"sub":"<some_uuid_not_yet_a_member>","role":"authenticated"}';
select code from public.team_invite_codes where team_id = '<team_uuid>';
-- note the code, then:
select public.join_team_with_code('<that_code>');
-- expect: error 'Este código ya expiró. Pide uno nuevo al líder del equipo'
rollback;
```

(The `rollback` at the end undoes the manual expiry backdating — this was purely a test.)

- [ ] **Step 4: Run `get_advisors(type: "security")`**

Expect no new findings beyond what's already known.

---

### Task 5: Frontend — server-side code generation on team creation

**Files:**
- Modify: `src/pages/crear-equipo.jsx:24-77`
- Modify: `src/components/CreateTeamModal.jsx:44-104`

**Interfaces:**
- Consumes: `public.regenerate_team_invite_code(p_team_id uuid)` from Task 2, via
  `supabase.rpc("regenerate_team_invite_code", { p_team_id }).single()` → `{ data: { code, expires_at },
  error }`.

- [ ] **Step 1: Update `crear-equipo.jsx`**

Replace lines 24-69 (the `generateCode` function and the invite-code portion of `handleCreateTeam`):

```jsx
// DELETE this entire function (lines 24-27):
const generateCode = (length = 6) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};
```

Replace this block (was lines 62-69):
```jsx
      const code = generateCode();
      const { error: codeError } = await supabase
        .from("team_invite_codes")
        .insert([{ code, team_id: newTeam.id }]);

      if (codeError) {
        throw new Error("Equipo creado, pero ocurrió un error al generar el código.");
      }

      setInviteCode(code);
```

with:
```jsx
      const { data: codeResult, error: codeError } = await supabase
        .rpc("regenerate_team_invite_code", { p_team_id: newTeam.id })
        .single();

      if (codeError || !codeResult?.code) {
        throw new Error("Equipo creado, pero ocurrió un error al generar el código.");
      }

      setInviteCode(codeResult.code);
```

- [ ] **Step 2: Update `CreateTeamModal.jsx`**

Replace lines 44-47 (delete `generateCode`, same as above), and replace this block (was lines 83-93):
```jsx
      const code = generateCode();
      const { error: codeError } = await supabase
        .from("team_invite_codes")
        .insert([{ code, team_id: newTeam.id }]);

      if (codeError) {
        throw new Error("Equipo creado, pero ocurrió un error al generar el código.");
      }

      setInviteCode(code);
      setSuccess(true);
```

with:
```jsx
      const { data: codeResult, error: codeError } = await supabase
        .rpc("regenerate_team_invite_code", { p_team_id: newTeam.id })
        .single();

      if (codeError || !codeResult?.code) {
        throw new Error("Equipo creado, pero ocurrió un error al generar el código.");
      }

      setInviteCode(codeResult.code);
      setSuccess(true);
```

- [ ] **Step 3: Build check**

Run: `npm run build` (from `TeamZen/`)
Expected: succeeds with no new errors (the pre-existing "chunk larger than 500kB" and dynamic-import
warnings are known and unrelated — ignore them).

- [ ] **Step 4: Manual QA note (human required — Claude cannot log in as a real user)**

Log in as a leader, create a new team via both entry points (the standalone `/crear-equipo` page AND the
`CreateTeamModal` from the dashboard), and confirm a 6-letter code is displayed in both flows.

- [ ] **Step 5: Commit**

```bash
git add src/pages/crear-equipo.jsx src/components/CreateTeamModal.jsx
git commit -m "feat: generate invite codes server-side via regenerate_team_invite_code"
```

---

### Task 6: Frontend — invite code expiry display + regenerate button

**Files:**
- Modify: `src/pages/dashboard.jsx:115` (add `expires_at` to select)
- Modify: `src/pages/dashboard.jsx:493` (add `expires_at` to select)
- Modify: `src/pages/dashboard.jsx:573` (insert new handler after `handleDeleteTeam`)
- Modify: `src/pages/dashboard.jsx:846-864` (pass new prop to `LeaderTeamsSection`)
- Modify: `src/pages/dashboard.jsx:1002` (accept new prop in `LeaderTeamsSection`)
- Modify: `src/pages/dashboard.jsx:1037-1052` (pass new prop to `LeaderTeamCard`)
- Modify: `src/pages/dashboard.jsx:1490` (accept new prop in `LeaderTeamCard`)
- Modify: `src/pages/dashboard.jsx:1668-1700` (expiry display + button JSX)

**Interfaces:**
- Consumes: `public.regenerate_team_invite_code` from Task 2.
- Produces: `onRegenerateCode(teamId)` prop threaded through `LeaderTeamsSection` → `LeaderTeamCard`.

- [ ] **Step 1: Fetch `expires_at` alongside the code**

At line 115, change:
```jsx
            .select("*, team_invite_codes(code)")
```
to:
```jsx
            .select("*, team_invite_codes(code, expires_at)")
```

At line 493 (inside `handleTeamCreated`), change:
```jsx
        .select("*, team_invite_codes(code)")
```
to:
```jsx
        .select("*, team_invite_codes(code, expires_at)")
```

- [ ] **Step 2: Add the `handleRegenerateCode` handler**

Insert immediately after line 573 (the closing `};` of `handleDeleteTeam`, before the "HANDLERS -
GESTIÓN DE PERFIL DE USUARIO" comment block):

```jsx
  const handleRegenerateCode = async (teamId) => {
    if (!confirm("¿Seguro que quieres generar un nuevo código? El código actual dejará de funcionar de inmediato.")) {
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc("regenerate_team_invite_code", { p_team_id: teamId })
        .single();

      if (error) throw error;

      setTeams(prevTeams =>
        prevTeams.map(team =>
          team.id === teamId
            ? { ...team, team_invite_codes: [{ code: data.code, expires_at: data.expires_at }] }
            : team
        )
      );
    } catch (error) {
      console.error("Error regenerando código:", error);
      alert("No se pudo regenerar el código. Inténtalo de nuevo.");
    }
  };
```

- [ ] **Step 3: Thread the prop down**

At line 861 (in the `<LeaderTeamsSection ... />` call), add a new prop right after `onDeleteTeam={handleDeleteTeam}`:
```jsx
              onDeleteTeam={handleDeleteTeam}
              onRegenerateCode={handleRegenerateCode}
```

At line 1002, add `onRegenerateCode` to the `LeaderTeamsSection` function signature:
```jsx
function LeaderTeamsSection({ teams, teamsLoading, teamMembers, membersLoading, navigate, activeCycles, onPrepareLaunch, launchingTeam, endingTeam, onEndCycle, respondedMembersByTeam, wellbeingByTeam = {}, onCreateTeam, onEditTeam, onDeleteTeam, onRegenerateCode, profile, currentUserId }) {
```

At line 1049 (in the `<LeaderTeamCard ... />` call inside `LeaderTeamsSection`), add:
```jsx
            onEdit={onEditTeam}
            onDelete={onDeleteTeam}
            onRegenerateCode={onRegenerateCode}
```

At line 1490, add `onRegenerateCode` to the `LeaderTeamCard` function signature:
```jsx
function LeaderTeamCard({ team, members, membersLoading, activeCycleId, onLaunch, launching, ending, onEndCycle, respondedMembers, wellbeingMetric, onEdit, onDelete, onRegenerateCode, profile, currentUserId }) {
```

- [ ] **Step 4: Add expiry display + regenerate button**

Replace the "Código de invitación" block (lines 1668-1700):

```jsx
        {/* Código de invitación */}
        <div className="bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 p-3 sm:p-4 rounded-xl mb-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-[#2E2E3A] font-medium flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-[#55C2A2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="flex-1">Código de invitación</span>
                <button
                  onClick={() => setShowInvite(v => !v)}
                  className="text-[10px] sm:text-xs px-2 py-0.5 rounded-lg border border-[#55C2A2]/50 text-[#55C2A2] hover:bg-[#55C2A2]/20 transition-all duration-200 flex-shrink-0"
                >{showInvite ? 'Ocultar' : 'Mostrar'}</button>
              </p>
              <p className="text-sm sm:text-lg font-mono font-bold text-[#2E2E3A] select-all break-all bg-[#FAF9F6] px-2 sm:px-3 py-2 rounded-lg border border-[#DAD5E4]">
                {team.team_invite_codes?.length > 0 ? (
                  showInvite ? team.team_invite_codes[0].code : '••••••••'
                ) : 'Sin código'}
              </p>
              {team.team_invite_codes?.length > 0 && team.team_invite_codes[0].expires_at && (
                new Date(team.team_invite_codes[0].expires_at) <= new Date() ? (
                  <span className="text-[10px] sm:text-xs text-red-600 font-medium">Expirado — genera uno nuevo</span>
                ) : (
                  <span className="text-[10px] sm:text-xs text-[#5B5B6B]">
                    Expira el {new Date(team.team_invite_codes[0].expires_at).toLocaleDateString()}
                  </span>
                )
              )}
              {copied && <span className="text-[10px] text-green-700 font-medium block">Copiado</span>}
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0 mt-6 sm:mt-0">
              <button
                onClick={async () => {
                  if (team.team_invite_codes?.length > 0) {
                    try { await navigator.clipboard.writeText(team.team_invite_codes[0].code); setCopied(true); setTimeout(()=>setCopied(false), 2000);} catch(e){}
                  }
                }}
                className="bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7] hover:from-[#4AB393] hover:to-[#6ED4B8] text-white px-3 py-1.5 sm:py-1 rounded-lg text-xs sm:text-sm transition-all duration-300 ease-out transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                Copiar
              </button>
              <button
                onClick={() => onRegenerateCode && onRegenerateCode(team.id)}
                className="border border-[#9D83C6]/50 text-[#9D83C6] px-3 py-1.5 sm:py-1 rounded-lg text-xs sm:text-sm hover:bg-[#9D83C6]/10 transition-all duration-200"
              >
                Regenerar
              </button>
            </div>
          </div>
        </div>
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: succeeds, no new errors.

- [ ] **Step 6: Manual QA note (human required)**

As a leader, open a team card, click "Regenerar" and confirm the dialog, verify the displayed code
changes and the expiry date updates to ~30 days from now. Confirm the old code no longer works by trying
to join with it from a second (test) account via `/unirse-equipo` — expect "Código de invitación no
encontrado".

- [ ] **Step 7: Commit**

```bash
git add src/pages/dashboard.jsx
git commit -m "feat: show invite code expiry and add regenerate button"
```

---

### Task 7: Frontend — expel (kick) a member

**Files:**
- Modify: `src/pages/dashboard.jsx` (handler + prop threading + button JSX, same locations pattern as Task 6)

**Interfaces:**
- Consumes: the `team_members_delete_as_leader` RLS policy from Task 1 (plain `supabase.from('team_members').delete()...` call — no RPC needed).
- Produces: `onKickMember(teamId, memberUserId)` prop threaded through `LeaderTeamsSection` → `LeaderTeamCard`.

- [ ] **Step 1: Add the `handleKickMember` handler**

Insert right after the `handleRegenerateCode` handler added in Task 6, Step 2:

```jsx
  const handleKickMember = async (teamId, memberUserId) => {
    if (!confirm("¿Estás seguro de que quieres expulsar a este miembro del equipo? Su historial de evaluaciones se conserva, pero perderá el acceso al equipo.")) {
      return;
    }

    try {
      const { error, count } = await supabase
        .from("team_members")
        .delete({ count: "exact" })
        .eq("team_id", teamId)
        .eq("user_id", memberUserId);

      if (error) throw error;

      if (count && count > 0) {
        setTeamMembers(prev => ({
          ...prev,
          [teamId]: (prev[teamId] || []).filter(m => m.user_id !== memberUserId)
        }));
      }
    } catch (error) {
      console.error("Error expulsando miembro:", error);
      alert("No se pudo expulsar al miembro. Inténtalo de nuevo.");
    }
  };
```

- [ ] **Step 2: Thread the prop down**

By this point Task 6 has already added `onRegenerateCode` in these same four spots — find each by its
now-updated content (line numbers will have shifted slightly from Task 6's edits) and extend it the same
way, adding `onKickMember` alongside it:

At the `<LeaderTeamsSection ... />` call site, change:
```jsx
              onDeleteTeam={handleDeleteTeam}
              onRegenerateCode={handleRegenerateCode}
```
to:
```jsx
              onDeleteTeam={handleDeleteTeam}
              onRegenerateCode={handleRegenerateCode}
              onKickMember={handleKickMember}
```

In the `LeaderTeamsSection` function signature, change:
```jsx
function LeaderTeamsSection({ teams, teamsLoading, teamMembers, membersLoading, navigate, activeCycles, onPrepareLaunch, launchingTeam, endingTeam, onEndCycle, respondedMembersByTeam, wellbeingByTeam = {}, onCreateTeam, onEditTeam, onDeleteTeam, onRegenerateCode, profile, currentUserId }) {
```
to:
```jsx
function LeaderTeamsSection({ teams, teamsLoading, teamMembers, membersLoading, navigate, activeCycles, onPrepareLaunch, launchingTeam, endingTeam, onEndCycle, respondedMembersByTeam, wellbeingByTeam = {}, onCreateTeam, onEditTeam, onDeleteTeam, onRegenerateCode, onKickMember, profile, currentUserId }) {
```

At the `<LeaderTeamCard ... />` call inside `LeaderTeamsSection`, change:
```jsx
            onEdit={onEditTeam}
            onDelete={onDeleteTeam}
            onRegenerateCode={onRegenerateCode}
```
to:
```jsx
            onEdit={onEditTeam}
            onDelete={onDeleteTeam}
            onRegenerateCode={onRegenerateCode}
            onKickMember={onKickMember}
```

In the `LeaderTeamCard` function signature, change:
```jsx
function LeaderTeamCard({ team, members, membersLoading, activeCycleId, onLaunch, launching, ending, onEndCycle, respondedMembers, wellbeingMetric, onEdit, onDelete, onRegenerateCode, profile, currentUserId }) {
```
to:
```jsx
function LeaderTeamCard({ team, members, membersLoading, activeCycleId, onLaunch, launching, ending, onEndCycle, respondedMembers, wellbeingMetric, onEdit, onDelete, onRegenerateCode, onKickMember, profile, currentUserId }) {
```

- [ ] **Step 3: Add the kick button to each member row**

Replace the member-row block (lines 1712-1744):

```jsx
                {allMembersForLeader.map((member) => {
                  const hasResponded = !!(respondedMembers && respondedMembers.has(member.user_id));
                  const isLeaderMember = member.isLeader;
                  return (
                    <div key={member.user_id} className="flex items-center space-x-3 p-2 bg-[#FAF9F6] border border-[#DAD5E4] rounded-xl">
                      <div className={`w-8 h-8 ${isLeaderMember ? 'bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7]' : 'bg-[#DAD5E4]'} rounded-full flex items-center justify-center`}>
                        <span className={`text-sm font-medium ${isLeaderMember ? 'text-white' : 'text-[#2E2E3A]'}`}>
                          {member.profiles?.first_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {member.profiles?.first_name && member.profiles?.last_name
                            ? `${member.profiles.first_name} ${member.profiles.last_name}`
                            : 'Usuario sin nombre'
                          }
                        </p>
                        <p className="text-xs text-gray-500">
                          {isLeaderMember ? 'Líder del equipo' : 'Miembro del equipo'}
                        </p>
                      </div>
                      {activeCycleId ? (
                        hasResponded ? (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">Respondió</span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">Pendiente</span>
                        )
                      ) : (
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">Sin ciclo</span>
                      )}
                    </div>
                  );
                })}
```

with:

```jsx
                {allMembersForLeader.map((member) => {
                  const hasResponded = !!(respondedMembers && respondedMembers.has(member.user_id));
                  const isLeaderMember = member.isLeader;
                  return (
                    <div key={member.user_id} className="flex items-center space-x-3 p-2 bg-[#FAF9F6] border border-[#DAD5E4] rounded-xl">
                      <div className={`w-8 h-8 ${isLeaderMember ? 'bg-gradient-to-r from-[#55C2A2] to-[#7DDFC7]' : 'bg-[#DAD5E4]'} rounded-full flex items-center justify-center`}>
                        <span className={`text-sm font-medium ${isLeaderMember ? 'text-white' : 'text-[#2E2E3A]'}`}>
                          {member.profiles?.first_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {member.profiles?.first_name && member.profiles?.last_name
                            ? `${member.profiles.first_name} ${member.profiles.last_name}`
                            : 'Usuario sin nombre'
                          }
                        </p>
                        <p className="text-xs text-gray-500">
                          {isLeaderMember ? 'Líder del equipo' : 'Miembro del equipo'}
                        </p>
                      </div>
                      {activeCycleId ? (
                        hasResponded ? (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">Respondió</span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">Pendiente</span>
                        )
                      ) : (
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">Sin ciclo</span>
                      )}
                      {!isLeaderMember && (
                        <button
                          onClick={() => onKickMember && onKickMember(team.id, member.user_id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                          aria-label="Expulsar miembro"
                          title="Expulsar del equipo"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
```

(The `!isLeaderMember` guard hides the button for the synthetic leader row, per the spec's error-handling
section.)

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: succeeds, no new errors.

- [ ] **Step 5: Manual QA note (human required)**

As a leader with at least one real member in a team, click the kick button on a non-leader row, confirm
the dialog, verify the member disappears from the list immediately. Log in as that kicked user (second
test account) and confirm they no longer see that team in their dashboard, and that their old MBI
responses are unaffected (check via a fresh join + `evaluaciones.jsx`'s own-history view still shows
past entries — though a kicked user's *access* to past team-scoped data depends on existing RLS, which
already scopes `mbi_responses`/`mbi_scores` reads to `user_id = auth.uid()` regardless of team
membership, so this should already work without further changes).

- [ ] **Step 6: Commit**

```bash
git add src/pages/dashboard.jsx
git commit -m "feat: let leaders remove a member from their team"
```

---

### Task 8: Frontend — transfer leadership

**Files:**
- Create: `src/components/TransferLeadershipModal.jsx`
- Modify: `src/components/TeamOptionsMenu.jsx`
- Modify: `src/pages/dashboard.jsx` (state, handler, wiring, render the new modal)

**Interfaces:**
- Consumes: `public.transfer_team_leadership(p_team_id uuid, p_new_leader_id uuid)` from Task 3, via
  `supabase.rpc("transfer_team_leadership", { p_team_id, p_new_leader_id })`.
- Produces: `TransferLeadershipModal` component with props `{ isOpen, onClose, team, members,
  onTransferred }`.

- [ ] **Step 1: Create `TransferLeadershipModal.jsx`**

```jsx
import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Modal from './Modal';
import { Alert } from './UIComponents';

export default function TransferLeadershipModal({ isOpen, onClose, team, members, onTransferred }) {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTransfer = async () => {
    if (!selectedUserId || !team) return;

    if (!confirm("¿Seguro que quieres transferir el liderazgo? Pasarás a ser un miembro normal de este equipo.")) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: transferError } = await supabase.rpc("transfer_team_leadership", {
        p_team_id: team.id,
        p_new_leader_id: selectedUserId
      });

      if (transferError) throw transferError;

      onTransferred();
    } catch (err) {
      setError(err.message || "No se pudo transferir el liderazgo.");
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedUserId(null);
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Transferir liderazgo"
      maxWidth="max-w-lg"
      preventCloseOnOutsideClick={loading}
    >
      <div className="space-y-4">
        <p className="text-sm text-[#5B5B6B]">
          Elige qué miembro será el nuevo líder de "{team?.name}". Tú pasarás a ser un miembro normal del equipo.
        </p>

        {!members || members.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Este equipo no tiene otros miembros todavía.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.map((member) => (
              <label
                key={member.user_id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${
                  selectedUserId === member.user_id ? 'border-[#55C2A2] bg-[#55C2A2]/10' : 'border-[#DAD5E4]'
                }`}
              >
                <span className="text-sm font-medium text-[#2E2E3A]">
                  {member.profiles?.first_name && member.profiles?.last_name
                    ? `${member.profiles.first_name} ${member.profiles.last_name}`
                    : 'Usuario sin nombre'}
                </span>
                <input
                  type="radio"
                  name="newLeader"
                  checked={selectedUserId === member.user_id}
                  onChange={() => setSelectedUserId(member.user_id)}
                  disabled={loading}
                  className="w-4 h-4 text-[#55C2A2] focus:ring-[#55C2A2]"
                />
              </label>
            ))}
          </div>
        )}

        {error && (
          <Alert type="error" title="Error al transferir liderazgo">
            {error}
          </Alert>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleTransfer}
            disabled={loading || !selectedUserId}
            className="flex-1 bg-[#55C2A2] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#4AA690] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Transfiriendo..." : "Transferir liderazgo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Add the menu item to `TeamOptionsMenu.jsx`**

Change the function signature (line 3):
```jsx
export default function TeamOptionsMenu({ team, onEdit, onDelete, onTransferLeadership }) {
```

Add a new handler next to `handleEdit`/`handleDelete` (after line 27):
```jsx
  const handleTransfer = () => {
    setIsOpen(false);
    onTransferLeadership(team);
  };
```

Add a new button in the dropdown, between the "Editar equipo" button and the "Eliminar equipo" button
(insert after line 59, before the delete `<button>` starting at line 60):
```jsx
            <button
              onClick={handleTransfer}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Transferir liderazgo
            </button>
```

- [ ] **Step 3: Wire it into `dashboard.jsx`**

Add the import near the other component imports (after line 20):
```jsx
import TransferLeadershipModal from "../components/TransferLeadershipModal";
```

Add state near the other modal state declarations (after line 78, `const [showEditTeamModal, ...]`):
```jsx
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferringTeam, setTransferringTeam] = useState(null);
```

Add handlers right after the `handleKickMember` handler from Task 7:
```jsx
  const handleOpenTransfer = (team) => {
    setTransferringTeam(team);
    setShowTransferModal(true);
  };

  const handleTransferred = () => {
    setShowTransferModal(false);
    setTransferringTeam(null);
    // Leadership of this team just changed hands — the transferring user's
    // view flips from leader to member, which touches enough state
    // (teams, teamMembers, activeCycles, respondedMembersByTeam,
    // wellbeingByTeam) that a full reload is simpler and safer than
    // hand-patching every piece of derived state. This mirrors the existing
    // "Dashboard" mobile nav button at line ~936, which already reloads
    // the page rather than re-running init() piecemeal.
    window.location.reload();
  };
```

Thread `onTransferLeadership={handleOpenTransfer}` down through the same four spots extended in Task 7,
Step 2 — by now each already carries `onKickMember` alongside `onRegenerateCode`, so extend once more:

At the `<LeaderTeamsSection ... />` call site, change:
```jsx
              onDeleteTeam={handleDeleteTeam}
              onRegenerateCode={handleRegenerateCode}
              onKickMember={handleKickMember}
```
to:
```jsx
              onDeleteTeam={handleDeleteTeam}
              onRegenerateCode={handleRegenerateCode}
              onKickMember={handleKickMember}
              onTransferLeadership={handleOpenTransfer}
```

In the `LeaderTeamsSection` function signature, change:
```jsx
function LeaderTeamsSection({ teams, teamsLoading, teamMembers, membersLoading, navigate, activeCycles, onPrepareLaunch, launchingTeam, endingTeam, onEndCycle, respondedMembersByTeam, wellbeingByTeam = {}, onCreateTeam, onEditTeam, onDeleteTeam, onRegenerateCode, onKickMember, profile, currentUserId }) {
```
to:
```jsx
function LeaderTeamsSection({ teams, teamsLoading, teamMembers, membersLoading, navigate, activeCycles, onPrepareLaunch, launchingTeam, endingTeam, onEndCycle, respondedMembersByTeam, wellbeingByTeam = {}, onCreateTeam, onEditTeam, onDeleteTeam, onRegenerateCode, onKickMember, onTransferLeadership, profile, currentUserId }) {
```

At the `<LeaderTeamCard ... />` call inside `LeaderTeamsSection`, change:
```jsx
            onEdit={onEditTeam}
            onDelete={onDeleteTeam}
            onRegenerateCode={onRegenerateCode}
            onKickMember={onKickMember}
```
to:
```jsx
            onEdit={onEditTeam}
            onDelete={onDeleteTeam}
            onRegenerateCode={onRegenerateCode}
            onKickMember={onKickMember}
            onTransferLeadership={onTransferLeadership}
```

In the `LeaderTeamCard` function signature, change:
```jsx
function LeaderTeamCard({ team, members, membersLoading, activeCycleId, onLaunch, launching, ending, onEndCycle, respondedMembers, wellbeingMetric, onEdit, onDelete, onRegenerateCode, onKickMember, profile, currentUserId }) {
```
to:
```jsx
function LeaderTeamCard({ team, members, membersLoading, activeCycleId, onLaunch, launching, ending, onEndCycle, respondedMembers, wellbeingMetric, onEdit, onDelete, onRegenerateCode, onKickMember, onTransferLeadership, profile, currentUserId }) {
```

Then, inside `LeaderTeamCard`, pass it to `TeamOptionsMenu`:

```jsx
            <TeamOptionsMenu 
              team={team}
              onEdit={() => onEdit && onEdit(team)}
              onDelete={() => onDelete && onDelete(team.id)}
              onTransferLeadership={onTransferLeadership}
            />
```

Render the modal near the other modals (after the `<EditTeamModal ... />` block, ~line 929):
```jsx
        <TransferLeadershipModal
          isOpen={showTransferModal}
          onClose={() => { setShowTransferModal(false); setTransferringTeam(null); }}
          team={transferringTeam}
          members={transferringTeam ? (teamMembers[transferringTeam.id] || []) : []}
          onTransferred={handleTransferred}
        />
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: succeeds, no new errors.

- [ ] **Step 5: Manual QA note (human required)**

Using two real test accounts (A = leader, B = member of A's team): as A, open the team's options menu,
choose "Transferir liderazgo", pick B, confirm. Verify the page reloads and A now sees that team under
"my teams as a member" (not as leader) and B, upon logging in, now sees it as leader with full
management controls (edit, delete, regenerate code, kick, transfer). Also verify the rejection paths
from Task 3 hold from the UI: attempting to select oneself isn't presented as an option in the list
(only `members`, which never includes the current leader — confirm this is actually true given how
`members` is populated for `teamMembers[team.id]`, which per `dashboard.jsx`'s data-loading effect only
ever contains real `team_members` rows, never the synthetically-injected leader row used for display — so
this is already guaranteed by construction, not something this task needs to add extra code for).

- [ ] **Step 6: Commit**

```bash
git add src/components/TransferLeadershipModal.jsx src/components/TeamOptionsMenu.jsx src/pages/dashboard.jsx
git commit -m "feat: let leaders transfer team leadership to a member"
```

---

## Plan self-review notes

- **Spec coverage**: expiry+regenerate → Tasks 1, 2, 5, 6. Kick member → Tasks 1, 7. Transfer leadership →
  Tasks 1 (helper reuse), 3, 8. Server-side code generation replacing `Math.random()` → Task 2 + 5.
  Distinct expired/invalid messages → Task 4. All spec sections have a corresponding task.
- **Type/name consistency check**: `regenerate_team_invite_code` returns `{ code, expires_at }` — used
  consistently in Task 5 (`codeResult.code`) and Task 6 (`data.code`, `data.expires_at`). `is_team_leader`
  and `is_team_member` names match what was actually created earlier this session (verified via this
  session's own migration history, not assumed). `member.isLeader` (camelCase) — confirmed by reading the
  actual current file content at `dashboard.jsx:1518`, not the `is_leader` (snake_case) name used in a
  *different* injection point elsewhere in the same file for the member-facing view — these are two
  separate, intentionally distinct mechanisms, not a naming bug to unify.
- **No placeholders**: every step includes literal code, not descriptions of code.
