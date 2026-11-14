module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54+) adds the react-native-worklets Babel
    // plugin automatically when the package is installed, so Reanimated 4
    // needs no explicit plugin entry here (listing it again would run it twice).
    presets: ['babel-preset-expo'],
  };
};
