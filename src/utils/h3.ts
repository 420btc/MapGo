import { latLngToCell, cellToBoundary, gridDisk, cellToLatLng } from 'h3-js';
import type { PlayerPosition, HexagonData, H3Config } from '@/types';

// Configuración por defecto para H3
export const DEFAULT_H3_CONFIG: H3Config = {
  resolution: 9, // ~50-100 metros por hexágono
  fillColor: '#3b82f6',
  strokeColor: '#1e40af',
  conqueredColor: '#10b981',
  currentHexColor: '#f59e0b',
  fillOpacity: 0.3,
  strokeWidth: 2,
  maxRadius: 5, // Radio máximo de 5 hexágonos desde el jugador
  maxHexagons: 200, // Máximo 200 hexágonos visibles
  enableLocalMode: true // Modo local habilitado por defecto
};

/**
 * Convierte coordenadas lat/lng a índice H3
 */
export function getH3Index(lat: number, lng: number, resolution: number = 9): string {
  try {
    return latLngToCell(lat, lng, resolution);
  } catch (error) {
    console.error('Error getting H3 index:', error);
    throw new Error('Failed to get H3 index');
  }
}

/**
 * Obtiene el hexágono actual basado en la posición del usuario
 */
export function getCurrentHexagon(position: PlayerPosition, resolution: number = 9): string {
  return getH3Index(position.latitude, position.longitude, resolution);
}

/**
 * Convierte un índice H3 a coordenadas del centro
 */
export function h3ToLatLng(h3Index: string): [number, number] {
  try {
    const [lat, lng] = cellToLatLng(h3Index);
    return [lng, lat]; // Retorna [lng, lat] para Mapbox
  } catch (error) {
    console.error('Error converting H3 to lat/lng:', error);
    throw new Error('Failed to convert H3 to coordinates');
  }
}

/**
 * Obtiene los límites de un hexágono como array de coordenadas
 */
export function getHexagonBoundary(h3Index: string): number[][] {
  try {
    const boundary = cellToBoundary(h3Index);
    // Convierte de [lat, lng] a [lng, lat] para Mapbox y cierra el polígono
    const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
    coordinates.push(coordinates[0]); // Cierra el polígono
    return coordinates;
  } catch (error) {
    console.error('Error getting hexagon boundary:', error);
    throw new Error('Failed to get hexagon boundary');
  }
}

/**
 * Genera hexágonos en un radio alrededor de un punto central
 */
export function generateHexagonsInRadius(
  centerLat: number,
  centerLng: number,
  radius: number = 3,
  resolution: number = 9
): string[] {
  try {
    const centerH3 = getH3Index(centerLat, centerLng, resolution);
    return gridDisk(centerH3, radius);
  } catch (error) {
    console.error('Error generating hexagons in radius:', error);
    throw new Error('Failed to generate hexagons');
  }
}

/**
 * Convierte hexágonos H3 a formato GeoJSON para Mapbox
 */
export function hexagonsToGeoJSON(
  hexagons: string[],
  hexagonDataMap: Map<string, HexagonData>
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = hexagons.map(h3Index => {
    const boundary = getHexagonBoundary(h3Index);
    const center = h3ToLatLng(h3Index);
    const hexData = hexagonDataMap.get(h3Index);
    
    return {
      type: 'Feature' as const,
      properties: {
        h3Index,
        conquered: hexData?.conquered || false,
        conqueredBy: hexData?.conqueredBy,
        conqueredAt: hexData?.conqueredAt,
        center
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [boundary]
      }
    };
  });

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Calcula la distancia aproximada entre dos hexágonos H3
 */
export function getHexagonDistance(h3Index1: string, h3Index2: string): number {
  try {
    const [lat1, lng1] = cellToLatLng(h3Index1);
    const [lat2, lng2] = cellToLatLng(h3Index2);
    
    // Fórmula de Haversine para calcular distancia
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  } catch (error) {
    console.error('Error calculating hexagon distance:', error);
    return Infinity;
  }
}

/**
 * Valida si un índice H3 es válido
 */
export function isValidH3Index(h3Index: string): boolean {
  try {
    cellToLatLng(h3Index);
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtiene hexágonos limitados por radio desde la posición del jugador
 */
export function getHexagonsInPlayerRadius(
  playerPosition: PlayerPosition,
  config: H3Config
): string[] {
  try {
    const centerH3 = getCurrentHexagon(playerPosition, config.resolution);
    const hexagons = gridDisk(centerH3, config.maxRadius);
    
    // Limita el número máximo de hexágonos
    if (hexagons.length > config.maxHexagons) {
      return hexagons.slice(0, config.maxHexagons);
    }
    
    return hexagons;
  } catch (error) {
    console.error('Error getting hexagons in player radius:', error);
    return [];
  }
}

/**
 * Obtiene hexágonos visibles en un bounding box
 */
export function getHexagonsInBounds(
  north: number,
  south: number,
  east: number,
  west: number,
  resolution: number = 9,
  playerPosition?: PlayerPosition,
  config?: H3Config
): string[] {
  try {
    // Si está habilitado el modo local y tenemos la posición del jugador, usar radio limitado
    if (config?.enableLocalMode && playerPosition) {
      return getHexagonsInPlayerRadius(playerPosition, config);
    }
    
    // Modo tradicional: generar hexágonos en el bounding box
    const hexagons = new Set<string>();
    
    // Genera una cuadrícula de puntos y obtiene sus hexágonos
    const latStep = (north - south) / 20;
    const lngStep = (east - west) / 20;
    
    for (let lat = south; lat <= north; lat += latStep) {
      for (let lng = west; lng <= east; lng += lngStep) {
        const h3Index = getH3Index(lat, lng, resolution);
        hexagons.add(h3Index);
        
        // Agrega hexágonos vecinos para mejor cobertura
        const neighbors = gridDisk(h3Index, 1);
        neighbors.forEach(neighbor => hexagons.add(neighbor));
      }
    }
    
    const result = Array.from(hexagons);
    
    // Aplica límite máximo si está configurado
    if (config?.maxHexagons && result.length > config.maxHexagons) {
      return result.slice(0, config.maxHexagons);
    }
    
    return result;
  } catch (error) {
    console.error('Error getting hexagons in bounds:', error);
    return [];
  }
}