/**
 * Babel, and the one plugin that is not optional.
 *
 * `react-native-reanimated/plugin` has to be last in the list. It rewrites the
 * functions marked `'worklet'` into something the UI thread can run, and if it
 * runs before another plugin has transformed the file it silently fails to find
 * them, which shows up as animations that do nothing rather than as a build
 * error. Reanimated 4 keeps the plugin name for compatibility even though the
 * worklet runtime moved.
 */
module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: ['react-native-reanimated/plugin'],
  };
};
