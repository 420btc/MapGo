'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useGameState } from '@/hooks/useGameState';
import HUD from '@/components/HUD';
import HexagonModal from '@/components/HexagonModal';
import type { HexagonData } from '@/types';
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
    if (currentHexagon && !hexagonData?.conquered) {
      const success = await conquerCurrentHexagon();
      if (success) {
        alert('🎉 ¡Hexágono conquistado exitosamente!');
        console.log('Current hexagon conquered!');
      } else {
        alert('❌ No se pudo conquistar el hexágono. Verifica que tengas suficientes recursos.');
      }
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

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900">
      {/* HUD Overlay */}
      <HUD 
        data={hudData} 
        isLoading={isLoading} 
        error={error}
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
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Conquistar</span>
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
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/70 text-white p-3 rounded-lg shadow-lg z-40 min-w-[200px]">
            <h3 className="font-bold text-sm mb-2">🏠 Base Principal</h3>
            <p className="text-xs mb-1">Lat: {homeBase.latitude.toFixed(6)}</p>
            <p className="text-xs mb-2">Lng: {homeBase.longitude.toFixed(6)}</p>
            
            {/* Base Status */}
            <p className="text-xs mb-2">
              Estado: {isAwayFromHome ? 
                <span className="text-orange-400">Lejos de Casa</span> : 
                <span className="text-green-400">En Casa</span>
              }
            </p>
            
            {/* Base Resources */}
            {hudData.playerState.resources && (
              <div className="border-t border-gray-600 pt-2">
                <h4 className="text-xs font-semibold mb-1">💰 Recursos de la Base:</h4>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div className="bg-amber-900/50 rounded px-1 py-0.5 text-center">
                    <div className="text-amber-300">🪵</div>
                    <div>{hudData.playerState.resources.wood}</div>
                  </div>
                  <div className="bg-gray-700/50 rounded px-1 py-0.5 text-center">
                    <div className="text-gray-300">⚙️</div>
                    <div>{hudData.playerState.resources.iron}</div>
                  </div>
                  <div className="bg-stone-700/50 rounded px-1 py-0.5 text-center">
                    <div className="text-stone-300">🪨</div>
                    <div>{hudData.playerState.resources.stone}</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Base Production Info */}
            {hudData.playerState.baseHexagon && (
              <div className="border-t border-gray-600 pt-2 mt-2">
                <h4 className="text-xs font-semibold mb-1">🏭 Producción:</h4>
                <p className="text-xs text-green-400">+5 🪵 +3 ⚙️ +4 🪨 /hora</p>
                <p className="text-xs text-red-400">-2 🪵 -1 ⚙️ -1 🪨 /mantenimiento</p>
              </div>
            )}
          </div>
        )}

        {/* Hexagon Stats */}
        {hexagonStats && (
          <div className="absolute bottom-20 left-4 bg-black/70 text-white p-3 rounded-lg shadow-lg z-40">
            <h3 className="font-bold text-sm mb-2">🏆 Estadísticas de Conquista</h3>
            <p className="text-xs">Conquistados: {hexagonStats.conquered}</p>
            <p className="text-xs">Total Visitados: {hexagonStats.total}</p>
            <p className="text-xs">Progreso: {hexagonStats.total > 0 ? Math.round((hexagonStats.conquered / hexagonStats.total) * 100) : 0}%</p>
            
            {/* Game Instructions */}
            <div className="border-t border-gray-600 pt-2 mt-2">
              <h4 className="text-xs font-semibold mb-1">🎮 Cómo Jugar:</h4>
              <ul className="text-xs text-gray-300 space-y-0.5">
                <li>• Muévete físicamente para explorar</li>
                <li>• Toca hexágonos para conquistarlos</li>
                <li>• Establece bases para generar recursos</li>
                <li>• Gestiona tus recursos sabiamente</li>
              </ul>
            </div>
          </div>
        )}

        {/* Current Hexagon Info */}
        {currentHexagon && (
          <div className="absolute top-4 left-4 bg-black/70 text-white p-3 rounded-lg shadow-lg z-40 max-w-xs">
            <h3 className="font-bold text-sm mb-2">📍 Hexágono Actual</h3>
            <p className="text-xs mb-1">ID: {currentHexagon.slice(0, 12)}...</p>
            <p className="text-xs mb-1">
              Estado: {hexagonData?.conquered ? 
                <span className="text-green-400">Conquistado</span> : 
                <span className="text-yellow-400">Disponible</span>
              }
            </p>
            {hexagonData?.conquered && hexagonData.conqueredBy && (
              <p className="text-xs">Por: {hexagonData.conqueredBy}</p>
            )}
            {hexagonData?.conqueredAt && (
              <p className="text-xs">Fecha: {hexagonData.conqueredAt.toLocaleString()}</p>
            )}
            
            {/* Action Instructions */}
            {!hexagonData?.conquered && (
              <div className="border-t border-gray-600 pt-2 mt-2">
                <p className="text-xs text-blue-300">💡 Toca el hexágono en el mapa o usa el botón 'Conquistar' para reclamarlo</p>
                {hudData?.playerState?.resources && (
                  <p className="text-xs text-gray-400 mt-1">Costo: 10 🪵 5 ⚙️ 8 🪨</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Welcome Message for First Time Users */}
        {!position && !error && !isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md mx-4 text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">🎯 Welcome to HexaConquest!</h2>
              <p className="text-gray-600 mb-4">
                Conquista territorios hexagonales en el mundo real usando indexación geoespacial H3.
              </p>
              <div className="text-sm text-gray-500 mb-6">
                <p>• Muévete para descubrir nuevos hexágonos</p>
                <p>• Toca hexágonos para conquistarlos</p>
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
                🚀 Start Conquest
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
      </div>
    </div>
  );
}
