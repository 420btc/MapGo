import mapboxgl from 'mapbox-gl';
import type { PlayerPosition, MapboxConfig, HexagonData, H3Config } from '@/types';
import { 
  hexagonsToGeoJSON, 
  generateHexagonsInRadius, 
  getHexagonsInBounds, 
  getHexagonsInPlayerRadius,
  getCurrentHexagon,
  DEFAULT_H3_CONFIG 
} from './h3';
import { getHexagons } from './indexedDB';

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
    style: 'mapbox://styles/mapbox/streets-v12',
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
  const existingMarker = (map as any)._markers?.[markerId];
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
  if (!(map as any)._markers) {
    (map as any)._markers = {};
  }
  (map as any)._markers[markerId] = marker;

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
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    let h3Indices: string[];
    
    if (config.enableLocalMode && playerPosition) {
      // Usar modo local: hexágonos limitados por radio desde el jugador
      h3Indices = getHexagonsInPlayerRadius(playerPosition, config);
    } else {
      // Modo tradicional: usar el centro del mapa
      const center = map.getCenter();
      h3Indices = generateHexagonsInRadius(
        center.lat,
        center.lng,
        config.maxRadius,
        config.resolution
      );
    }

    // Get hexagon data from IndexedDB
    const hexagonDataMap = await getHexagons(h3Indices);

    // Convert to GeoJSON
    const geoJsonData = hexagonsToGeoJSON(h3Indices, hexagonDataMap, config);

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
          ['get', 'conquered'],
          config.conqueredColor,
          config.fillColor
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

    // Convert to GeoJSON
    const geoJsonData = hexagonsToGeoJSON(h3Indices, hexagonDataMap, config);

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
        center: feature.properties?.center || coordinates
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
 * Clean up map resources
 */
export function cleanupMap(map: mapboxgl.Map): void {
  // Remove all custom markers
  if ((map as any)._markers) {
    Object.values((map as any)._markers).forEach((marker: any) => {
      marker.remove();
    });
  }

  // Remove map
  map.remove();
}