'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { PlayerPosition, HexagonData, H3Config } from '@/types';
import {
  initializeMap,
  centerMapOnPosition,
  updatePlayerMarker,
  addAccuracyCircle,
  addH3HexGrid,
  updateH3HexGridByBounds,
  highlightCurrentHexagon,
  onH3HexClick,
  addHexagonPopup,
  cleanupMap
} from '@/utils/mapbox';
import { DEFAULT_H3_CONFIG } from '@/utils/h3';

// Import Mapbox CSS
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapProps {
  position: PlayerPosition | null;
  currentHexagon?: string | null;
  onHexSelect?: (h3Index: string, coordinates: [number, number], hexagonData?: HexagonData) => void;
  h3Config?: H3Config;
  className?: string;
}

const Map: React.FC<MapProps> = ({ 
  position, 
  currentHexagon, 
  onHexSelect, 
  h3Config = DEFAULT_H3_CONFIG,
  className = '' 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = initializeMap(mapContainer.current, {
        center: position ? [position.longitude, position.latitude] : [0, 0],
        zoom: 15
      });

      map.current.on('load', async () => {
        setMapLoaded(true);
        setMapError(null);
        
        // Add H3 hex grid if position is available
        if (position && map.current) {
          try {
            await addH3HexGrid(
              map.current, 
              position,
              h3Config
            );
            
            // Set up hex click handler
            if (onHexSelect) {
              onH3HexClick(map.current, onHexSelect);
            }
            
            // Add hexagon popup
            addHexagonPopup(map.current);
            
            // Highlight current hexagon if available
            if (currentHexagon) {
              highlightCurrentHexagon(map.current, position, h3Config);
            }
          } catch (error) {
            console.error('Failed to add H3 hex grid:', error);
          }
        }
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Failed to load map. Please check your internet connection.');
      });

    } catch (error) {
      console.error('Failed to initialize map:', error);
      setMapError('Failed to initialize map. Please refresh the page.');
    }

    // Cleanup function
    return () => {
      if (map.current) {
        cleanupMap(map.current);
        map.current = null;
      }
    };
  }, []);

  // Update map when position changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !position) return;

    const updateMap = async () => {
      try {
        // Center map on new position
        centerMapOnPosition(map.current!, position);
        
        // Update player marker
        updatePlayerMarker(map.current!, position);
        
        // Add accuracy circle
        addAccuracyCircle(map.current!, position);
        
        // Update H3 hex grid based on current bounds or player position
        await updateH3HexGridByBounds(map.current!, h3Config, 'h3-hex-grid', position);
        
        // Highlight current hexagon
        if (currentHexagon) {
          highlightCurrentHexagon(map.current!, position, h3Config);
        }
        
      } catch (error) {
        console.error('Failed to update map:', error);
      }
    };

    updateMap();
  }, [position, mapLoaded, h3Config, currentHexagon]);

  // Set up hex click handler when callback changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !onHexSelect) return;

    onH3HexClick(map.current, onHexSelect);
  }, [onHexSelect, mapLoaded, currentHexagon, h3Config, position]);

  // Update hex grid when map moves
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleMoveEnd = async () => {
      try {
        await updateH3HexGridByBounds(map.current!, h3Config, 'h3-hex-grid', position || undefined);
      } catch (error) {
        console.error('Failed to update hex grid on move:', error);
      }
    };

    map.current.on('moveend', handleMoveEnd);
    
    return () => {
      if (map.current) {
        map.current.off('moveend', handleMoveEnd);
      }
    };
  }, [mapLoaded, h3Config, position]);

  if (mapError) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center p-8">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Map Error</h3>
          <p className="text-gray-600 mb-4">{mapError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapContainer} 
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Map Controls Info */}
      <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs p-2 rounded max-w-xs">
        <p className="mb-1">🎮 <strong>HexaConquest:</strong></p>
        <p>• Tap hexagons to conquer</p>
        <p>• Move to explore new areas</p>
        <p>• Use + / - to zoom</p>
        <p>• Drag to pan around</p>
        {currentHexagon && (
          <p className="mt-2 text-yellow-300">📍 Current: {currentHexagon.slice(-6)}</p>
        )}
      </div>
    </div>
  );
};

export default Map;