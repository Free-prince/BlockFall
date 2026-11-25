const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix expo-av CMakeLists.txt for SDK 58+
 * Replaces ReactAndroid::reactnativejni with the correct target
 */
module.exports = function withExpoAvCmakeFix(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const cmakePath = path.join(
        config.modRequest.projectRoot,
        'node_modules/expo-av/android/CMakeLists.txt'
      );

      if (!fs.existsSync(cmakePath)) {
        console.warn('[withExpoAvCmakeFix] CMakeLists.txt not found at:', cmakePath);
        return config;
      }

      let content = fs.readFileSync(cmakePath, 'utf-8');

      // Fix: Replace ReactAndroid::reactnativejni with react-native's exported target
      // In SDK 58+, the target is provided by react-native's CMake config
      const oldTarget = 'ReactAndroid::reactnativejni';
      const newTarget = 'reactnativejni'; // This is exported by react-native's CMake config

      if (content.includes(oldTarget)) {
        content = content.replace(oldTarget, newTarget);
        fs.writeFileSync(cmakePath, content);
        console.log('[withExpoAvCmakeFix] Patched CMakeLists.txt:', oldTarget, '->', newTarget);
      } else if (content.includes(newTarget)) {
        console.log('[withExpoAvCmakeFix] Already patched');
      } else {
        console.warn('[withExpoAvCmakeFix] Target not found, manual fix may be needed');
      }

      return config;
    },
  ]);
};