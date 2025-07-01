const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add Skia support
config.resolver.assetExts.push('png', 'jpg', 'jpeg', 'gif', 'webp', 'svg');

module.exports = config; 