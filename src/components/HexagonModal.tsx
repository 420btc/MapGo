import React from 'react';
import type { HexagonData, PlayerState } from '@/types';

interface HexagonModalProps {
  isOpen: boolean;
  onClose: () => void;
  hexagonId: string | null;
  hexagonData?: HexagonData;
  currentHexagon: string | null;
  playerResources?: { wood: number; iron: number; stone: number };
  onConquer?: () => void;
  onEstablishBase?: () => void;
}

const HexagonModal: React.FC<HexagonModalProps> = ({
  isOpen,
  onClose,
  hexagonId,
  hexagonData,
  currentHexagon,
  playerResources,
  onConquer,
  onEstablishBase
}) => {
  if (!isOpen || !hexagonId) return null;

  const conquestCost = { wood: 10, iron: 5, stone: 8 };
  const baseCost = { wood: 50, iron: 30, stone: 40 };
  
  const canAffordConquest = playerResources && 
    playerResources.wood >= conquestCost.wood &&
    playerResources.iron >= conquestCost.iron &&
    playerResources.stone >= conquestCost.stone;

  const canAffordBase = playerResources &&
    playerResources.wood >= baseCost.wood &&
    playerResources.iron >= baseCost.iron &&
    playerResources.stone >= baseCost.stone;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 text-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-blue-400">📍 Información del Hexágono</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* Hexagon Info */}
        <div className="mb-4">
          <div className="bg-gray-800 rounded p-3 mb-3">
            <div className="text-xs text-gray-400 mb-1">ID del Hexágono</div>
            <div className="text-sm font-mono">{hexagonId.slice(0, 12)}...</div>
          </div>
          
          <div className="bg-gray-800 rounded p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Estado:</span>
              <span className={`text-sm font-bold ${
                hexagonData?.conquered ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {hexagonData?.conquered ? '🏴 Conquistado' : '🆓 Disponible'}
              </span>
            </div>
            
            {hexagonData?.conquered && hexagonData.conqueredBy && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="text-xs text-gray-400">Conquistado por:</div>
                <div className="text-sm">{hexagonData.conqueredBy}</div>
                {hexagonData.conqueredAt && (
                  <div className="text-xs text-gray-500 mt-1">
                    {hexagonData.conqueredAt.toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Player Resources */}
        {playerResources && (
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2 text-blue-300">💰 Tus Recursos:</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-amber-900/30 rounded p-2 text-center border border-amber-700/50">
                <div className="text-amber-300 text-lg">🪵</div>
                <div className="text-xs text-amber-200">Madera</div>
                <div className="text-sm font-bold text-amber-100">{playerResources.wood}</div>
              </div>
              <div className="bg-gray-700/30 rounded p-2 text-center border border-gray-600/50">
                <div className="text-gray-300 text-lg">⚙️</div>
                <div className="text-xs text-gray-200">Hierro</div>
                <div className="text-sm font-bold text-gray-100">{playerResources.iron}</div>
              </div>
              <div className="bg-stone-700/30 rounded p-2 text-center border border-stone-600/50">
                <div className="text-stone-300 text-lg">🪨</div>
                <div className="text-xs text-stone-200">Piedra</div>
                <div className="text-sm font-bold text-stone-100">{playerResources.stone}</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!hexagonData?.conquered && (
          <div className="space-y-3">
            {/* Conquest Action */}
            <div className="bg-gray-800 rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold">⚔️ Conquistar Hexágono</span>
                <span className={`text-xs ${
                  canAffordConquest ? 'text-green-400' : 'text-red-400'
                }`}>
                  {canAffordConquest ? '✓ Disponible' : '✗ Sin recursos'}
                </span>
              </div>
              
              <div className="text-xs text-gray-400 mb-2">Costo:</div>
              <div className="flex gap-2 text-xs mb-3">
                <span className={`${playerResources && playerResources.wood >= conquestCost.wood ? 'text-amber-300' : 'text-red-400'}`}>
                  🪵 {conquestCost.wood}
                </span>
                <span className={`${playerResources && playerResources.iron >= conquestCost.iron ? 'text-gray-300' : 'text-red-400'}`}>
                  ⚙️ {conquestCost.iron}
                </span>
                <span className={`${playerResources && playerResources.stone >= conquestCost.stone ? 'text-stone-300' : 'text-red-400'}`}>
                  🪨 {conquestCost.stone}
                </span>
              </div>
              
              <button
                onClick={() => {
                  if (canAffordConquest && onConquer) {
                    onConquer();
                    onClose();
                  }
                }}
                disabled={!canAffordConquest}
                className={`w-full py-2 px-4 rounded text-sm font-semibold transition-colors ${
                  canAffordConquest
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {canAffordConquest ? 'Conquistar' : 'Recursos Insuficientes'}
              </button>
            </div>

            {/* Base Establishment */}
            <div className="bg-gray-800 rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold">🏠 Establecer Base</span>
                <span className={`text-xs ${
                  canAffordBase ? 'text-green-400' : 'text-red-400'
                }`}>
                  {canAffordBase ? '✓ Disponible' : '✗ Sin recursos'}
                </span>
              </div>
              
              <div className="text-xs text-gray-400 mb-2">Costo:</div>
              <div className="flex gap-2 text-xs mb-3">
                <span className={`${playerResources && playerResources.wood >= baseCost.wood ? 'text-amber-300' : 'text-red-400'}`}>
                  🪵 {baseCost.wood}
                </span>
                <span className={`${playerResources && playerResources.iron >= baseCost.iron ? 'text-gray-300' : 'text-red-400'}`}>
                  ⚙️ {baseCost.iron}
                </span>
                <span className={`${playerResources && playerResources.stone >= baseCost.stone ? 'text-stone-300' : 'text-red-400'}`}>
                  🪨 {baseCost.stone}
                </span>
              </div>
              
              <button
                onClick={() => {
                  if (canAffordBase && onEstablishBase) {
                    onEstablishBase();
                    onClose();
                  }
                }}
                disabled={!canAffordBase}
                className={`w-full py-2 px-4 rounded text-sm font-semibold transition-colors ${
                  canAffordBase
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {canAffordBase ? 'Establecer Base' : 'Recursos Insuficientes'}
              </button>
            </div>
          </div>
        )}

        {/* Already Conquered */}
        {hexagonData?.conquered && (
          <div className="bg-green-900/30 border border-green-700/50 rounded p-3 text-center">
            <div className="text-green-400 text-sm font-semibold mb-1">✅ Hexágono ya conquistado</div>
            <div className="text-xs text-green-300">Este territorio ya está bajo control</div>
          </div>
        )}

        {/* Close Button */}
        <div className="mt-4 pt-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default HexagonModal;