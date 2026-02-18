# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Every API integration is defined in a .proto file with generated type-safe TypeScript clients and server handlers, eliminating hand-written fetch boilerplate.
**Current focus:** Phase 2B: Server Runtime

## Current Position

Phase: 2A complete (All Domain Protos)
Next: Phase 2B (Server Runtime)
Status: Ready for Phase 2B
Last activity: 2026-02-18 -- Completed Phase 2A (all 17 domain proto packages)

Progress: [████░░░░░░] ~25%

## Performance Metrics

**Completed Phases:**
- Phase 1: Proto Foundation (2 plans, 7min total)
- Phase 2A: All Domain Protos (1 session)

## Accumulated Context

### Decisions

- [2A]: Dropped dual-mode adapter approach entirely — no feature flags, no parity testing, direct migration per domain
- [2A]: 17 domains + core types (79 proto files total)
- [2A]: `enum_value` and `INT64_ENCODING_NUMBER` sebuf annotations not yet available in v0.6.0 — using plain enums and int64 for now
- [2A]: Enums follow existing TS union values as comments for future mapping
- [2A]: military_vessel.proto imports military_flight.proto for shared enums (MilitaryOperator, MilitaryConfidence, MilitaryActivityType)
- [2A]: No `oneof success/error` in responses — throw errors in handler, map with `onError`
- [2A]: All RPCs use POST, kebab-case paths under `/api/{domain}/v1/`
- [2A]: Test domain protos removed (served their Phase 1 purpose)

### Pending Todos

- Phase 2B: Build server runtime (router.ts, cors.ts, error-mapper.ts, catch-all gateway)
- Phase 2B: Implement seismology handler as first end-to-end proof

### Blockers/Concerns

- `int64` time fields generate as `string` in client code — will need sebuf INT64_ENCODING_NUMBER support or manual mapping
- @sentry/browser missing from dependencies (pre-existing, unrelated)

## Session Continuity

Last session: 2026-02-18
Stopped at: Phase 2A complete, ready for Phase 2B (Server Runtime)
Next steps: Build api/server/ infrastructure, implement seismology handler
