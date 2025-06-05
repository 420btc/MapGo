// Type definitions for HexaConquest game

export interface PlayerPosition {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

export interface PlayerState {
  id: string;
  position: PlayerPosition;
  health: number;
  score: number;
  level: number;
  resources: ResourceInventory;
  baseHexagon?: string; // H3 index of player's base
}

// Resource System Types
export type ResourceType = 'wood' | 'iron' | 'stone';

export interface ResourceInventory {
  wood: number;
  iron: number;
  stone: number;
}

export interface ResourceCost {
  wood?: number;
  iron?: number;
  stone?: number;
}

export interface ResourceZone {
  id: string; // H3 index
  resourceType: ResourceType;
  amount: number; // Amount available for collection
  regenerationRate: number; // Resources per hour
  lastRegeneration: Date;
}

// Base System Types
export type BaseLevel = 1 | 2;

export interface PlayerBase {
  id: string; // H3 index
  playerId: string;
  level: BaseLevel;
  health: number;
  maxHealth: number;
  lastMaintenance: Date;
  resourceGeneration: ResourceInventory; // Resources generated per hour
  maintenanceCost: ResourceInventory; // Resources required per maintenance cycle
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface MapboxConfig {
  accessToken: string;
  style: string;
  center: [number, number];
  zoom: number;
}

export interface HUDData {
  position: PlayerPosition;
  playerState: PlayerState;
  connectionStatus: 'online' | 'offline';
}

// H3 Hexagon Types
export interface HexagonData {
  id: string; // H3 index
  conquered: boolean;
  conqueredBy?: string;
  conqueredAt?: Date;
  center: [number, number]; // [lng, lat]
  resourceZone?: ResourceZone;
  base?: PlayerBase;
  conquestCost: ResourceCost; // Cost to conquer this hexagon
  maintenanceCost: ResourceCost; // Cost to maintain this hexagon per cycle
}

export interface H3Config {
  resolution: number; // 9-10 para hexágonos de 50-100m
  fillColor: string;
  strokeColor: string;
  conqueredColor: string;
  currentHexColor: string;
  fillOpacity: number;
  strokeWidth: number;
  maxRadius: number; // Radio máximo en hexágonos desde la posición del jugador
  maxHexagons: number; // Límite máximo de hexágonos a mostrar
  enableLocalMode: boolean; // Si está habilitado el modo local (limitado por radio)
}

export interface HexagonState {
  currentHexagon: string | null;
  hexagons: Map<string, HexagonData>;
  visibleHexagons: string[];
}
