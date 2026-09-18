# Role workspace tokens

Each role owns the same semantic token names in its local `globals.css`. Pages and primitives use those names rather than importing a cross-role visual theme.

| Token group | Staff: paper / sky | Admin: paper / indigo | Developer: navy / cyan |
| --- | --- | --- | --- |
| Canvas / paper | `#F6F9FC` / `#FFFFFF` | `#F7F7FB` / `#FFFFFF` | `#07111F` / `#0F172A` |
| Ink / muted | `#122033` / `#5D6B7E` | `#171A33` / `#60657A` | `#E6EDF7` / `#94A3B8` |
| Line | `#DCE7F0` | `#E1E3F0` | `#243247` |
| Accent / hover / soft | `#0B84C6` / `#0369A1` / `#E0F2FE` | `#4F46E5` / `#4338CA` / `#EEF2FF` | `#22D3EE` / `#06B6D4` / `#083344` |
| Success / warning / danger | `#15803D` / `#B45309` / `#B91C1C` | `#15803D` / `#B45309` / `#B91C1C` | `#34D399` / `#FBBF24` / `#F87171` |

Type scale: page `clamp(1.75rem, 2.3vw, 2rem)`, section `clamp(1.125rem, 1.6vw, 1.25rem)`, card `1rem`, body `0.9375rem`, and metadata `0.8125rem`. Spacing tokens are `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`, and `3rem`. Radius values are `0.5rem`, `0.75rem`, `1rem`, and `1.25rem`.

All roles use a visible four-pixel focus ring (`--workspace-focus-ring`) and 44px minimum control height. Motion is `150ms` for hover and `180ms` for page entry with `cubic-bezier(0.2, 0.8, 0.2, 1)`; the reduced-motion query turns transitions and animations off. `.metric-rail` automatically collapses to one or two columns, while `.table-shell` retains table actions through horizontal scrolling on narrow screens.
