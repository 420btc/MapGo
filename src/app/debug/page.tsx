'use client';

import React, { useEffect, useState } from 'react';
import { latLngToCell, cellToBoundary, gridDisk } from 'h3-js';
import { DEFAULT_H3_CONFIG } from '@/utils/h3';

export default function DebugPage() {
  const [h3Test, setH3Test] = useState<any>({});
  
  useEffect(() => {
    try {
      // Coordenadas de prueba (Ciudad de México)
      const testLat = 19.4326;
      const testLng = -99.1332;
      const resolution = DEFAULT_H3_CONFIG.resolution;
      
      console.log('🔵 Starting H3 debug test...');
      
      // Test 1: Generar índice H3
      const h3Index = latLngToCell(testLat, testLng, resolution);
      console.log('✅ H3 Index:', h3Index);
      
      // Test 2: Obtener boundary
      const boundary = cellToBoundary(h3Index);
      console.log('✅ Boundary points:', boundary.length);
      console.log('✅ First boundary point:', boundary[0]);
      
      // Test 3: Generar hexágonos vecinos
      const neighbors = gridDisk(h3Index, 2);
      console.log('✅ Neighbors:', neighbors.length);
      
      setH3Test({
        success: true,
        h3Index,
        boundaryPoints: boundary.length,
        neighbors: neighbors.length,
        testCoords: { lat: testLat, lng: testLng },
        resolution,
        library: 'h3-js loaded correctly'
      });
      
    } catch (error) {
      console.error('❌ H3 Test failed:', error);
      setH3Test({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : ''
      });
    }
  }, []);
  
  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6">🔧 H3 Debug Page</h1>
      
      <div className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">H3 Library Test</h2>
        
        {h3Test.success ? (
          <div className="space-y-2">
            <p className="text-green-400">✅ H3 library is working correctly!</p>
            <p>📍 Test coordinates: {h3Test.testCoords?.lat}, {h3Test.testCoords?.lng}</p>
            <p>🔢 Resolution: {h3Test.resolution}</p>
            <p>🆔 H3 Index: <code className="bg-gray-700 px-2 py-1 rounded">{h3Test.h3Index}</code></p>
            <p>📐 Boundary points: {h3Test.boundaryPoints}</p>
            <p>🔷 Neighbors at radius 2: {h3Test.neighbors}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-red-400">❌ H3 library test failed!</p>
            <p>Error: {h3Test.error}</p>
            {h3Test.stack && (
              <pre className="text-xs bg-gray-900 p-2 rounded overflow-auto">
                {h3Test.stack}
              </pre>
            )}
          </div>
        )}
      </div>
      
      <div className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Configuration</h2>
        <pre className="bg-gray-900 p-4 rounded overflow-auto">
          {JSON.stringify(DEFAULT_H3_CONFIG, null, 2)}
        </pre>
      </div>
      
      <div className="bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Debug Instructions</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Open the browser console (F12) to see detailed logs</li>
          <li>Check for any red error messages</li>
          <li>Verify that the H3 library is loaded correctly</li>
          <li>Go back to the game and allow location access</li>
          <li>The hexagons should appear around your current location</li>
        </ul>
      </div>
      
      <div className="flex gap-4">
        <button
          onClick={() => window.location.href = '/'}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
        >
          Back to Menu
        </button>
        
        <button
          onClick={() => window.location.href = '/game'}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg"
        >
          Go to Game
        </button>
      </div>
    </div>
  );
} 