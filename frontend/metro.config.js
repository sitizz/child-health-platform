const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * react-native-maps is native-only, but expo-router's require.context eagerly
 * pulls in app/(tabs)/map.tsx on every platform, which breaks the web bundle.
 * The web route itself resolves to map.web.tsx, so the native module is never
 * rendered on web and can safely resolve to nothing there.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { type: 'empty' };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
