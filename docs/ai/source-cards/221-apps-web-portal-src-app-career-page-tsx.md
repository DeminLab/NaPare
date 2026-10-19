# Source card: `apps/web-portal/src/app/career/page.tsx`

## Canonical source

`apps/web-portal/src/app/career/page.tsx`

## Scope

Career module: student professional profiles, scoped career-center/company permissions and task lifecycle. Payment provider is intentionally empty; accepted work does not mean paid. Telegram is not used. See [career domain](../../modules/career.md).

## Read sequence

Read AI_CONTEXT.md, docs/modules/career.md, this canonical source and its direct imports before changing behavior.

## Change boundary

Preserve academic tenant isolation. Employer accounts cannot read university records. Only verified students with an exact approved skill may apply to profiled tasks; publication needs both parties' consent. Never expose correct test answers or infer a payment.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
pnpm --filter @napare/web-portal exec eslint src/app/career/page.tsx
```

Task discovery uses the additive `/career/tasks` endpoint. Search and filters apply across the scoped server-side collection; `Показать ещё задачи` appends the next stable page, and a failed append retains earlier rows for retry. The overview endpoint and its payload remain available to existing clients.

Applications and works use `/career/workflows` for server-side search/state filters, accurate counts, and append pagination. Employers can continue selecting applicants, deciding submitted work, and adding required reviews; students can append older applications and keep active/revision work submission forms available. A failed append leaves loaded rows in place. Successful actions reload the current workflow from page one with status feedback. Student task-search handlers invalidate active task requests synchronously before state changes so an earlier response cannot repopulate results for a newer query.

The career-center profile/admission review section uses `/career/center/reviews` with a visible kind switch. `ReviewQueue` keeps its dirty-form selection confirmation while search, status, and kind changes reset selection safely; counts and search are server-side, and append/retry retains the current queue after an append failure. Profile verification and admission decisions still use their original protected mutation handlers.

The tests endpoint loads independently from the overview, with its own loading/error state, retry action, and request sequence guard. A failed tests request cannot hide the loaded career cabinet or render a false empty state, and a late result from a prior workspace is ignored. Changing workspace invalidates the overview and all paginated request sequences synchronously before React effects run. In the student profile tab, attempt forms require `profile.verification === 'verified'` and a positive server-returned `remainingAttempts`; missing/rejected/pending profiles get an explanation and a link back to the profile form. After an attempt, the test catalog refreshes the remaining count. The backend still enforces both guards.

Student and center test catalogs use paginated `/career/tests` with debounced title/skill search, server totals, append, and retry. Search changes synchronously invalidate stale requests; failed append retains loaded tests. Test attempt payloads and the existing attempt route are unchanged.

Company partnerships use `/career/partnerships` with server search/status filters, counts, append and retry. Legacy overview partnership rows are omitted from the company cards to avoid duplicate decisions. `TaskComposer` checks eligibility for the exact selected company/university pair and rejects stale responses as soon as either selection changes; the backend create guard remains authoritative. Task search is debounced by 250 ms, invalidates active requests synchronously on input/filter changes, and paginates the server-side collection.

Employer application and works views and student work/application history use `/career/workflows`; they preserve selection, submission, decision, and review actions and append older history without discarding loaded rows on append failure.

Student `Сначала совместимые и стартовые` sorts the currently loaded task page by fit rank, then starter level, preserving the server's stable order inside ties. Switching sort invalidates pending task requests and reloads page one. Legacy capped profile, partnership-row, employer-application, work-list, and student-application JSX has been removed in favor of the paginated sections; company cards, membership and partnership request forms remain.

Career notices use owner-scoped `/career/notices` pages plus `/career/notices/unread-count` for the tab badge. The list appends with retry without discarding loaded rows, shows explicit read state and a notice-specific accessible action name, locally updates the current row after a successful read mutation, and refetches the exact count. List/count failures preserve the last loaded data. The global footer no longer claims that every list is capped at the overview limit.

Employer company creation, partnership requests and the task composer use the paginated `/career/universities` selector; center team assignment uses `/career/center/assignable-staff`. Both selectors show search/count/continuation/loading/error/empty states, retain the selected ID when search or append changes, and leave existing POST handlers intact. The university selector offers active institutions only. Backend authorization remains authoritative for assignment.

The student profile tab uses `/career/student/admissions` for owner-scoped pages and relies on its complete `approvedSkills` set for task eligibility, not the capped overview array. The student portfolio UI is composed in `StudentPortfolio.tsx`; this page keeps the profile/admission tab's load, retry, pagination and mutation flows independent from overview data.
