import mapboxgl from 'mapbox-gl';
import type { PlayerPosition, MapboxConfig, HexagonData, H3Config, ResourceZone, ResourceType } from '@/types';
import { 
  hexagonsToGeoJSON, 
  generateHexagonsInRadius, 
  getHexagonsInBounds, 
  getHexagonsInPlayerRadius,
  getCurrentHexagon,
  getH3Index,
  h3ToLatLng,
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
    console.log('🔵 Starting addH3HexGrid function');
    console.log('Player position:', playerPosition);
    console.log('Config:', config);
    
    // Verificar que el mapa esté listo
    if (!map.isStyleLoaded()) {
      console.warn('⚠️ Map style not loaded, waiting...');
      map.once('styledata', () => addH3HexGrid(map, playerPosition, config, sourceId));
      return;
    }
    
    // Remove existing layers and source if they exist
    const layers = [`${sourceId}-layer`, `${sourceId}-stroke`];
    layers.forEach(layerId => {
      if (map.getLayer(layerId)) {
        console.log(`Removing existing layer: ${layerId}`);
        map.removeLayer(layerId);
      }
    });
    
    if (map.getSource(sourceId)) {
      console.log(`Removing existing source: ${sourceId}`);
      map.removeSource(sourceId);
    }

    let h3Indices: string[];
    
    if (config.enableLocalMode && playerPosition) {
      // Usar modo local: hexágonos limitados por radio desde el jugador
      console.log('✅ Using local mode with player position');
      h3Indices = getHexagonsInPlayerRadius(playerPosition, config);
      console.log(`✅ Generated ${h3Indices.length} hexagons in player radius`);
    } else {
      // Modo tradicional: usar el centro del mapa
      const center = map.getCenter();
      console.log('✅ Using traditional mode with map center:', center);
      h3Indices = generateHexagonsInRadius(
        center.lat,
        center.lng,
        config.maxRadius,
        config.resolution
      );
      console.log(`✅ Generated ${h3Indices.length} hexagons in radius`);
    }

    // Verificar que tengamos hexágonos
    if (!h3Indices || h3Indices.length === 0) {
      console.error('❌ No hexagons generated!');
      return;
    }

    // Get hexagon data from IndexedDB
    console.log('🔵 Getting hexagon data from IndexedDB...');
    const hexagonDataMap = await getHexagons(h3Indices);
    console.log(`✅ Retrieved data for ${hexagonDataMap.size} hexagons`);

    // Convert to GeoJSON
    console.log('🔵 Converting to GeoJSON...');
    const geoJsonData = hexagonsToGeoJSON(h3Indices, hexagonDataMap);
    console.log(`✅ GeoJSON created with ${geoJsonData.features.length} features`);

    // Add source
    console.log('🔵 Adding source to map...');
    map.addSource(sourceId, {
      type: 'geojson',
      data: geoJsonData
    });
    console.log('✅ Source added successfully');

    // Add fill layer (primero para que esté debajo)
    console.log('🔵 Adding fill layer...');
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
    console.log('✅ Fill layer added');

    // Add stroke layer (encima del fill)
    console.log('🔵 Adding stroke layer...');
    map.addLayer({
      id: `${sourceId}-stroke`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': config.strokeColor,
        'line-width': config.strokeWidth,
        'line-opacity': 1.0
      }
    });
    console.log('✅ Stroke layer added');

    console.log('✅ H3 hex grid added successfully!');
  } catch (error) {
    console.error('❌ Error adding H3 hex grid:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
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
    console.log('🔵 Updating H3 hex grid by bounds...');
    
    // Verificar que el mapa esté listo
    if (!map.isStyleLoaded()) {
      console.warn('⚠️ Map style not loaded for update');
      return;
    }
    
    // Verificar que el source existe
    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
    if (!source) {
      console.warn('⚠️ Source not found, creating new hex grid...');
      await addH3HexGrid(map, playerPosition, config, sourceId);
      return;
    }
    
    const bounds = map.getBounds();
    if (!bounds) {
      console.warn('⚠️ Map bounds not available');
      return;
    }
    
    console.log('📍 Map bounds:', {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    });
    
    const h3Indices = getHexagonsInBounds(
      bounds.getNorth(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getWest(),
      config.resolution,
      playerPosition,
      config
    );
    
    console.log(`✅ Generated ${h3Indices.length} hexagons for current bounds`);

    // Get hexagon data from IndexedDB
    const hexagonDataMap = await getHexagons(h3Indices);
    console.log(`✅ Retrieved data for ${hexagonDataMap.size} hexagons`);

    // Convert to GeoJSON
    const geoJsonData = hexagonsToGeoJSON(h3Indices, hexagonDataMap);
    console.log(`✅ Updated GeoJSON with ${geoJsonData.features.length} features`);

    // Update source data
    source.setData(geoJsonData);
    console.log('✅ Hex grid updated successfully');
  } catch (error) {
    console.error('❌ Error updating H3 hex grid by bounds:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
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
    console.log('🔵 Highlighting current hexagon...');
    const currentH3 = getCurrentHexagon(position, config.resolution);
    console.log('📍 Current hexagon:', currentH3);
    
    // Verificar que las capas existan
    const fillLayer = `${sourceId}-layer`;
    const strokeLayer = `${sourceId}-stroke`;
    
    if (!map.getLayer(fillLayer)) {
      console.warn('⚠️ Fill layer not found:', fillLayer);
      return null;
    }
    
    // Resaltar solo el borde del hexágono actual, no cambiar el color de relleno
    if (map.getLayer(strokeLayer)) {
      // Hacer el borde del hexágono actual más grueso y amarillo
      map.setPaintProperty(strokeLayer, 'line-width', [
        'case',
        ['==', ['get', 'h3Index'], currentH3],
        4, // Borde más grueso para el hexágono actual
        config.strokeWidth
      ]);
      
      map.setPaintProperty(strokeLayer, 'line-color', [
        'case',
        ['==', ['get', 'h3Index'], currentH3],
        config.currentHexColor, // Amarillo para el borde del hexágono actual
        config.strokeColor
      ]);
    }

    console.log('✅ Current hexagon highlighted successfully');
    return currentH3;
  } catch (error) {
    console.error('❌ Error highlighting current hexagon:', error);
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
  
  // Handle clicks on hexagon layer
  map.on('click', layerId, (e) => {
    if (e.features && e.features[0]) {
      const feature = e.features[0];
      const h3Index = feature.properties?.h3Index;
      const coordinates = e.lngLat.toArray() as [number, number];
      
      // Si no hay h3Index en las propiedades, genera uno desde las coordenadas
      let finalH3Index = h3Index;
      if (!finalH3Index) {
        try {
          finalH3Index = getH3Index(e.lngLat.lat, e.lngLat.lng, 9);
        } catch (error) {
          console.error('Failed to generate H3 index from coordinates:', error);
          return;
        }
      }
      
      const hexagonData: HexagonData | undefined = h3Index ? {
        id: h3Index,
        conquered: feature.properties?.conquered || false,
        conqueredBy: feature.properties?.conqueredBy,
        conqueredAt: feature.properties?.conqueredAt ? new Date(feature.properties.conqueredAt) : undefined,
        center: feature.properties?.center || coordinates,
        conquestCost: { wood: 10, iron: 5, stone: 8 },
        maintenanceCost: { wood: 2, iron: 1, stone: 2 }
      } : undefined;
      
      callback(finalH3Index, coordinates, hexagonData);
    }
  });

  // Handle clicks on empty areas of the map to generate new hexagons
  map.on('click', (e) => {
    // Check if we clicked on an existing hexagon feature
    const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
    
    if (features.length === 0) {
      // No hexagon at this location, generate H3 index from coordinates
      try {
        const h3Index = getH3Index(e.lngLat.lat, e.lngLat.lng, 9);
        const coordinates = e.lngLat.toArray() as [number, number];
        
        console.log('🔵 Generated H3 index for empty area:', h3Index);
        
        // Create default hexagon data
        const hexagonData: HexagonData = {
          id: h3Index,
          conquered: false,
          center: coordinates,
          conquestCost: { wood: 10, iron: 5, stone: 8 },
          maintenanceCost: { wood: 2, iron: 1, stone: 2 }
        };
        
        callback(h3Index, coordinates, hexagonData);
      } catch (error) {
        console.error('Failed to generate H3 index for map click:', error);
      }
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
  console.log('🏗️ Adding resource zones to map:', resourceZones.length, 'zones');
  
  if (!resourceZones || resourceZones.length === 0) {
    console.warn('⚠️ No resource zones to display');
    return;
  }

  if (!map.isStyleLoaded()) {
    console.log('⏳ Map style not loaded yet, waiting...');
    map.once('styledata', () => addResourceZones(map, resourceZones, onResourceCollect));
    return;
  }

  // Remove existing resource zones layers if they exist
  const layers = ['resource-zones-fill', 'resource-zones-stroke', 'resource-zones-symbols', 'resource-zones-amount', 'resource-zones-background', 'resource-zones-label'];
  layers.forEach(layerId => {
    if (map.getLayer(layerId)) {
      console.log(`Removing existing resource layer: ${layerId}`);
      map.removeLayer(layerId);
    }
  });
  
  if (map.getSource('resource-zones')) {
    map.removeSource('resource-zones');
  }

  if (resourceZones.length === 0) return;

  console.log('🔵 Adding resource zones:', resourceZones.length);

  // Convert resource zones to GeoJSON
  const features = resourceZones.map(zone => {
    console.log('🔧 Processing resource zone:', zone);
    
    const hexagons = [zone.id];
    const hexagonDataMap = new Map<string, HexagonData>();
    const geoJson = hexagonsToGeoJSON(hexagons, hexagonDataMap);
    
    if (!geoJson.features || geoJson.features.length === 0) {
      console.error('❌ Failed to generate hexagon for resource zone:', zone.id);
      return null;
    }
    
    const feature = {
      ...geoJson.features[0],
      properties: {
        ...geoJson.features[0].properties,
        id: zone.id,
        resourceType: zone.resourceType,
        amount: zone.amount,
        regenerationRate: zone.regenerationRate,
        lastUpdated: zone.lastRegeneration,
        lastRegeneration: zone.lastRegeneration
      }
    };
    
    console.log('✅ Generated feature for resource zone:', feature);
    return feature;
  }).filter((feature): feature is NonNullable<typeof feature> => feature !== null);

  const resourceZonesGeoJSON = {
    type: 'FeatureCollection' as const,
    features
  };

  console.log('📍 Final resource zones GeoJSON:', resourceZonesGeoJSON);
  console.log('📊 Total features created:', features.length);

  // Add source
  map.addSource('resource-zones', {
    type: 'geojson',
    data: resourceZonesGeoJSON
  });

  // Add fill layer for resource hexagons (purple color)
  map.addLayer({
    id: 'resource-zones-fill',
    type: 'fill',
    source: 'resource-zones',
    paint: {
      'fill-color': '#8b5cf6', // Purple color for resource zones
      'fill-opacity': 0.6
    }
  });

  // Add stroke layer for resource hexagons (bright purple border)
  map.addLayer({
    id: 'resource-zones-stroke',
    type: 'line',
    source: 'resource-zones',
    paint: {
      'line-color': '#7c3aed', // Darker purple for border
      'line-width': 4,
      'line-opacity': 0.9
    }
  });

  // Add large background circle for maximum visibility
  map.addLayer({
    id: 'resource-zones-background',
    type: 'circle',
    source: 'resource-zones',
    paint: {
      'circle-radius': 35,
      'circle-color': '#000000',
      'circle-opacity': 0.8,
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 1.0
    }
  });

  // Add HUGE emoji symbols for resource types
  map.addLayer({
    id: 'resource-zones-symbols',
    type: 'symbol',
    source: 'resource-zones',
    layout: {
      'text-field': [
        'case',
        ['==', ['get', 'resourceType'], 'wood'], '🪵',
        ['==', ['get', 'resourceType'], 'iron'], '⚙️',
        ['==', ['get', 'resourceType'], 'stone'], '🪨',
        '📦'
      ],
      'text-size': 80, // Much larger emoji
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'symbol-z-order': 'viewport-y'
    },
    paint: {
      'text-color': '#FFFFFF',
      'text-halo-color': '#000000',
      'text-halo-width': 8,
      'text-halo-blur': 3,
      'text-opacity': 1.0
    }
  });

  // Add resource amount text with bright yellow color
  map.addLayer({
    id: 'resource-zones-amount',
    type: 'symbol',
    source: 'resource-zones',
    layout: {
      'text-field': ['to-string', ['get', 'amount']],
      'text-size': 24,
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-offset': [0, 4.0],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
    },
    paint: {
      'text-color': '#FFFF00',
      'text-halo-color': '#000000',
      'text-halo-width': 5,
      'text-opacity': 1.0
    }
  });

  // Add resource type label
  map.addLayer({
    id: 'resource-zones-label',
    type: 'symbol',
    source: 'resource-zones',
    layout: {
      'text-field': [
        'case',
        ['==', ['get', 'resourceType'], 'wood'], 'MADERA',
        ['==', ['get', 'resourceType'], 'iron'], 'HIERRO',
        ['==', ['get', 'resourceType'], 'stone'], 'PIEDRA',
        'RECURSO'
      ],
      'text-size': 14,
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-offset': [0, -4.5],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-transform': 'uppercase'
    },
    paint: {
      'text-color': '#FFFFFF',
      'text-halo-color': '#8b5cf6',
      'text-halo-width': 3,
      'text-opacity': 1.0
    }
  });

  // Set up click handler if callback provided
  if (onResourceCollect) {
    map.on('click', 'resource-zones-fill', (e) => {
      if (e.features && e.features[0]) {
        const hexagonId = e.features[0].properties?.id;
        if (hexagonId) {
          onResourceCollect(hexagonId);
        }
      }
    });

    // Change cursor on hover
    map.on('mouseenter', 'resource-zones-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'resource-zones-fill', () => {
      map.getCanvas().style.cursor = '';
    });
  }
  
  // Add popup on hover
  addResourceZonePopup(map, 'resource-zones-fill');

  console.log('✅ Resource zones added successfully');

  // Add resource zone click handlers
  const resourceLayers = ['resource-zones-fill', 'resource-zones-symbols', 'resource-zones-amount', 'resource-zones-background', 'resource-zones-label'];
  
  resourceLayers.forEach(layerId => {
    map.on('click', layerId, (e: any) => {
      if (e.features && e.features[0]) {
        const feature = e.features[0];
        const resourceZone = feature.properties;
        
        console.log('🎯 Resource zone clicked:', resourceZone);
        
        // Create resource zone popup info
        const popupContent = `
          <div style="padding: 16px; font-family: system-ui; min-width: 280px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 12px; color: white;">
            <h3 style="margin: 0 0 16px 0; color: #ffffff; display: flex; align-items: center; gap: 12px; font-size: 20px;">
              <span style="font-size: 32px;">${resourceZone.resourceType === 'wood' ? '🪵' : 
                                             resourceZone.resourceType === 'iron' ? '⚙️' : 
                                             resourceZone.resourceType === 'stone' ? '🪨' : '📦'}</span>
              ZONA DE RECURSOS
            </h3>
            <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 12px; backdrop-filter: blur(10px);">
              <p style="margin: 6px 0; color: #ffffff; font-weight: 600; font-size: 16px;">
                <strong>Tipo:</strong> ${resourceZone.resourceType === 'wood' ? '🪵 MADERA' : 
                                      resourceZone.resourceType === 'iron' ? '⚙️ HIERRO' : 
                                      resourceZone.resourceType === 'stone' ? '🪨 PIEDRA' : '📦 DESCONOCIDO'}
              </p>
              <p style="margin: 6px 0; color: #ffffff; font-size: 18px;">
                <strong>Cantidad disponible:</strong> <span style="font-size: 24px; color: #ffff00; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${resourceZone.amount}</span>
              </p>
              <p style="margin: 6px 0; color: #ffffff;">
                <strong>Regeneración:</strong> +${resourceZone.regenerationRate}/hora
              </p>
              <p style="margin: 6px 0; color: #e5e7eb; font-size: 12px;">
                <strong>Última actualización:</strong> ${new Date(resourceZone.lastUpdated).toLocaleTimeString()}
              </p>
            </div>
            <div style="background: rgba(59, 130, 246, 0.3); border: 2px solid #3b82f6; padding: 12px; border-radius: 8px; font-size: 14px; color: #ffffff; text-align: center;">
              <strong>💡 CONSEJO:</strong><br/>
              Acércate a esta zona para recolectar recursos automáticamente
            </div>
          </div>
        `;
        
        new mapboxgl.Popup({ 
          closeOnClick: true,
          closeButton: true,
          maxWidth: '350px',
          className: 'resource-zone-detailed-popup'
        })
          .setLngLat(e.lngLat)
          .setHTML(popupContent)
          .addTo(map);
      }
    });
    
    // Add hover cursor
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  });
}

/**
 * Add resource zone popup on hover
 */
export function addResourceZonePopup(
  map: mapboxgl.Map,
  layerId: string = 'resource-zones-fill'
): mapboxgl.Popup {
  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'resource-zone-popup'
  });

  map.on('mouseenter', layerId, (e) => {
    if (e.features && e.features[0]) {
      const feature = e.features[0];
      const resourceType = feature.properties?.resourceType as ResourceType;
      const amount = feature.properties?.amount || 0;
      const regenerationRate = feature.properties?.regenerationRate || 0;
      
      const resourceIcons: Record<ResourceType, string> = {
        wood: '🪵',
        iron: '⚙️',
        stone: '🪨'
      };
      
      const resourceNames: Record<ResourceType, string> = {
        wood: 'Madera',
        iron: 'Hierro',
        stone: 'Piedra'
      };
      
      const resourceIcon = resourceIcons[resourceType] || '📦';
      const resourceName = resourceNames[resourceType] || 'Recurso';
      
      let popupContent = `
        <div class="resource-zone-popup-content">
          <div class="resource-header">
            <span class="resource-icon">${resourceIcon}</span>
            <span>${resourceName}</span>
          </div>
          <div class="resource-info">
            <div><strong>Disponible:</strong> ${amount}</div>
            <div><strong>Regeneración:</strong> +${regenerationRate}/hora</div>
            ${amount > 0 
              ? '<div class="collect-hint">✋ Click para recolectar</div>' 
              : '<div class="empty-hint">Agotado temporalmente</div>'
            }
          </div>
        </div>
      `;

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