# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are HR / People Ops professionals responsible for monitoring and preventing burnout across teams in an organization — they need scientifically defensible measurement and actionable, low-cost interventions, not just a survey tool.

The current implementation is organized per-team rather than as an org-wide HR console: a "Líder" creates a team via invite code, invites members, launches evaluation rounds, and reads reports/AI advice; "Miembro" roles mainly complete the MBI survey when invited. An HR/People Ops user today operates the product by owning and overseeing one or more of these teams.

## Product Purpose

Prevent and manage team burnout by running the Maslach Burnout Inventory (MBI) — the standard validated psychometric burnout assessment — as recurring rounds per team, then turning results into concrete, trackable recommended actions. Success means teams/HR catch rising burnout early and follow through on recommended actions across cycles, not just receive a report.

## Positioning

Not a generic pulse-survey tool: results are grounded in the official MBI scale and burnout ranges (not an ad-hoc questionnaire), and an AI layer closes the loop from diagnosis to specific recommended actions with cross-round action tracking — delivering what would otherwise require a specialized organizational psychology consultancy, at a fraction of the cost.

## Operating Context

- Teams are created with invite codes; members join a specific team via that code. Invite flow supports expiry, regeneration, kicking members, and leadership transfer.
- Evaluation happens in rounds/cycles ("rondas"/"ciclos") so trends can be compared over time.
- AI advice comes from two sources: a local heuristic engine (rule-based, always available) and an external Groq (Llama 3.1) call via a Supabase Edge Function proxy. Advice can go stale and is invalidated on team/cycle change.
- Backend is Supabase (Postgres + Row Level Security + Auth); frontend is a React/Vite SPA currently deployed via GitHub Pages / Netlify.
- Product language is Spanish (UI copy, docs, marketing).

## Capabilities and Constraints

- MBI: 22 items across 3 dimensions (Agotamiento Emocional, Despersonalización, Realización Personal), 0–6 scale, official burnout range thresholds (Bajo/Medio/Alto).
- Synthetic wellness metric (0–100) with historical trend and forecast charts per team.
- Leaders can track the status of AI-suggested actions across rounds.
- Row Level Security enforces k-anonymity-style protections and opt-out on sensitive burnout data.
- Undecided: whether/how a distinct HR "multi-team oversight" surface (aggregating across teams for a People Ops user) gets built, versus the current per-team leader dashboard remaining the primary surface.

## Brand Commitments

- Name: TeamZen. Mascot/logo: "Zenpanda", a panda character used across the existing logo and illustrations.
- Tagline: "Equipos más saludables, trabajo más productivo."
- Founding team named on the landing page (Benjamín Alarcón — Product Owner, Sebastián Sepúlveda — Desarrollador móvil, Vicente Aranguiz — Backend Developer) — this is real, not placeholder.

## Evidence on Hand

- Pre-launch: no real customer testimonials, client logos, or case studies exist. Only the founding-team profiles above are real; nothing else resembling social proof should be treated as factual.
- Reference document on hand: the Maslach Burnout Inventory PDF (`mbi-inventario-de-burnout-de-maslach.pdf`) as the scientific/methodological source of truth for the assessment.

## Product Principles

1. Measurement stays scientifically defensible — never drift from official MBI items/ranges for the sake of a friendlier UI.
2. Every report ends in a specific, trackable action, not just a score — the AI/heuristic advice loop is the product's reason to exist over a plain survey tool.
3. Burnout data is sensitive: privacy/anonymity protections (RLS, k-anonymity) are a constraint on every feature, not an afterthought.
4. Design for the eventual HR/People Ops buyer even while today's flows are built team-by-team — don't assume a single team is the only unit of oversight.
5. Keep cost/complexity low relative to a human consultancy — that's the core competitive claim.
