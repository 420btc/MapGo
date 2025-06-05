// Script para limpiar zonas de recursos desde la consola del navegador
// Ejecutar en la consola del navegador en la página del juego

async function clearAndRegenerate() {
  try {
    // Abrir IndexedDB
    const request = indexedDB.open('HexaConquestDB', 1);
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      const transaction = db.transaction(['resourceZones'], 'readwrite');
      const store = transaction.objectStore('resourceZones');
      
      // Limpiar todas las zonas de recursos
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = function() {
        console.log('✅ Resource zones cleared successfully!');
        console.log('🔄 Please refresh the page to regenerate resources.');
        // Opcional: recargar la página automáticamente
        // window.location.reload();
      };
      
      clearRequest.onerror = function() {
        console.error('❌ Error clearing resource zones');
      };
    };
    
    request.onerror = function() {
      console.error('❌ Error opening database');
    };
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar la función
clearAndRegenerate();