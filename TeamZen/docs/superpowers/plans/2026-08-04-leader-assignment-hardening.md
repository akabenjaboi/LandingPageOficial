# Leader-Assignment Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make team creation and role assignment actually enforced server-side (not just client-side JS),
fix the misleading "leader vs member" onboarding copy to reflect that `profiles.role` is a pure capability
flag (not an exclusive identity), and replace the skippable post-join privacy modal with a pre-join consent
screen so nobody joins a team without knowing what they're joining into.

**Architecture:** A real RLS policy on `teams` closes the team-creation bypass; a `BEFORE UPDATE` trigger on
`profiles` (not RLS — this is a "which transitions are valid" rule, cleanly expressed via `OLD`/`NEW`)
allows upgrading to `'leader'` freely but blocks downgrading once onboarding is done. Two onboarding forms
in `dashboard.jsx` get reworded. A new read-only `preview_team_invite_code` function plus an extra
parameter on the existing `join_team_with_code` function let `unirse-equipo.jsx` show a consent screen
*before* committing to a join, replacing today's skippable post-join modal.

**Tech Stack:** Supabase (Postgres/RLS/triggers, applied via MCP `apply_migration` — no local migration
files exist in this repo), React 19 + Vite frontend, no test framework (verification is impersonation-based
SQL testing plus `npm run build`).

## Global Constraints

- SQL changes are applied via the Supabase MCP `apply_migration` tool directly to production
  (`alzjmlnoaxqlkdtvwisr`) — there is no local `supabase/migrations` directory in this repo.
- Self-service leader assignment stays intact — anyone can still set their own `profiles.role` to
  `'leader'`. This plan closes enforcement gaps; it does not add admin/organization approval.
- `profiles.role` upgrades (`'user'` → `'leader'`) are always allowed, even after onboarding. Downgrades
  (`'leader'` → `'user'`) are blocked once onboarding is complete (`first_name`/`last_name` both non-null).
  A no-op update (new value equals old value) is always allowed regardless.
- A person being simultaneously the leader of one team and a plain member of another is intentional,
  correct, existing behavior — nothing in this plan should make team creation or role changes depend on a
  user's existing team memberships.
- No test framework exists in this repo — verification is impersonation-based SQL testing (`execute_sql`
  wrapped in `begin; set local role authenticated; set local request.jwt.claims = '...'; ...; rollback;`)
  plus `npm run build` succeeding.

---

### Task 1: RLS + trigger lockdown for team creation and role assignment

**Files:**
- No local files — applied via `mcp__supabase__apply_migration`.

**Interfaces:**
- Produces: `public.enforce_profile_role_immutability()` trigger function + `profiles_role_immutability`
  trigger on `public.profiles`, and a rewritten `teams_insert_own` RLS policy. Not consumed by any other
  task in this plan (Tasks 2-4 don't reference these directly).

- [ ] **Step 1: Confirm current (unenforced) behavior — before state**

Via `mcp__supabase__execute_sql`, find a real account with `profiles.role = 'user'` (not `'leader'`):

```sql
select id, role, first_name, last_name from profiles where role = 'user' limit 3;
```

Pick one `user_id`. Impersonate it in a rolled-back transaction and confirm team creation currently
succeeds despite `role = 'user'` (the bug this task fixes):

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user_id>","role":"authenticated"}';
insert into teams (leader_id, name) values ('<user_id>', 'TEST-should-not-be-allowed-pre-fix');
select id, leader_id, name from teams where name = 'TEST-should-not-be-allowed-pre-fix';
rollback;
```

Expected: the insert succeeds (proving the current gap) — the row appears before rollback undoes it.

- [ ] **Step 2: Apply the migration**

Call `mcp__supabase__apply_migration` with `name: "leader_assignment_hardening"` and this `query`:

```sql
begin;

drop policy teams_insert_own on public.teams;
create policy teams_insert_own on public.teams
  for insert
  with_check (leader_id = auth.uid() and (select role from public.profiles where id = auth.uid()) = 'leader');

create or replace function public.enforce_profile_role_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.role = old.role then
    return new;
  end if;
  if old.first_name is null and old.last_name is null then
    return new;
  end if;
  if old.role = 'user' and new.role = 'leader' then
    return new;
  end if;
  raise exception 'No se puede cambiar el rol de líder a miembro una vez completado el perfil.';
end;
$$;

drop trigger if exists profiles_role_immutability on public.profiles;
create trigger profiles_role_immutability
  before update on public.profiles
  for each row
  execute function public.enforce_profile_role_immutability();

commit;
```

- [ ] **Step 3: Verify team creation is now blocked for `role = 'user'`**

Re-run the exact same scenario from Step 1:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user_id>","role":"authenticated"}';
insert into teams (leader_id, name) values ('<user_id>', 'TEST-should-fail-post-fix');
rollback;
```

Expected: the `insert` itself fails with an RLS policy violation error (e.g. `new row violates row-level
security policy for table "teams"`) — nothing to select afterward.

- [ ] **Step 4: Verify team creation still succeeds for `role = 'leader'`**

Find a real account with `profiles.role = 'leader'` (`select id from profiles where role = 'leader' limit
1;`), impersonate it in a rolled-back transaction, and confirm `insert into teams (leader_id, name) values
('<leader_user_id>', 'TEST-should-succeed')` succeeds (row appears in a `select` before `rollback`).

- [ ] **Step 5: Verify role upgrade (`user` → `leader`) succeeds after onboarding**

Find a real account with `role = 'user'` where `first_name`/`last_name` are both set (onboarding
complete): `select id from profiles where role = 'user' and first_name is not null and last_name is not
null limit 1;`. Impersonate it in a rolled-back transaction:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user_id>","role":"authenticated"}';
update profiles set role = 'leader' where id = '<user_id>';
select role from profiles where id = '<user_id>';
rollback;
```

Expected: succeeds, `select` shows `role = 'leader'` before rollback.

- [ ] **Step 6: Verify role downgrade (`leader` → `user`) is blocked after onboarding**

Using the same or another real account with `role = 'leader'` and onboarding complete (`first_name`/
`last_name` set), impersonate it in a rolled-back transaction:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_user_id>","role":"authenticated"}';
update profiles set role = 'user' where id = '<leader_user_id>';
rollback;
```

Expected: the `update` fails with the trigger's exception message (`No se puede cambiar el rol de líder a
miembro una vez completado el perfil.`).

- [ ] **Step 7: Verify a no-op / unrelated-field update still succeeds for a leader**

Using the same `role = 'leader'` account, confirm updating an unrelated field while resending the same
`role` value works:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<leader_user_id>","role":"authenticated"}';
update profiles set job_title = 'TEST-job-title', role = 'leader' where id = '<leader_user_id>';
select job_title from profiles where id = '<leader_user_id>';
rollback;
```

Expected: succeeds, `job_title` shows `'TEST-job-title'` before rollback.

- [ ] **Step 8: Verify a still-onboarding account can freely pick either role**

Find or note a real account where `first_name is null and last_name is null` (a genuinely new signup —
if none exists, this step can instead verify the trigger's logic by temporarily setting a test account's
`first_name`/`last_name` to `null` inside the same rolled-back transaction before attempting the role
change). Impersonate it:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<new_user_id>","role":"authenticated"}';
-- If needed to construct the scenario (only inside this rolled-back transaction):
-- update profiles set first_name = null, last_name = null where id = '<new_user_id>';
update profiles set role = 'leader' where id = '<new_user_id>';
update profiles set role = 'user' where id = '<new_user_id>';
select role from profiles where id = '<new_user_id>';
rollback;
```

Expected: both updates succeed (still-onboarding accounts can flip either direction freely).

- [ ] **Step 9: Run `get_advisors(type: "security")`**

Expect no new ERROR-level findings. The `teams_insert_own` policy change and the new trigger function are
not `SECURITY DEFINER`, so they shouldn't add to the existing WARN class covering this project's
`SECURITY DEFINER` helpers.

---

### Task 2: Vocabulary fix — role selection as capability, not identity

**Files:**
- Modify: `src/pages/dashboard.jsx` (two role `<select>` blocks, `ProfileForm` and `ProfileFormModal`
  components)

**Interfaces:**
- No new functions/props — pure JSX text and one `disabled`-condition change within existing components.

- [ ] **Step 1: Reword `ProfileForm`'s role select**

Find (`src/pages/dashboard.jsx`, inside the `ProfileForm` component):
```jsx
              <label className="font-semibold text-[#2E2E3A] text-sm">
                Rol <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                className="w-full border border-[#DAD5E4] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#55C2A2] focus:border-transparent"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="">Selecciona tu rol</option>
                <option value="user">Miembro de Equipo</option>
                <option value="leader">Líder de Equipo</option>
              </select>
```
Replace with:
```jsx
              <label className="font-semibold text-[#2E2E3A] text-sm">
                ¿Vas a crear y liderar equipos? <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                className="w-full border border-[#DAD5E4] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#55C2A2] focus:border-transparent"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="">Selecciona una opción</option>
                <option value="leader">Sí, quiero poder crear y liderar equipos</option>
                <option value="user">No, por ahora solo quiero unirme a equipos existentes</option>
              </select>
```

- [ ] **Step 2: Reword `ProfileFormModal`'s role select and its disabled/note logic**

Find (`src/pages/dashboard.jsx`, inside the `ProfileFormModal` component):
```jsx
          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Rol en TeamZen*
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A]"
              required
              disabled={(!isNewUser && profile?.role) || saving}
            >
              <option value="">Selecciona tu rol</option>
              <option value="leader">Líder de equipo - Puedo crear y gestionar equipos</option>
              <option value="user">Miembro de equipo - Me uno a equipos existentes</option>
            </select>
            {!isNewUser && profile?.role && (
              <p className="text-xs text-[#5B5B6B] mt-2">
                El rol no se puede cambiar una vez establecido. Contacta al administrador si necesitas cambiarlo.
              </p>
            )}
          </div>
```
Replace with:
```jsx
          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              ¿Vas a crear y liderar equipos?*
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A]"
              required
              disabled={(!isNewUser && profile?.role === 'leader') || saving}
            >
              <option value="">Selecciona una opción</option>
              <option value="leader">Sí, quiero poder crear y liderar equipos</option>
              <option value="user">No, por ahora solo quiero unirme a equipos existentes</option>
            </select>
            {!isNewUser && profile?.role === 'leader' && (
              <p className="text-xs text-[#5B5B6B] mt-2">
                Ya activaste la creación de equipos — esto no se puede desactivar. Podés seguir uniéndote a otros equipos como miembro normal cuando quieras.
              </p>
            )}
            {!isNewUser && profile?.role === 'user' && (
              <p className="text-xs text-[#5B5B6B] mt-2">
                Podés activar esto más adelante si cambiás de opinión. Una vez que actives la creación de equipos, no vas a poder desactivarla.
              </p>
            )}
          </div>
```

Note: `crear-equipo.jsx`'s existing client-side role check and its error message ("No tienes permisos para
crear un equipo.") are unaffected by this task — they already read correctly and don't need wording
changes; Task 1's RLS policy just means that check now has real server-side backing.

- [ ] **Step 3: Build check**

Run `npm run build` from `C:\Claude\Teamzen\TeamZen` — must succeed with no new errors (the pre-existing
groqClient dynamic/static import warning is expected and fine).

- [ ] **Step 4: Manual QA note (human required)**

As a brand-new user completing onboarding, confirm both options read clearly. As an existing `role =
'leader'` user, open the profile edit modal and confirm the select is disabled with the "ya activaste"
note. As an existing `role = 'user'` user, confirm the select is enabled and shows the "podés activar esto
más adelante" note.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard.jsx
git commit -m "fix: reword role selection as a capability, not an exclusive identity"
```

---

### Task 3: Pre-join consent — database functions

**Files:**
- No local files — applied via `mcp__supabase__apply_migration`.

**Interfaces:**
- Produces: `public.preview_team_invite_code(p_code text) returns table(team_name text)` — consumed by
  Task 4 via `supabase.rpc('preview_team_invite_code', { p_code })`.
- Produces: `public.join_team_with_code(p_code text, p_share_results boolean default false) returns
  table(team_id uuid, team_name text)` — signature change (new optional parameter) to the existing
  function; consumed by Task 4 via `supabase.rpc('join_team_with_code', { p_code, p_share_results })`.

- [ ] **Step 1: Confirm current `join_team_with_code` behavior — before state**

```sql
select pg_get_functiondef(oid) from pg_proc where proname = 'join_team_with_code';
```

Confirm the current signature is `join_team_with_code(p_code text)` (single parameter) and that it
hardcodes `share_results_with_leader` to `false` in its `insert` — this is the state Step 3 changes.

- [ ] **Step 2: Apply the migration**

Call `mcp__supabase__apply_migration` with `name: "team_join_preview_and_consent"` and this `query`:

```sql
begin;

create or replace function public.preview_team_invite_code(p_code text)
returns table(team_name text)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_team_id uuid;
  v_expires_at timestamptz;
  v_join_policy text;
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

  select t.join_policy into v_join_policy from public.teams t where t.id = v_team_id;
  if v_join_policy is distinct from 'code' then
    raise exception 'Este equipo no permite unirse directamente';
  end if;

  return query select t.name from public.teams t where t.id = v_team_id;
end;
$$;

revoke all on function public.preview_team_invite_code(text) from public, anon;
grant execute on function public.preview_team_invite_code(text) to authenticated;

create or replace function public.join_team_with_code(p_code text, p_share_results boolean default false)
returns table(team_id uuid, team_name text)
language plpgsql
security definer
set search_path = 'public'
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
  values (v_team_id, auth.uid(), p_share_results);

  return query
    select t.id, t.name from public.teams t where t.id = v_team_id;
end;
$$;

commit;
```

- [ ] **Step 3: Verify `preview_team_invite_code` returns the team name without joining**

Find a real, unexpired invite code and the real team name it belongs to:

```sql
select tic.code, t.name, t.id as team_id
from team_invite_codes tic join teams t on t.id = tic.team_id
where tic.expires_at > now()
limit 1;
```

Impersonate any real authenticated user (not necessarily a member of that team) in a rolled-back
transaction:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<any_real_user_id>","role":"authenticated"}';
select * from preview_team_invite_code('<real_code>');
select count(*) from team_members where team_id = '<team_id>' and user_id = '<any_real_user_id>';
rollback;
```

Expected: `preview_team_invite_code` returns the real team name; the `team_members` count is `0` (no join
happened).

- [ ] **Step 4: Verify `preview_team_invite_code` raises the same errors as `join_team_with_code` for
  invalid input**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<any_real_user_id>","role":"authenticated"}';
select * from preview_team_invite_code('ZZZZZZ');
rollback;
```

Expected: `ERROR: Código de invitación no encontrado` (same message `join_team_with_code` already produces
for this case).

- [ ] **Step 5: Verify `join_team_with_code` with an explicit `p_share_results := true` sets the flag
  correctly**

Using a code for a team the impersonated user is NOT already a member of (construct a fresh test scenario
if needed, e.g. a code belonging to a team the test user has never joined):

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<any_real_user_id_not_already_member>","role":"authenticated"}';
select * from join_team_with_code('<real_code>', true);
select share_results_with_leader from team_members where team_id = '<team_id>' and user_id = '<any_real_user_id_not_already_member>';
rollback;
```

Expected: join succeeds, `share_results_with_leader` is `true`.

- [ ] **Step 6: Verify `join_team_with_code` called without the new parameter still defaults to `false`**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<same_or_another_non_member_user_id>","role":"authenticated"}';
select * from join_team_with_code('<real_code>');
select share_results_with_leader from team_members where team_id = '<team_id>' and user_id = '<same_or_another_non_member_user_id>';
rollback;
```

Expected: join succeeds, `share_results_with_leader` is `false` (default preserved for any caller that
doesn't pass the new parameter).

- [ ] **Step 7: Verify grants and run security advisors**

```sql
select grantee, privilege_type from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'preview_team_invite_code';
```

Expected: `authenticated` has `EXECUTE`; no `anon`/`public` row. Then run
`mcp__supabase__get_advisors(type: "security")` — expect only the same WARN-level
`authenticated_security_definer_function_executable` class already accepted for every other `SECURITY
DEFINER` function in this project, no new ERROR-level findings.

---

### Task 4: Pre-join consent — frontend screen

**Files:**
- Modify: `src/pages/unirse-equipo.jsx`

**Interfaces:**
- Consumes: `public.preview_team_invite_code(p_code text)` and `public.join_team_with_code(p_code text,
  p_share_results boolean)` from Task 3, via `supabase.rpc(...)`.

- [ ] **Step 1: Replace state variables**

Find (`src/pages/unirse-equipo.jsx`, top of the component):
```jsx
  const [userId, setUserId] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [joinedTeamId, setJoinedTeamId] = useState(null);
  const [privacyPreferences, setPrivacyPreferences] = useState({
    membersCanSeeResponses: false
  });
```
Replace with:
```jsx
  const [userId, setUserId] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("enter-code"); // 'enter-code' | 'confirm' | 'success'
  const [error, setError] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [shareResults, setShareResults] = useState(false);
```

- [ ] **Step 2: Replace `handleJoin` with a preview step, and add the real join handler**

Find:
```jsx
  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      // Validación de código + verificación de membresía + insert ocurren
      // atómicamente en la base de datos (join_team_with_code), no en el cliente.
      const { data, error: joinError } = await supabase
        .rpc("join_team_with_code", { p_code: code.toUpperCase() })
        .single();

      if (joinError) {
        throw new Error(joinError.message || "No se pudo unir al equipo.");
      }

      setJoinedTeamId(data.team_id);
      setSuccess("¡Te uniste al equipo correctamente!");
      setShowPrivacyModal(true);
      setCode("");
    } catch (err) {
      console.error("Error al unirse al equipo:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyPreferences = async () => {
    if (!joinedTeamId || !userId) return;
    
    try {
      setLoading(true);
      
      // Actualizar las preferencias de privacidad del miembro individual
      const { error } = await supabase
        .from('team_members')
        .update({
          share_results_with_leader: privacyPreferences.membersCanSeeResponses
        })
        .eq('team_id', joinedTeamId)
        .eq('user_id', userId);

      if (error) throw error;

      setShowPrivacyModal(false);
    } catch (err) {
      console.error('Error actualizando preferencias de privacidad:', err);
      setError('No se pudieron guardar las preferencias de privacidad.');
    } finally {
      setLoading(false);
    }
  };
```
Replace with:
```jsx
  const handlePreview = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // La validación real (código válido, no expirado, política de unión)
      // ocurre en la base de datos (preview_team_invite_code), no en el
      // cliente — este paso solo muestra qué equipo es antes de unirte.
      const { data, error: previewError } = await supabase
        .rpc("preview_team_invite_code", { p_code: code.toUpperCase() })
        .single();

      if (previewError) {
        throw new Error(previewError.message || "No se pudo verificar el código.");
      }

      setTeamName(data.team_name);
      setShareResults(false);
      setStep("confirm");
    } catch (err) {
      console.error("Error al verificar el código:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmJoin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validación + verificación de membresía + insert ocurren atómicamente
      // en la base de datos (join_team_with_code), incluyendo la elección de
      // compartir resultados hecha en esta misma pantalla.
      const { error: joinError } = await supabase
        .rpc("join_team_with_code", { p_code: code.toUpperCase(), p_share_results: shareResults })
        .single();

      if (joinError) {
        throw new Error(joinError.message || "No se pudo unir al equipo.");
      }

      setCode("");
      setStep("success");
    } catch (err) {
      console.error("Error al unirse al equipo:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirm = () => {
    setStep("enter-code");
    setTeamName("");
    setError(null);
  };
```

- [ ] **Step 3: Replace the render's code-entry/success branching with a 3-step branch, and add the
  confirm screen**

Find (the `<Card>` block containing the code form and the success panel):
```jsx
        <Card className="max-w-lg mx-auto">
          {!success ? (
            <form onSubmit={handleJoin} className="space-y-4 sm:space-y-6">
              <div className="space-y-4">
                <Input
                  label="Código de Invitación"
                  type="text"
                  required
                  placeholder="Ej: ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="text-center text-xl sm:text-2xl font-mono tracking-wider"
                  maxLength={6}
                />
                <div className="text-xs sm:text-sm text-[#5B5B6B] text-center">
                  Los códigos tienen 6 letras (ej: ABC123)
                </div>
              </div>

              <Button 
                type="submit" 
                loading={loading} 
                className="w-full text-sm sm:text-base" 
                size="large"
                disabled={code.length < 6}
              >
                {loading ? "Uniéndose al equipo..." : "Unirse al Equipo"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4 sm:space-y-6">
```
Replace with:
```jsx
        <Card className="max-w-lg mx-auto">
          {step === "enter-code" && (
            <form onSubmit={handlePreview} className="space-y-4 sm:space-y-6">
              <div className="space-y-4">
                <Input
                  label="Código de Invitación"
                  type="text"
                  required
                  placeholder="Ej: ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="text-center text-xl sm:text-2xl font-mono tracking-wider"
                  maxLength={6}
                />
                <div className="text-xs sm:text-sm text-[#5B5B6B] text-center">
                  Los códigos tienen 6 letras (ej: ABC123)
                </div>
              </div>

              <Button 
                type="submit" 
                loading={loading} 
                className="w-full text-sm sm:text-base" 
                size="large"
                disabled={code.length < 6}
              >
                {loading ? "Verificando código..." : "Continuar"}
              </Button>
            </form>
          )}

          {step === "confirm" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="text-center">
                <h2 className="text-xl sm:text-2xl font-bold text-[#2E2E3A] mb-2">
                  Antes de unirte a {teamName}
                </h2>
                <p className="text-[#5B5B6B] text-sm sm:text-base">
                  Este equipo usa TeamZen para medir el bienestar del equipo con evaluaciones periódicas (MBI).
                </p>
              </div>

              <ul className="text-xs sm:text-sm text-[#5B5B6B] space-y-2 text-left bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-lg p-4 sm:p-6">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#55C2A2] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Vas a poder responder evaluaciones de forma privada.</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#55C2A2] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Tus respuestas individuales NO se muestran a tu líder por defecto — el líder solo ve un promedio de todo el equipo, y nunca con menos de 3 personas respondiendo (para que nadie pueda ser identificado a partir del promedio).</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#55C2A2] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Podés elegir compartir tus resultados individuales con tu líder si querés. Podés cambiar esta decisión cuando quieras desde tu equipo.</span>
                </li>
              </ul>

              <div className="border border-[#DAD5E4] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="shareResults"
                    checked={shareResults}
                    onChange={(e) => setShareResults(e.target.checked)}
                    className="mt-1 w-4 h-4 text-[#845EC2] border-gray-300 rounded focus:ring-[#845EC2]"
                  />
                  <label htmlFor="shareResults" className="text-sm font-medium text-[#2E2E3A] cursor-pointer">
                    Compartir mis resultados individuales con el líder de este equipo
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={handleCancelConfirm}
                  className="flex-1 text-sm"
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmJoin}
                  loading={loading}
                  className="flex-1 text-sm"
                >
                  {loading ? "Uniéndose..." : "Unirme al equipo"}
                </Button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="text-center space-y-4 sm:space-y-6">
```
(The rest of the `step === "success"` block — the green checkmark, "¡Bienvenido al equipo!", the "¿Qué
sigue?" list, and the "Ir al Dashboard" button — is unchanged from today's existing success panel; only
its wrapping condition changes from `success` truthy to `step === "success"`.)

- [ ] **Step 4: Delete the old post-join modal**

No edit is needed around the `{error && (...)}` block / `</Card>` closing tag — once the three `step ===
"..."` blocks from Step 3 are JSX siblings (rather than one `!success ? ... : ...` ternary), that existing
closing structure already balances correctly as-is. Just confirm the file still parses (no unbalanced
JSX) once Steps 2-3 are applied, then move on to deleting the now-unused modal below.

Find and delete the entire old post-join modal block (it sits after `</Card>` and before the component's
final closing, and is now fully superseded by the Step 3 confirm screen):
```jsx
      {/* Modal de preferencias de privacidad */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto bg-[#845EC2]/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-[#845EC2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[#2E2E3A] mb-2">Configuración de Privacidad</h2>
                <p className="text-sm text-[#5B5B6B]">
                  Configura qué información quieres compartir con tu equipo
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="border border-[#DAD5E4] rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="responses"
                      checked={privacyPreferences.membersCanSeeResponses}
                      onChange={(e) => setPrivacyPreferences(prev => ({
                        ...prev,
                        membersCanSeeResponses: e.target.checked
                      }))}
                      className="mt-1 w-4 h-4 text-[#845EC2] border-gray-300 rounded focus:ring-[#845EC2]"
                    />
                    <div className="flex-1">
                      <label htmlFor="responses" className="text-sm font-medium text-[#2E2E3A] cursor-pointer">
                        Compartir mis respuestas de evaluación con el líder
                      </label>
                      <p className="text-xs text-[#5B5B6B] mt-1">
                        Permite que el líder del equipo pueda ver tus resultados individuales para brindar mejor apoyo personalizado
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs text-blue-800 font-medium">¿Por qué es importante?</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Estas configuraciones ayudan a los líderes a brindar mejor apoyo y seguimiento sin comprometer tu privacidad.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowPrivacyModal(false)}
                  className="flex-1 text-sm"
                  disabled={loading}
                >
                  Configurar después
                </Button>
                <Button
                  onClick={handlePrivacyPreferences}
                  className="flex-1 text-sm"
                  loading={loading}
                >
                  {loading ? "Guardando..." : "Guardar preferencias"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```
Replace with:
```jsx
    </div>
  );
}
```

- [ ] **Step 5: Build check**

Run `npm run build` from `C:\Claude\Teamzen\TeamZen` — must succeed with no new errors.

- [ ] **Step 6: Manual QA note (human required)**

Using a real invite code, walk through: entering the code shows the consent screen with the real team
name; "Cancelar" returns to the code-entry step cleanly; toggling the checkbox and clicking "Unirme al
equipo" joins with the chosen sharing preference (verify in the team's member list afterward, or via the
leader's Reportes page per the earlier privacy-enforcement work); an invalid/expired code shows the same
error banner as before.

- [ ] **Step 7: Commit**

```bash
git add src/pages/unirse-equipo.jsx
git commit -m "feat: replace skippable post-join privacy modal with pre-join consent screen"
```

---

## Plan self-review notes

- **Spec coverage:** the spec's 4 scope items map 1:1 to Tasks 1-4 (team creation RLS + role trigger →
  Task 1; vocabulary fix → Task 2; pre-join consent DB functions → Task 3; pre-join consent frontend →
  Task 4). The spec's explicit non-goals (admin approval workflow, changing how leadership/membership
  itself is tracked, closed-loop tracking) have no task, by design.
- **Type/naming consistency:** `preview_team_invite_code`'s return shape (`{team_name}`) and
  `join_team_with_code`'s new parameter (`p_share_results boolean default false`) are defined once in Task
  3 and consumed with those exact names in Task 4's `handlePreview`/`handleConfirmJoin`. The `step` state
  values (`'enter-code' | 'confirm' | 'success'`) are introduced in Task 4 Step 1 and used consistently in
  every subsequent step of that same task — no drift.
- **No placeholders:** every step has literal SQL/JSX before-after content or exact verification queries.
