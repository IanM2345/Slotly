// <repo-root>/babel.config.js  (or apps/mobile/babel.config.js)
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'expo-router/babel',
      'react-native-reanimated/plugin' // <-- MUST be last
    ],
  };
};
