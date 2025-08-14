// Test simple para verificar conexión con Groq
// Ejecutar en consola del navegador: testGroqConnection()

window.testGroqConnection = async function() {
  const API_KEY = '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';
  
  console.log('🧪 Iniciando test de conexión con Groq...');
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'user',
            content: 'Di solo "Test exitoso" en JSON: {"message": "..."}'
          }
        ],
        max_tokens: 50
      })
    });

    console.log('📡 Status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ Respuesta:', result);
    return true;
    
  } catch (error) {
    console.error('💥 Error de conexión:', error);
    return false;
  }
};

console.log('🔧 Test cargado. Ejecuta testGroqConnection() en la consola.');
