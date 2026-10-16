# Source card: Student shell

## Canonical source

`apps/web-student/src/components/navigation/StudentShell.tsx`

## Scope

Authentication, notification counts and navigation data for the student workspace. The approved all-page scope permits this file. Curation appears in the secondary navigation only after the account context grants access; the four main mobile destinations remain unchanged. Shared header rendering, avatars and logos are preserved.

## Verification

Run the student TypeScript check, lint and repository boundary guard. Menu visibility is not backend authorization.
