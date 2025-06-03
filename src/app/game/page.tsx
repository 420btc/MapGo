'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useGameState } from '@/hooks/useGameState';
import HUD from '@/components/HUD';
import type { HexagonData } from '@/types';
import { DEFAULT_H3_CONFIG } from '@/utils/h3';

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
    initializeGame,
    refreshPosition,
    conquerCurrentHexagon,
    setHomeBase,
    resetToHomeBase
  } = useGameState(DEFAULT_H3_CONFIG);

  const [gameInitialized, setGameInitialized] = useState(false);

  // Initialize game on component mount
  useEffect(() => {
    if (!gameInitialized) {
      initializeGame();
      setGameInitialized(true);
    }
  }, [initializeGame, gameInitialized]);

  // Handle hex selection
  const handleHexSelect = async (h3Index: string, coordinates: [number, number], hexagonData?: HexagonData) => {
    console.log('Hexagon selected:', h3Index, coordinates, hexagonData);
    
    // If this is the current hexagon and it's not conquered, try to conquer it
    if (h3Index === currentHexagon && !hexagonData?.conquered) {
      const success = await conquerCurrentHexagon();
      if (success) {
        console.log('Hexagon conquered successfully!');
      } else {
        console.log('Failed to conquer hexagon');
      }
    } else if (hexagonData?.conquered) {
      console.log('This hexagon is already conquered by:', hexagonData.conqueredBy);
    } else {
      console.log('You need to be in this hexagon to conquer it');
    }
  };

  // Handle conquer button
  const handleConquerHexagon = async () => {
    if (currentHexagon && !hexagonData?.conquered) {
      const success = await conquerCurrentHexagon();
      if (success) {
        console.log('Current hexagon conquered!');
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
          onHexSelect={handleHexSelect}
          h3Config={DEFAULT_H3_CONFIG}
          className="h-full w-full"
        />

        {/* Bottom Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="flex space-x-2">
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
                <span>Conquer</span>
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

        {/* Home Base Status */}
        {homeBase && (
          <div className="absolute top-20 right-4 bg-black/70 text-white p-3 rounded-lg shadow-lg z-40">
            <h3 className="font-bold text-sm mb-2">🏠 Home Base</h3>
            <p className="text-xs mb-1">Lat: {homeBase.latitude.toFixed(6)}</p>
            <p className="text-xs mb-1">Lng: {homeBase.longitude.toFixed(6)}</p>
            <p className="text-xs">
              Status: {isAwayFromHome ? 
                <span className="text-orange-400">Away from Home</span> : 
                <span className="text-green-400">At Home</span>
              }
            </p>
          </div>
        )}

        {/* Hexagon Stats */}
        {hexagonStats && (
          <div className="absolute top-20 left-4 bg-black/70 text-white p-3 rounded-lg shadow-lg z-40">
            <h3 className="font-bold text-sm mb-2">🏆 Conquest Stats</h3>
            <p className="text-xs">Conquered: {hexagonStats.conquered}</p>
            <p className="text-xs">Total Visited: {hexagonStats.total}</p>
            <p className="text-xs">Progress: {hexagonStats.total > 0 ? Math.round((hexagonStats.conquered / hexagonStats.total) * 100) : 0}%</p>
          </div>
        )}

        {/* Current Hexagon Info */}
        {currentHexagon && (
          <div className="absolute top-4 left-4 bg-black/70 text-white p-3 rounded-lg shadow-lg z-40 max-w-xs">
            <h3 className="font-bold text-sm mb-2">📍 Current Hexagon</h3>
            <p className="text-xs mb-1">ID: {currentHexagon}</p>
            <p className="text-xs mb-1">
              Status: {hexagonData?.conquered ? 
                <span className="text-green-400">Conquered</span> : 
                <span className="text-yellow-400">Available</span>
              }
            </p>
            {hexagonData?.conquered && hexagonData.conqueredBy && (
              <p className="text-xs">By: {hexagonData.conqueredBy}</p>
            )}
            {hexagonData?.conqueredAt && (
              <p className="text-xs">At: {hexagonData.conqueredAt.toLocaleString()}</p>
            )}
          </div>
        )}

        {/* Welcome Message for First Time Users */}
        {!position && !error && !isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md mx-4 text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">🎯 Welcome to HexaConquest!</h2>
              <p className="text-gray-600 mb-4">
                Conquer hexagonal territories in the real world using H3 geospatial indexing.
              </p>
              <div className="text-sm text-gray-500 mb-6">
                <p>• Move around to discover new hexagons</p>
                <p>• Tap hexagons to conquer them</p>
                <p>• Build your territorial empire</p>
              </div>
              <p className="text-gray-600 mb-6">
                This game uses your real location. Please allow location access to start playing.
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
      </div>
    </div>
  );
}
