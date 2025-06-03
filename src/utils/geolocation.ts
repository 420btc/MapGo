import type { PlayerPosition, GeolocationError } from '@/types';
import { savePlayerPosition } from './indexedDB';

/**
 * Get current position using browser geolocation API
 */
export function getCurrentPosition(): Promise<PlayerPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 0,
        message: 'Geolocation is not supported by this browser'
      } as GeolocationError);
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000 // Cache position for 1 minute
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const playerPosition: PlayerPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: position.coords.accuracy
        };
        resolve(playerPosition);
      },
      (error) => {
        const geolocationError: GeolocationError = {
          code: error.code,
          message: getGeolocationErrorMessage(error.code)
        };
        reject(geolocationError);
      },
      options
    );
  });
}

/**
 * Watch position changes and automatically save to IndexedDB
 */
export function watchPosition(
  onSuccess: (position: PlayerPosition) => void,
  onError: (error: GeolocationError) => void
): number | null {
  if (!navigator.geolocation) {
    onError({
      code: 0,
      message: 'Geolocation is not supported by this browser'
    });
    return null;
  }

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 30000 // Cache position for 30 seconds
  };

  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const playerPosition: PlayerPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: Date.now(),
        accuracy: position.coords.accuracy
      };
      
      try {
        // Save to IndexedDB
        await savePlayerPosition(playerPosition);
        onSuccess(playerPosition);
      } catch (error) {
        console.error('Failed to save position:', error);
        onSuccess(playerPosition); // Still call success even if save fails
      }
    },
    (error) => {
      const geolocationError: GeolocationError = {
        code: error.code,
        message: getGeolocationErrorMessage(error.code)
      };
      onError(geolocationError);
    },
    options
  );

  return watchId;
}

/**
 * Stop watching position
 */
export function clearWatch(watchId: number): void {
  if (navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Get user-friendly error message for geolocation errors
 */
function getGeolocationErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return 'Location access denied by user. Please enable location permissions.';
    case 2:
      return 'Location information is unavailable. Please check your connection.';
    case 3:
      return 'Location request timed out. Please try again.';
    default:
      return 'An unknown error occurred while retrieving location.';
  }
}

/**
 * Check if geolocation is available
 */
export function isGeolocationAvailable(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Request permission for geolocation (for browsers that support it)
 */
export async function requestGeolocationPermission(): Promise<PermissionState> {
  if ('permissions' in navigator) {
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return permission.state;
    } catch (error) {
      console.warn('Permission API not supported:', error);
      return 'prompt';
    }
  }
  return 'prompt';
}

/**
 * Calculate distance between two positions (in meters)
 */
export function calculateDistance(
  pos1: { latitude: number; longitude: number },
  pos2: { latitude: number; longitude: number }
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (pos1.latitude * Math.PI) / 180;
  const φ2 = (pos2.latitude * Math.PI) / 180;
  const Δφ = ((pos2.latitude - pos1.latitude) * Math.PI) / 180;
  const Δλ = ((pos2.longitude - pos1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}