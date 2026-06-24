const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
const cracha = localStorage.getItem('icesoft_token');

let clientesGlobais = [];
let historicoMarketing = [];

window.onload = async () => {
    if (!cracha) {
        alert("Acesso negado. Faça login no sistema.");
        window.location.href = '../login.html';
        return;
    }
    await carregarDashboardMarketing();
    await carregarClientesCRM();
};

async function carregarDashboardMarketing() {
    try {
        const res = await fetch(`${API_URL}/marketing/dashboard`, {
            headers: { 'Authorization': `Bearer ${cracha}` }
        });
        
        if (!res.ok) throw new Error("Falha ao buscar métricas");
        
        const data = await res.json();
        historicoMarketing = data.historico || [];

        // Atualiza KPIs de ROI
        document.getElementById('kpi-enviados').innerText = data.kpis.total_enviado;
        document.getElementById('kpi-pedidos').innerText = data.kpis.pedidos_gerados;
        document.getElementById('kpi-roi').innerText = `R$ ${Number(data.kpis.lucro_gerado).toFixed(2).replace('.', ',')}`;

    } catch (e) {
        console.error("Erro no Dashboard de Marketing:", e);
    }
}

async function carregarClientesCRM() {
    try {
        const res = await fetch(`${API_URL}/crm/clientes`, {
            headers: { 'Authorization': `Bearer ${cracha}` }
        });
        
        if (!res.ok) throw new Error("Falha ao buscar CRM");
        
        clientesGlobais = await res.json();
        renderizarListaClientes();
    } catch (e) {
        document.getElementById('lista-crm').innerHTML = '<p style="color: red;">Erro ao carregar clientes.</p>';
    }
}

let filtroSegmentacaoAtual = 'todos';

function aplicarFiltroCategoria() {
    filtroSegmentacaoAtual = document.getElementById('filtro-categoria-crm').value;
    renderizarListaClientes();
}

function desmarcarTodos() {
    const checkboxes = document.querySelectorAll('.chk-cliente');
    checkboxes.forEach(chk => chk.checked = false);
}

function renderizarListaClientes() {
    const container = document.getElementById('lista-crm');
    container.innerHTML = '';

    if (clientesGlobais.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center;">Nenhum cliente com telefone cadastrado no momento.</p>';
        return;
    }

    const agora = new Date();
    // 7 Dias de segurança anti-ban
    const tempoSegurancaMs = 7 * 24 * 60 * 60 * 1000; 

    // O Filtro de Segmentação CRM
    const clientesFiltrados = clientesGlobais.filter(cliente => {
        if (filtroSegmentacaoAtual === 'todos') return true;
        
        let diffDias = 999; // Se não tem data, assumimos que é inativo
        if (cliente.ultima_compra) {
            const dataCompra = new Date(cliente.ultima_compra);
            if (!isNaN(dataCompra.getTime())) {
                diffDias = Math.floor((agora - dataCompra) / (1000 * 60 * 60 * 24));
            }
        }

        if (filtroSegmentacaoAtual === 'ativos') return diffDias < 15;
        if (filtroSegmentacaoAtual === 'risco') return diffDias >= 15 && diffDias < 30;
        if (filtroSegmentacaoAtual === 'inativos') return diffDias >= 30;
        
        return true;
    });

    if (clientesFiltrados.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px 0;">Nenhum cliente encontrado nesta categoria.</p>';
        return;
    }

    clientesFiltrados.forEach((cliente) => {
        // Pega a posição original para o robô não enviar pro cliente errado!
        const indexGlobal = clientesGlobais.indexOf(cliente);
        
        const telLimpo = String(cliente.telefone).replace(/\D/g, '');
        
        // 1. Procura se enviamos mensagem pra ele recentemente
        const ultimoEnvio = historicoMarketing.find(h => h.telefone === telLimpo);
        let riscoSpam = false;
        let textoUltimoEnvio = 'Nunca recebeu';

        if (ultimoEnvio) {
            const dataEnvio = new Date(ultimoEnvio.data_envio);
            const diferencaDias = Math.floor((agora - dataEnvio) / (1000 * 60 * 60 * 24));
            
            if ((agora - dataEnvio) < tempoSegurancaMs) {
                riscoSpam = true;
                textoUltimoEnvio = `Há ${diferencaDias} dia(s)`;
            } else {
                textoUltimoEnvio = `Há ${diferencaDias} dias (Seguro)`;
            }
        }

        // 2. NOVA INTELIGÊNCIA: Calcula a quantos dias o cliente não pede
        let textoDias = 'Novo / Sem pedido';
        let corBadge = '#999';
        let bgBadge = '#f0f0f0';

        if (cliente.ultima_compra) {
            const dataCompra = new Date(cliente.ultima_compra);
            if (!isNaN(dataCompra.getTime())) {
                const diffDiasCompra = Math.floor((agora - dataCompra) / (1000 * 60 * 60 * 24));
                textoDias = `há ${diffDiasCompra} dias`;

                // Espelha as cores do funil do CRM
                if (diffDiasCompra < 15) {
                    corBadge = '#25D366'; // Verde (Ativo)
                    bgBadge = '#e8f5e9';
                } else if (diffDiasCompra < 30) {
                    corBadge = '#ff9800'; // Laranja (Risco)
                    bgBadge = '#fff3e0';
                } else {
                    corBadge = '#f44336'; // Vermelho (Inativo)
                    bgBadge = '#ffebee';
                }
            }
        }

        const classeRisco = riscoSpam ? 'risco-spam' : '';
        const badgeSpam = riscoSpam ? '<span class="badge-spam">⚠️ SPAM RECENTE</span>' : '';
        const checkedStatus = riscoSpam ? '' : 'checked';

        container.innerHTML += `
            <label class="cliente-card ${classeRisco}">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="checkbox" class="chk-cliente" value="${indexGlobal}" data-seguro="${!riscoSpam}" ${checkedStatus}>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="color: #333;">${cliente.nome || 'Cliente'}</strong>
                            <span style="font-size: 0.7rem; color: ${corBadge}; background: ${bgBadge}; padding: 2px 8px; border-radius: 12px; font-weight: bold; border: 1px solid ${corBadge}50;">
                                🛒 ${textoDias}
                            </span>
                        </div>
                        <span style="font-size: 0.8rem; color: #666;">${cliente.telefone}</span>
                    </div>
                </div>
                <div style="text-align: right; font-size: 0.8rem; color: #888;">
                    Último disparo:<br>
                    <strong>${textoUltimoEnvio}</strong>
                    ${badgeSpam}
                </div>
            </label>
        `;
    });
}

// Botão rápido para marcar só quem é seguro
function selecionarTodosSeguros() {
    const checkboxes = document.querySelectorAll('.chk-cliente');
    checkboxes.forEach(chk => {
        if (chk.getAttribute('data-seguro') === 'true') {
            chk.checked = true;
        } else {
            chk.checked = false;
        }
    });
}

// O utilitário para o Javascript "dormir" (O pulo do gato do Robô)
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function iniciarDisparos() {
    const checkboxes = document.querySelectorAll('.chk-cliente:checked');
    const mensagemPadrao = document.getElementById('texto-mensagem').value.trim();
    const nomeCampanha = document.getElementById('nome-campanha').value.trim();

    if (checkboxes.length === 0) return alert("Selecione pelo menos um cliente.");
    if (!mensagemPadrao) return alert("Escreva a mensagem antes de iniciar.");
    if (!nomeCampanha) return alert("Dê um nome para a campanha para podermos medir o lucro depois.");

    const btn = document.getElementById('btn-iniciar');
    const areaProgresso = document.getElementById('area-progresso');
    const barraVerde = document.getElementById('barra-verde');
    const statusRobo = document.getElementById('status-robo');
    const contadorTexto = document.getElementById('contador-progresso');

    btn.disabled = true;
    btn.style.background = '#888';
    btn.innerText = "Robô Operando... Não feche a tela!";
    areaProgresso.style.display = 'block';

    const total = checkboxes.length;
    let enviados = 0;

    for (let chk of checkboxes) {
        const cliente = clientesGlobais[chk.value];
        const primeiroNome = cliente.nome ? cliente.nome.split(' ')[0] : 'Cliente';
        
        // Troca a tag {nome} pelo nome real do cliente
        const mensagemPersonalizada = mensagemPadrao.replace(/{nome}/g, primeiroNome);

        statusRobo.innerText = `📲 Enviando para ${primeiroNome}...`;

        try {
            // 1. Dispara a mensagem via Evolution API (A rota que você já tinha no server.js)
            await fetch(`${API_URL}/whatsapp/disparo-manual`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cracha}` // Opcional, dependendo da sua segurança da rota manual
                },
                body: JSON.stringify({
                    telefone: cliente.telefone,
                    mensagem: mensagemPersonalizada
                })
            });

            // 2. Registra na memória do banco de dados (Marketing ROI)
            await fetch(`${API_URL}/marketing/registro`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telefone: cliente.telefone,
                    nome: cliente.nome,
                    campanha: nomeCampanha
                })
            });

        } catch (e) {
            console.error(`Falha ao enviar para ${primeiroNome}`, e);
        }

        enviados++;
        barraVerde.style.width = `${(enviados / total) * 100}%`;
        contadorTexto.innerText = `${enviados} / ${total}`;

        // Se ainda faltam clientes, faz a PAUSA HUMANIZADA (Entre 25s e 45s)
        if (enviados < total) {
            const tempoAleatorioMs = Math.floor(Math.random() * (45000 - 25000 + 1) + 25000);
            statusRobo.innerText = `🕒 Pausa Humana: Aguardando ${Math.round(tempoAleatorioMs/1000)}s para o próximo...`;
            await delay(tempoAleatorioMs);
        }
    }

    // Fim do Processo
    statusRobo.innerText = "✅ Todos os disparos concluídos com sucesso!";
    statusRobo.style.color = "#4CAF50";
    btn.innerText = "Disparos Finalizados 🎉";
    
    // Recarrega o painel de lucros para mostrar as atualizações
    setTimeout(() => {
        carregarDashboardMarketing();
        carregarClientesCRM();
        btn.disabled = false;
        btn.style.background = '#9c27b0';
        btn.innerText = "🚀 Iniciar Novos Disparos";
        areaProgresso.style.display = 'none';
    }, 5000);
}