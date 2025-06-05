'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PlayerPosition, PlayerState, GeolocationError, HUDData, HexagonData, H3Config, ResourceInventory, ResourceZone, ResourceType } from '@/types';
import {
  getCurrentPosition,
  watchPosition,
  clearWatch,
  isGeolocationAvailable,
  requestGeolocationPermission
} from '@/utils/geolocation';
import {
  initDB,
  savePlayerPosition,
  getLatestPlayerPosition,
  savePlayerState,
  getPlayerState,
  cleanupOldPositions,
  saveHexagon,
  getHexagon,
  getHexagons,
  conquerHexagon,
  getHexagonStats,
  savePlayerHomeBase,
  getPlayerHomeBase,
  isPlayerFarFromHome,
  getResourceZones,
  getResourceZone,
  saveResourceZones,
  saveResourceZone,
  updateResourceZone,
  updatePlayerResources,
  setPlayerBase,
  clearResourceZones
} from '@/utils/indexedDB';
import {
  getCurrentHexagon,
  DEFAULT_H3_CONFIG,
  generateResourceZones,
  generateHexagonConquestCost,
  generateHexagonMaintenanceCost,
  hasEnoughResources,
  subtractResources,
  addResources,
  getResourceBaseAmount,
  generateHexagonsInRadius,
  getH3Index,
  h3ToLatLng
} from '@/utils/h3';

interface UseGameStateReturn {
  position: PlayerPosition | null;
  playerState: PlayerState | null;
  hudData: HUDData | null;
  currentHexagon: string | null;
  hexagonData: HexagonData | null;
  hexagonStats: { total: number; conquered: number } | null;
  homeBase: PlayerPosition | null;
  isAwayFromHome: boolean;
  isLoading: boolean;
  error: string | null;
  connectionStatus: 'online' | 'offline';
  resourceZones: ResourceZone[];
  initializeGame: () => Promise<void>;
  updatePlayerHealth: (health: number) => void;
  updatePlayerScore: (score: number) => void;
  refreshPosition: () => Promise<void>;
  conquerCurrentHexagon: () => Promise<boolean>;
  getHexagonInfo: (h3Index: string) => Promise<HexagonData | null>;
  setHomeBase: (position?: PlayerPosition) => Promise<void>;
  resetToHomeBase: () => Promise<void>;
  collectResources: (hexagonId: string) => Promise<boolean>;
  establishBase: (hexagonId: string) => Promise<boolean>;
  upgradeBase: (hexagonId: string) => Promise<boolean>;
  initializeResourceZones: (hexagons: string[]) => Promise<void>;
}

const DEFAULT_PLAYER_STATE: Omit<PlayerState, 'id' | 'position'> = {
  health: 100,
  score: 0,
  level: 1,
  resources: {
    wood: 50,
    iron: 30,
    stone: 40
  },
  baseHexagon: undefined
};

const PLAYER_ID = 'main-player';

export function useGameState(h3Config: H3Config = DEFAULT_H3_CONFIG): UseGameStateReturn {
  const [position, setPosition] = useState<PlayerPosition | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [currentHexagon, setCurrentHexagon] = useState<string | null>(null);
  const [hexagonData, setHexagonData] = useState<HexagonData | null>(null);
  const [hexagonStats, setHexagonStats] = useState<{ total: number; conquered: number } | null>(null);
  const [homeBase, setHomeBase] = useState<PlayerPosition | null>(null);
  const [isAwayFromHome, setIsAwayFromHome] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('offline');
  const [resourceZones, setResourceZones] = useState<ResourceZone[]>([]);
  const watchId = useRef<number | null>(null);
  const cleanupInterval = useRef<NodeJS.Timeout | null>(null);

  // Check online status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setConnectionStatus(navigator.onLine ? 'online' : 'offline');
    };

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Initialize game state
  const initializeGame = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentPosition = await getCurrentPosition();
      setPosition(currentPosition);

      // Try to load existing player state
      let existingPlayerState = await getPlayerState('default-player');
      
      if (!existingPlayerState) {
        // Create new player
        existingPlayerState = {
          id: 'default-player',
          position: currentPosition,
          health: 100,
          score: 0,
          level: 1,
          resources: { wood: 50, iron: 25, stone: 40 }
        };
        
        await savePlayerState(existingPlayerState);
        console.log('✅ New player created');
        
        // Generate initial resource zones for new player
        const initialResourceZones = await generateInitialResourceZones(currentPosition);
        setResourceZones(initialResourceZones);
        
        // Save resource zones to IndexedDB
        await saveResourceZones(initialResourceZones);
        console.log('✅ Initial resource zones generated and saved');
      } else {
        // Load existing resource zones
        const existingResourceZones = await getResourceZones();
        
        if (existingResourceZones.length === 0) {
          // No resource zones exist, generate them
          console.log('🔄 No resource zones found, generating new ones...');
          const newResourceZones = await generateInitialResourceZones(currentPosition);
          setResourceZones(newResourceZones);
          await saveResourceZones(newResourceZones);
          console.log('✅ New resource zones generated for existing player');
        } else {
          setResourceZones(existingResourceZones);
          console.log(`✅ Loaded ${existingResourceZones.length} existing resource zones`);
        }
      }

      setPlayerState(existingPlayerState);
      await updateCurrentHexagon(currentPosition);

      // Load hexagon stats
      const stats = await getHexagonStats();
      setHexagonStats(stats);

      // Load home base
      const homeBasePosition = await getPlayerHomeBase(existingPlayerState.id);
      if (homeBasePosition) {
        setHomeBase(homeBasePosition);
        const isAway = await isPlayerFarFromHome(existingPlayerState.id, currentPosition, 5);
        setIsAwayFromHome(isAway);
      }

      console.log('✅ Game state initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize game state:', error);
      setError('Failed to initialize game state');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update player health
  const updatePlayerHealth = useCallback(async (health: number) => {
    if (!playerState) return;

    const updatedState = {
      ...playerState,
      health: Math.max(0, Math.min(100, health))
    };
    
    setPlayerState(updatedState);
    await savePlayerState(updatedState);
  }, [playerState]);

  // Update player score
  const updatePlayerScore = useCallback(async (score: number) => {
    if (!playerState) return;

    const updatedState = {
      ...playerState,
      score: Math.max(0, score)
    };
    
    setPlayerState(updatedState);
    await savePlayerState(updatedState);
  }, [playerState]);

  // Update current hexagon
  const updateCurrentHexagon = useCallback(async (newPosition: PlayerPosition) => {
    try {
      const h3Index = getCurrentHexagon(newPosition, h3Config.resolution);
      setCurrentHexagon(h3Index);
      
      // Get hexagon data
      const hexData = await getHexagon(h3Index);
      setHexagonData(hexData);
      
      // Update hexagon stats
      const stats = await getHexagonStats();
      setHexagonStats(stats);
    } catch (err) {
      console.error('Error updating current hexagon:', err);
    }
  }, [h3Config.resolution]);

  // Refresh position manually
  const refreshPosition = useCallback(async () => {
    try {
      setError(null);
      const newPosition = await getCurrentPosition();
      setPosition(newPosition);
      
      // Update current hexagon
      await updateCurrentHexagon(newPosition);
      
      if (playerState) {
        const updatedState = {
          ...playerState,
          position: newPosition
        };
        setPlayerState(updatedState);
        await savePlayerState(updatedState);
        
        // Check if player is away from home
        if (homeBase) {
          const isAway = await isPlayerFarFromHome(playerState.id, newPosition, 5);
          setIsAwayFromHome(isAway);
        }
      }
    } catch (err) {
      const errorMessage = err && typeof err === 'object' && 'code' in err && 'message' in err
        ? (err as GeolocationError).message 
        : 'Failed to get current position';
      setError(errorMessage);
    }
  }, [playerState, homeBase, updateCurrentHexagon]);

  // Conquer current hexagon
  const conquerCurrentHexagon = useCallback(async (): Promise<boolean> => {
    if (!currentHexagon || !playerState || !position) {
      return false;
    }

    try {
      // Check if hexagon is already conquered
      const existingHexData = await getHexagon(currentHexagon);
      if (existingHexData && existingHexData.conquered) {
        return false; // Already conquered
      }

      // Check if player has enough resources to conquer
      const conquestCost = { wood: 10, iron: 5, stone: 8 };
      const currentResources = playerState.resources || { wood: 0, iron: 0, stone: 0 };
      
      if (!hasEnoughResources(currentResources, conquestCost)) {
        console.log('Not enough resources to conquer hexagon');
        return false;
      }

      // Deduct resources for conquest
      const newResources = subtractResources(currentResources, conquestCost);
      await updatePlayerResources(playerState.id, newResources);
      
      // Update local state
      setPlayerState(prev => prev ? { 
        ...prev, 
        resources: newResources
      } : null);

      await conquerHexagon(currentHexagon, playerState.id, [position.longitude, position.latitude]);
      
      // Update hexagon data
      const updatedHexData = await getHexagon(currentHexagon);
      setHexagonData(updatedHexData);
      
      // Update stats
      const stats = await getHexagonStats();
      setHexagonStats(stats);
      
      // Update player score
      await updatePlayerScore(playerState.score + 10);
      
      return true;
    } catch (err) {
      console.error('Error conquering hexagon:', err);
      return false;
    }
  }, [currentHexagon, playerState, position, updatePlayerScore]);

  // Get hexagon information
  const getHexagonInfo = useCallback(async (h3Index: string): Promise<HexagonData | null> => {
    try {
      return await getHexagon(h3Index);
    } catch (err) {
      console.error('Error getting hexagon info:', err);
      return null;
    }
  }, []);

  // Set home base
  const setHomeBaseFunction = useCallback(async (position?: PlayerPosition) => {
    try {
      const basePosition = position || (await getCurrentPosition());
      if (playerState) {
        await savePlayerHomeBase(playerState.id, basePosition);
        setHomeBase(basePosition);
        setIsAwayFromHome(false);
      }
    } catch (err) {
      console.error('Error setting home base:', err);
    }
  }, [playerState]);

  // Reset to home base
  const resetToHomeBase = useCallback(async () => {
    if (homeBase) {
      setPosition(homeBase);
      await updateCurrentHexagon(homeBase);
      setIsAwayFromHome(false);
    }
  }, [homeBase, updateCurrentHexagon]);

  // Create HUD data
  const hudData: HUDData | null = position && playerState ? {
    position,
    playerState,
    connectionStatus
  } : null;

  // Initialize resource zones
  const initializeResourceZones = useCallback(async (hexagons: string[]) => {
    try {
      console.log('🔵 Initializing resource zones for hexagons:', hexagons.length);
      
      // Always clear existing zones and generate new ones
      console.log('🧹 Clearing existing resource zones...');
      await clearResourceZones();
      
      // Generate new resource zones
      console.log('🔨 Generating new resource zones...');
      const newZones = generateResourceZones(hexagons, 8);
      console.log('💾 Saving', newZones.length, 'new resource zones:', newZones);
      
      await saveResourceZones(newZones);
      setResourceZones(newZones);
      console.log('✅ Resource zones initialized successfully with', newZones.length, 'zones');
    } catch (err) {
      console.error('❌ Error initializing resource zones:', err);
    }
  }, []);

  // Collect resources from a hexagon
  const collectResources = useCallback(async (hexagonId: string): Promise<boolean> => {
    try {
      if (!playerState) return false;

      const resourceZone = await getResourceZone(hexagonId);
      if (!resourceZone || resourceZone.amount <= 0) {
        return false;
      }

      // Calculate collection amount (10-30% of available resources)
      const collectionRate = 0.1 + Math.random() * 0.2;
      const collectedAmount = Math.floor(resourceZone.amount * collectionRate);
      
      if (collectedAmount <= 0) return false;

      // Update player resources
      const currentResources = playerState.resources || { wood: 0, iron: 0, stone: 0 };
      const newResources = addResources(currentResources, {
        [resourceZone.resourceType]: collectedAmount
      } as any);

      await updatePlayerResources(playerState.id, newResources);
      
      // Update resource zone
      const updatedZone: ResourceZone = {
        ...resourceZone,
        amount: resourceZone.amount - collectedAmount,
        lastRegeneration: new Date()
      };
      
      await updateResourceZone(updatedZone);
      
      // Update local state
      setPlayerState(prev => prev ? { ...prev, resources: newResources } : null);
      setResourceZones(prev => prev.map(zone => 
        zone.id === hexagonId ? updatedZone : zone
      ));

      return true;
    } catch (err) {
      console.error('Error collecting resources:', err);
      return false;
    }
  }, [playerState]);

  // Establish a base on a hexagon
  const establishBase = useCallback(async (hexagonId: string): Promise<boolean> => {
    try {
      if (!playerState) return false;

      // Check if hexagon is conquered
      const hexData = await getHexagon(hexagonId);
      if (!hexData || !hexData.conquered) {
        return false;
      }

      // Check if player already has a base
      if (playerState.baseHexagon) {
        return false;
      }

      // Check resource requirements for base establishment
      const baseCost = { wood: 30, iron: 20, stone: 25 };
      const currentResources = playerState.resources || { wood: 0, iron: 0, stone: 0 };
      
      if (!hasEnoughResources(currentResources, baseCost)) {
        return false;
      }

      // Deduct resources
      const newResources = subtractResources(currentResources, baseCost);
      await updatePlayerResources(playerState.id, newResources);
      
      // Set base
      await setPlayerBase(playerState.id, hexagonId);
      
      // Update hexagon with base
      const defaultHexData: HexagonData = {
        id: hexagonId,
        conquered: true,
        conqueredBy: playerState.id,
        conqueredAt: new Date(),
        center: [0, 0],
        conquestCost: { wood: 10, iron: 5, stone: 8 },
        maintenanceCost: { wood: 2, iron: 1, stone: 2 }
      };
      
      const updatedHexData: HexagonData = {
        ...defaultHexData,
        ...hexData,
        base: {
          id: hexagonId,
          playerId: playerState.id,
          level: 1,
          health: 100,
          maxHealth: 100,
          lastMaintenance: new Date(),
          resourceGeneration: { wood: 5, iron: 3, stone: 4 },
          maintenanceCost: { wood: 2, iron: 1, stone: 2 }
        }
      };
      
      // Update local state
      setPlayerState(prev => prev ? { 
        ...prev, 
        resources: newResources,
        baseHexagon: hexagonId 
      } : null);

      return true;
    } catch (err) {
      console.error('Error establishing base:', err);
      return false;
    }
  }, [playerState]);

  // Upgrade base
  const upgradeBase = useCallback(async (hexagonId: string): Promise<boolean> => {
    try {
      if (!playerState || playerState.baseHexagon !== hexagonId) {
        return false;
      }

      const hexData = await getHexagon(hexagonId);
      if (!hexData || !hexData.base || hexData.base.level >= 2) {
        return false;
      }

      // Check upgrade cost
      const upgradeCost = { wood: 50, iron: 30, stone: 40 };
      const currentResources = playerState.resources || { wood: 0, iron: 0, stone: 0 };
      
      if (!hasEnoughResources(currentResources, upgradeCost)) {
        return false;
      }

      // Deduct resources and upgrade
      const newResources = subtractResources(currentResources, upgradeCost);
      await updatePlayerResources(playerState.id, newResources);
      
      // Update local state
      setPlayerState(prev => prev ? { 
        ...prev, 
        resources: newResources
      } : null);

      return true;
    } catch (err) {
      console.error('Error upgrading base:', err);
      return false;
    }
  }, [playerState]);

  // Load resource zones on initialization
  useEffect(() => {
    const loadResourceZones = async () => {
      try {
        const zones = await getResourceZones();
        setResourceZones(zones);
      } catch (err) {
        console.error('Error loading resource zones:', err);
      }
    };

    loadResourceZones();
  }, []);

  // Resource regeneration and base maintenance interval
  useEffect(() => {
    if (!playerState) return;

    const maintenanceInterval = setInterval(async () => {
      try {
        // Regenerate resources
        if (resourceZones.length > 0) {
          const updatedZones = await Promise.all(resourceZones.map(async (zone) => {
            const timeSinceLastRegen = Date.now() - new Date(zone.lastRegeneration).getTime();
            const hoursElapsed = timeSinceLastRegen / (1000 * 60 * 60);
            
            if (hoursElapsed >= 1) {
              const regenAmount = Math.floor(zone.regenerationRate * hoursElapsed);
              const maxAmount = getResourceBaseAmount(zone.resourceType) * 2; // Max 2x base amount
              
              const updatedZone: ResourceZone = {
                ...zone,
                amount: Math.min(zone.amount + regenAmount, maxAmount),
                lastRegeneration: new Date()
              };
              
              await updateResourceZone(updatedZone);
              return updatedZone;
            }
            return zone;
          }));
          
          setResourceZones(updatedZones);
        }

        // Check base maintenance
        if (playerState.baseHexagon && playerState.resources) {
          const maintenanceCost = { wood: 2, iron: 1, stone: 2 };
          
          if (hasEnoughResources(playerState.resources, maintenanceCost)) {
            // Deduct maintenance cost
            const newResources = subtractResources(playerState.resources, maintenanceCost);
            await updatePlayerResources(playerState.id, newResources);
            
            // Generate base resources
            const baseProduction = { wood: 5, iron: 3, stone: 4 };
            const finalResources = addResources(newResources, baseProduction);
            await updatePlayerResources(playerState.id, finalResources);
            
            setPlayerState(prev => prev ? { ...prev, resources: finalResources } : null);
          } else {
            // Not enough resources for maintenance - lose the base
            console.warn('⚠️ Base maintenance failed - not enough resources!');
            // TODO: Implement base loss logic
          }
        }
      } catch (error) {
        console.error('Error in maintenance interval:', error);
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(maintenanceInterval);
  }, [playerState, resourceZones]);

  // Auto-refresh position every 5 seconds
  useEffect(() => {
    if (!playerState) return;

    const positionUpdateInterval = setInterval(async () => {
      try {
        console.log('🔄 Auto-refreshing position...');
        const newPosition = await getCurrentPosition();
        setPosition(newPosition);
        
        // Update current hexagon
        await updateCurrentHexagon(newPosition);
        
        // Update player state with new position
        const updatedState = {
          ...playerState,
          position: newPosition
        };
        setPlayerState(updatedState);
        await savePlayerState(updatedState);
        
        // Check if player is away from home
        if (homeBase) {
          const isAway = await isPlayerFarFromHome(playerState.id, newPosition, 5);
          setIsAwayFromHome(isAway);
        }
      } catch (error) {
        console.error('🔴 Auto position update failed:', error);
        // Don't set error state for auto-updates to avoid annoying users
      }
    }, 5000); // Every 5 seconds

    return () => clearInterval(positionUpdateInterval);
  }, [playerState, homeBase, updateCurrentHexagon]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current) {
        clearWatch(watchId.current);
      }
      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
      }
    };
  }, []);

  // Generate initial resource zones around player
  const generateInitialResourceZones = useCallback(async (playerPosition: PlayerPosition): Promise<ResourceZone[]> => {
    console.log('🏗️ Generating initial resource zones around player position');
    
    const currentH3 = getCurrentHexagon(playerPosition);
    if (!currentH3) return [];

    const resourceZones: ResourceZone[] = [];
    const resourceTypes: ResourceType[] = ['wood', 'iron', 'stone'];
    
    // Generar recursos cerca de la base (radio 2-4 hexágonos)
    const nearbyHexagons = generateHexagonsInRadius(playerPosition.latitude, playerPosition.longitude, 4);
    const nearbyResourceHexagons = nearbyHexagons.slice(5, 14); // Tomar algunos hexágonos cercanos pero no inmediatos
    
    // Asegurar que hay al menos un recurso de cada tipo cerca
    resourceTypes.forEach((resourceType, index) => {
      if (nearbyResourceHexagons[index]) {
        const zone: ResourceZone = {
          id: nearbyResourceHexagons[index],
          resourceType,
          amount: Math.floor(Math.random() * 50) + 30, // 30-80 recursos
          regenerationRate: Math.floor(Math.random() * 5) + 3, // 3-8 por hora
          lastRegeneration: new Date()
        };
        resourceZones.push(zone);
        console.log(`✅ Generated ${resourceType} zone near base:`, zone.id);
      }
    });
    
    // Generar recursos adicionales en un radio más amplio (5-8 hexágonos)
    const distantHexagons = generateHexagonsInRadius(playerPosition.latitude, playerPosition.longitude, 8);
    const distantResourceHexagons = distantHexagons.slice(20, 35); // Hexágonos más lejanos
    
    // Añadir recursos adicionales distribuidos
    for (let i = 0; i < Math.min(12, distantResourceHexagons.length); i++) {
      const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
      const zone: ResourceZone = {
        id: distantResourceHexagons[i],
        resourceType,
        amount: Math.floor(Math.random() * 40) + 20, // 20-60 recursos
        regenerationRate: Math.floor(Math.random() * 4) + 2, // 2-6 por hora
        lastRegeneration: new Date()
      };
      resourceZones.push(zone);
      console.log(`✅ Generated distant ${resourceType} zone:`, zone.id);
    }

    console.log(`🎯 Generated ${resourceZones.length} total resource zones`);
    return resourceZones;
  }, []);

  return {
    position,
    playerState,
    hudData,
    currentHexagon,
    hexagonData,
    hexagonStats,
    homeBase,
    isAwayFromHome,
    isLoading,
    error,
    connectionStatus,
    resourceZones,
    initializeGame,
    updatePlayerHealth,
    updatePlayerScore,
    refreshPosition,
    conquerCurrentHexagon,
    getHexagonInfo,
    setHomeBase: setHomeBaseFunction,
    resetToHomeBase,
    collectResources,
    establishBase,
    upgradeBase,
    initializeResourceZones
  };
}