const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/**
 * Metro, configured for a monorepo.
 *
 * Metro does not follow symlinks out of the project root by default, and npm
 * workspaces put every shared package in the root `node_modules` as a symlink.
 * Without `watchFolders` and the extra `nodeModulesPaths`, importing
 * `@tickr/core-ui` resolves to a path Metro refuses to read and the bundle
 * fails with a module-not-found that names the package rather than the symlink,
 * which sends you looking in the wrong place.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Hierarchical lookup is deliberately left ON. The usual monorepo advice is to
// disable it as an optimisation, but that is only safe when every dependency is
// hoisted to the root. npm nests when two packages disagree on a version, and
// here it nested `@react-native/virtualized-lists` under `react-native` itself,
// so `react-native/Libraries/Modal` importing it failed to resolve and the app
// died on a red box before the first screen. With the lookup enabled Metro
// walks up into the nested directory and finds it, and the extra paths above
// are still what make the workspace packages resolve.

module.exports = config;
