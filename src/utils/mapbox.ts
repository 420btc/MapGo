import mapboxgl from 'mapbox-gl';
import type { PlayerPosition, MapboxConfig, HexagonData, H3Config, ResourceZone, ResourceType } from '@/types';
import { 
  hexagonsToGeoJSON, 
  generateHexagonsInRadius, 
  getHexagonsInBounds, 
  getHexagonsInPlayerRadius,
  getCurrentHexagon,
  DEFAULT_H3_CONFIG 
} from './h3';
import { getHexagons } from './indexedDB';

// Type for map with custom marker storage
interface MapWithMarkers {
  _markers?: Record<string, mapboxgl.Marker>;
}

// Mapbox access token
const MAPBOX_TOKEN = 'pk.eyJ1IjoiNDIwYnRjIiwiYSI6ImNtOTN3ejBhdzByNjgycHF6dnVmeHl2ZTUifQ.Utq_q5wN6DHwpkn6rcpZdw';

/**
 * Initialize Mapbox map
 */
export function initializeMap(
  container: string | HTMLElement,
  config?: Partial<MapboxConfig>
): mapboxgl.Map {
  // Set the access token
  mapboxgl.accessToken = MAPBOX_TOKEN;

  const defaultConfig: MapboxConfig = {
    accessToken: MAPBOX_TOKEN,
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [0, 0], // Will be updated with user location
    zoom: 15
  };

  const mapConfig = { ...defaultConfig, ...config };

  const map = new mapboxgl.Map({
    container,
    style: mapConfig.style,
    center: mapConfig.center,
    zoom: mapConfig.zoom,
    attributionControl: false // We'll add custom attribution
  });

  // Add navigation controls
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');

  // Add geolocate control
  const geolocateControl = new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserHeading: true
  });
  map.addControl(geolocateControl, 'top-right');

  // Add scale control
  map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

  // Add custom attribution
  map.addControl(
    new mapboxgl.AttributionControl({
      customAttribution: '© HexaConquest'
    }),
    'bottom-right'
  );

  return map;
}

/**
 * Update map center to user position
 */
export function centerMapOnPosition(
  map: mapboxgl.Map,
  position: PlayerPosition,
  zoom?: number
): void {
  map.flyTo({
    center: [position.longitude, position.latitude],
    zoom: zoom || map.getZoom(),
    duration: 1000
  });
}

/**
 * Add or update player marker on map
 */
export function updatePlayerMarker(
  map: mapboxgl.Map,
  position: PlayerPosition,
  markerId: string = 'player-marker'
): mapboxgl.Marker {
  // Remove existing marker if it exists
  const mapWithMarkers = map as unknown as mapboxgl.Map & MapWithMarkers;
  const existingMarker = mapWithMarkers._markers?.[markerId];
  if (existingMarker) {
    existingMarker.remove();
  }

  // Create player marker element
  const markerElement = document.createElement('div');
  markerElement.className = 'player-marker';
  markerElement.style.cssText = `
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: #3b82f6;
    border: 3px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    cursor: pointer;
  `;

  // Create marker
  const marker = new mapboxgl.Marker(markerElement)
    .setLngLat([position.longitude, position.latitude])
    .addTo(map);

  // Store marker reference
  const markerStorage = mapWithMarkers as unknown as { _markers?: Record<string, mapboxgl.Marker> };
  if (!markerStorage._markers) {
    markerStorage._markers = {};
  }
  markerStorage._markers[markerId] = marker;

  return marker;
}

/**
 * Add accuracy circle around player position
 */
export function addAccuracyCircle(
  map: mapboxgl.Map,
  position: PlayerPosition,
  sourceId: string = 'accuracy-circle'
): void {
  if (!position.accuracy) return;

  // Remove existing source if it exists
  if (map.getSource(sourceId)) {
    map.removeLayer(`${sourceId}-layer`);
    map.removeSource(sourceId);
  }

  // Create circle geometry
  const center = [position.longitude, position.latitude];
  const radiusInKm = position.accuracy / 1000;
  const points = 64;
  const coordinates = [];

  for (let i = 0; i < points; i++) {
    const angle = (i * 360) / points;
    const dx = radiusInKm * Math.cos((angle * Math.PI) / 180);
    const dy = radiusInKm * Math.sin((angle * Math.PI) / 180);
    coordinates.push([
      center[0] + dx / (111.32 * Math.cos((center[1] * Math.PI) / 180)),
      center[1] + dy / 110.54
    ]);
  }
  coordinates.push(coordinates[0]); // Close the circle

  // Add source
  map.addSource(sourceId, {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      },
      properties: {}
    }
  });

  // Add layer
  map.addLayer({
    id: `${sourceId}-layer`,
    type: 'fill',
    source: sourceId,
    paint: {
      'fill-color': '#3b82f6',
      'fill-opacity': 0.1
    }
  });
}

/**
 * Add H3 hexagon grid to map
 */
export async function addH3HexGrid(
  map: mapboxgl.Map,
  playerPosition?: PlayerPosition,
  config: H3Config = DEFAULT_H3_CONFIG,
  sourceId: string = 'h3-hex-grid'
): Promise<void> {
  try {
    // Remove existing layers and source if they exist
    if (map.getLayer(`${sourceId}-layer`)) {
      map.removeLayer(`${sourceId}-layer`);
    }
    if (map.getLayer(`${sourceId}-stroke`)) {
      map.removeLayer(`${sourceId}-stroke`);
    }
    if (map.getLayer(`${sourceId}-emotes`)) {
      map.removeLayer(`${sourceId}-emotes`);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    let h3Indices: string[];
    
    if (config.enableLocalMode && playerPosition) {
      // Usar modo local: hexágonos limitados por radio desde el jugador
      console.log('Using local mode with player position:', playerPosition);
      h3Indices = getHexagonsInPlayerRadius(playerPosition, config);
      console.log('Generated hexagons in player radius:', h3Indices.length);
    } else {
      // Modo tradicional: usar el centro del mapa
      const center = map.getCenter();
      console.log('Using traditional mode with map center:', center);
      h3Indices = generateHexagonsInRadius(
        center.lat,
        center.lng,
        config.maxRadius,
        config.resolution
      );
      console.log('Generated hexagons in radius:', h3Indices.length);
    }

    // Get hexagon data from IndexedDB
    const hexagonDataMap = await getHexagons(h3Indices);
    console.log(`📊 Loaded ${hexagonDataMap.size} hexagon data entries`);
    
    // Log resource hexagons
    const resourceHexagons = Array.from(hexagonDataMap.values()).filter(hex => hex.resourceZone);
    console.log(`🎯 Found ${resourceHexagons.length} hexagons with resources:`, 
      resourceHexagons.map(hex => `${hex.resourceZone?.resourceType} at ${hex.id}`));

    // Convert to GeoJSON
    const geoJsonData = hexagonsToGeoJSON(h3Indices, hexagonDataMap);
    
    // Log GeoJSON features with resources
    const resourceFeatures = geoJsonData.features.filter(f => f.properties.hasResource);
    console.log(`🗺️ GeoJSON features with resources: ${resourceFeatures.length}`);
    resourceFeatures.forEach(f => {
      console.log(`  - ${f.properties.resourceType} at ${f.properties.h3Index}`);
    });

    // Add source
    map.addSource(sourceId, {
      type: 'geojson',
      data: geoJsonData
    });

    // Add fill layer
    map.addLayer({
      id: `${sourceId}-layer`,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': [
          'case',
          ['get', 'conquered'], config.conqueredColor,
          ['==', ['get', 'resourceType'], 'wood'], '#22c55e', // Verde brillante para madera
          ['==', ['get', 'resourceType'], 'iron'], '#9ca3af', // Gris claro para hierro
          ['==', ['get', 'resourceType'], 'stone'], '#a8a29e', // Beige para piedra
          config.fillColor // Azul por defecto
        ],
        'fill-opacity': config.fillOpacity
      }
    });

    // Add stroke layer
    map.addLayer({
      id: `${sourceId}-stroke`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': config.strokeColor,
        'line-width': config.strokeWidth,
        'line-opacity': 0.8
      }
    });

    // Add resource emotes layer
    map.addLayer({
      id: `${sourceId}-emotes`,
      type: 'symbol',
      source: sourceId,
      filter: ['!=', ['get', 'emote'], ''],
      layout: {
        'text-field': ['get', 'emote'],
        'text-size': 24,
        'text-anchor': 'center',
        'text-allow-overlap': true,
        'text-ignore-placement': true
      },
      paint: {
        'text-opacity': 0.9
      }
    });

  } catch (error) {
    console.error('Error adding H3 hex grid:', error);
    throw error;
  }
}

/**
 * Update hexagon grid based on map bounds or player position
 */
export async function updateH3HexGridByBounds(
  map: mapboxgl.Map,
  config: H3Config = DEFAULT_H3_CONFIG,
  sourceId: string = 'h3-hex-grid',
  playerPosition?: PlayerPosition
): Promise<void> {
  try {
    const bounds = map.getBounds();
    if (!bounds) {
      console.warn('Map bounds not available');
      return;
    }
    
    const h3Indices = getHexagonsInBounds(
      bounds.getNorth(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getWest(),
      config.resolution,
      playerPosition,
      config
    );

    // Get hexagon data from IndexedDB
    const hexagonDataMap = await getHexagons(h3Indices);
    console.log(`📊 Loaded ${hexagonDataMap.size} hexagon data entries`);
    
    // Log resource hexagons
    const resourceHexagons = Array.from(hexagonDataMap.values()).filter(hex => hex.resourceZone);
    console.log(`🎯 Found ${resourceHexagons.length} hexagons with resources:`, 
      resourceHexagons.map(hex => `${hex.resourceZone?.resourceType} at ${hex.id}`));

    // Convert to GeoJSON
    const geoJsonData = hexagonsToGeoJSON(h3Indices, hexagonDataMap);
    
    // Log GeoJSON features with resources
    const resourceFeatures = geoJsonData.features.filter(f => f.properties.hasResource);
    console.log(`🗺️ GeoJSON features with resources: ${resourceFeatures.length}`);
    resourceFeatures.forEach(f => {
      console.log(`  - ${f.properties.resourceType} at ${f.properties.h3Index}`);
    });

    // Update source data
    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geoJsonData);
    }
  } catch (error) {
    console.error('Error updating H3 hex grid by bounds:', error);
  }
}

/**
 * Highlight current hexagon
 */
export function highlightCurrentHexagon(
  map: mapboxgl.Map,
  position: PlayerPosition,
  config: H3Config = DEFAULT_H3_CONFIG,
  sourceId: string = 'h3-hex-grid'
): string | null {
  try {
    const currentH3 = getCurrentHexagon(position, config.resolution);
    
    // Update layer paint to highlight current hexagon
    if (map.getLayer(`${sourceId}-layer`)) {
      map.setPaintProperty(`${sourceId}-layer`, 'fill-color', [
        'case',
        ['==', ['get', 'h3Index'], currentH3],
        config.currentHexColor,
        [
          'case',
          ['get', 'conquered'],
          config.conqueredColor,
          config.fillColor
        ]
      ]);
    }

    return currentH3;
  } catch (error) {
    console.error('Error highlighting current hexagon:', error);
    return null;
  }
}

/**
 * Handle map click events for H3 hexagon selection
 */
export function onH3HexClick(
  map: mapboxgl.Map,
  callback: (h3Index: string, coordinates: [number, number], hexagonData?: HexagonData) => void,
  sourceId: string = 'h3-hex-grid'
): void {
  const layerId = `${sourceId}-layer`;
  
  map.on('click', layerId, (e) => {
    if (e.features && e.features[0]) {
      const feature = e.features[0];
      const h3Index = feature.properties?.h3Index;
      const coordinates = e.lngLat.toArray() as [number, number];
      const hexagonData: HexagonData | undefined = {
        id: h3Index,
        conquered: feature.properties?.conquered || false,
        conqueredBy: feature.properties?.conqueredBy,
        conqueredAt: feature.properties?.conqueredAt ? new Date(feature.properties.conqueredAt) : undefined,
        center: feature.properties?.center || coordinates,
        conquestCost: { wood: 10, iron: 5, stone: 8 },
        maintenanceCost: { wood: 2, iron: 1, stone: 2 }
      };
      callback(h3Index, coordinates, hexagonData);
    }
  });

  // Change cursor on hover
  map.on('mouseenter', layerId, () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', layerId, () => {
    map.getCanvas().style.cursor = '';
  });
}

/**
 * Add popup for hexagon information
 */
export function addHexagonPopup(
  map: mapboxgl.Map,
  sourceId: string = 'h3-hex-grid'
): mapboxgl.Popup {
  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
  });

  const layerId = `${sourceId}-layer`;

  map.on('mouseenter', layerId, (e) => {
    if (e.features && e.features[0]) {
      const feature = e.features[0];
      const h3Index = feature.properties?.h3Index;
      const conquered = feature.properties?.conquered;
      const conqueredBy = feature.properties?.conqueredBy;
      
      let popupContent = `<div class="hexagon-popup">`;
      popupContent += `<strong>Hexágono:</strong> ${h3Index}<br>`;
      popupContent += `<strong>Estado:</strong> ${conquered ? 'Conquistado' : 'Libre'}<br>`;
      if (conquered && conqueredBy) {
        popupContent += `<strong>Conquistado por:</strong> ${conqueredBy}<br>`;
      }
      popupContent += `</div>`;

      popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map);
    }
  });

  map.on('mouseleave', layerId, () => {
    popup.remove();
  });

  return popup;
}

/**
 * Get resource zone color based on resource type
 */
function getResourceZoneColor(resourceType: ResourceType): string {
  switch (resourceType) {
    case 'wood':
      return '#228B22'; // Forest Green
    case 'iron':
      return '#708090'; // Slate Gray
    case 'stone':
      return '#696969'; // Dim Gray
    default:
      return '#808080'; // Default Gray
  }
}

/**
 * Add resource zones to the map
 */
export function addResourceZones(
  map: mapboxgl.Map,
  resourceZones: ResourceZone[],
  onResourceCollect?: (hexagonId: string) => void
): void {
  if (!map.isStyleLoaded()) {
    map.once('styledata', () => addResourceZones(map, resourceZones, onResourceCollect));
    return;
  }

  // Remove existing resource zones layer if it exists
  if (map.getLayer('resource-zones')) {
    map.removeLayer('resource-zones');
  }
  if (map.getSource('resource-zones')) {
    map.removeSource('resource-zones');
  }

  if (resourceZones.length === 0) return;

  // Convert resource zones to GeoJSON
  const features = resourceZones.map(zone => {
    const hexagons = [zone.id];
    const hexagonDataMap = new Map<string, HexagonData>();
    const geoJson = hexagonsToGeoJSON(hexagons, hexagonDataMap);
    
    return {
      ...geoJson.features[0],
      properties: {
        ...geoJson.features[0].properties,
        resourceType: zone.resourceType,
        amount: zone.amount,
        regenerationRate: zone.regenerationRate,
        lastRegeneration: zone.lastRegeneration
      }
    };
  });

  const resourceZonesGeoJSON = {
    type: 'FeatureCollection' as const,
    features
  };

  // Add source
  map.addSource('resource-zones', {
    type: 'geojson',
    data: resourceZonesGeoJSON
  });

  // Add layer with dynamic colors based on resource type
  map.addLayer({
    id: 'resource-zones',
    type: 'fill',
    source: 'resource-zones',
    paint: {
      'fill-color': [
        'case',
        ['==', ['get', 'resourceType'], 'wood'], '#228B22',
        ['==', ['get', 'resourceType'], 'iron'], '#708090',
        ['==', ['get', 'resourceType'], 'stone'], '#696969',
        '#808080' // default
      ],
      'fill-opacity': [
        'interpolate',
        ['linear'],
        ['/', ['get', 'amount'], ['get', 'maxAmount']],
        0, 0.2,
        1, 0.6
      ]
    }
  });

  // Add border layer
  map.addLayer({
    id: 'resource-zones-border',
    type: 'line',
    source: 'resource-zones',
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'resourceType'], 'wood'], '#006400',
        ['==', ['get', 'resourceType'], 'iron'], '#2F4F4F',
        ['==', ['get', 'resourceType'], 'stone'], '#2F2F2F',
        '#404040' // default
      ],
      'line-width': 2,
      'line-opacity': 0.8
    }
  });

  // Add click handler for resource collection
  if (onResourceCollect) {
    map.on('click', 'resource-zones', (e) => {
      if (e.features && e.features[0]) {
        const feature = e.features[0];
        const hexagonId = feature.properties?.h3Index;
        const amount = feature.properties?.amount || 0;
        
        if (hexagonId && amount > 0) {
          onResourceCollect(hexagonId);
        }
      }
    });

    // Change cursor on hover
    map.on('mouseenter', 'resource-zones', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'resource-zones', () => {
      map.getCanvas().style.cursor = '';
    });
  }
}

/**
 * Add resource zone popup on hover
 */
export function addResourceZonePopup(
  map: mapboxgl.Map,
  layerId: string = 'resource-zones'
): mapboxgl.Popup {
  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'resource-zone-popup'
  });

  map.on('mouseenter', layerId, (e) => {
    if (e.features && e.features[0]) {
      const feature = e.features[0];
      const resourceType = feature.properties?.resourceType;
      const amount = feature.properties?.amount || 0;
      const maxAmount = feature.properties?.maxAmount || 0;
      const regenerationRate = feature.properties?.regenerationRate || 0;
      
      const resourceIcon = resourceType === 'wood' ? '🌲' : 
                          resourceType === 'iron' ? '⛏️' : 
                          resourceType === 'stone' ? '🪨' : '❓';
      
      let popupContent = `<div class="resource-zone-popup-content">`;
      popupContent += `<div class="resource-header">`;
      popupContent += `<span class="resource-icon">${resourceIcon}</span>`;
      popupContent += `<strong>${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} Zone</strong>`;
      popupContent += `</div>`;
      popupContent += `<div class="resource-info">`;
      popupContent += `<div>Amount: ${amount}/${maxAmount}</div>`;
      popupContent += `<div>Regen: ${regenerationRate}/hr</div>`;
      if (amount > 0) {
        popupContent += `<div class="collect-hint">Click to collect!</div>`;
      } else {
        popupContent += `<div class="empty-hint">Empty - wait for regeneration</div>`;
      }
      popupContent += `</div>`;
      popupContent += `</div>`;

      popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map);
    }
  });

  map.on('mouseleave', layerId, () => {
    popup.remove();
  });

  return popup;
}

/**
 * Update resource zones on the map
 */
export function updateResourceZones(
  map: mapboxgl.Map,
  resourceZones: ResourceZone[]
): void {
  const source = map.getSource('resource-zones') as mapboxgl.GeoJSONSource;
  if (!source) return;

  // Convert resource zones to GeoJSON
  const features = resourceZones.map(zone => {
    const hexagons = [zone.id];
    const hexagonDataMap = new Map<string, HexagonData>();
    const geoJson = hexagonsToGeoJSON(hexagons, hexagonDataMap);
    
    return {
      ...geoJson.features[0],
      properties: {
        ...geoJson.features[0].properties,
        resourceType: zone.resourceType,
        amount: zone.amount,
        regenerationRate: zone.regenerationRate,
        lastRegeneration: zone.lastRegeneration
      }
    };
  });

  const resourceZonesGeoJSON = {
    type: 'FeatureCollection' as const,
    features
  };

  source.setData(resourceZonesGeoJSON);
}

/**
 * Clean up map resources
 */
export function cleanupMap(map: mapboxgl.Map): void {
  // Remove all custom markers
  const mapWithMarkers = map as unknown as mapboxgl.Map & MapWithMarkers;
  if (mapWithMarkers._markers) {
    Object.values(mapWithMarkers._markers).forEach((marker: mapboxgl.Marker) => {
      marker.remove();
    });
  }

  // Remove map
  map.remove();
}