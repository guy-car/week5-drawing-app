const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('png', 'jpg', 'jpeg', 'gif', 'webp', 'svg');

module.exports = config; 


// Metro is React Native's bundler that packages all JS code and assets
// This config extends Expo's default settings to support additional image formats
// These formats are needed alongside Skia for the drawing app functionality