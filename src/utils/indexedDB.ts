import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { PlayerPosition, PlayerState, HexagonData, ResourceZone, ResourceInventory } from '@/types';

// Database schema
interface HexaConquestDB extends DBSchema {
  playerPositions: {
    key: number;
    value: PlayerPosition;
    indexes: { 'by-timestamp': number };
  };
  playerState: {
    key: string;
    value: PlayerState;
  };
  gameSettings: {
    key: string;
    value: unknown;
  };
  hexagons: {
    key: string; // H3 index
    value: HexagonData;
    indexes: { 'by-conquered': 'conquered'; 'by-conqueredAt': 'conqueredAt' };
  };
  resourceZones: {
    key: string; // H3 index
    value: ResourceZone;
    indexes: { 'by-resourceType': 'resourceType' };
  };
}

const DB_NAME = 'hexaconquest-db';
const DB_VERSION = 3;

let dbInstance: IDBPDatabase<HexaConquestDB> | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDB(): Promise<IDBPDatabase<HexaConquestDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await openDB<HexaConquestDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create player positions store
        if (!db.objectStoreNames.contains('playerPositions')) {
          const positionStore = db.createObjectStore('playerPositions', {
            keyPath: 'timestamp',
          });
          positionStore.createIndex('by-timestamp', 'timestamp');
        }

        // Create player state store
        if (!db.objectStoreNames.contains('playerState')) {
          db.createObjectStore('playerState', {
            keyPath: 'id',
          });
        }

        // Create game settings store
        if (!db.objectStoreNames.contains('gameSettings')) {
          db.createObjectStore('gameSettings');
        }

        // Create hexagons store
        if (!db.objectStoreNames.contains('hexagons')) {
          const hexagonStore = db.createObjectStore('hexagons', {
            keyPath: 'id',
          });
          hexagonStore.createIndex('by-conquered', 'conquered');
          hexagonStore.createIndex('by-conqueredAt', 'conqueredAt');
        }

        // Create resource zones store
        if (!db.objectStoreNames.contains('resourceZones')) {
          const resourceZoneStore = db.createObjectStore('resourceZones', {
            keyPath: 'id',
          });
          resourceZoneStore.createIndex('by-resourceType', 'resourceType');
        }
      },
    });

    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    throw new Error('Database initialization failed');
  }
}

/**
 * Save player position to IndexedDB
 */
export async function savePlayerPosition(position: PlayerPosition): Promise<void> {
  try {
    const db = await initDB();
    await db.add('playerPositions', position);
  } catch (error) {
    console.error('Failed to save player position:', error);
    throw error;
  }
}

/**
 * Get the latest player position from IndexedDB
 */
export async function getLatestPlayerPosition(): Promise<PlayerPosition | null> {
  try {
    const db = await initDB();
    const tx = db.transaction('playerPositions', 'readonly');
    const store = tx.objectStore('playerPositions');
    const index = store.index('by-timestamp');
    
    const cursor = await index.openCursor(null, 'prev');
    return cursor ? cursor.value : null;
  } catch (error) {
    console.error('Failed to get latest player position:', error);
    return null;
  }
}

/**
 * Save player state to IndexedDB
 */
export async function savePlayerState(playerState: PlayerState): Promise<void> {
  try {
    const db = await initDB();
    await db.put('playerState', playerState);
  } catch (error) {
    console.error('Failed to save player state:', error);
    throw error;
  }
}

/**
 * Get player state from IndexedDB
 */
export async function getPlayerState(playerId: string): Promise<PlayerState | null> {
  try {
    const db = await initDB();
    const playerState = await db.get('playerState', playerId);
    return playerState || null;
  } catch (error) {
    console.error('Failed to get player state:', error);
    return null;
  }
}

/**
 * Clear old position data (keep only last 100 positions)
 */
export async function cleanupOldPositions(): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction('playerPositions', 'readwrite');
    const store = tx.objectStore('playerPositions');
    const index = store.index('by-timestamp');
    
    const allKeys = await index.getAllKeys();
    if (allKeys.length > 100) {
      const keysToDelete = allKeys.slice(0, allKeys.length - 100);
      for (const key of keysToDelete) {
        await store.delete(key);
      }
    }
    
    await tx.done;
  } catch (error) {
    console.error('Failed to cleanup old positions:', error);
  }
}

/**
 * Save game setting
 */
export async function saveSetting(key: string, value: unknown): Promise<void> {
  try {
    const db = await initDB();
    await db.put('gameSettings', value, key);
  } catch (error) {
    console.error('Failed to save setting:', error);
    throw error;
  }
}

/**
 * Get game setting
 */
export async function getSetting(key: string): Promise<unknown> {
  try {
    const db = await initDB();
    return await db.get('gameSettings', key);
  } catch (error) {
    console.error('Failed to get setting:', error);
    return null;
  }
}

/**
 * Save hexagon data to IndexedDB
 */
export async function saveHexagon(hexagon: HexagonData): Promise<void> {
  try {
    const db = await initDB();
    
    // Ensure conquered property is always a boolean
    const normalizedHexagon: HexagonData = {
      ...hexagon,
      conquered: Boolean(hexagon.conquered)
    };
    
    await db.put('hexagons', normalizedHexagon);
  } catch (error) {
    console.error('Failed to save hexagon:', error);
    throw error;
  }
}

/**
 * Get hexagon data from IndexedDB
 */
export async function getHexagon(h3Index: string): Promise<HexagonData | null> {
  try {
    const db = await initDB();
    const tx = db.transaction(['hexagons', 'resourceZones'], 'readonly');
    const hexagonStore = tx.objectStore('hexagons');
    const resourceStore = tx.objectStore('resourceZones');
    
    const hexagon = await hexagonStore.get(h3Index);
    const resourceZone = await resourceStore.get(h3Index);
    
    await tx.done;
    
    if (hexagon) {
      // Agregar zona de recursos si existe
      if (resourceZone) {
        hexagon.resourceZone = resourceZone;
      }
      return hexagon;
    } else if (resourceZone) {
      // Crear hexágono básico si solo existe zona de recursos
      return {
        id: h3Index,
        conquered: false,
        center: [0, 0], // Se calculará en el frontend
        resourceZone,
        conquestCost: { wood: 10, iron: 5, stone: 8 },
        maintenanceCost: { wood: 2, iron: 1, stone: 2 }
      };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get hexagon:', error);
    return null;
  }
}

/**
 * Get all conquered hexagons
 */
export async function getConqueredHexagons(): Promise<HexagonData[]> {
  try {
    const db = await initDB();
    const tx = db.transaction('hexagons', 'readonly');
    const store = tx.objectStore('hexagons');
    
    const conqueredHexagons: HexagonData[] = [];
    const cursor = await store.openCursor();
    
    if (cursor) {
      do {
        const hexagon = cursor.value as HexagonData;
        if (hexagon && hexagon.conquered === true) {
          conqueredHexagons.push(hexagon);
        }
      } while (await cursor.continue());
    }
    
    return conqueredHexagons;
  } catch (error) {
    console.error('Failed to get conquered hexagons:', error);
    return [];
  }
}

/**
 * Get multiple hexagons by their H3 indices
 */
export async function getHexagons(h3Indices: string[]): Promise<Map<string, HexagonData>> {
  try {
    const db = await initDB();
    const hexagonMap = new Map<string, HexagonData>();
    
    const tx = db.transaction(['hexagons', 'resourceZones'], 'readonly');
    const hexagonStore = tx.objectStore('hexagons');
    const resourceStore = tx.objectStore('resourceZones');
    
    for (const h3Index of h3Indices) {
      const hexagon = await hexagonStore.get(h3Index);
      const resourceZone = await resourceStore.get(h3Index);
      
      if (hexagon) {
        // Agregar zona de recursos si existe
        if (resourceZone) {
          hexagon.resourceZone = resourceZone;
        }
        hexagonMap.set(h3Index, hexagon);
      } else if (resourceZone) {
        // Crear hexágono básico si solo existe zona de recursos
        const basicHexagon: HexagonData = {
          id: h3Index,
          conquered: false,
          center: [0, 0], // Se calculará en el frontend
          resourceZone,
          conquestCost: { wood: 10, iron: 5, stone: 8 },
          maintenanceCost: { wood: 2, iron: 1, stone: 2 }
        };
        hexagonMap.set(h3Index, basicHexagon);
      }
    }
    
    await tx.done;
    return hexagonMap;
  } catch (error) {
    console.error('Failed to get hexagons:', error);
    return new Map();
  }
}

/**
 * Conquer a hexagon
 */
export async function conquerHexagon(
  h3Index: string,
  conqueredBy: string,
  center: [number, number]
): Promise<void> {
  try {
    const hexagonData: HexagonData = {
      id: h3Index,
      conquered: true,
      conqueredBy,
      conqueredAt: new Date(),
      center,
      conquestCost: { wood: 10, iron: 5, stone: 8 },
      maintenanceCost: { wood: 2, iron: 1, stone: 2 }
    };
    
    await saveHexagon(hexagonData);
  } catch (error) {
    console.error('Failed to conquer hexagon:', error);
    throw error;
  }
}

/**
 * Get hexagon conquest statistics
 */
export async function getHexagonStats(): Promise<{
  total: number;
  conquered: number;
  unconquered: number;
}> {
  try {
    const db = await initDB();
    const tx = db.transaction('hexagons', 'readonly');
    const store = tx.objectStore('hexagons');
    
    const total = await store.count();
    
    // Count conquered hexagons manually to avoid IDBKeyRange issues
    let conquered = 0;
    const cursor = await store.openCursor();
    
    if (cursor) {
      do {
        const hexagon = cursor.value as HexagonData;
        if (hexagon && hexagon.conquered === true) {
          conquered++;
        }
      } while (await cursor.continue());
    }
    
    const unconquered = total - conquered;
    
    return { total, conquered, unconquered };
  } catch (error) {
    console.error('Failed to get hexagon stats:', error);
    return { total: 0, conquered: 0, unconquered: 0 };
  }
}

/**
 * Save player's home base position
 */
export async function savePlayerHomeBase(playerId: string, position: PlayerPosition): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction('gameSettings', 'readwrite');
    const store = tx.objectStore('gameSettings');
    
    await store.put({
      playerId,
      position,
      savedAt: new Date()
    }, `homeBase_${playerId}`);
    
    await tx.done;
  } catch (error) {
    console.error('Failed to save player home base:', error);
    throw error;
  }
}

/**
 * Get player's home base position
 */
export async function getPlayerHomeBase(playerId: string): Promise<PlayerPosition | null> {
  try {
    const db = await initDB();
    const tx = db.transaction('gameSettings', 'readonly');
    const store = tx.objectStore('gameSettings');
    
    const result = await store.get(`homeBase_${playerId}`);
    return (result as { position?: PlayerPosition })?.position || null;
  } catch (error) {
    console.error('Failed to get player home base:', error);
    return null;
  }
}

/**
 * Check if player is far from their home base
 */
export async function isPlayerFarFromHome(
  playerId: string, 
  currentPosition: PlayerPosition, 
  maxDistanceKm: number = 10
): Promise<boolean> {
  try {
    const homeBase = await getPlayerHomeBase(playerId);
    if (!homeBase) return false;
    
    // Calculate distance using Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = (currentPosition.latitude - homeBase.latitude) * Math.PI / 180;
    const dLng = (currentPosition.longitude - homeBase.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(homeBase.latitude * Math.PI / 180) * Math.cos(currentPosition.latitude * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance > maxDistanceKm;
  } catch (error) {
    console.error('Failed to check distance from home:', error);
    return false;
  }
}

/**
 * Save resource zones to IndexedDB
 */
export async function saveResourceZones(resourceZones: ResourceZone[]): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction('resourceZones', 'readwrite');
    const store = tx.objectStore('resourceZones');
    
    for (const zone of resourceZones) {
      await store.put(zone);
    }
    
    await tx.done;
  } catch (error) {
    console.error('Failed to save resource zones:', error);
    throw error;
  }
}

/**
 * Get all resource zones from IndexedDB
 */
export async function getResourceZones(): Promise<ResourceZone[]> {
  try {
    const db = await initDB();
    const tx = db.transaction('resourceZones', 'readonly');
    const store = tx.objectStore('resourceZones');
    
    const zones = await store.getAll();
    return zones;
  } catch (error) {
    console.error('Failed to get resource zones:', error);
    return [];
  }
}

/**
 * Get resource zone by hexagon ID
 */
export async function getResourceZone(hexagonId: string): Promise<ResourceZone | null> {
  try {
    const db = await initDB();
    const tx = db.transaction('resourceZones', 'readonly');
    const store = tx.objectStore('resourceZones');
    
    const zone = await store.get(hexagonId);
    return zone || null;
  } catch (error) {
    console.error('Failed to get resource zone:', error);
    return null;
  }
}

/**
 * Update resource zone after collection
 */
export async function updateResourceZone(zone: ResourceZone): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction('resourceZones', 'readwrite');
    const store = tx.objectStore('resourceZones');
    
    await store.put(zone);
    await tx.done;
  } catch (error) {
    console.error('Failed to update resource zone:', error);
    throw error;
  }
}

/**
 * Update player resources in their state
 */
export async function updatePlayerResources(
  playerId: string, 
  resources: ResourceInventory
): Promise<void> {
  try {
    const playerState = await getPlayerState(playerId);
    if (!playerState) {
      throw new Error('Player state not found');
    }
    
    const updatedState: PlayerState = {
      ...playerState,
      resources
    };
    
    await savePlayerState(updatedState);
  } catch (error) {
    console.error('Failed to update player resources:', error);
    throw error;
  }
}

/**
 * Initialize player with default resources if they don't exist
 */
export async function initializePlayerResources(playerId: string): Promise<ResourceInventory> {
  try {
    const playerState = await getPlayerState(playerId);
    
    if (!playerState || !playerState.resources) {
      const defaultResources: ResourceInventory = {
        wood: 50,
        iron: 30,
        stone: 40
      };
      
      const newPlayerState: PlayerState = {
        id: playerId,
        position: { latitude: 0, longitude: 0, timestamp: Date.now() },
        health: 100,
        score: 0,
        level: 1,
        resources: defaultResources,
        baseHexagon: undefined
      };
      
      await savePlayerState(newPlayerState);
      return defaultResources;
    }
    
    return playerState.resources;
  } catch (error) {
    console.error('Failed to initialize player resources:', error);
    const defaultResources: ResourceInventory = {
      wood: 50,
      iron: 30,
      stone: 40
    };
    return defaultResources;
  }
}

/**
 * Set player base hexagon
 */
export async function setPlayerBase(playerId: string, hexagonId: string): Promise<void> {
  try {
    const playerState = await getPlayerState(playerId);
    if (!playerState) {
      throw new Error('Player state not found');
    }
    
    const updatedState: PlayerState = {
      ...playerState,
      baseHexagon: hexagonId
    };
    
    await savePlayerState(updatedState);
  } catch (error) {
    console.error('Failed to set player base:', error);
    throw error;
  }
}

/**
 * Clear all resource zones (for testing/reset)
 */
export async function clearResourceZones(): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction('resourceZones', 'readwrite');
    const store = tx.objectStore('resourceZones');
    
    await store.clear();
    await tx.done;
  } catch (error) {
    console.error('Failed to clear resource zones:', error);
    throw error;
  }
}

/**
 * Save a single resource zone to IndexedDB
 */
export async function saveResourceZone(zone: ResourceZone): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction('resourceZones', 'readwrite');
    const store = tx.objectStore('resourceZones');
    
    await store.put(zone);
    await tx.done;
  } catch (error) {
    console.error('Failed to save resource zone:', error);
    throw error;
  }
}