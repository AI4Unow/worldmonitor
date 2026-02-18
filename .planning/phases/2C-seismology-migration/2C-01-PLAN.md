---
phase: 2C-seismology-migration
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - proto/worldmonitor/seismology/v1/earthquake.proto
  - proto/worldmonitor/wildfire/v1/fire_detection.proto
  - proto/worldmonitor/aviation/v1/airport_delay.proto
  - proto/worldmonitor/military/v1/military_vessel.proto
  - proto/worldmonitor/military/v1/military_flight.proto
  - proto/worldmonitor/intelligence/v1/intelligence.proto
  - proto/worldmonitor/intelligence/v1/get_country_intel_brief.proto
  - proto/worldmonitor/infrastructure/v1/infrastructure.proto
  - proto/worldmonitor/news/v1/news_item.proto
  - proto/worldmonitor/conflict/v1/acled_event.proto
  - proto/worldmonitor/conflict/v1/humanitarian_summary.proto
  - proto/worldmonitor/unrest/v1/unrest_event.proto
  - proto/worldmonitor/prediction/v1/prediction_market.proto
  - proto/worldmonitor/maritime/v1/vessel_snapshot.proto
  - proto/worldmonitor/cyber/v1/cyber_threat.proto
  - proto/worldmonitor/economic/v1/economic_data.proto
  - proto/worldmonitor/research/v1/research_item.proto
  - Makefile
  - proto/buf.lock
  - api/server/worldmonitor/seismology/v1/handler.ts
  - src/generated/client/worldmonitor/seismology/v1/service_client.ts
  - src/generated/server/worldmonitor/seismology/v1/service_server.ts
autonomous: true
requirements:
  - CLIENT-01
  - SERVER-02

must_haves:
  truths:
    - "All int64 time fields (suffix _at) generate as TypeScript `number`, not `string`"
    - "Non-time int64 fields (population counts, etc.) still generate as `string`"
    - "Seismology handler compiles without type errors after occurredAt becomes number"
    - "`make generate` succeeds with zero errors"
    - "`buf lint` passes"
  artifacts:
    - path: "proto/worldmonitor/seismology/v1/earthquake.proto"
      provides: "INT64_ENCODING_NUMBER annotation on occurred_at"
      contains: "sebuf.http.int64_encoding"
    - path: "src/generated/client/worldmonitor/seismology/v1/service_client.ts"
      provides: "Generated Earthquake type with occurredAt: number"
      contains: "occurredAt: number"
    - path: "api/server/worldmonitor/seismology/v1/handler.ts"
      provides: "Handler returning occurredAt as number (not String())"
    - path: "Makefile"
      provides: "Updated plugin versions supporting INT64_ENCODING_NUMBER"
  key_links:
    - from: "proto/**/earthquake.proto"
      to: "src/generated/client/**/service_client.ts"
      via: "buf generate code generation"
      pattern: "occurredAt: number"
    - from: "api/server/**/handler.ts"
      to: "src/generated/server/**/service_server.ts"
      via: "implements SeismologyServiceHandler"
      pattern: "occurredAt: f\\.properties\\.time"
---

<objective>
Enable INT64_ENCODING_NUMBER annotations on all int64 time fields across all 17 domain proto files, upgrade sebuf plugins, regenerate all TypeScript code, and fix the seismology handler type.

Purpose: This is a prerequisite for all domain migrations. Without it, int64 time fields generate as `string` in TypeScript, requiring manual conversions everywhere. With the annotation, they generate as `number` -- matching JavaScript's native epoch millisecond handling. Per user decision, this is done project-wide during Phase 2C before any client wiring.

Output: All ~30 int64 time fields annotated, all generated code regenerated with `number` types, seismology handler type-correct.
</objective>

<execution_context>
@/Users/sebastienmelki/.claude/get-shit-done/workflows/execute-plan.md
@/Users/sebastienmelki/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/2C-seismology-migration/2C-RESEARCH.md
@proto/buf.yaml
@proto/buf.gen.yaml
@proto/buf.lock
@Makefile
@api/server/worldmonitor/seismology/v1/handler.ts
@src/generated/client/worldmonitor/seismology/v1/service_client.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Annotate all int64 time fields with INT64_ENCODING_NUMBER and regenerate</name>
  <files>
    proto/worldmonitor/seismology/v1/earthquake.proto
    proto/worldmonitor/wildfire/v1/fire_detection.proto
    proto/worldmonitor/aviation/v1/airport_delay.proto
    proto/worldmonitor/military/v1/military_vessel.proto
    proto/worldmonitor/military/v1/military_flight.proto
    proto/worldmonitor/intelligence/v1/intelligence.proto
    proto/worldmonitor/intelligence/v1/get_country_intel_brief.proto
    proto/worldmonitor/infrastructure/v1/infrastructure.proto
    proto/worldmonitor/news/v1/news_item.proto
    proto/worldmonitor/conflict/v1/acled_event.proto
    proto/worldmonitor/conflict/v1/humanitarian_summary.proto
    proto/worldmonitor/unrest/v1/unrest_event.proto
    proto/worldmonitor/prediction/v1/prediction_market.proto
    proto/worldmonitor/maritime/v1/vessel_snapshot.proto
    proto/worldmonitor/cyber/v1/cyber_threat.proto
    proto/worldmonitor/economic/v1/economic_data.proto
    proto/worldmonitor/research/v1/research_item.proto
    Makefile
    proto/buf.lock
  </files>
  <action>
    **Step 1: Resolve the BSR annotation blocker.**

    The BSR-published `buf.build/sebmelki/sebuf` does NOT currently expose the `int64_encoding` field extension in `annotations.proto`. The installed binary (v0.6.0) has it compiled in, but `buf generate` will fail because the proto dependency lacks the definition.

    Resolution options (try in order):
    1. Check if the sebuf source repo is available locally (e.g., at `~/go/src/github.com/SebastienMelki/sebuf` or similar). If yes, check if the `annotations.proto` already has the `int64_encoding` extension. If it does, push an updated BSR module: `cd /path/to/sebuf && buf push proto`.
    2. If no local sebuf repo, or BSR push fails, vendor the annotations proto locally: create `proto/sebuf/http/annotations.proto` with the `int64_encoding` field extension (extension number 50010, type `Int64Encoding` enum with `INT64_ENCODING_UNSPECIFIED=0` and `INT64_ENCODING_NUMBER=1`, extending `google.protobuf.FieldOptions`). Update `proto/buf.yaml` to remove the `buf.build/sebmelki/sebuf` dep (since it's now local).
    3. If vendoring, run `cd proto && buf dep update` to update the lock file.

    **Step 2: Upgrade sebuf plugin versions in Makefile.**

    Update `Makefile` `install-plugins` target from `@v0.6.0` to the version that supports INT64_ENCODING_NUMBER. If BSR was updated, use the matching release tag. If vendoring, the existing v0.6.0 binary already supports it (confirmed via binary strings), so this step may be a no-op unless a newer version exists.

    Run `make install-plugins` to install updated versions.

    **Step 3: Annotate all int64 time fields.**

    In each proto file that has `int64` fields with `_at` suffix (timestamps), add the annotation. Each file needs:
    1. An import: `import "sebuf/http/annotations.proto";`
    2. The annotation on each time field: `[(sebuf.http.int64_encoding) = INT64_ENCODING_NUMBER]`

    **IMPORTANT: Only annotate fields that represent timestamps (suffix `_at`).** Do NOT annotate non-time int64 fields like population counts in `displacement.proto` (refugees, asylum_seekers, etc.) -- these could exceed `Number.MAX_SAFE_INTEGER`.

    **NOTE on `intelligence.proto` line 92:** The field `string recorded_at = 9` is already a `string` type, not `int64`. Do NOT change its type -- it stays as `string`. Only `int64` fields get the annotation.

    Complete list of fields to annotate (grep result, ~30 fields across 17 files):

    - `proto/worldmonitor/seismology/v1/earthquake.proto`: `occurred_at`
    - `proto/worldmonitor/wildfire/v1/fire_detection.proto`: `detected_at`
    - `proto/worldmonitor/aviation/v1/airport_delay.proto`: `updated_at`
    - `proto/worldmonitor/military/v1/military_vessel.proto`: `last_ais_update_at`, `assessed_at`
    - `proto/worldmonitor/military/v1/military_flight.proto`: `last_seen_at`, `first_seen_at`
    - `proto/worldmonitor/intelligence/v1/intelligence.proto`: `computed_at`, `updated_at`
    - `proto/worldmonitor/intelligence/v1/get_country_intel_brief.proto`: `generated_at`
    - `proto/worldmonitor/infrastructure/v1/infrastructure.proto`: `detected_at`, `ended_at`, `checked_at`
    - `proto/worldmonitor/news/v1/news_item.proto`: `published_at`, `generated_at`
    - `proto/worldmonitor/conflict/v1/acled_event.proto`: `occurred_at`
    - `proto/worldmonitor/conflict/v1/humanitarian_summary.proto`: `updated_at`
    - `proto/worldmonitor/unrest/v1/unrest_event.proto`: `occurred_at`, `start_at`, `end_at`
    - `proto/worldmonitor/prediction/v1/prediction_market.proto`: `closes_at`
    - `proto/worldmonitor/maritime/v1/vessel_snapshot.proto`: `snapshot_at`, `issued_at`, `expires_at`
    - `proto/worldmonitor/cyber/v1/cyber_threat.proto`: `first_seen_at`, `last_seen_at`
    - `proto/worldmonitor/economic/v1/economic_data.proto`: `price_at`
    - `proto/worldmonitor/research/v1/research_item.proto`: `published_at`, `submitted_at`

    For each file, the pattern is:
    ```protobuf
    // Add this import (if not already present):
    import "sebuf/http/annotations.proto";

    // Change each time field from:
    int64 occurred_at = 6;
    // To:
    int64 occurred_at = 6 [(sebuf.http.int64_encoding) = INT64_ENCODING_NUMBER];
    ```

    If a field already has other annotations (e.g., `(buf.validate.field)`), append the sebuf annotation in the same bracket list.

    **Step 4: Lint and generate.**

    ```bash
    cd proto && buf lint
    cd proto && buf generate
    ```

    If `buf lint` fails on the annotation import, check that the import path matches the vendored/BSR proto path exactly.

    **Step 5: Verify generated types.**

    Check `src/generated/client/worldmonitor/seismology/v1/service_client.ts` -- the `Earthquake` interface should now have `occurredAt: number` (not `occurredAt: string`).

    Spot-check 2-3 other generated clients to confirm time fields are `number`.

    **Step 6: Fix seismology handler.**

    In `api/server/worldmonitor/seismology/v1/handler.ts`, change:
    ```typescript
    occurredAt: String(f.properties.time),
    ```
    to:
    ```typescript
    occurredAt: f.properties.time,
    ```

    The USGS API returns `time` as a number (Unix epoch ms), so this is already the correct type.

    **Step 7: Type-check.**

    ```bash
    npx tsc -p tsconfig.api.json --noEmit
    ```

    Must pass with zero errors.

    **Step 8: Rebuild sidecar bundle.**

    ```bash
    npm run build:sidecar-sebuf
    ```

    Must succeed (the handler type change affects the compiled bundle).
  </action>
  <verify>
    1. `cd proto && buf lint` -- zero errors
    2. `cd proto && buf generate` -- succeeds
    3. `grep "occurredAt: number" src/generated/client/worldmonitor/seismology/v1/service_client.ts` -- matches
    4. `grep "occurredAt: number" src/generated/client/worldmonitor/wildfire/v1/service_client.ts` -- matches (spot check)
    5. `npx tsc -p tsconfig.api.json --noEmit` -- zero errors
    6. `npm run build:sidecar-sebuf` -- succeeds
    7. `grep -r "INT64_ENCODING_NUMBER" proto/ | wc -l` -- should be ~30 (one per annotated field)
    8. `grep "String(" api/server/worldmonitor/seismology/v1/handler.ts` -- no matches (String() removed)
  </verify>
  <done>
    All int64 time fields across 17 domain protos are annotated with INT64_ENCODING_NUMBER. Generated TypeScript types use `number` for all time fields. Seismology handler returns `occurredAt` as a number. `buf lint`, `buf generate`, `tsc`, and sidecar build all pass.
  </done>
</task>

</tasks>

<verification>
1. `cd proto && buf lint` passes
2. `make generate` completes without errors
3. Generated `Earthquake` interface has `occurredAt: number` (not `string`)
4. Generated `TimeRange` interface has `start: number` and `end: number` (if annotated)
5. `npx tsc -p tsconfig.api.json --noEmit` passes
6. `npm run build:sidecar-sebuf` succeeds
7. No `String()` wrapper on `occurredAt` in handler
</verification>

<success_criteria>
- All ~30 int64 time fields annotated with INT64_ENCODING_NUMBER
- `make generate` produces TypeScript with `number` types for all time fields
- Seismology handler compiles and passes type-check
- Sidecar bundle builds successfully
- Zero lint errors, zero type errors
</success_criteria>

<output>
After completion, create `.planning/phases/2C-seismology-migration/2C-01-SUMMARY.md`
</output>
