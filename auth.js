// auth.js - O Fiscal de Segurança da Icesoft

function verificarAcesso() {
    // 1. Procura o "crachá" (token) no bolso do navegador
    const cracha = localStorage.getItem('icesoft_token');
    
    // 2. Se o crachá não existir, joga o invasor para fora (tela de login)
    if (!cracha) {
        window.location.href = '../login/index.html'; // Ajuste o caminho se necessário
        return false;
    }
    
    // 3. Se tiver crachá, deixa a tela carregar normalmente
    return true;
}

// 4. Cria o botão de sair (destrói o crachá e expulsa da tela)
function fazerLogout() {
    localStorage.removeItem('icesoft_token');
    localStorage.removeItem('icesoft_usuario');
    window.location.href = '../login/index.html';
}

// Executa a verificação no exato milissegundo que a tela abre
verificarAcesso();

// ==========================================
// 📡 RADAR GLOBAL DE CLIENTES ONLINE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica se a página atual tem o menu lateral com a bolinha do radar
    const badgeRadar = document.getElementById('online-notification-badge');
    if (!badgeRadar) return; // Se for a tela de login (que não tem menu), ele ignora

    // 2. Injeta a antena do Socket.IO silenciosamente no HTML se ela não existir
    if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdn.socket.io/4.7.2/socket.io.min.js";
        script.onload = ligarRadarGlobal;
        document.head.appendChild(script);
    } else {
        ligarRadarGlobal();
    }

    // 3. Liga o rádio
    function ligarRadarGlobal() {
        try {
            const socket = io('https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host');
            
            socket.on('atualiza_clientes_online', (quantidade) => {
                const badge = document.getElementById('online-notification-badge');
                if (badge) {
                    if (quantidade > 0) {
                        badge.textContent = quantidade;
                        badge.style.display = 'flex';
                        badge.title = `${quantidade} cliente(s) navegando no cardápio agora!`;
                    } else {
                        badge.style.display = 'none';
                    }
                }
            });
        } catch(e) {
            console.log("⚠️ Radar global offline: ", e);
        }
    }
});