const API_URL = 'https://icesoft-api.onrender.com/api';

const COLUNAS_ID = {
    'Pendente Delivery': 'corpo-analise',
    'A Preparar': 'corpo-preparar',
    'Saiu p/ Entrega': 'corpo-entrega',
    'Entregue': 'corpo-entregue',
    'Cancelado': 'corpo-cancelado'
};

let pedidosGlobais = []; // Guarda os pedidos pra gente abrir os detalhes depois!

async function carregarPedidos() {
    try {
        const res = await fetch(`${API_URL}/vendas`);
        const vendas = await res.json();
        
        const pedidosDelivery = vendas.filter(v => {
            const statusLimpo = v.status ? v.status.trim() : '';
            return Object.keys(COLUNAS_ID).includes(statusLimpo);
        });

        pedidosGlobais = pedidosDelivery; // Salva na memória
        renderizarKanban(pedidosDelivery);
    } catch (e) {
        console.error("Erro ao buscar pedidos da nuvem:", e);
    }
}

function renderizarKanban(pedidos) {
    Object.values(COLUNAS_ID).forEach(id => {
        document.getElementById(id).innerHTML = '';
        document.getElementById(id.replace('corpo-', 'qtd-')).innerText = '0';
    });

    const contadores = { 'Pendente Delivery': 0, 'A Preparar': 0, 'Saiu p/ Entrega': 0, 'Entregue': 0, 'Cancelado': 0 };

    pedidos.forEach(pedido => {
        const colunaId = COLUNAS_ID[pedido.status];
        if (!colunaId) return;

        contadores[pedido.status]++;

        // Formata os itens do pedido
        let itensHtml = "";
        try {
            const itensParse = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : pedido.itens;
            if (Array.isArray(itensParse) && itensParse.length > 0) {
                itensParse.forEach(item => {
                    const nomeLimpo = item.nome ? item.nome.replace('Delivery: ', '').replace('🔥 Oferta: ', '🔥 ') : 'Produto';
                    itensHtml += `<div style="font-size: 0.85rem; padding: 4px 0; border-bottom: 1px dashed #ddd; color: #444;">🛒 1x ${nomeLimpo}</div>`;
                });
            } else {
                itensHtml = `<div style="font-size: 0.85rem; color: #888;">Itens não encontrados.</div>`;
            }
        } catch(e) { 
            itensHtml = `<div style="color: #999; font-size: 0.8rem;">Erro ao ler itens.</div>`; 
        }

        let botoesHtml = '';
        if (pedido.status === 'Pendente Delivery') {
            botoesHtml = `
                <button onclick="mudarStatus(${pedido.id}, 'A Preparar')" style="background: #2196F3; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer; flex: 1; font-weight: bold; font-size: 0.85rem; transition: 0.2s;">👨‍🍳 Preparar</button>
                <button onclick="mudarStatus(${pedido.id}, 'Cancelado')" style="background: #f44336; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: 0.2s;" title="Cancelar Pedido">❌</button>
            `;
        } else if (pedido.status === 'A Preparar') {
            botoesHtml = `
                <button onclick="mudarStatus(${pedido.id}, 'Saiu p/ Entrega')" style="background: #FF9800; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer; flex: 1; font-weight: bold; font-size: 0.85rem; transition: 0.2s;">🛵 Enviar</button>
                <button onclick="mudarStatus(${pedido.id}, 'Cancelado')" style="background: #f44336; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: 0.2s;" title="Cancelar Pedido">❌</button>
            `;
        } else if (pedido.status === 'Saiu p/ Entrega') {
            botoesHtml = `
                <button onclick="mudarStatus(${pedido.id}, 'Entregue')" style="background: #4CAF50; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer; flex: 1; font-weight: bold; font-size: 0.85rem; transition: 0.2s;">✅ Concluir</button>
            `;
        }

        const horaVenda = pedido.data_hora ? new Date(pedido.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Hoje';

        const cardHtml = `
            <div style="background: white; border-radius: 12px; padding: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border-left: 5px solid var(--cor-borda, #ccc); display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f0f2f5; padding-bottom: 8px; align-items: center;">
                    <strong style="color: #333; font-size: 1.1rem;">#${pedido.id}</strong>
                    <div style="display: flex; gap: 5px;">
                        <span style="color: #888; font-size: 0.8rem; background: #f0f2f5; padding: 4px 8px; border-radius: 10px;">⏱️ ${horaVenda}</span>
                        <button onclick="abrirDetalhes(${pedido.id})" style="background: #333; color: white; border: none; padding: 4px 8px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: bold;">🔍 Detalhes</button>
                    </div>
                </div>
                
                <div style="min-height: 40px;">
                    ${itensHtml}
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; background: #fafafa; padding: 8px; border-radius: 8px;">
                    <span style="font-size: 0.75rem; background: #e0e0e0; color: #333; padding: 4px 8px; border-radius: 10px; font-weight: bold;">💳 ${pedido.forma_pagamento || 'N/A'}</span>
                    <strong style="color: #e91e63; font-size: 1.1rem;">R$ ${Number(pedido.valor_total).toFixed(2).replace('.', ',')}</strong>
                </div>

                <div style="display: flex; gap: 8px; margin-top: 5px;">
                    ${botoesHtml}
                </div>
            </div>
        `;

        document.getElementById(colunaId).innerHTML += cardHtml;
    });

    Object.entries(contadores).forEach(([status, qtd]) => {
        const spanId = COLUNAS_ID[status].replace('corpo-', 'qtd-');
        document.getElementById(spanId).innerText = qtd;
    });

    document.querySelectorAll('#corpo-analise > div').forEach(c => c.style.setProperty('--cor-borda', '#ffb74d'));
    document.querySelectorAll('#corpo-preparar > div').forEach(c => c.style.setProperty('--cor-borda', '#64b5f6'));
    document.querySelectorAll('#corpo-entrega > div').forEach(c => c.style.setProperty('--cor-borda', '#ff8a65'));
    document.querySelectorAll('#corpo-entregue > div').forEach(c => c.style.setProperty('--cor-borda', '#81c784'));
    document.querySelectorAll('#corpo-cancelado > div').forEach(c => c.style.setProperty('--cor-borda', '#e57373'));
}

async function mudarStatus(id, novoStatus) {
    try {
        await fetch(`${API_URL}/vendas/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });
        carregarPedidos();
    } catch (e) {
        alert("Erro ao tentar mover o pedido.");
    }
}

// ==========================================
// MÁGICA DA JANELA DE DETALHES
// ==========================================
function abrirDetalhes(id) {
    const pedido = pedidosGlobais.find(p => p.id === id);
    if (!pedido) return;

    // Preenche os dados
    document.getElementById('detalhe-id').innerText = `#${pedido.id}`;
    document.getElementById('detalhe-nome').innerText = pedido.cliente_nome || "Não informado";
    document.getElementById('detalhe-telefone').innerText = pedido.cliente_telefone || "Não informado";
    document.getElementById('detalhe-endereco').innerText = pedido.cliente_endereco || "Retirada Balcão / Não informado";
    document.getElementById('detalhe-pagamento').innerText = pedido.forma_pagamento || "N/A";
    document.getElementById('detalhe-total').innerText = `R$ ${Number(pedido.valor_total).toFixed(2).replace('.', ',')}`;

    // Monta os itens novamente na janela grande
    let itensHtml = "";
    try {
        const itensParse = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : pedido.itens;
        if (Array.isArray(itensParse) && itensParse.length > 0) {
            itensParse.forEach(item => {
                const nomeLimpo = item.nome ? item.nome.replace('Delivery: ', '').replace('🔥 Oferta: ', '🔥 ') : 'Produto';
                itensHtml += `<div style="font-size: 0.95rem; padding: 8px 0; border-bottom: 1px dashed #eee; color: #444; display: flex; justify-content: space-between;">
                                <span>🛒 1x ${nomeLimpo}</span>
                                <strong style="color: #e91e63;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</strong>
                              </div>`;
            });
        }
    } catch(e) {}
    
    document.getElementById('detalhe-itens').innerHTML = itensHtml;

    // Abre a janela
    document.getElementById('modal-detalhes').style.display = 'flex';
}

function fecharDetalhes() {
    document.getElementById('modal-detalhes').style.display = 'none';
}

window.onload = carregarPedidos;
setInterval(carregarPedidos, 15000);