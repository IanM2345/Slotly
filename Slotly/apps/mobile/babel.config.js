module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Map "@/..." to project root of the app
      ['module-resolver', {
        root: ['./'],
        alias: { '@': './' },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
      }],

      // Use the new worklets plugin (replaces react-native-reanimated/plugin)
      'react-native-worklets/plugin',
    ],
  };
};
