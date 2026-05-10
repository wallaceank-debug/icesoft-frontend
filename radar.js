// ==========================================
// 🔔 RADAR GLOBAL DE PEDIDOS (radar.js)
// Módulo independente - Basta plugar no HTML de qualquer tela
// ==========================================

const RADAR_API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let radarGlobal_ultimoId = 0;
let radarGlobal_primeiraCarga = true;

async function checarNovosPedidosGlobal() {
    try {
        const res = await fetch(`${RADAR_API_URL}/vendas`);
        const vendas = await res.json();
        
        let maxIdAtual = 0;
        vendas.forEach(v => {
            if (v.id > maxIdAtual) maxIdAtual = v.id;
        });

        // Se encontrou um ID maior, é venda nova!
        if (!radarGlobal_primeiraCarga && maxIdAtual > radarGlobal_ultimoId) {
            
            // 1. Toca a campainha (O '/kanban/' garante que ache não importa a pasta da tela atual)
            try {
                const audio = new Audio('../kanban/campainha.mp3');
                audio.play().catch(() => console.log("Áudio aguardando interação do usuário na tela."));
            } catch(e) {}

            // 2. Cria a Bolha Visual
            if (!document.getElementById('bolha-alerta-pedido')) {
                const bolha = document.createElement('div');
                bolha.id = 'bolha-alerta-pedido';
                bolha.innerHTML = `
                    <div style="font-size: 28px; margin-bottom: 5px;">🔔</div>
                    <strong style="display: block; font-size: 16px;">Novo Pedido!</strong>
                    <span style="font-size: 13px; opacity: 0.9;">Clique aqui para abrir o Kanban</span>
                `;
                
                bolha.style.cssText = `
                    position: fixed; bottom: 30px; right: 30px; 
                    background: #e91e63; color: white; 
                    padding: 15px 25px; border-radius: 12px; 
                    box-shadow: 0 8px 25px rgba(0,0,0,0.4); 
                    z-index: 99999; cursor: pointer; 
                    font-family: 'Inter', sans-serif; text-align: center; 
                    animation: piscarAlerta 0.6s infinite alternate;
                `;
                
                // O '/kanban/' garante o redirecionamento perfeito de qualquer lugar
                bolha.onclick = () => window.location.href = '/kanban/';
                document.body.appendChild(bolha);

                if (!document.getElementById('style-alerta-bolha')) {
                    const style = document.createElement('style');
                    style.id = 'style-alerta-bolha';
                    style.innerHTML = `
                        @keyframes piscarAlerta {
                            from { transform: scale(1); box-shadow: 0 8px 25px rgba(233,30,99,0.4); }
                            to { transform: scale(1.05); box-shadow: 0 8px 30px rgba(233,30,99,0.7); }
                        }
                    `;
                    document.head.appendChild(style);
                }

                // Some em 10 segundos
                setTimeout(() => { if(document.getElementById('bolha-alerta-pedido')) document.getElementById('bolha-alerta-pedido').remove(); }, 10000);
            }
        }

        if (maxIdAtual > radarGlobal_ultimoId) {
            radarGlobal_ultimoId = maxIdAtual;
        }
        radarGlobal_primeiraCarga = false;

    } catch (e) {
        console.error("Erro no radar global:", e);
    }
}

// Inicia automático
setTimeout(checarNovosPedidosGlobal, 3000);
setInterval(checarNovosPedidosGlobal, 15000);