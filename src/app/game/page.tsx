'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useGameState } from '@/hooks/useGameState';
import HUD from '@/components/HUD';
import HexagonModal from '@/components/HexagonModal';
import ResourceCollectionModal from '@/components/ResourceCollectionModal';
import ResourceBar from '@/components/ResourceBar';
import HexagonOverlay from '@/components/HexagonOverlay';
import type { HexagonData, ResourceZone } from '@/types';
import { DEFAULT_H3_CONFIG, generateHexagonsInRadius, getCurrentHexagon } from '@/utils/h3';

// Dynamically import Map component to avoid SSR issues with Mapbox
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  )
});

export default function Home() {
  const {
    position,
    hudData,
    currentHexagon,
    hexagonData,
    hexagonStats,
    homeBase,
    isAwayFromHome,
    isLoading,
    error,
    connectionStatus,
    resourceZones,
    initializeGame,
    refreshPosition,
    conquerCurrentHexagon,
    setHomeBase,
    resetToHomeBase,
    collectResources,
    establishBase,
    upgradeBase,
    initializeResourceZones
  } = useGameState(DEFAULT_H3_CONFIG);

  const [gameInitialized, setGameInitialized] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedHexagon, setSelectedHexagon] = useState<string | null>(null);
  const [selectedHexagonData, setSelectedHexagonData] = useState<HexagonData | undefined>(undefined);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [currentResourceZone, setCurrentResourceZone] = useState<ResourceZone | null>(null);
  const [isCollectingResource, setIsCollectingResource] = useState(false);

  console.log('🎮 Game page render:', {
    position: position ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}` : 'null',
    currentHexagon,
    resourceZonesCount: resourceZones.length,
    resourceZones: resourceZones.map(zone => ({
      id: zone.id.slice(-6),
      type: zone.resourceType,
      amount: zone.amount
    })),
    isLoading,
    error
  });

  // Initialize game on component mount
  useEffect(() => {
    if (!gameInitialized) {
      initializeGame();
      setGameInitialized(true);
    }
  }, [initializeGame, gameInitialized]);

  // Initialize resource zones when position is available
  useEffect(() => {
    if (position && currentHexagon && resourceZones.length === 0) {
      // Generate hexagons around the player's current position for resource zones
      const hexagonsInRadius = generateHexagonsInRadius(
        position.latitude,
        position.longitude,
        3, // radius of 3 hexagons around player
        DEFAULT_H3_CONFIG.resolution
      );
      initializeResourceZones(hexagonsInRadius);
    }
  }, [position, currentHexagon, resourceZones.length, initializeResourceZones]);

  // Detect when player enters a resource zone
  useEffect(() => {
    if (!currentHexagon || !resourceZones.length) return;

    // Check if current hexagon is a resource zone
    const resourceZone = resourceZones.find(zone => zone.id === currentHexagon);
    
    if (resourceZone && resourceZone.amount > 0) {
      console.log('🎯 Player entered resource zone:', resourceZone);
      setCurrentResourceZone(resourceZone);
      setResourceModalOpen(true);
    }
  }, [currentHexagon, resourceZones]);

  // Handle hex selection
  const handleHexSelect = async (h3Index: string, coordinates: [number, number], hexagonData?: HexagonData) => {
    console.log('Hexagon selected:', h3Index, coordinates, hexagonData);
    
    // Open modal with hexagon information
    setSelectedHexagon(h3Index);
    setSelectedHexagonData(hexagonData);
    setModalOpen(true);
  };

  // Handle conquest from modal
  const handleConquestFromModal = async () => {
    if (selectedHexagon !== currentHexagon) {
      alert('❌ Debes estar físicamente en este hexágono para conquistarlo. Muévete hasta el hexágono y vuelve a intentarlo.');
      return;
    }

    try {
      await conquerCurrentHexagon();
      console.log('Hexagon conquered successfully!');
    } catch (error) {
      console.error('Failed to conquer hexagon:', error);
      alert('❌ Error al conquistar el hexágono. Inténtalo de nuevo.');
    }
  };

  // Handle base establishment from modal
  const handleEstablishBaseFromModal = async () => {
    if (selectedHexagon !== currentHexagon) {
      alert('❌ Debes estar físicamente en este hexágono para establecer una base.');
      return;
    }

    try {
      await establishBase(selectedHexagon!);
      console.log('Base established successfully!');
    } catch (error) {
      console.error('Failed to establish base:', error);
      alert('❌ Error al establecer la base. Inténtalo de nuevo.');
    }
  };

  // Handle conquer button
  const handleConquerHexagon = async () => {
    if (!currentHexagon || hexagonData?.conquered) return;
    
    // Verificar recursos
    if (hudData?.playerState?.resources) {
      const hasResources = 
        hudData.playerState.resources.wood >= 10 &&
        hudData.playerState.resources.iron >= 5 &&
        hudData.playerState.resources.stone >= 8;
      
      if (!hasResources) {
        const needed = [];
        if (hudData.playerState.resources.wood < 10) {
          needed.push(`${10 - hudData.playerState.resources.wood} 🪵 Madera`);
        }
        if (hudData.playerState.resources.iron < 5) {
          needed.push(`${5 - hudData.playerState.resources.iron} ⚙️ Hierro`);
        }
        if (hudData.playerState.resources.stone < 8) {
          needed.push(`${8 - hudData.playerState.resources.stone} 🪨 Piedra`);
        }
        
        alert(`❌ Recursos insuficientes para conquistar.\n\nNecesitas:\n${needed.join('\n')}`);
        return;
      }
    }
    
    const success = await conquerCurrentHexagon();
    if (success) {
      alert('🎉 ¡Hexágono conquistado exitosamente!');
      console.log('Current hexagon conquered!');
    } else {
      alert('❌ No se pudo conquistar el hexágono. Inténtalo de nuevo.');
    }
  };

  // Handle refresh button
  const handleRefresh = () => {
    refreshPosition();
  };

  // Handle set home base
  const handleSetHomeBase = async () => {
    if (position) {
      await setHomeBase(position);
    }
  };

  // Handle return to home base
  const handleReturnHome = async () => {
    await resetToHomeBase();
  };

  // Handle resource collection from modal
  const handleResourceCollectFromModal = async () => {
    if (!currentResourceZone) return;

    setIsCollectingResource(true);
    
    try {
      const success = await collectResources(currentResourceZone.id);
      
      if (success) {
        const resourceName = {
          wood: 'madera',
          iron: 'hierro',
          stone: 'piedra'
        }[currentResourceZone.resourceType] || 'recursos';
        
        alert(`✅ ¡Has recolectado ${resourceName} exitosamente!`);
        setResourceModalOpen(false);
        setCurrentResourceZone(null);
      } else {
        alert('❌ No se pudieron recolectar los recursos. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error collecting resources:', error);
      alert('❌ Error al recolectar recursos.');
    } finally {
      setIsCollectingResource(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900">
      {/* HUD Overlay */}
      <HUD 
        data={hudData} 
        isLoading={isLoading} 
        error={error}
      />
      
      {/* Resource Bar */}
      <ResourceBar resources={hudData?.playerState?.resources || null} />
      
      {/* Hexagon Overlay Info */}
      <HexagonOverlay 
        currentHexagon={currentHexagon}
        hexagonData={hexagonData}
        conqueredCount={hexagonStats?.conquered || 0}
        totalCount={hexagonStats?.total || 0}
      />

      {/* Main Game Area */}
      <div className="h-full w-full relative">
        {/* Map Container */}
        <Map 
          position={position}
          currentHexagon={currentHexagon}
          resourceZones={resourceZones}
          onHexSelect={handleHexSelect}
          onResourceCollect={collectResources}
          onBaseEstablish={establishBase}
          h3Config={DEFAULT_H3_CONFIG}
          className="h-full w-full"
        />

        {/* Bottom Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="flex space-x-2">
            {/* Back to Menu Button */}
            <button
              onClick={() => window.location.href = '/'}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Menú</span>
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
            
            {/* Home Base Controls */}
            <button
              onClick={handleSetHomeBase}
              disabled={isLoading || !position}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Set Home</span>
            </button>
            
            {homeBase && isAwayFromHome && (
              <button
                onClick={handleReturnHome}
                disabled={isLoading}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Go Home</span>
              </button>
            )}
            
            {/* Conquer Button */}
            {currentHexagon && !hexagonData?.conquered && (
              <button
                onClick={handleConquerHexagon}
                disabled={isLoading || (hudData?.playerState?.resources && (
                  hudData.playerState.resources.wood < 10 ||
                  hudData.playerState.resources.iron < 5 ||
                  hudData.playerState.resources.stone < 8
                ))}
                className={`${
                  hudData?.playerState?.resources && (
                    hudData.playerState.resources.wood >= 10 &&
                    hudData.playerState.resources.iron >= 5 &&
                    hudData.playerState.resources.stone >= 8
                  ) 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-600 cursor-not-allowed'
                } disabled:bg-gray-600 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center space-x-2`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>
                  {hudData?.playerState?.resources && (
                    hudData.playerState.resources.wood >= 10 &&
                    hudData.playerState.resources.iron >= 5 &&
                    hudData.playerState.resources.stone >= 8
                  ) ? 'Conquistar' : 'Sin Recursos'}
                </span>
              </button>
            )}
            
            {/* Establish Base Button */}
            {currentHexagon && !hexagonData?.conquered && !hudData?.playerState?.baseHexagon && (
              <button
                onClick={() => establishBase(currentHexagon)}
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Establecer Base</span>
              </button>
            )}
            
            {connectionStatus === 'offline' && (
              <div className="bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span>Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Home Base Status with Resources */}
        {homeBase && hudData?.playerState && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/80 text-white p-4 rounded-lg shadow-xl z-40 min-w-[300px]">
            <h3 className="font-bold text-lg mb-3 flex items-center justify-between">
              <span>🏠 Base Principal</span>
              {isAwayFromHome ? 
                <span className="text-xs text-orange-400 bg-orange-900/30 px-2 py-1 rounded">Lejos</span> : 
                <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">En Casa</span>
              }
            </h3>
            
            {/* Base Location */}
            <div className="text-xs text-gray-300 mb-3">
              <p>📍 Lat: {homeBase.latitude.toFixed(6)} | Lng: {homeBase.longitude.toFixed(6)}</p>
            </div>
            
            {/* Base Resources Display */}
            {hudData.playerState.resources && (
              <div className="border-t border-gray-600 pt-3">
                <h4 className="text-sm font-semibold mb-2 text-gray-300">💰 Recursos Disponibles:</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-2 text-center">
                    <div className="text-2xl mb-1">🪵</div>
                    <div className="text-lg font-bold text-amber-300">{hudData.playerState.resources.wood}</div>
                    <div className="text-xs text-gray-400">Madera</div>
                  </div>
                  <div className="bg-gray-700/30 border border-gray-600/50 rounded-lg p-2 text-center">
                    <div className="text-2xl mb-1">⚙️</div>
                    <div className="text-lg font-bold text-gray-300">{hudData.playerState.resources.iron}</div>
                    <div className="text-xs text-gray-400">Hierro</div>
                  </div>
                  <div className="bg-stone-700/30 border border-stone-600/50 rounded-lg p-2 text-center">
                    <div className="text-2xl mb-1">🪨</div>
                    <div className="text-lg font-bold text-stone-300">{hudData.playerState.resources.stone}</div>
                    <div className="text-xs text-gray-400">Piedra</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Base Production & Maintenance Info */}
            {hudData.playerState.baseHexagon && (
              <div className="border-t border-gray-600 pt-3 mt-3">
                <h4 className="text-sm font-semibold mb-2 text-gray-300">🏭 Producción y Mantenimiento:</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-400">📈 Producción/hora:</span>
                    <span className="text-green-300">+5 🪵 +3 ⚙️ +4 🪨</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-400">📉 Mantenimiento:</span>
                    <span className="text-red-300">-2 🪵 -1 ⚙️ -1 🪨</span>
                  </div>
                  
                  {/* Maintenance Warning */}
                  {hudData.playerState.resources && (
                    <div className="mt-2 p-2 rounded bg-yellow-900/20 border border-yellow-700/50">
                      <p className="text-xs text-yellow-300">
                        ⚠️ <strong>Atención:</strong> Mantén recursos suficientes para el mantenimiento o perderás la base.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Welcome Message for First Time Users */}
        {!position && !error && !isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md mx-4 text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">🎯 Bienvenido a HexaConquest!</h2>
              <p className="text-gray-600 mb-4">
                Conquista territorios hexagonales en el mundo real usando indexación geoespacial H3.
              </p>
              <div className="text-sm text-gray-500 mb-6">
                <p>• Muévete para descubrir nuevos hexágonos</p>
                <p>• Recolecta recursos para conquistar</p>
                <p>• Construye tu imperio territorial</p>
                <p>• Gestiona recursos y establece bases</p>
              </div>
              <p className="text-gray-600 mb-6">
                Este juego usa tu ubicación real. Por favor permite el acceso a la ubicación para comenzar a jugar.
              </p>
              <button
                onClick={initializeGame}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                🚀 Comenzar Conquista
              </button>
            </div>
          </div>
        )}

        {/* Hexagon Modal */}
        <HexagonModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          hexagonId={selectedHexagon}
          hexagonData={selectedHexagonData}
          currentHexagon={currentHexagon}
          playerResources={hudData?.playerState?.resources}
          onConquer={handleConquestFromModal}
          onEstablishBase={handleEstablishBaseFromModal}
        />
        
        {/* Resource Collection Modal */}
        <ResourceCollectionModal
          isOpen={resourceModalOpen}
          onClose={() => setResourceModalOpen(false)}
          resourceZone={currentResourceZone}
          playerResources={hudData?.playerState?.resources}
          onCollect={handleResourceCollectFromModal}
          isCollecting={isCollectingResource}
        />
      </div>
    </div>
  );
}
