const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root so Metro can read + transpile the shared TS package
// sources (they live under `packages/*`, outside this app's folder).
config.watchFolders = [workspaceRoot];

// Resolve modules from the app first, then fall back to the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// --- Shared source packages (@mtt/engine, @mtt/theme) ------------------------
// These are plain TS source packages with no build step. This app is a
// STANDALONE Expo app (not a member of the root npm `workspaces` globs), so
// Expo roots Metro's file map / server at `mobile/` and scopes file access
// here. Two things make the shared sources consumable:
//
//   1) `scripts/link-shared.js` (run via `postinstall`) symlinks the packages
//      into `mobile/node_modules/@mtt/*`, so the bare `@mtt/*` specifiers
//      resolve from this app's own node_modules (inside the server root).
//   2) `watchFolders` above includes the monorepo root, so Metro crawls and
//      transpiles the real `packages/*/src/*.ts` targets with babel-preset-expo.
//
// `extraNodeModules` is a belt-and-suspenders alias to the package roots for
// tooling that walks the resolver map directly.
config.resolver.extraNodeModules = {
  '@mtt/engine': path.resolve(workspaceRoot, 'packages/engine'),
  '@mtt/theme': path.resolve(workspaceRoot, 'packages/theme'),
};

// The shared packages declare `"exports": { ".": "./src/index.ts" }`. Metro's
// package-`exports` resolution won't select a `.ts` source entry, so disable it
// and fall back to the classic `main`/`module` fields (both src/index.ts).
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
