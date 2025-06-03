'use client';

import React from 'react';
import type { HUDData } from '@/types';

interface HUDProps {
  data: HUDData | null;
  isLoading?: boolean;
  error?: string | null;
}

const HUD: React.FC<HUDProps> = ({ data, isLoading, error }) => {
  const formatCoordinate = (coord: number, decimals: number = 6): string => {
    return coord.toFixed(decimals);
  };

  const formatAccuracy = (accuracy?: number): string => {
    if (!accuracy) return 'Unknown';
    return accuracy < 1000 ? `${Math.round(accuracy)}m` : `${(accuracy / 1000).toFixed(1)}km`;
  };

  const getConnectionStatusColor = (status: 'online' | 'offline'): string => {
    return status === 'online' ? 'bg-green-500' : 'bg-red-500';
  };

  const getConnectionStatusText = (status: 'online' | 'offline'): string => {
    return status === 'online' ? 'Online' : 'Offline';
  };

  if (error) {
    return (
      <div className="fixed top-4 left-4 right-4 z-50 md:right-auto md:w-80">
        <div className="bg-red-500 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="font-medium">Error</span>
          </div>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="fixed top-4 left-4 right-4 z-50 md:right-auto md:w-80">
        <div className="bg-gray-800 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span className="font-medium">Loading...</span>
          </div>
          <p className="text-sm mt-1">Getting your location...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:right-auto md:w-80">
      <div className="bg-gray-900/90 backdrop-blur-sm text-white p-4 rounded-lg shadow-lg border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">HexaConquest</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor(data.connectionStatus)}`}></div>
            <span className="text-xs">{getConnectionStatusText(data.connectionStatus)}</span>
          </div>
        </div>

        {/* Player Stats */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className="text-xs text-gray-400">Health</div>
            <div className="text-sm font-bold text-green-400">{data.playerState.health}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Score</div>
            <div className="text-sm font-bold text-yellow-400">{data.playerState.score.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Level</div>
            <div className="text-sm font-bold text-blue-400">{data.playerState.level}</div>
          </div>
        </div>

        {/* Position Info */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Latitude:</span>
            <span className="text-xs font-mono">{formatCoordinate(data.position.latitude)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Longitude:</span>
            <span className="text-xs font-mono">{formatCoordinate(data.position.longitude)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Accuracy:</span>
            <span className="text-xs">{formatAccuracy(data.position.accuracy)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Last Update:</span>
            <span className="text-xs">
              {new Date(data.position.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Health Bar */}
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-400">Health</span>
            <span className="text-xs">{data.playerState.health}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${data.playerState.health}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HUD;