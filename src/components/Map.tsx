'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { getHexagonBoundary } from '@/utils/h3';
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
  cleanupMap
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
        setMapLoaded(true);
        setMapError(null);
        
        // Add H3 hex grid if position is available
        if (position && map.current) {
          try {
            console.log('Adding H3 hex grid with position:', position);
            console.log('H3 config:', h3Config);
            await addH3HexGrid(
              map.current, 
              position,
              h3Config
            );
            console.log('H3 hex grid added successfully');
            
            // Set up hex click handler
            if (onHexSelect) {
              onH3HexClick(map.current, onHexSelect);
            }
            
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

  // Visualize resource zones
  useEffect(() => {
    if (!map.current || !mapLoaded || !resourceZones.length) return;

    // Remove existing resource zone layers
    if (map.current.getLayer('resource-zones')) {
      map.current.removeLayer('resource-zones');
    }
    if (map.current.getSource('resource-zones')) {
      map.current.removeSource('resource-zones');
    }

    // Create GeoJSON features for resource zones
    const features = resourceZones.map(zone => {
      const boundary = getHexagonBoundary(zone.id);
      const coordinates = [boundary.map((coord: number[]) => [coord[1], coord[0]])];
      
      return {
        type: 'Feature' as const,
        properties: {
          id: zone.id,
          resourceType: zone.resourceType,
          amount: zone.amount,
          regenerationRate: zone.regenerationRate,
          lastRegeneration: zone.lastRegeneration
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates
        }
      };
    });

    // Add resource zones source
    map.current.addSource('resource-zones', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features
      }
    });

    // Add resource zones layer
    map.current.addLayer({
      id: 'resource-zones',
      type: 'fill',
      source: 'resource-zones',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'resourceType'], 'wood'], '#8B4513',
          ['==', ['get', 'resourceType'], 'iron'], '#708090',
          ['==', ['get', 'resourceType'], 'stone'], '#696969',
          '#CCCCCC'
        ],
        'fill-opacity': 0.3,
        'fill-outline-color': [
          'case',
          ['==', ['get', 'resourceType'], 'wood'], '#654321',
          ['==', ['get', 'resourceType'], 'iron'], '#2F4F4F',
          ['==', ['get', 'resourceType'], 'stone'], '#2F2F2F',
          '#999999'
        ]
      }
    });

    // Add click handler for resource zones
    const handleResourceZoneClick = (e: any) => {
      const features = map.current!.queryRenderedFeatures(e.point, {
        layers: ['resource-zones']
      });

      if (features.length > 0) {
        const feature = features[0];
        const hexagonId = feature.properties?.id;
        
        if (hexagonId && onResourceCollect) {
          onResourceCollect(hexagonId);
        }
      }
    };

    map.current.on('click', 'resource-zones', handleResourceZoneClick);

    // Change cursor on hover
    const handleMouseEnter = () => {
      map.current!.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = () => {
      map.current!.getCanvas().style.cursor = '';
    };

    map.current.on('mouseenter', 'resource-zones', handleMouseEnter);
    map.current.on('mouseleave', 'resource-zones', handleMouseLeave);

    return () => {
      if (map.current) {
        map.current.off('click', 'resource-zones', handleResourceZoneClick);
        map.current.off('mouseenter', 'resource-zones', handleMouseEnter);
        map.current.off('mouseleave', 'resource-zones', handleMouseLeave);
      }
    };
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