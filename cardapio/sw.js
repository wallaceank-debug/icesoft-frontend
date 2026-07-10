// Trabalhador Invisível (Service Worker)
self.addEventListener('install', (e) => {
    console.log('✅ [Motor PWA] O App da Icesoft foi instalado na máquina.');
});

self.addEventListener('fetch', (e) => {
    // Essa função vazia é obrigatória para o celular liberar o botão "Instalar"
});