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
