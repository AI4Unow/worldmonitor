#!/usr/bin/env bash
set -euo pipefail

# If this is the first deploy, force a build.
if [[ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ]]; then
  exit 1
fi

# After force-push/rewrite, previous SHA may not exist in clone history.
if ! git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  exit 1
fi
if ! git cat-file -e "${VERCEL_GIT_COMMIT_SHA}^{commit}" 2>/dev/null; then
  exit 1
fi

# Skip build only when no deploy-relevant files changed.
if git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA}" "${VERCEL_GIT_COMMIT_SHA}" -- \
  api/ src/ server/ proto/ public/ index.html settings.html middleware.ts \
  vite.config.ts vercel.json package.json tsconfig.json data/; then
  exit 0
fi

exit 1
