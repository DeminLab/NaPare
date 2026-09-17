# НаПаре MAX Hackathon MVP

## Goal

Deliver an education-track demo that opens as a MAX Mini App and lets a student understand today's study context, open a lesson space, download lesson materials, and submit an absence.

## Product decisions

- The MAX Mini App is the primary student demo; existing web panels remain staff and administration surfaces.
- The first screen is action-first: current or next lesson, changes, deadlines, and a visible absence action.
- A lesson space presents announcements, homework, and downloadable files in a single mobile-first feed.
- Navigation is five destinations: Today, Schedule, Lessons, Notifications, and Profile.
- MAX launch data is validated by the server. The client never treats `initDataUnsafe` as authenticated identity.

## Scope

### Included

- Create a React/Vite MAX Mini App with HTTPS-ready static build, Bridge wrapper, mobile shell, and the demo flows above.
- Add student absence creation and downloadable PairSpace files.
- Enforce role, university, group, and ownership checks for schedule, PairSpace, and absence mutations.
- Repair the absence DTO/entity mapping and make the shared API client use the `/api/v1` envelope.
- Add regression tests for authorization and absence mapping.

### Deferred

- Next.js major upgrade and dependency-audit remediation: these require a separately reviewed compatibility migration.
- Token revocation, encryption-at-rest, full offline cache, and full visual refresh of staff/admin panels.
- Publishing to MAX: requires the team token and an externally hosted HTTPS URL.

## Acceptance criteria

- A student can create only their own absence and cannot confirm, excuse, update, or delete another student's absence.
- Only authorized staff roles can mutate schedules or publish PairSpace content; students can read content only for their own group.
- PairSpace file entries expose a safe download link.
- The Mini App builds, has a responsive 375 px layout, uses `window.WebApp` only through a wrapper, and falls back cleanly in a normal browser.
- Student API requests use `/api/v1` and parse `{ data, meta }` responses.

## MAX platform constraints

- App deployment URL is HTTPS.
- `initData` is passed to the backend for server validation; no confidential data is placed in `startapp` payloads.
- The visual system uses MAX UI-compatible spacing, typography, and controls; native MAX capabilities are progressive enhancements.
