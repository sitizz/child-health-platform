// Overlays the static app.json with values that must come from the environment
// and stay out of source control. Expo reads app.json first and passes it in as
// `config`, so everything else in app.json is preserved untouched.
//
// GOOGLE_MAPS_API_KEY becomes the com.google.android.geo.API_KEY manifest entry
// that react-native-maps requires on Android (iOS uses Apple Maps and needs no
// key). It is applied at build time — changing it requires a new build.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...(config.android && config.android.config),
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
  },
  extra: {
    ...config.extra,
    // A boolean the app can read at runtime (never the key itself) so the Map
    // screen can avoid mounting the native MapView when no key is configured —
    // otherwise Google Maps throws an uncatchable native IllegalStateException.
    hasGoogleMapsKey: Boolean(process.env.GOOGLE_MAPS_API_KEY),
  },
});
