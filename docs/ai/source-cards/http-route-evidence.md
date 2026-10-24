# Test HTTP route metadata

## Canonical source

`apps/backend/test/http-route-evidence.ts`

## Scope

Explicit test-only response metadata on real AppModules: route template/status/role/tenant bucket/suite/hash only. Record finish or close after sent headers once, including client-closed SSE; headers do not prove full stream correctness. No request bodies, URLs with parameters, tokens or response contents. Guard probes are not instrumented. Preserve output path restrictions and disabled-by-default behavior. See [evidence boundaries](../../security/business-route-evidence.md).

## Verification

Run a real disposable HTTP/PG suite with BUSINESS_ROUTE_EVIDENCE_FILE and validate its JSONL with the report script. A passing report is not isolation proof.
