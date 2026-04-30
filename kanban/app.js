const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';

const COLUNAS_ID = {
    'Pendente Delivery': 'corpo-analise',
    'A Preparar': 'corpo-preparar',
    'Saiu p/ Entrega': 'corpo-entrega',
    'Entregue': 'corpo-entregue',
    'Cancelado': 'corpo-cancelado'
};

let pedidosGlobais = []; 
let qtdPendentesAnterior = -1; 
let pedidosJaImpressos = []; // 🖨️ Memória da impressora

async function carregarPedidos() {
    try {
        const res = await fetch(`${API_URL}/vendas`);
        const vendas = await res.json();
        
        const hoje = new Date().toDateString();

        const pedidosDelivery = vendas.filter(v => {
            const statusLimpo = v.status ? v.status.trim() : '';
            if (!Object.keys(COLUNAS_ID).includes(statusLimpo)) return false;

            if (v.data_hora) {
                const dataPedido = new Date(v.data_hora).toDateString();
                if ((statusLimpo === 'Entregue' || statusLimpo === 'Cancelado') && dataPedido !== hoje) {
                    return false; 
                }
            }
            return true; 
        });

        // 🛎️ LÓGICA DA CAMPAINHA
        const pendentesAgora = pedidosDelivery.filter(p => p.status.trim() === 'Pendente Delivery');
        const qtdPendentesAtual = pendentesAgora.length;

        if (qtdPendentesAnterior !== -1 && qtdPendentesAtual > qtdPendentesAnterior) {
             tocarCampainha();
        }
        qtdPendentesAnterior = qtdPendentesAtual;
        
        // 🖨️ LÓGICA DA IMPRESSÃO AUTOMÁTICA
        pendentesAgora.forEach(pedido => {
            if (!pedidosJaImpressos.includes(pedido.id)) {
                imprimirComandaKanban(pedido);
                pedidosJaImpressos.push(pedido.id);
            }
        });

        pedidosGlobais = pedidosDelivery; 
        renderizarKanban(pedidosDelivery);
    } catch (e) {
        console.error("Erro ao buscar pedidos da nuvem:", e);
    }
}

// ==========================================
// 🛎️ SISTEMA DE ALERTA SONORO PROFISSIONAL
// ==========================================
let somAtivado = false;
const audioCampainha = new Audio('https://www.myinstants.com/media/sounds/bell.mp3');

function ativarSom() {
    const btn = document.getElementById('btn-som');
    somAtivado = !somAtivado; 

    if (somAtivado) {
        btn.innerHTML = '🔔 Alerta Sonoro: ATIVADO';
        btn.style.background = '#4CAF50'; 
        
        audioCampainha.volume = 0.1;
        audioCampainha.play().then(() => {
            setTimeout(() => { audioCampainha.volume = 1.0; }, 500);
        }).catch(e => console.log("Navegador ainda bloqueando."));
    } else {
        btn.innerHTML = '🔇 Alerta Sonoro: Desativado';
        btn.style.background = '#f44336'; 
    }
}

function tocarCampainha() {
    if (!somAtivado) return; 

    try {
        audioCampainha.currentTime = 0; 
        audioCampainha.volume = 1.0; 
        audioCampainha.play();
    } catch(e) {
        console.log("Erro ao tocar a campainha:", e);
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
        const obsHtml = pedido.observacoes ? `<div style="background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 8px; border-radius: 8px; font-size: 0.85rem; margin-top: 10px;"><strong>📝 Obs:</strong> ${pedido.observacoes}</div>` : '';

        const cardHtml = `
            <div style="background: white; border-radius: 12px; padding: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border-left: 5px solid var(--cor-borda, #ccc); display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #f0f2f5; padding-bottom: 8px; align-items: center;">
                    <strong style="color: #333; font-size: 1.1rem;">#${pedido.id}</strong>
                    <div style="display: flex; gap: 5px;">
                        <span style="color: #888; font-size: 0.8rem; background: #f0f2f5; padding: 4px 8px; border-radius: 10px;">⏱️ ${horaVenda}</span>
                        
                        <!-- 🖨️ O NOVO BOTÃO DE IMPRIMIR NA MÃO -->
                        <button onclick="imprimirComandaKanban(pedidosGlobais.find(v => v.id === ${pedido.id}))" style="background: #e0e0e0; color: #333; border: none; padding: 4px 8px; border-radius: 8px; cursor: pointer; font-size: 0.8rem;" title="Reimprimir Comanda">🖨️</button>
                        
                        <button onclick="abrirDetalhes(${pedido.id})" style="background: #333; color: white; border: none; padding: 4px 8px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: bold;">🔍</button>
                    </div>
                </div>
                
                <div style="min-height: 40px;">
                    ${itensHtml}
                    ${obsHtml} 
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

    document.getElementById('detalhe-id').innerText = `#${pedido.id}`;
    document.getElementById('detalhe-nome').innerText = pedido.cliente_nome || "Não informado";
    document.getElementById('detalhe-telefone').innerText = pedido.cliente_telefone || "Não informado";
    document.getElementById('detalhe-endereco').innerText = pedido.cliente_endereco || "Retirada Balcão / Não informado";
    document.getElementById('detalhe-pagamento').innerText = pedido.forma_pagamento || "N/A";
    document.getElementById('detalhe-total').innerText = `R$ ${Number(pedido.valor_total).toFixed(2).replace('.', ',')}`;

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
    
    if (pedido.observacoes && pedido.observacoes.trim() !== '') {
        itensHtml += `
            <div style="margin-top: 15px; padding: 12px; background: #fff3cd; border: 1px dashed #ffeeba; border-radius: 8px; color: #856404; font-size: 0.95rem;">
                <strong style="display: block; margin-bottom: 5px;">📝 Observações do Cliente:</strong>
                ${pedido.observacoes}
            </div>
        `;
    }

    document.getElementById('detalhe-itens').innerHTML = itensHtml;
    document.getElementById('modal-detalhes').style.display = 'flex';
}

function fecharDetalhes() {
    document.getElementById('modal-detalhes').style.display = 'none';
}

// ==========================================
// 🖨️ MOTOR DE IMPRESSÃO TÉRMICA (80mm)
// ==========================================
function imprimirComandaKanban(venda) {
    if(!venda) return;
    const areaImpressao = document.getElementById('cupom-kanban');
    
    let arrayItens = [];
    try { arrayItens = typeof venda.itens === 'string' ? JSON.parse(venda.itens) : venda.itens; } 
    catch (e) { arrayItens = []; }

    let htmlItens = '';
    arrayItens.forEach(item => {
        let nomeBase = item.nome;
        if (nomeBase.includes('(')) nomeBase = nomeBase.replace('(', '<br>&nbsp;&nbsp;+ ').replace(')', '');
        
        htmlItens += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold;">
            <span style="flex: 1;">${item.quantidade || 1}x ${nomeBase}</span>
            <span style="margin-left: 10px;">R$ ${Number(item.preco * (item.quantidade || 1)).toFixed(2).replace('.',',')}</span>
        </div>`;
    });

    const dataFormatada = new Date(venda.data_hora).toLocaleString('pt-BR');
    
    areaImpressao.innerHTML = `
        <div style="border-bottom: 2px dashed black; padding-bottom: 10px; margin-bottom: 10px; text-align: center;">
            <h2 style="margin: 0;">ICESOFT</h2>
            <strong>COMANDA DE PRODUÇÃO</strong><br>
            ${dataFormatada}
        </div>
        
        <div style="font-size: 16px; margin-bottom: 10px; text-align: center;">
            <strong style="font-size: 20px;">PEDIDO #${venda.id}</strong><br>
            <strong style="background: black; color: white; padding: 2px 5px;">${(venda.origem || 'Balcão').toUpperCase()}</strong>
        </div>

        <div style="margin-bottom: 10px; border-bottom: 1px dashed black; padding-bottom: 10px;">
            <strong>Cliente:</strong> ${venda.cliente_nome || 'Balcão/Mesa'}<br>
            <strong>WhatsApp:</strong> ${venda.cliente_telefone || '---'}<br>
            <strong>Endereço:</strong> ${venda.cliente_endereco || 'Retirada no Local'}
        </div>
        
        <div style="border-bottom: 2px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
            ${htmlItens}
        </div>
        
        <div style="text-align: right; font-size: 18px; margin-bottom: 10px;">
            <strong>TOTAL: R$ ${Number(venda.valor_total).toFixed(2).replace('.',',')}</strong>
        </div>
        
        <div style="margin-bottom: 10px; font-size: 16px;">
            <strong>Pagamento:</strong> ${venda.forma_pagamento || '---'}<br>
            ${venda.observacoes && venda.observacoes !== 'null' ? `<div style="margin-top: 10px; border: 2px solid black; padding: 5px;"><strong>⚠️ OBSERVAÇÃO:</strong><br>${venda.observacoes}</div>` : ''}
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 12px;">
            -- Icesoft Sistema --
        </div>
    `;

    areaImpressao.style.display = 'block';
    window.print();
    areaImpressao.style.display = 'none';
}

window.onload = carregarPedidos;
setInterval(carregarPedidos, 15000);
