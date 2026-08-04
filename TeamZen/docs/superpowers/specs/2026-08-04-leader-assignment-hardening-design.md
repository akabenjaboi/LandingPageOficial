# Leader-assignment hardening: real enforcement, honest vocabulary, informed joining

Status: approved by user, pending implementation plan.

## Context

Second of three sequential product/security issues raised while questioning TeamZen's logic (first was
MBI leader-visibility privacy enforcement, already shipped; third — closed-loop tracking of whether advice
leads to improvement — is deferred). Investigation found:

1. **Team creation has no real access control.** The `teams_insert_own` RLS policy only checks `leader_id
   = auth.uid()` — it never references `profiles.role`. The only "must be a leader" check lives in
   `crear-equipo.jsx` as client-side JavaScript (`if (profileError || profile?.role !== "leader") throw new
   Error(...)`), which is trivially bypassed by calling the Supabase REST API directly.
2. **`profiles.role` is freely mutable with no restriction.** `profiles_update_own`'s RLS policy is `id =
   auth.uid()` with no `WITH CHECK` at all — any column, including `role`, can be changed via a direct API
   call. The UI (`dashboard.jsx`'s second profile form) claims "El rol no se puede cambiar una vez
   establecido" ("the role can't be changed once set"), but nothing enforces that server-side. In practice
   the current UI disables the entire `<select>` once any profile exists at all (`!isNewUser &&
   profile?.role`), which — since `profiles.role` defaults to `'user'` and is never null — means the field
   is already permanently locked for every existing user today, with no working "change it later" path.
3. **The vocabulary conflates a permission with an identity.** Investigating what `profiles.role` actually
   *does* in this codebase revealed it only gates one thing: whether you can create a **new** team. It has
   no bearing on team membership — joining a team via invite code never checks `profiles.role` at all, and
   `dashboard.jsx` already loads/renders "teams you lead" and "teams you belong to" completely
   independently of `profiles.role` (fixed earlier this session, for the leadership-transfer bug). So a
   person can already be the leader of one team and a plain member of another, simultaneously, today — the
   architecture supports it, but the onboarding copy ("Miembro de Equipo" / "Líder de Equipo", presented as
   a single exclusive choice) implies it's an identity you pick once, not a capability you can hold
   alongside being a member elsewhere. This is the same class of problem as the "ciclo"/"ronda" vocabulary
   fix earlier this session: internal-sounding, misleading words leaking into user-facing copy.
4. **Joining a team has no upfront disclosure.** `join_team_with_code` validates a code and inserts a
   `team_members` row with `share_results_with_leader` hardcoded to `false`, atomically. Only *after*
   joining does `unirse-equipo.jsx` show a "Configuración de Privacidad" modal explaining that a leader
   might see shared results — and that modal has a "Configurar después" (configure later) button that
   skips it entirely. A member can finish joining without ever having read what they're joining into.

## Scope

Four changes, decided during brainstorming:

1. **RLS: team creation requires `profiles.role = 'leader'`**, matching what the client-side check in
   `crear-equipo.jsx` already claims to enforce but doesn't. Self-service model stays exactly as-is —
   anyone can still set their own role to `'leader'` — this only closes the gap where the *declared* rule
   wasn't actually checked server-side.
2. **`profiles.role` may be upgraded (`'user'` → `'leader'`) at any time, but not downgraded
   (`'leader'` → `'user'`) once onboarding is complete — enforced by a database trigger, not RLS** (RLS
   decides who can write a row; this is a rule about which transitions are valid, which a trigger expresses
   unambiguously via `OLD`/`NEW`). Reframing `role` as a pure capability ("can I
   create teams") rather than an identity means upgrading is low-risk self-service (it doesn't affect any
   existing team — leadership of existing teams is tracked by `teams.leader_id`, never by
   `profiles.role`), so it should stay open. Downgrading is blocked to prevent someone confusing themselves
   into thinking they've relinquished responsibility for teams they still lead (they haven't — this is
   about avoiding a confusing dead-end, not a security boundary, since downgrading doesn't actually change
   anything about existing teams either).
3. **Vocabulary fix in `dashboard.jsx`'s two role-selection forms**, reframing the choice as a capability
   question ("¿vas a crear y liderar equipos?") instead of an identity pick ("¿sos líder o miembro?"),
   consistent with point 3 above. Explicitly documented: a "leader" (capability holder) belonging to other
   teams as a plain member is intentional and correct, not a bug to "fix" later.
4. **A pre-join consent screen in `unirse-equipo.jsx`**, replacing the current skippable post-join privacy
   modal. A new read-only preview function lets the UI show the team's name and a plain-language
   explanation of what joining means (periodic MBI evaluations, private-by-default results, the leader only
   ever sees a k-anonymous aggregate) *before* the join is committed, with the sharing choice made as part
   of that same screen rather than as an optional afterthought.

Explicitly out of scope: any admin/organization-approval workflow for becoming a leader (the user
confirmed self-service is the intended model, not gated verification); any change to how team
leadership/membership itself is tracked (already correct, per point 3 above — `teams.leader_id` and
`team_members` remain the sole sources of truth, `profiles.role` never gates viewing or joining existing
teams); the third sequential issue (closed-loop tracking), deferred to a later session.

## 1. Team creation RLS lockdown

```sql
drop policy teams_insert_own on public.teams;
create policy teams_insert_own on public.teams
  for insert
  with_check (leader_id = auth.uid() and (select role from public.profiles where id = auth.uid()) = 'leader');
```

`crear-equipo.jsx`'s existing client-side check and error message ("No tienes permisos para crear un
equipo.") stay exactly as they are — they already produce the right user-facing behavior; this change just
ensures the same rule holds even if that client code is bypassed.

## 2. Role mutability, enforced via trigger (not RLS)

This is a "which transitions are valid" rule, not a "who's allowed to touch this row" rule — those are
different concerns, and Postgres has a purpose-built, unambiguous tool for the former: a `BEFORE UPDATE`
trigger with `OLD`/`NEW` row references. (An earlier draft of this spec tried to express the same rule as
an RLS `WITH CHECK` subquery comparing old vs. new `role` — that depends on subtle, easy-to-get-wrong
Postgres snapshot semantics for self-referential subqueries mid-statement. A trigger's `OLD`/`NEW` are
unambiguous by construction, so this spec uses that instead.) `profiles_update_own`'s existing RLS policy
(`id = auth.uid()`) is untouched — RLS still decides *who* can update their own row; this trigger decides
*which* `role` transitions are valid for anyone who's allowed to write.

Reuses the same signal `dashboard.jsx` already uses everywhere else to mean "this user hasn't completed
onboarding yet": `first_name is null and last_name is null`. Once a profile has a name, its `role` may only
change from `'user'` to `'leader'` (upgrade), never the reverse; any update that doesn't touch `role` is
always allowed:

```sql
create or replace function public.enforce_profile_role_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.role = old.role then
    return new;
  end if;
  if old.first_name is null and old.last_name is null then
    -- Still onboarding (no name set yet) — free to pick either role.
    return new;
  end if;
  if old.role = 'user' and new.role = 'leader' then
    -- Upgrade always allowed — enabling team creation doesn't affect
    -- any existing team (leadership is tracked by teams.leader_id,
    -- never by profiles.role).
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
```

## 3. Vocabulary fix

Both `dashboard.jsx` role `<select>` elements change from an identity framing to a capability framing.

**`ProfileForm`** (`dashboard.jsx`, shown only during first-time onboarding when `first_name`/`last_name`
are both still empty):

Before:
```jsx
<label className="font-semibold text-[#2E2E3A] text-sm">
  Rol <span className="text-red-500 ml-1">*</span>
</label>
<select ...>
  <option value="">Selecciona tu rol</option>
  <option value="user">Miembro de Equipo</option>
  <option value="leader">Líder de Equipo</option>
</select>
```

After:
```jsx
<label className="font-semibold text-[#2E2E3A] text-sm">
  ¿Vas a crear y liderar equipos? <span className="text-red-500 ml-1">*</span>
</label>
<select ...>
  <option value="">Selecciona una opción</option>
  <option value="leader">Sí, quiero poder crear y liderar equipos</option>
  <option value="user">No, por ahora solo quiero unirme a equipos existentes</option>
</select>
```

**`ProfileFormModal`** (`dashboard.jsx`, the general profile edit/onboarding modal): same relabeling, plus
the `disabled` condition changes from "always locked once any profile exists" to "locked only once already
a leader" (matching the upgrade-allowed/downgrade-blocked rule), and the helper note only shows for
existing leaders:

Before:
```jsx
<label className="block text-sm font-medium text-[#2E2E3A] mb-2">
  Rol en TeamZen*
</label>
<select
  value={role}
  onChange={(e) => setRole(e.target.value)}
  className="..."
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
```

After:
```jsx
<label className="block text-sm font-medium text-[#2E2E3A] mb-2">
  ¿Vas a crear y liderar equipos?*
</label>
<select
  value={role}
  onChange={(e) => setRole(e.target.value)}
  className="..."
  required
  disabled={(!isNewUser && profile?.role === 'leader') || saving}
>
  <option value="">Selecciona una opción</option>
  <option value="leader">Sí, quiero poder crear y liderar equipos</option>
  <option value="user">No, por ahora solo quiero unirme a equipos existentes</option>
</select>
{!isNewUser && profile?.role === 'leader' && (
  <p className="text-xs text-[#5B5B6B] mt-2">
    Ya activaste la creación de equipos — esto no se puede desactivar. Podés seguir uniéndote a otros
    equipos como miembro normal cuando quieras.
  </p>
)}
{!isNewUser && profile?.role === 'user' && (
  <p className="text-xs text-[#5B5B6B] mt-2">
    Podés activar esto más adelante si cambiás de opinión. Una vez que actives la creación de equipos, no
    vas a poder desactivarla.
  </p>
)}
```

No other files need vocabulary changes — a grep of the codebase for role-related copy outside these two
forms found no other user-facing "rol"/"líder"/"miembro" framing that implies exclusivity (the badge at
`dashboard.jsx:867` — `{profile.role === "leader" ? "Líder" : "Miembro"}` — is a short status label next to
the person's name, not a claim about what teams they can join; left unchanged, as it's already accurate
shorthand for "has the create-teams capability," not "is only ever this one thing").

## 4. Pre-join consent screen

**New read-only DB function**, so the UI can show what a code leads to before committing to the join:

```sql
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
```

This mirrors `join_team_with_code`'s own validation exactly (same error messages) but performs no insert —
purely for display. Because it re-validates from scratch, a code that expires or gets exhausted between
preview and the real join simply surfaces the same error at that later point; no new race condition is
introduced (the real join still validates atomically, unchanged).

**`join_team_with_code` gains an explicit sharing parameter**, replacing the hardcoded `false`:

```sql
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
```

(Identical to today's function except the new parameter with a safe `default false`, and using it instead
of the literal `false` in the `insert`. Grants/ownership/`SECURITY DEFINER` unchanged.)

**Frontend (`unirse-equipo.jsx`) restructured** around a new step between entering the code and actually
joining:

- New state: `step` (`'enter-code' | 'confirm' | 'success'`, replacing the current boolean
  `success`/`showPrivacyModal` pair), `teamName` (from the preview call), `shareResults` (boolean, defaults
  `false`, replaces `privacyPreferences.membersCanSeeResponses`).
- Submitting the code form calls `supabase.rpc('preview_team_invite_code', { p_code: code.toUpperCase()
  }).single()` instead of joining directly. On success, stores `teamName` and moves to `step = 'confirm'`.
  On failure, shows the same error banner as today (same error messages, since the preview function
  reuses them verbatim).
- The `'confirm'` step renders the consent screen: a heading using the real team name ("Antes de unirte a
  **{teamName}**"), the plain-language explanation (below), the `shareResults` checkbox (defaulting off,
  labeled the same as today's "Compartir mis respuestas de evaluación con el líder"), a "Cancelar" button
  (returns to `step = 'enter-code'`, clears `code`), and an "Unirme al equipo" button that calls
  `supabase.rpc('join_team_with_code', { p_code: code.toUpperCase(), p_share_results: shareResults
  }).single()`, and on success moves to `step = 'success'` (today's existing "¡Bienvenido al equipo!" panel,
  unchanged).
- The old post-join modal (`showPrivacyModal`, `handlePrivacyPreferences`, the separate `update` call to
  `team_members`) is deleted entirely — the sharing choice is now made once, before joining, atomically
  with the join itself.

**Consent screen copy:**

```
Antes de unirte a {teamName}

Este equipo usa TeamZen para medir el bienestar del equipo con evaluaciones periódicas (MBI).

• Vas a poder responder evaluaciones de forma privada.
• Tus respuestas individuales NO se muestran a tu líder por defecto — el líder solo ve un promedio
  de todo el equipo, y nunca con menos de 3 personas respondiendo (para que nadie pueda ser identificado
  a partir del promedio).
• Podés elegir compartir tus resultados individuales con tu líder si querés. Podés cambiar esta
  decisión cuando quieras desde tu equipo.

[ ] Compartir mis resultados individuales con el líder de este equipo

[Cancelar]  [Unirme al equipo]
```

## Error handling / edge cases

- `preview_team_invite_code` raising an exception (invalid/expired code, wrong join policy) is caught the
  same way the current `handleJoin` already catches `join_team_with_code` errors — same `try/catch`
  pattern, same error banner, just triggered one step earlier in the flow.
- If a user backs out via "Cancelar" and re-enters the same code, `preview_team_invite_code` simply
  re-validates from scratch — no state to clean up, since nothing was written yet.
- A user who already belongs to the team they're previewing: `preview_team_invite_code` doesn't check this
  (it only checks the code/expiry/join_policy), so the confirm screen would still show — but the actual
  `join_team_with_code` call still raises "Ya eres miembro de este equipo" when they click "Unirme al
  equipo", surfaced as the existing error banner. Not adding this check to the preview function keeps it
  a pure, cheap validation step; the real enforcement stays exactly where it already correctly lives.
- Role-mutability trigger: a `profiles` update that changes unrelated fields (name, job title, etc.)
  without touching `role` is unaffected — `enforce_profile_role_immutability` returns immediately via its
  first condition (`new.role = old.role`) whenever the submitted role equals the stored one, which is what
  every non-role-changing update already does today (the frontend always resends the current `role` value
  as part of the full profile form submission).
- A user with `role = 'leader'` who already created teams cannot ever downgrade — confirmed intentional
  (see Scope, point 2): downgrading wouldn't affect those teams anyway (`teams.leader_id` is untouched by
  `profiles.role`), so blocking it is about avoiding a confusing dead-end, not a security necessity.

## Verification plan

Same impersonation-based methodology used throughout this session:

1. Apply the migration (the `teams_insert_own` policy rewrite, the new
   `enforce_profile_role_immutability` trigger function + trigger on `profiles`, the new
   `preview_team_invite_code` function, the `join_team_with_code` signature change) via `apply_migration`.
2. Impersonate a real `role = 'user'` account (rolled back): confirm a direct `insert into teams (...)`
   fails under the new `teams_insert_own` policy; confirm updating `profiles.role` to `'leader'` for that
   same account succeeds (upgrade allowed); confirm that, once `role = 'leader'`, a further update trying
   to set it back to `'user'` fails (downgrade blocked) — while an update that changes only `first_name`
   and resends the current `role` unchanged still succeeds.
3. Impersonate a real `role = 'leader'` account (rolled back): confirm `insert into teams (...)` with
   `leader_id` set to that user succeeds.
4. Call `preview_team_invite_code` with a real, valid code (rolled back if any test code is created) and
   confirm it returns the team name without creating a `team_members` row; call it with an expired/invalid
   code and confirm the same error messages `join_team_with_code` already produces today.
5. Call the updated `join_team_with_code` with an explicit `p_share_results := true` and confirm the
   inserted `team_members` row has `share_results_with_leader = true` (rolled back); call it with the
   parameter omitted and confirm it still defaults to `false`, preserving any other caller's existing
   behavior.
6. `npm run build` after the frontend changes — must succeed with no new errors.
7. Manual QA (owed by the user, as with every other feature this session): walk through onboarding as a
   brand-new user picking each option, attempt to change an existing leader's role via the profile modal
   (should be locked) and an existing plain user's role (should be open), and join a real team through the
   new pre-join consent screen end-to-end, confirming the sharing checkbox's choice is reflected in the
   team's member list afterward.
