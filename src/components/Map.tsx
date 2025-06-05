'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { PlayerPosition, HexagonData, H3Config, ResourceZone } from '@/types';
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
  cleanupMap,
  addResourceZones
} from '@/utils/mapbox';
import { DEFAULT_H3_CONFIG } from '@/utils/h3';

// Import Mapbox CSS
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapProps {
  position: PlayerPosition | null;
  currentHexagon?: string | null;
  resourceZones?: ResourceZone[];
  onHexSelect?: (h3Index: string, coordinates: [number, number], hexagonData?: HexagonData) => void;
  onResourceCollect?: (hexagonId: string) => void;
  onBaseEstablish?: (hexagonId: string) => void;
  h3Config?: H3Config;
  className?: string;
}

const Map: React.FC<MapProps> = ({ 
  position, 
  currentHexagon, 
  resourceZones = [],
  onHexSelect, 
  onResourceCollect,
  onBaseEstablish,
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
        console.log('🗺️ Map loaded successfully');
        setMapLoaded(true);
        setMapError(null);
        
        // Esperar un momento para asegurar que el estilo está completamente cargado
        setTimeout(async () => {
          // Add H3 hex grid if position is available
          if (position && map.current) {
            try {
              console.log('🔵 Adding H3 hex grid from Map component');
              console.log('Current position:', position);
              console.log('H3 config:', h3Config);
              
              await addH3HexGrid(
                map.current, 
                position,
                h3Config
              );
              console.log('✅ H3 hex grid added successfully from Map component');
              
              // Add resource zones if available
              if (resourceZones.length > 0) {
                console.log('🔵 Adding initial resource zones:', resourceZones.length);
                addResourceZones(map.current, resourceZones, onResourceCollect);
                console.log('✅ Initial resource zones added');
              }
              
              // Set up hex click handler
              if (onHexSelect) {
                console.log('🔵 Setting up hex click handler');
                onH3HexClick(map.current, onHexSelect);
              }
              
              // Highlight current hexagon if available
              if (currentHexagon) {
                console.log('🔵 Highlighting current hexagon:', currentHexagon);
                highlightCurrentHexagon(map.current, position, h3Config);
              }
            } catch (error) {
              console.error('❌ Failed to add H3 hex grid:', error);
              setMapError('Failed to load hexagon grid. Please refresh the page.');
            }
          } else {
            console.warn('⚠️ Position not available when map loaded');
          }
        }, 500); // Esperar 500ms para asegurar que el estilo está cargado
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
    if (!map.current || !mapLoaded || !position) {
      console.log('⚠️ Map update skipped:', { 
        hasMap: !!map.current, 
        mapLoaded, 
        hasPosition: !!position 
      });
      return;
    }

    const updateMap = async () => {
      try {
        console.log('🔵 Updating map with new position:', position);
        
        // Center map on new position
        centerMapOnPosition(map.current!, position);
        
        // Update player marker
        updatePlayerMarker(map.current!, position);
        
        // Add accuracy circle
        addAccuracyCircle(map.current!, position);
        
        // Update H3 hex grid based on current bounds or player position
        console.log('🔵 Updating hex grid...');
        await updateH3HexGridByBounds(map.current!, h3Config, 'h3-hex-grid', position);
        
        // Highlight current hexagon
        if (currentHexagon) {
          console.log('🔵 Highlighting current hexagon:', currentHexagon);
          highlightCurrentHexagon(map.current!, position, h3Config);
        }
        
        console.log('✅ Map update completed');
      } catch (error) {
        console.error('❌ Failed to update map:', error);
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

  // Visualize resource zones
  useEffect(() => {
    if (!map.current || !mapLoaded) {
      console.log('⚠️ Resource zones update skipped:', { 
        hasMap: !!map.current, 
        mapLoaded,
        resourceZonesCount: resourceZones.length 
      });
      return;
    }

    console.log('🔵 Visualizing resource zones:', resourceZones.length);
    
    try {
      // Siempre llamar a addResourceZones, incluso si no hay zonas (para limpiar)
      addResourceZones(map.current, resourceZones, onResourceCollect);
      console.log('✅ Resource zones visualization completed');
    } catch (error) {
      console.error('❌ Error adding resource zones:', error);
    }
  }, [mapLoaded, resourceZones, onResourceCollect]);

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