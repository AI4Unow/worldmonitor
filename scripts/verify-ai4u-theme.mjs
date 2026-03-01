#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();

/**
 * Each check enforces one non-negotiable AI4U brand token or fallback color.
 * If upstream drifts these values, daily sync should fail before push.
 */
const checks = [
  {
    file: 'src/styles/ai4u-theme-overrides.css',
    label: 'brand maize token',
    regex: /--brand-maize:\s*#f4c542;/i,
  },
  {
    file: 'src/styles/ai4u-theme-overrides.css',
    label: 'brand navy token',
    regex: /--brand-navy:\s*#0a1a3f;/i,
  },
  {
    file: 'src/styles/ai4u-theme-overrides.css',
    label: 'default dark background',
    regex: /--bg:\s*#081634;/i,
  },
  {
    file: 'src/styles/ai4u-theme-overrides.css',
    label: 'light-mode background',
    regex: /data-theme="light"[\s\S]*?--bg:\s*#f3f6fc;/i,
  },
  {
    file: 'src/styles/ai4u-theme-overrides.css',
    label: 'light-mode primary text',
    regex: /data-theme="light"[\s\S]*?--text:\s*#0a1a3f;/i,
  },
  {
    file: 'src/main.ts',
    label: 'main entry imports AI4U overrides',
    regex: /import '\.\/styles\/ai4u-theme-overrides\.css';/,
  },
  {
    file: 'src/settings-main.ts',
    label: 'settings entry imports AI4U overrides',
    regex: /import '\.\/styles\/ai4u-theme-overrides\.css';/,
  },
  {
    file: 'src/live-channels-main.ts',
    label: 'live channels entry imports AI4U overrides',
    regex: /import '\.\/styles\/ai4u-theme-overrides\.css';/,
  },
  {
    file: 'index.html',
    label: 'theme-color meta tag',
    regex: /<meta name="theme-color" content="#0a1a3f"\s*\/?>/i,
  },
  {
    file: 'index.html',
    label: 'dark skeleton shell background',
    regex: /\.skeleton-shell\{[^}]*background:#081634/i,
  },
  {
    file: 'index.html',
    label: 'light skeleton shell background',
    regex: /\[data-theme="light"\]\s+\.skeleton-shell\{[^}]*background:#f3f6fc/i,
  },
  {
    file: 'src/utils/theme-manager.ts',
    label: 'runtime theme-color mapping',
    regex: /return theme === 'dark' \? '#0a1a3f' : '#f3f6fc';/,
  },
  {
    file: 'vite.config.ts',
    label: 'PWA manifest theme color',
    regex: /theme_color:\s*'#0a1a3f'/,
  },
  {
    file: 'vite.config.ts',
    label: 'PWA manifest background color',
    regex: /background_color:\s*'#0a1a3f'/,
  },
  {
    file: 'public/offline.html',
    label: 'offline page navy background',
    regex: /background:\s*#081634;/i,
  },
  {
    file: 'public/offline.html',
    label: 'offline retry button maize',
    regex: /button\s*\{[\s\S]*?background:\s*#f4c542;[\s\S]*?color:\s*#0a1a3f;[\s\S]*?border:\s*1px solid #e0b132;/i,
  },
  {
    file: 'settings.html',
    label: 'settings shell fallback colors',
    regex: /<body style="background:#081634;color:#f8fbff;margin:0">/i,
  },
];

const failures = [];

for (const check of checks) {
  const filePath = resolve(repoRoot, check.file);
  let content = '';
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${check.file}: unreadable (${message})`);
    continue;
  }

  if (!check.regex.test(content)) {
    failures.push(`${check.file}: missing ${check.label}`);
  }
}

if (failures.length > 0) {
  console.error('[ai4u-theme] verification failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[ai4u-theme] verification passed');
