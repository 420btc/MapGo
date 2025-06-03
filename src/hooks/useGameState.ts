'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PlayerPosition, PlayerState, GeolocationError, HUDData, HexagonData, H3Config } from '@/types';
import {
  getCurrentPosition,
  watchPosition,
  clearWatch,
  isGeolocationAvailable,
  requestGeolocationPermission
} from '@/utils/geolocation';
import {
  savePlayerState,
  getPlayerState,
  getLatestPlayerPosition,
  cleanupOldPositions,
  saveHexagon,
  getHexagon,
  conquerHexagon,
  getHexagonStats,
  savePlayerHomeBase,
  getPlayerHomeBase,
  isPlayerFarFromHome
} from '@/utils/indexedDB';
import {
  getCurrentHexagon,
  DEFAULT_H3_CONFIG
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
  initializeGame: () => Promise<void>;
  updatePlayerHealth: (health: number) => void;
  updatePlayerScore: (score: number) => void;
  refreshPosition: () => Promise<void>;
  conquerCurrentHexagon: () => Promise<boolean>;
  getHexagonInfo: (h3Index: string) => Promise<HexagonData | null>;
  setHomeBase: (position?: PlayerPosition) => Promise<void>;
  resetToHomeBase: () => Promise<void>;
}

const DEFAULT_PLAYER_STATE: Omit<PlayerState, 'id' | 'position'> = {
  health: 100,
  score: 0,
  level: 1
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
    setIsLoading(true);
    setError(null);

    try {
      // Check geolocation availability
      if (!isGeolocationAvailable()) {
        throw new Error('Geolocation is not supported by this browser');
      }

      // Request permission
      const permission = await requestGeolocationPermission();
      if (permission === 'denied') {
        throw new Error('Location permission denied. Please enable location access.');
      }

      // Load existing player state or create new one
      let existingPlayerState = await getPlayerState(PLAYER_ID);
      if (!existingPlayerState) {
        // Get initial position
        const initialPosition = await getCurrentPosition();
        
        existingPlayerState = {
          id: PLAYER_ID,
          position: initialPosition,
          ...DEFAULT_PLAYER_STATE
        };
        
        await savePlayerState(existingPlayerState);
        
        // Set initial home base
        await savePlayerHomeBase(existingPlayerState.id, initialPosition);
        setHomeBase(initialPosition);
      } else {
        // Try to get latest position from storage
        const latestPosition = await getLatestPlayerPosition();
        if (latestPosition) {
          existingPlayerState.position = latestPosition;
        }
        
        // Load home base
        const savedHomeBase = await getPlayerHomeBase(existingPlayerState.id);
        if (savedHomeBase) {
          setHomeBase(savedHomeBase);
          // Check if player is away from home
          const isAway = await isPlayerFarFromHome(existingPlayerState.id, existingPlayerState.position, 5);
          setIsAwayFromHome(isAway);
        } else {
          // Set current position as home base if none exists
          await savePlayerHomeBase(existingPlayerState.id, existingPlayerState.position);
          setHomeBase(existingPlayerState.position);
        }
      }

      setPlayerState(existingPlayerState);
      setPosition(existingPlayerState.position);

      // Start watching position
      if (watchId.current) {
        clearWatch(watchId.current);
      }

      watchId.current = watchPosition(
        async (newPosition) => {
          setPosition(newPosition);
          setError(null);
          
          // Update current hexagon
          await updateCurrentHexagon(newPosition);
          
          // Update player state with new position
          if (existingPlayerState) {
            const updatedState = {
              ...existingPlayerState,
              position: newPosition
            };
            setPlayerState(updatedState);
            await savePlayerState(updatedState);
          }
        },
        (geolocationError) => {
          setError(geolocationError.message);
          console.error('Geolocation error:', geolocationError);
        }
      );

      // Set up cleanup interval (every 5 minutes)
      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
      }
      cleanupInterval.current = setInterval(() => {
        cleanupOldPositions().catch(console.error);
      }, 5 * 60 * 1000);

      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize game';
      setError(errorMessage);
      setIsLoading(false);
      console.error('Game initialization error:', err);
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
  }, [playerState, updateCurrentHexagon, homeBase]);

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
    initializeGame,
    updatePlayerHealth,
    updatePlayerScore,
    refreshPosition,
    conquerCurrentHexagon,
    getHexagonInfo,
    setHomeBase: setHomeBaseFunction,
    resetToHomeBase
  };
}