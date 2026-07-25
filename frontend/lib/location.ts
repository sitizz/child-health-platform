import * as Location from 'expo-location';

import { ApiError } from './api';

/** Requests permission and returns the current coordinates, or throws ApiError. */
export async function getCurrentCoords(): Promise<{ lat: number; lon: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new ApiError(
      0,
      'Location permission is needed to check local environmental risk. Please enable it in Settings.'
    );
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return { lat: location.coords.latitude, lon: location.coords.longitude };
}
