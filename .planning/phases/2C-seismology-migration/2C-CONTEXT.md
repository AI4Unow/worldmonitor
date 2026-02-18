# Phase 2C: Seismology Migration - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate the seismology/earthquakes domain end-to-end from legacy api/earthquakes.js to sebuf-powered handler + generated client + updated components. The handler already exists from Phase 2B — this phase wires the frontend, tests the pipeline, and deletes legacy code. This is the first domain migration and sets the pattern for 2D-2S.

</domain>

<decisions>
## Implementation Decisions

### INT64 Encoding (prerequisite step)
- Enable `INT64_ENCODING_NUMBER` on all time fields in proto files before migrating
- Regenerate code so TypeScript gets `number` not `string` for int64 fields
- This is part of this phase (not a separate prerequisite) — benefits all future domains
- Must be done first, before any client wiring

### Client Switchover
- **Direct switch** — no side-by-side comparison with legacy, just swap to sebuf
- **Adapter/port pattern** for legacy interaction — reference implementation at `koussa/internal/modules` (specifically playlist module)
  - Port = interface declaring what the domain needs, internal to the module
  - Adapter = concrete implementation backed by sebuf client
  - Consuming code imports the port (interface), never the adapter directly
  - Port types are hidden in the module domain — the rest of the codebase doesn't see them
- **Adapt components** to consume generated response types directly — no mapping shim between client and components
- **Delete legacy adapter immediately** once sebuf adapter is wired up and working — no fallback period

### Testing Strategy
- **Gradual testing at both levels**: test each sub-step within the domain AND validate the full domain before moving to the next
  - After handler wiring: verify endpoint responds
  - After client switch: verify data flows to components
  - After component update: verify UI renders correctly
- **Atomic commits** for each sub-step — easy to bisect if something breaks
- **Testing approach: Claude's discretion** — Claude picks manual vs automated, what to assert
- No need to maintain legacy API request/response shapes — this is a rewrite, proto types are canonical

### Legacy Cleanup
- **Delete api/earthquakes.js in the same commit** as the client switchover
- **Leave shared utils** (api/_cors.js, api/_upstash-cache.js, etc.) until Phase 2T — other legacy endpoints still use them
- **Leave legacy TypeScript types** (Earthquake in src/types/index.ts) until Phase 2T — avoid touching shared file 17 times
- **Remove Vite proxy rule** for seismology when legacy endpoint is deleted

### Git Sync Cadence
- **Rebase onto main after every sub-step** (every atomic commit) — maximum freshness, catches conflicts early
- **Push after each sync** — force push to keep PR current, CI runs on every commit
- **One big PR (#106)** for the entire sebuf integration — stays as draft
- **PR description updates**: always update the PR description with what's new, be clear on what to review, be straightforward and informative, show examples

### Claude's Discretion
- Exact testing approach (manual smoke tests, automated integration tests, or both)
- Adapter/port implementation details in TypeScript (translate from Go reference)
- Component refactoring approach when adapting to proto types
- Commit message style and granularity within the atomic commits

</decisions>

<specifics>
## Specific Ideas

- Adapter/port pattern reference: `koussa/internal/modules/playlist` (Go project, but same architectural pattern in TypeScript)
- The user emphasized "gradual testing, gradual sync with main to avoid drift" as core workflow principles
- PR communication: "be clear on what to review, be straightforward and informative and show examples"
- INT64_ENCODING_NUMBER on time fields is a user preference documented in project memory — apply project-wide during this phase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 2C-seismology-migration*
*Context gathered: 2026-02-18*
