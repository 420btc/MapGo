'use client';

import React from 'react';
import type { HexagonData } from '@/types';

interface HexagonOverlayProps {
  currentHexagon: string | null;
  hexagonData: HexagonData | null;
  conqueredCount: number;
  totalCount: number;
}

const HexagonOverlay: React.FC<HexagonOverlayProps> = ({ 
  currentHexagon, 
  hexagonData, 
  conqueredCount,
  totalCount 
}) => {
  return (
    <div className="fixed top-24 right-4 z-40 space-y-3">
      {/* Conquest Progress */}
      <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 shadow-xl border border-gray-700/50">
        <h3 className="text-white font-bold text-sm mb-2 flex items-center">
          <span className="mr-2">🗺️</span>
          Progreso de Conquista
        </h3>
        
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-300 mb-1">
            <span>Conquistados</span>
            <span>{conqueredCount} / {totalCount}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${totalCount > 0 ? (conqueredCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
        
        <div className="text-xs text-gray-400">
          {totalCount > 0 ? Math.round((conqueredCount / totalCount) * 100) : 0}% del territorio
        </div>
      </div>

      {/* Current Hexagon Quick Info */}
      {currentHexagon && (
        <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 shadow-xl border border-gray-700/50">
          <h3 className="text-white font-bold text-sm mb-2 flex items-center">
            <span className="mr-2">📍</span>
            Hexágono Actual
          </h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Estado:</span>
              <span className={`text-xs font-semibold ${
                hexagonData?.conquered ? 'text-green-400' : 'text-blue-400'
              }`}>
                {hexagonData?.conquered ? '✅ Conquistado' : '🔷 Disponible'}
              </span>
            </div>
            
            {!hexagonData?.conquered && (
              <div className="text-xs text-yellow-300 bg-yellow-900/20 rounded px-2 py-1">
                💡 Presiona Conquistar o click en el mapa
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 shadow-xl border border-gray-700/50">
        <h3 className="text-white font-bold text-sm mb-2">🎨 Leyenda</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded opacity-40"></div>
            <span className="text-xs text-gray-300">Hexágono no conquistado</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded opacity-40"></div>
            <span className="text-xs text-gray-300">Hexágono conquistado</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-yellow-500 rounded"></div>
            <span className="text-xs text-gray-300">Tu posición actual</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-purple-500 rounded opacity-60"></div>
            <span className="text-xs text-gray-300">Zona de recursos</span>
          </div>
          <div className="flex items-center space-x-3 mt-2 p-2 bg-purple-900/30 rounded">
            <div className="flex space-x-1">
              <span className="text-sm">🪵</span>
              <span className="text-sm">⚙️</span>
              <span className="text-sm">🪨</span>
            </div>
            <span className="text-xs text-purple-200">Madera, Hierro, Piedra</span>
          </div>
          <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-800/50 rounded">
            💡 Click en hexágonos morados para ver recursos disponibles
          </div>
        </div>
      </div>
    </div>
  );
};

export default HexagonOverlay; 