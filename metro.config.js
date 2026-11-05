const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Alias react-dom to react-native-web for React Native compatibility
config.resolver.alias = {
  ...config.resolver.alias,
  'react-dom': 'react-native-web',
};

module.exports = config;