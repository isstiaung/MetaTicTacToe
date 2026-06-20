#!/usr/bin/env node
/**
 * Link the shared monorepo source packages (@mtt/engine, @mtt/theme) into this
 * app's node_modules.
 *
 * Why: this Expo app is intentionally NOT a member of the root npm `workspaces`
 * globs (it is a standalone app with its own node_modules). Expo therefore
 * roots the Metro server / file map at `mobile/`, which scopes file access to
 * this directory. Symlinking the shared packages under `mobile/node_modules`
 * lets Metro resolve the bare `@mtt/*` specifiers AND read their TS sources
 * (the real targets live under `packages/*`, which `metro.config.js` adds to
 * `watchFolders`, so babel-preset-expo transpiles them).
 *
 * Run automatically via the `postinstall` hook, and safe to run by hand.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const scopeDir = path.join(projectRoot, 'node_modules', '@mtt');

const links = {
  engine: path.join(workspaceRoot, 'packages', 'engine'),
  theme: path.join(workspaceRoot, 'packages', 'theme'),
};

fs.mkdirSync(scopeDir, { recursive: true });

for (const [name, target] of Object.entries(links)) {
  const linkPath = path.join(scopeDir, name);

  if (!fs.existsSync(target)) {
    console.warn(`[link-shared] target missing, skipping: ${target}`);
    continue;
  }

  // Replace any stale entry so the link always points at the current package.
  try {
    if (fs.existsSync(linkPath) || fs.lstatSync(linkPath)) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
  } catch {
    // lstat throws if nothing is there — nothing to remove.
  }

  // Relative symlink so the repo stays portable across machines.
  const relativeTarget = path.relative(scopeDir, target);
  fs.symlinkSync(relativeTarget, linkPath, 'junction');
  console.log(`[link-shared] @mtt/${name} -> ${relativeTarget}`);
}
