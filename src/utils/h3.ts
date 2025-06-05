import { latLngToCell, cellToBoundary, gridDisk, cellToLatLng } from 'h3-js';
import type { PlayerPosition, HexagonData, H3Config, ResourceType, ResourceZone, ResourceCost, ResourceInventory } from '@/types';

// Configuración por defecto para H3
export const DEFAULT_H3_CONFIG: H3Config = {
  resolution: 9, // ~50-100 metros por hexágono
  fillColor: '#60a5fa', // Azul claro transparente para hexágonos no conquistados
  strokeColor: '#e0e7ff', // Líneas azul claro más sutiles
  conqueredColor: '#22c55e', // Verde brillante para conquistados
  currentHexColor: '#fbbf24', // Amarillo dorado para hexágono actual
  fillOpacity: 0.4, // Transparencia del 40% para mejor visibilidad
  strokeWidth: 1, // Líneas más finas
  maxRadius: 5, // Radio máximo de 5 hexágonos desde el jugador
  maxHexagons: 200, // Máximo 200 hexágonos visibles
  enableLocalMode: true // Modo local habilitado por defecto
};

/**
 * Convierte coordenadas lat/lng a índice H3
 */
export function getH3Index(lat: number, lng: number, resolution: number = 9): string {
  try {
    // Validar coordenadas
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error(`Invalid coordinates: lat=${lat}, lng=${lng}`);
    }
    
    // Validar resolución
    if (resolution < 0 || resolution > 15) {
      throw new Error(`Invalid resolution: ${resolution}. Must be between 0 and 15`);
    }
    
    const h3Index = latLngToCell(lat, lng, resolution);
    
    // Validar el índice generado
    if (!h3Index || h3Index.length === 0) {
      throw new Error('Failed to generate H3 index');
    }
    
    return h3Index;
  } catch (error) {
    console.error('Error getting H3 index:', error);
    console.error('Parameters:', { lat, lng, resolution });
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
    
    // Debug: verificar que tengamos al menos 6 puntos (hexágono)
    if (boundary.length < 6) {
      console.error(`❌ Invalid boundary for ${h3Index}: only ${boundary.length} points`);
      throw new Error('Invalid hexagon boundary');
    }
    
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
    console.log(`🔵 Generating hexagons: center(${centerLat}, ${centerLng}), radius=${radius}, resolution=${resolution}`);
    
    // Validar coordenadas
    if (isNaN(centerLat) || isNaN(centerLng)) {
      console.error('❌ Invalid coordinates:', { centerLat, centerLng });
      return [];
    }
    
    const centerH3 = getH3Index(centerLat, centerLng, resolution);
    console.log('📍 Center H3 index:', centerH3);
    
    const hexagons = gridDisk(centerH3, radius);
    console.log(`✅ Generated ${hexagons.length} hexagons`);
    
    return hexagons;
  } catch (error) {
    console.error('❌ Error generating hexagons in radius:', error);
    return [];
  }
}

/**
 * Convierte hexágonos H3 a formato GeoJSON para Mapbox
 */
export function hexagonsToGeoJSON(
  hexagons: string[],
  hexagonDataMap: Map<string, HexagonData>
): GeoJSON.FeatureCollection {
  console.log(`🔵 Converting ${hexagons.length} hexagons to GeoJSON`);
  
  if (!hexagons || hexagons.length === 0) {
    console.warn('⚠️ No hexagons to convert to GeoJSON');
    return {
      type: 'FeatureCollection' as const,
      features: []
    };
  }
  
  const features: GeoJSON.Feature[] = hexagons.map((h3Index, index) => {
    try {
      const boundary = getHexagonBoundary(h3Index);
      const center = h3ToLatLng(h3Index);
      const hexData = hexagonDataMap.get(h3Index);
      
      if (index < 3) {
        console.log(`Sample hexagon ${index + 1}:`, {
          h3Index,
          center,
          boundaryPoints: boundary.length,
          hasData: !!hexData
        });
      }
      
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
    } catch (error) {
      console.error(`❌ Error processing hexagon ${h3Index}:`, error);
      return null;
    }
  }).filter(feature => feature !== null) as GeoJSON.Feature[];

  console.log(`✅ Created ${features.length} valid features`);
  
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
    console.log(`🔵 Getting hexagons in player radius:`, {
      position: playerPosition,
      maxRadius: config.maxRadius,
      resolution: config.resolution
    });
    
    const centerH3 = getCurrentHexagon(playerPosition, config.resolution);
    console.log('📍 Player H3 index:', centerH3);
    
    const hexagons = gridDisk(centerH3, config.maxRadius);
    console.log(`✅ Generated ${hexagons.length} hexagons around player`);
    
    // Limita el número máximo de hexágonos
    if (hexagons.length > config.maxHexagons) {
      console.log(`⚠️ Limiting hexagons from ${hexagons.length} to ${config.maxHexagons}`);
      return hexagons.slice(0, config.maxHexagons);
    }
    
    return hexagons;
  } catch (error) {
    console.error('❌ Error getting hexagons in player radius:', error);
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

/**
 * Genera zonas de recursos aleatorias en hexágonos
 */
export function generateResourceZones(
  hexagons: string[],
  count: number = 8
): ResourceZone[] {
  const resourceTypes: ResourceType[] = ['wood', 'iron', 'stone'];
  const resourceZones: ResourceZone[] = [];
  
  // Selecciona hexágonos aleatorios para zonas de recursos
  const shuffledHexagons = [...hexagons].sort(() => Math.random() - 0.5);
  const selectedHexagons = shuffledHexagons.slice(0, Math.min(count, hexagons.length));
  
  selectedHexagons.forEach(hexId => {
    const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
    const baseAmount = getResourceBaseAmount(resourceType);
    
    resourceZones.push({
      id: hexId,
      resourceType,
      amount: baseAmount + Math.floor(Math.random() * baseAmount),
      regenerationRate: getResourceRegenRate(resourceType),
      lastRegeneration: new Date()
    });
  });
  
  return resourceZones;
}

/**
 * Obtiene la cantidad base de recursos por tipo
 */
export function getResourceBaseAmount(resourceType: ResourceType): number {
  switch (resourceType) {
    case 'wood': return 50;
    case 'iron': return 30;
    case 'stone': return 40;
    default: return 30;
  }
}

/**
 * Obtiene la tasa de regeneración por tipo de recurso (por hora)
 */
function getResourceRegenRate(resourceType: ResourceType): number {
  switch (resourceType) {
    case 'wood': return 10;
    case 'iron': return 5;
    case 'stone': return 8;
    default: return 5;
  }
}

/**
 * Genera costos aleatorios para conquistar un hexágono
 */
export function generateHexagonConquestCost(): ResourceCost {
  return {
    wood: Math.floor(Math.random() * 10) + 5,
    iron: Math.floor(Math.random() * 8) + 3,
    stone: Math.floor(Math.random() * 12) + 8
  };
}

/**
 * Genera costos de mantenimiento para un hexágono
 */
export function generateHexagonMaintenanceCost(): ResourceCost {
  return {
    wood: Math.floor(Math.random() * 3) + 2,
    iron: Math.floor(Math.random() * 2) + 1,
    stone: Math.floor(Math.random() * 4) + 3
  };
}

/**
 * Verifica si el jugador tiene suficientes recursos
 */
export function hasEnoughResources(
  playerResources: ResourceInventory,
  requiredResources: ResourceCost
): boolean {
  return (
    playerResources.wood >= (requiredResources.wood || 0) &&
    playerResources.iron >= (requiredResources.iron || 0) &&
    playerResources.stone >= (requiredResources.stone || 0)
  );
}

/**
 * Resta recursos del inventario del jugador
 */
export function subtractResources(
  playerResources: ResourceInventory,
  cost: ResourceCost
): ResourceInventory {
  return {
    wood: playerResources.wood - (cost.wood || 0),
    iron: playerResources.iron - (cost.iron || 0),
    stone: playerResources.stone - (cost.stone || 0)
  };
}

/**
 * Suma recursos al inventario del jugador
 */
export function addResources(
  playerResources: ResourceInventory,
  resources: ResourceCost
): ResourceInventory {
  return {
    wood: playerResources.wood + (resources.wood || 0),
    iron: playerResources.iron + (resources.iron || 0),
    stone: playerResources.stone + (resources.stone || 0)
  };
}

/**
 * Obtiene la configuración de base por nivel
 */
export function getBaseConfig(level: 1 | 2) {
  switch (level) {
    case 1:
      return {
        name: 'Choza',
        maxHealth: 100,
        resourceGeneration: { wood: 3, iron: 2, stone: 2 } as ResourceInventory,
        maintenanceCost: { wood: 5, iron: 3, stone: 4 } as ResourceInventory,
        upgradeCost: { wood: 50, iron: 30, stone: 40 } as ResourceCost
      };
    case 2:
      return {
        name: 'Fortaleza',
        maxHealth: 250,
        resourceGeneration: { wood: 8, iron: 6, stone: 7 } as ResourceInventory,
        maintenanceCost: { wood: 12, iron: 8, stone: 10 } as ResourceInventory,
        upgradeCost: null
      };
    default:
      return getBaseConfig(1);
  }
}