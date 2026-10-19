### Task 1: Establish role-safe visual foundations

**Files:**
- Modify: `apps/web-staff/src/app/globals.css`, `apps/web-admin/src/app/globals.css`, `apps/web-developer/src/app/globals.css`
- Modify: `apps/web-{staff,admin,developer}/src/components/ui/{Card,StatCard,Badge,Button,EmptyState,RequestState,Skeleton}.tsx`
- Create: `docs/design/role-workspace-tokens.md`

**Interfaces:**
- Produces role-scoped classes: `.workspace-hero`, `.workspace-kicker`, `.metric-rail`, `.action-card`, `.table-shell`, `.status-dot`.
- Preserves component public props and all existing imports.

- [ ] Write a static guard test that rejects changes under student, navigation, Avatar and logo paths.
- [ ] Run it and confirm it fails before the guard exists.
- [ ] Define semantic tokens per role: paper/sky for staff, paper/indigo for admin, navy/cyan for developer; document exact hex colors, type scale, spacing, radius, focus and motion values.
- [ ] Update each local primitive to consume tokens and preserve `className`, variant and children behavior.
- [ ] Add responsive table, metric rail and action card utilities; make focus and reduced-motion behavior explicit.
- [ ] Run the static guard and all three typechecks; commit `feat: establish role workspace tokens`.
