module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
}; 


// This configuration file is for Babel, a JavaScript/TypeScript compiler
// The expo preset handles React Native specific transformations
// The reanimated plugin is required for smooth animations in the drawing canvas