# NaPare Design System

Единый foundation для role workspaces находится в packages/design-tokens и packages/ui. Student app сохраняет собственный compatibility boundary согласно AGENTS.md и не входит в активный redesign.

## Архитектура

- @napare/design-tokens — CSS custom properties, Tailwind preset и типизированная карта tokens.
- @napare/ui — shared React primitives: Button, Badge, Card, Input, Modal, ConfirmDialog, EmptyState, RequestState, NetworkStatus, Skeleton, StatCard, TabBar, SearchInput, Avatar, ToastProvider/useToast и единый SVG Icon registry.
- apps/web-{staff,admin,developer}/src/components/ui — только compatibility re-exports; бизнес-код и существующие page imports не меняются.
- apps/web-{staff,admin,developer}/src/app/globals.css — импортирует shared CSS и оставляет только role accent/layout adaptations.
- Tailwind configs используют общий preset; локальные color/radius/shadow copies удалены.

## Token contract

| Слой | Канонические значения |
| --- | --- |
| Surfaces | --color-background, --color-surface, --color-surface-secondary, --color-surface-tertiary |
| Content | --color-text, --color-text-secondary, --color-text-muted |
| Brand/semantic | --color-brand*, --color-success*, --color-warning*, --color-danger*, --color-info* |
| Shape/elevation | --radius-sm/md/lg/xl, --shadow-sm/md/lg |
| Motion | --motion-fast/normal/slow, --motion-ease; all animated foundation styles respect prefers-reduced-motion |
| Layering | --z-base/sticky/overlay/modal/toast |

Base interaction height is 44px. Focus is :focus-visible with semantic brand ring. Inputs expose aria-invalid and aria-describedby for errors. Loading, empty, error, forbidden and offline states use icons, not text glyphs.

## Role accents

Staff uses restrained info blue, admin uses indigo, developer uses technical blue. These accents only set role emphasis; surfaces, typography, geometry, states and component behavior remain shared.

## Migration rule

New UI imports from @napare/ui. Do not add role-local primitives or duplicate token values. Navigation/header/logo files remain protected by repository policy and are outside this migration boundary.

## Workspace shell

\`WorkspaceShell\` in \`@napare/ui\` is the shared application frame for staff, admin and developer workspaces:

- grouped desktop sidebar with active state, collapsed mode, tooltips and badges;
- mobile drawer plus five-item bottom navigation with safe-area padding;
- top bar with role context, breadcrumbs, status, notifications and profile;
- \`Ctrl/Cmd+K\` command palette with fuzzy matching, recent commands, keyboard navigation, Escape and focus looping;
- navigation commands, contextual actions and entity commands are passed as data, so role policy stays in the app while presentation stays shared.

Role navigation is a task hierarchy, not a CRUD menu. Student remains on its protected shell boundary; its target information architecture is documented separately before connection to this shared runtime.
