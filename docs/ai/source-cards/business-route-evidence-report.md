# Business route observation report

## Canonical source

`scripts/report-business-route-evidence.cjs`

## Scope

Closed-schema JSONL validation, current AST inventory matching and explicit observed/unobserved rows. Preserve absence of a security/coverage verdict; 200/403 observations do not establish paired business assertions. Output is ignored JSON/Markdown metadata, not production telemetry. Read [workflow and limits](../../security/business-route-evidence.md).

## Verification

Use real HTTP/PG evidence, require a nonempty collection in CI, and check zero unknown templates after reviewed route changes. Repository guards/docs lint and backend typecheck cover the helper integration.
