'use client';

import React from 'react';
import type { ResourceZone, ResourceInventory } from '@/types';

interface ResourceCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceZone: ResourceZone | null;
  playerResources?: ResourceInventory;
  onCollect: () => void;
  isCollecting?: boolean;
}

const ResourceCollectionModal: React.FC<ResourceCollectionModalProps> = ({
  isOpen,
  onClose,
  resourceZone,
  playerResources,
  onCollect,
  isCollecting = false
}) => {
  if (!isOpen || !resourceZone) return null;

  const resourceIcon = {
    wood: '🪵',
    iron: '⚙️',
    stone: '🪨'
  }[resourceZone.resourceType] || '📦';

  const resourceName = {
    wood: 'Madera',
    iron: 'Hierro',
    stone: 'Piedra'
  }[resourceZone.resourceType] || 'Recurso';

  const collectionAmount = Math.floor(resourceZone.amount * 0.2); // 20% of available

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 text-white rounded-lg shadow-xl max-w-md w-full animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 rounded-t-lg">
          <h2 className="text-xl font-bold flex items-center">
            <span className="text-2xl mr-2">{resourceIcon}</span>
            ¡Zona de Recursos Encontrada!
          </h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-lg mb-2">Has encontrado una zona de <strong>{resourceName}</strong></p>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Recursos disponibles:</span>
                <span className="text-xl font-bold">{resourceZone.amount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Puedes recolectar:</span>
                <span className="text-xl font-bold text-green-400">+{collectionAmount}</span>
              </div>
            </div>
          </div>

          {/* Current Resources */}
          {playerResources && (
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">Tus recursos actuales:</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-amber-900/30 border border-amber-700/50 rounded p-2 text-center">
                  <div className="text-lg">🪵</div>
                  <div className="text-sm">{playerResources.wood}</div>
                </div>
                <div className="bg-gray-700/30 border border-gray-600/50 rounded p-2 text-center">
                  <div className="text-lg">⚙️</div>
                  <div className="text-sm">{playerResources.iron}</div>
                </div>
                <div className="bg-stone-700/30 border border-stone-600/50 rounded p-2 text-center">
                  <div className="text-lg">🪨</div>
                  <div className="text-sm">{playerResources.stone}</div>
                </div>
              </div>
            </div>
          )}

          {/* Regeneration Info */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded p-3 mb-4">
            <p className="text-xs text-blue-300">
              ℹ️ Esta zona regenera <strong>{resourceZone.regenerationRate}</strong> recursos por hora
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-800 px-6 py-4 rounded-b-lg flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            disabled={isCollecting}
          >
            Cancelar
          </button>
          <button
            onClick={onCollect}
            disabled={isCollecting || resourceZone.amount <= 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center space-x-2"
          >
            {isCollecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Recolectando...</span>
              </>
            ) : (
              <>
                <span>✋</span>
                <span>Recolectar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResourceCollectionModal; 