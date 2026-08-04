# Version History

Convention: [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH.
- MAJOR: breaking changes to data model or core tournament logic.
- MINOR: new features (new format, new UI section, new setting).
- PATCH: bug fixes, visual polish, copy changes, no new capability.

**Rule going forward: any change worth describing in a commit message revises this
file first.** Small in-place fixes discovered while building a feature count toward
that feature's entry, not a separate patch.

The project has been under active development but not yet deployed/published — so
everything up to and including the double-elim bug fixes is bundled as the
starting `0.1.0` baseline rather than split into artificial pre-release patches.

---

## Unreleased

- (nothing pending)

## 0.3.0 — 2026-08-01

New feature: 3rd place match + final results/ranking screen.

- Single elimination now generates a real "Third Place Match" between the two
  semifinal losers whenever the bracket is big enough to have a semifinal (4+
  participants) — previously those two players were just dropped with no
  placement. The tournament only marks `complete` once both the Final and the
  Third Place Match have finished (order doesn't matter, either can finish
  first).
- New `TournamentResults` panel appears once a tournament is `complete`,
  showing Champion / Runner-up / 3rd (/ 4th for single elim) with trophy/medal
  icons. Double elimination's placements come for free from existing bracket
  structure (Grand Finals winner/loser = 1st/2nd, Losers Bracket Final loser =
  3rd) — no schema or engine change needed there. Round robin/Swiss reuse the
  existing standings computation for a top-5 ranked list.
- Verified via scripted 8-player single-elim simulation: semifinal losers
  correctly routed into the Third Place Match, tournament correctly stays
  `active` until both final matches resolve.

Not done: double elimination doesn't get an explicit 4th-place entry (the
losers-bracket round before the losers final can have 1 or 2 "4th place" ties
depending on bracket size — ambiguous enough to skip for now rather than
under-build it).

## 0.2.1 — 2026-08-01

Bug fix: best-of validation was checking "winner's score >= threshold" instead of
"== threshold", and clamping inputs to the full best-of instead of the win
threshold — so e.g. a Bo3 (win at 2) wrongly accepted 3-2 as a valid result.
Fixed both client-side (match-card.tsx) and server-side (recordResult in
tournaments.ts), and fixed a second bug found while patching this: server-side
validation was reading the tournament-wide default best-of instead of the
match's actual round-level best-of override.

## 0.2.0 — 2026-08-01

Design system overhaul per `UI.txt` (first pass — full spec is much larger, see
"deferred" list below).

Shipped:
- Dark-only palette (background #09090B, surface #17171B, elevated #1F1F25,
  border #2A2A31, violet #7C3AED accent) applied app-wide via CSS variables.
- Typography: Space Grotesk (headings), Inter (body), IBM Plex Mono (all numeric
  displays — scores, seeds, standings, dates).
- Radius bumped to 18px; subtle architectural background (faint grid + radial
  violet glow behind the hero).
- Bracket connector lines re-rendered as thin (1.5px), rounded, glowing violet
  routing lines instead of plain gray borders.
- Home page hero (large title/subtitle, primary+secondary CTAs) and tournament
  cards redesigned with hover lift + glow, participant count, and created date.

Deferred (see PROJECT_OVERVIEW.txt section 9 for the full list):
- Champion reveal screen, animated home-page graph construction, drag-to-reorder
  participants, Swiss win/loss-bucket visualization, mobile-specific redesign,
  and most of the microinteraction spec (path illumination on advancement,
  crossfade on rename, pulsing active-status badges).

## 0.1.0 — 2026-08-01

Baseline: single/double elimination, round robin, and Swiss tournaments with real
Postgres persistence. Bracket connector-line rendering for elim formats. Seeding
UI (manual position + randomize). Per-round best-of (Bo1/3/5/7). Inline
participant renaming from any match card. Format preview thumbnails on creation.
Uneven-bracket bye warning before starting single/double elim. Hidden admin panel
(wipe-all, gated behind a 5-click easter egg + credentials). Back navigation on
the tournament page.
