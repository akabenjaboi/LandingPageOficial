# Team invite-flow redesign — expiry/regeneration, kick member, transfer leadership

Status: approved by user, pending implementation plan.

## Context

TeamZen (Maslach Burnout Inventory team platform) currently has a minimal, brittle team-management
model:

- Invite codes are 6 random letters generated client-side (`Math.random()`, duplicated in both
  `crear-equipo.jsx` and `CreateTeamModal.jsx`), inserted once into `team_invite_codes`, and **never
  expire or get regenerated**.
- There is **no way to remove a member** from a team, and **no way to transfer leadership**. If a leader
  leaves the organization, the team becomes permanently unmanageable — nobody can fix its settings,
  regenerate its code, or reassign it.
- This session already redesigned RLS on all 9 core tables (see prior work same day: RLS enable,
  `join_team_with_code` RPC, `is_team_leader`/`is_team_member` SECURITY DEFINER helper functions). Any new
  mutation must be compatible with that RLS model, in particular: `team_members` currently has **no
  INSERT policy for direct client access** (joining only happens through `join_team_with_code`), and
  `teams` UPDATE is restricted so a leader cannot change `leader_id` to someone else (by design, to
  prevent team hijacking) — this redesign must work *with* that restriction, not around it insecurely.

## Scope

All four improvements together, in one design/implementation pass:
1. Invite codes expire (fixed TTL) and can be manually regenerated.
2. Leader can remove ("kick") a member from a team.
3. Leader can transfer leadership of a team to an existing member.
4. (Implicit) Server-side code generation replaces the weak client-side `Math.random()` generator, since
   the regenerate function is being built anyway.

## Product decisions (confirmed with user)

- **Kicking a member preserves their historical MBI data.** Only their `team_members` row is deleted; past
  `mbi_responses`/`mbi_scores` submitted under that team remain untouched, so historical aggregates for
  the team don't retroactively change. The kicked user simply loses access/visibility going forward and
  cannot rejoin without a valid invite code.
- **Transferring leadership**: the current leader can hand leadership to **any existing member** of the
  team (no additional eligibility gate, e.g. no requirement that the target's `profiles.role = 'leader'`
  — that self-assigned role flag remains a separate, deferred concern, not addressed here). After
  transfer, **the outgoing leader becomes a regular member** of the same team (not removed) — they get a
  normal `team_members` row like anyone else.
- **Invite code expiry**: fixed **30-day TTL** from creation/regeneration, plus a manual "Regenerar
  código" button the leader can use any time (e.g., if they suspect the code leaked). Regenerating
  immediately invalidates the old code — exactly one active code exists per team at any time (matches
  today's implicit 1:1 usage).

## Technical approach

**Hybrid**, chosen over "all RLS policies" and "all SECURITY DEFINER functions":

- **Kick member → plain RLS DELETE policy.** A leader deleting a member's `team_members` row is a pure
  permission check with no extra steps, so a declarative policy is the right tool:
  ```sql
  create policy "team_members_delete_as_leader" on public.team_members
    for delete to authenticated
    using (public.is_team_leader(team_members.team_id));
  ```
  This coexists (permissive OR) with the existing `team_members_delete_own` policy (a member leaving
  voluntarily).

  *Why not a function here:* there's no multi-step state to coordinate — a plain policy is simpler and
  consistent with how `team_members_select_as_leader` already works.

- **Regenerate invite code → SECURITY DEFINER function**, because it's a multi-step atomic operation
  (delete old code, generate new one server-side, insert with fresh expiry):
  ```sql
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
  ```
  This same function is called **both** right after team creation (replacing the duplicated
  `Math.random()` logic in `crear-equipo.jsx` and `CreateTeamModal.jsx`) **and** from the manual
  "Regenerar código" button — one code path instead of three.

- **Transfer leadership → SECURITY DEFINER function**, because it needs to bypass the deliberate
  `teams` UPDATE restriction (leader can't normally set `leader_id` to someone else — that's an
  intentional anti-hijacking guard from the RLS redesign) *and* coordinate multiple row changes
  atomically:
  ```sql
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
  ```
  Keeps the existing invariant that a team's leader has no `team_members` row for their own team (the new
  leader's membership row is removed; the old leader gets a fresh one).

- **`join_team_with_code` update**: add an `expires_at > now()` check, with a distinct error message from
  "code not found" (see Error handling below).

## Data model change

One migration: add `expires_at timestamptz not null default (now() + interval '30 days')` to
`public.team_invite_codes`.

## Frontend / UI changes

- **Invite code display** (team card in `dashboard.jsx`, and the post-creation screen in
  `crear-equipo.jsx`/`CreateTeamModal.jsx`): show "Expira el DD/MM/AAAA" or "Expirado" (styled as a
  warning) next to the code, plus a **"Regenerar código"** button calling
  `regenerate_team_invite_code`, replacing the displayed code immediately on success.
- **Kick member**: a button per row in the team's member list (leader view only), gated behind
  `window.confirm(...)` — matching the existing "Eliminar equipo" confirmation pattern in
  `TeamOptionsMenu.jsx` rather than introducing a new modal component for this.
- **Transfer leadership**: new item in `TeamOptionsMenu.jsx`'s dropdown (alongside "Editar equipo" /
  "Eliminar equipo"). Opens a modal (reusing the existing `Modal.jsx` component) listing current members
  with a "Hacer líder" button per row, plus a confirmation step before calling
  `transfer_team_leadership` (irreversible for the outgoing leader's view of that team).
- After a successful transfer, re-run the dashboard's existing `init()` data-loading effect so the
  transferring user's view of that team flips from leader to member automatically — no special-cased
  transition logic needed.

## Error handling / edge cases

- **`join_team_with_code`**: split the current single generic error into two — "código no encontrado" vs.
  "este código ya expiró, pide uno nuevo al líder del equipo" — so the user knows what to do next.
- **Kicking an already-removed member** (double-click / race): the DELETE affects 0 rows in that case;
  the client checks affected-row count before showing a success message, and just silently refreshes the
  member list if nothing was actually removed (no scary error for a harmless race).
- **Hiding "kick" for the synthetic leader row**: when `include_leader_in_metrics` is on, the leader is
  injected into the member list client-side with an `is_leader: true` marker (it is not a real
  `team_members` row). The kick button must be hidden for any row where `is_leader === true`.
- **Self-transfer / non-member target**: both explicitly checked and rejected inside
  `transfer_team_leadership` with clear, distinct error messages (see function body above).
- **Double-submitting transfer**: the second call naturally fails because the caller is no longer
  `teams.leader_id` after the first succeeds — no extra guard needed beyond the existing leadership check.

## Verification plan

1. Apply the migration (new column + policy + 2 functions) directly to production in one transaction
   (consistent with how the RLS redesign was applied earlier this session; branching remains unavailable
   through this MCP connection — no `confirm_cost` tool exposed).
2. Impersonate real users via `execute_sql` with `set local role authenticated; set local
   request.jwt.claims = '{"sub":"...", "role":"authenticated"}'` (the technique that caught the earlier
   RLS recursion bug) to confirm: a non-leader cannot regenerate a code, kick a member, or transfer
   leadership on a team they don't lead; a leader can do all three on their own team.
3. `get_advisors(type: security)` after migrating — expect no new `ERROR`-level findings (only the same
   class of informational `authenticated_security_definer_function_executable` WARN already seen for the
   other SECURITY DEFINER functions in this project).
4. `npm run build` to confirm the frontend compiles cleanly.
5. **Out of scope for Claude to verify**: full manual browser QA with two real logged-in accounts (kick a
   real member, transfer leadership between two accounts, confirm both dashboards update correctly). This
   requires the user's own testing, same as the RLS redesign and Groq migration earlier this session.

## Explicitly out of scope (deferred)

- Any change to the self-assigned `profiles.role = 'leader'` model (flagged elsewhere in the audit as its
  own, separate design decision).
- Notifications (email/in-app) to a kicked member or to a new leader — no notification system exists in
  the app today; this would be new infrastructure, not a natural extension of this feature.
- Configurable TTL per team (fixed 30 days for everyone, per the user's explicit choice).
