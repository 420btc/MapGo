'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function MenuPage() {
  const router = useRouter();

  const handlePlay = () => {
    router.push('/game');
  };

  const handleExit = () => {
    if (typeof window !== 'undefined') {
      window.close();
    }
  };

  return (
    <div 
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        backgroundImage: 'url(/mapgoportada.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >


      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-end min-h-screen px-4 pb-32">
        {/* Title */}
        <div className="mb-8 text-center">
          <p className="text-xl md:text-2xl text-white drop-shadow-lg">
            Conquista el mundo hexágono por hexágono
          </p>
        </div>

        {/* Menu Buttons */}
        <div className="flex flex-col gap-6 w-full max-w-xs">
          <button
            onClick={handlePlay}
            className="bg-white text-black font-bold text-xl py-4 px-8 rounded-lg shadow-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            Jugar
          </button>
          
          <button
            onClick={handleExit}
            className="bg-white text-black font-bold text-xl py-4 px-8 rounded-lg shadow-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            Salir
          </button>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 text-center">
          <p className="text-white text-sm drop-shadow-lg">
            © 2024 MapGo - Juego de Conquista Hexagonal
          </p>
        </div>
      </div>
    </div>
  );
}