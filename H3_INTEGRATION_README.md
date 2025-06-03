# HexaConquest - H3 Integration Guide

## 🎯 Overview

HexaConquest now uses the H3 geospatial indexing system to divide the world into hexagonal territories that players can conquer. This integration provides a robust, scalable system for location-based gameplay.

## 🔧 What Was Integrated

### 1. H3 Library Installation
- **Package**: `h3-js` v4.2.1
- **Purpose**: Provides H3 geospatial indexing functions
- **Installation**: `npm install h3-js --legacy-peer-deps`

### 2. New Type Definitions (`src/types/index.ts`)
```typescript
// H3 Hexagon data structure
export interface HexagonData {
  id: string;           // H3 index
  conquered: boolean;   // Conquest status
  conqueredBy?: string; // Player ID who conquered it
  conqueredAt?: Date;   // Conquest timestamp
  center: [number, number]; // [lng, lat]
}

// H3 Configuration
export interface H3Config {
  resolution: number;        // H3 resolution (0-15)
  fillColor: string;        // Default hexagon color
  strokeColor: string;      // Border color
  conqueredColor: string;   // Conquered hexagon color
  currentHexColor: string;  // Current player hexagon color
  fillOpacity: number;      // Fill transparency
  strokeWidth: number;      // Border width
}

// Hexagon state for game management
export interface HexagonState {
  currentHexagon: string | null;
  conqueredHexagons: string[];
  totalHexagons: number;
}
```

### 3. H3 Utility Functions (`src/utils/h3.ts`)
- **`getCurrentHexagon()`**: Get H3 index for current position
- **`generateHexagonsInRadius()`**: Generate hexagons around a point
- **`getHexagonsInBounds()`**: Get hexagons within map bounds
- **`hexagonsToGeoJSON()`**: Convert H3 indices to Mapbox GeoJSON
- **`getHexagonBoundary()`**: Get hexagon polygon coordinates
- **`calculateHexDistance()`**: Distance between hexagons
- **`validateH3Index()`**: Validate H3 index format

### 4. Enhanced IndexedDB Storage (`src/utils/indexedDB.ts`)
- **New Object Store**: `hexagons` with indexes for `conquered` and `conqueredAt`
- **Functions Added**:
  - `saveHexagon()`: Store hexagon data
  - `getHexagon()`: Retrieve hexagon data
  - `conquerHexagon()`: Mark hexagon as conquered
  - `getConqueredHexagons()`: Get all conquered hexagons
  - `getHexagonStats()`: Get conquest statistics

### 5. Updated Mapbox Integration (`src/utils/mapbox.ts`)
- **`addH3HexGrid()`**: Add H3 hexagon layer to map
- **`updateH3HexGridByBounds()`**: Update hexagons based on map view
- **`highlightCurrentHexagon()`**: Highlight player's current hexagon
- **`onH3HexClick()`**: Handle hexagon click events
- **`addHexagonPopup()`**: Show hexagon information on hover

### 6. Enhanced Game State Hook (`src/hooks/useGameState.ts`)
- **New State Variables**:
  - `currentHexagon`: Player's current H3 index
  - `hexagonData`: Current hexagon information
  - `hexagonStats`: Conquest statistics
- **New Functions**:
  - `conquerCurrentHexagon()`: Conquer the current hexagon
  - `getHexagonInfo()`: Get information about any hexagon
  - `updateCurrentHexagon()`: Update current hexagon when moving

### 7. Updated Map Component (`src/components/Map.tsx`)
- **H3 Integration**: Uses H3 functions instead of basic hexagon grid
- **Dynamic Updates**: Hexagons update based on map movement
- **Current Hexagon Highlighting**: Shows player's current location
- **Interactive Popups**: Hover to see hexagon information

### 8. Enhanced Main Page (`src/app/page.tsx`)
- **Conquest Interface**: Button to conquer current hexagon
- **Statistics Display**: Shows conquest progress
- **Current Hexagon Info**: Real-time hexagon information
- **Interactive Gameplay**: Click hexagons to conquer them

## 🎮 How to Use

### For Players:
1. **Start the Game**: Allow location access when prompted
2. **Explore**: Move around to see different hexagons
3. **Conquer**: Tap the green "Conquer" button or click on your current hexagon
4. **Track Progress**: View your conquest statistics in the top-left panel
5. **Expand Territory**: Move to new areas to discover more hexagons

### For Developers:
1. **H3 Configuration**: Modify `DEFAULT_H3_CONFIG` in `src/utils/h3.ts`
2. **Resolution**: Change H3 resolution (7-10 recommended for city-level gameplay)
3. **Colors**: Customize hexagon colors in the H3Config
4. **Game Logic**: Extend conquest rules in the game state hook

## 🔧 Configuration Options

### H3 Resolution Levels
- **Resolution 7**: ~5.16 km² per hexagon (neighborhood level)
- **Resolution 8**: ~0.74 km² per hexagon (block level)
- **Resolution 9**: ~0.10 km² per hexagon (building level)
- **Resolution 10**: ~0.015 km² per hexagon (precise location)

### Default Configuration
```typescript
export const DEFAULT_H3_CONFIG: H3Config = {
  resolution: 9,              // Building-level precision
  fillColor: '#3b82f6',      // Blue for unconquered
  strokeColor: '#1e40af',    // Dark blue borders
  conqueredColor: '#10b981', // Green for conquered
  currentHexColor: '#f59e0b', // Orange for current
  fillOpacity: 0.3,          // 30% transparency
  strokeWidth: 2             // 2px borders
};
```

## 🚀 Features Implemented

### ✅ Core Features
- [x] H3 geospatial indexing integration
- [x] Real-time hexagon generation based on location
- [x] Hexagon conquest system
- [x] Persistent storage with IndexedDB
- [x] Interactive map with hexagon visualization
- [x] Current hexagon highlighting
- [x] Conquest statistics tracking
- [x] Responsive design for mobile and desktop

### ✅ Advanced Features
- [x] Dynamic hexagon loading based on map bounds
- [x] Hover popups with hexagon information
- [x] Error handling and validation
- [x] Offline capability with IndexedDB
- [x] Performance optimization for large hexagon sets

## 🔄 Next Steps

### Potential Enhancements
1. **Multiplayer Support**: Add real-time conquest battles
2. **Hexagon Resources**: Different hexagon types with resources
3. **Territory Bonuses**: Rewards for controlling adjacent hexagons
4. **Time-based Mechanics**: Hexagons that can be re-conquered over time
5. **Social Features**: Share conquest achievements
6. **Analytics**: Track player movement and conquest patterns

## 🐛 Troubleshooting

### Common Issues
1. **H3 Library Not Found**: Ensure `h3-js` is installed correctly
2. **Location Permission**: Make sure browser location access is enabled
3. **Map Not Loading**: Check Mapbox token and internet connection
4. **Hexagons Not Appearing**: Verify H3 functions are working correctly

### Debug Tips
- Check browser console for H3-related errors
- Verify IndexedDB is storing hexagon data
- Test with different H3 resolutions
- Ensure location services are enabled

## 📱 Browser Compatibility

- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 13+)
- **Edge**: Full support

## 🎯 Performance Notes

- H3 resolution 9 provides good balance of precision and performance
- Hexagon rendering is optimized for mobile devices
- IndexedDB provides fast local storage for hexagon data
- Map updates are throttled to prevent excessive API calls

The H3 integration is now complete and ready for testing! The application provides a robust foundation for location-based hexagonal conquest gameplay.