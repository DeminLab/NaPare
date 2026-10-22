# Student route title: Пространство пары

## Canonical source

`apps/web-student/src/app/(student)/pair-space/[lessonId]/layout.tsx`

## Scope

Server layout supplies an absolute route-specific document title, including the app name, so its parent pair-space layout does not consume the root template. It returns children without changing page behavior, navigation, headers or assets.

## Read sequence

Read the student accessibility audit, root app layout and this route's page source.

## Verification

Student TypeScript/build and browser document.title on direct navigation, client navigation and back/forward.
