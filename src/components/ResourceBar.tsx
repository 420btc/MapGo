'use client';

import React from 'react';
import type { ResourceInventory } from '@/types';

interface ResourceBarProps {
  resources: ResourceInventory | null;
  className?: string;
}

const ResourceBar: React.FC<ResourceBarProps> = ({ resources, className = '' }) => {
  console.log('🔧 ResourceBar rendering with resources:', resources);
  
  // Mostrar siempre la barra con valores por defecto si no hay recursos
  const displayResources = resources || { wood: 0, iron: 0, stone: 0 };

  const resourceItems = [
    {
      type: 'wood',
      icon: '🪵',
      color: 'from-amber-600 to-amber-700',
      bgColor: 'bg-amber-900/20',
      borderColor: 'border-amber-600/30',
      amount: displayResources.wood,
      label: 'Madera'
    },
    {
      type: 'iron',
      icon: '⚙️',
      color: 'from-gray-600 to-gray-700',
      bgColor: 'bg-gray-900/20',
      borderColor: 'border-gray-600/30',
      amount: displayResources.iron,
      label: 'Hierro'
    },
    {
      type: 'stone',
      icon: '🪨',
      color: 'from-stone-600 to-stone-700',
      bgColor: 'bg-stone-900/20',
      borderColor: 'border-stone-600/30',
      amount: displayResources.stone,
      label: 'Piedra'
    }
  ];

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 ${className}`}>
      <div className="bg-black/90 backdrop-blur-md rounded-full shadow-2xl p-2 border border-gray-700/50">
        <div className="flex items-center space-x-3">
          {/* Logo/Title */}
          <div className="hidden sm:flex items-center px-4">
            <span className="text-white font-bold text-lg">🏰</span>
          </div>

          {/* Resources */}
          <div className="flex items-center space-x-2">
            {resourceItems.map((resource) => (
              <div
                key={resource.type}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full ${resource.bgColor} border ${resource.borderColor} transition-all hover:scale-105`}
              >
                <div className="flex items-center space-x-1">
                  <span className="text-2xl">{resource.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-white font-bold text-lg leading-none">
                      {resource.amount}
                    </span>
                    <span className="text-xs text-gray-300 hidden sm:block">
                      {resource.label}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="hidden md:flex items-center px-4 border-l border-gray-700">
            <div className="text-center">
              <div className="text-xs text-gray-400">Total</div>
              <div className="text-lg font-bold text-white">
                {displayResources.wood + displayResources.iron + displayResources.stone}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Production Indicators */}
      <div className="flex justify-center mt-2 space-x-4">
        <div className="bg-green-900/30 text-green-300 text-xs px-3 py-1 rounded-full flex items-center space-x-1">
          <span>📈</span>
          <span>+5/+3/+4 por hora</span>
        </div>
        <div className="bg-red-900/30 text-red-300 text-xs px-3 py-1 rounded-full flex items-center space-x-1">
          <span>📉</span>
          <span>-2/-1/-2 mantenimiento</span>
        </div>
      </div>
    </div>
  );
};

export default ResourceBar; 