const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let clientesGlobais = [];
let configsFidelidade = { ativo: false, meta: 10, tipo: 'porcentagem', valor: 0 };

async function iniciarCRM() {
    await carregarConfigs();
    await carregarClientes();
}

async function carregarConfigs() {
    try {
        const res = await fetch(`${API_URL}/configuracoes`);
        const configs = await res.json();
        
        configsFidelidade.ativo = configs.fidelidade_ativo === 'true';
        configsFidelidade.meta = Number(configs.fidelidade_meta) || 10;
        configsFidelidade.tipo = configs.fidelidade_tipo || 'porcentagem';
        configsFidelidade.valor = Number(configs.fidelidade_valor) || 0;

        document.getElementById('fidelidade-ativo').value = configs.fidelidade_ativo || 'false';
        document.getElementById('fidelidade-meta').value = configsFidelidade.meta;
        document.getElementById('fidelidade-tipo').value = configsFidelidade.tipo;
        document.getElementById('fidelidade-valor').value = configsFidelidade.valor;
    } catch (e) {
        console.error("Erro ao carregar configurações de fidelidade:", e);
    }
}

async function salvarConfigFidelidade() {
    const btn = document.querySelector('.btn-salvar');
    btn.innerText = 'Salvando...';

    const payload = {
        fidelidade_ativo: document.getElementById('fidelidade-ativo').value,
        fidelidade_meta: document.getElementById('fidelidade-meta').value,
        fidelidade_tipo: document.getElementById('fidelidade-tipo').value,
        fidelidade_valor: document.getElementById('fidelidade-valor').value
    };

    try {
        await fetch(`${API_URL}/configuracoes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        await carregarConfigs();
        filtrarClientes(); // Repinta a tabela para atualizar as barrinhas!
        
        btn.innerText = 'Salvo! ✅';
        setTimeout(() => btn.innerText = 'Salvar Regras', 2000);
    } catch (e) {
        alert("Erro ao salvar regras de fidelidade.");
        btn.innerText = 'Salvar Regras';
    }
}

async function carregarClientes() {  
 try {  
 // 1. Pega o crachá do bolso do navegador
 const cracha = localStorage.getItem('icesoft_token');
 
 // 2. Mostra o crachá na porta do servidor
 const res = await fetch(`${API_URL}/crm/clientes`, {
     method: 'GET',
     headers: {
         'Authorization': `Bearer ${cracha}`
     }
 });  
 
 // Se o servidor expulsar (token inválido), manda pro login
 if (res.status === 401 || res.status === 403) {
     fazerLogout();
     return;
 }
 
 clientesGlobais = await res.json();  
 filtrarClientes();  
 atualizarContadoresKPI();
 } catch (e) {
        document.getElementById('tabela-clientes').innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Erro ao carregar clientes.</td></tr>';
    }
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabela-clientes');
    tbody.innerHTML = '';

    if (lista.length === 0) {
        return tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum cliente registrado ainda.</td></tr>';
    }

    lista.forEach(cliente => {
        const nomeLimpo = cliente.nome || "Cliente não identificado";
        const totalGasto = Number(cliente.total_gasto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // --- INÍCIO: FAROL DE RETENÇÃO ---
        const dataUltimaCompra = new Date(cliente.ultima_compra);
        const hoje = new Date();
        const diffDias = Math.floor((hoje - dataUltimaCompra) / (1000 * 60 * 60 * 24));
        
        let corFarol = '#25D366'; // Verde (Ativo - < 15 dias)
        let textoStatus = 'Ativo';
        
        // 🛡️ Previne falha caso a data seja inválida ou muito antiga
        if (isNaN(diffDias) || diffDias >= 30) {
            corFarol = '#f44336'; 
            textoStatus = 'Inativo'; 
        } else if (diffDias >= 15) {
            corFarol = '#ff9800'; 
            textoStatus = 'Em Risco'; 
        }

        const textoExibicaoDias = isNaN(diffDias) ? 'Desconhecido' : `há ${diffDias} dias`;

        // Monta a data com a bolinha colorida e o contador de dias
        const ultimaCompra = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${corFarol}; box-shadow: 0 0 5px ${corFarol};" title="${textoStatus}"></span>
                <span style="font-weight: 600;">${isNaN(dataUltimaCompra.getTime()) ? '--/--/----' : dataUltimaCompra.toLocaleDateString('pt-BR')}</span>
            </div>
            <div style="font-size: 0.8rem; color: #888; margin-top: 3px; margin-left: 20px;">
                ${textoExibicaoDias} (${textoStatus})
            </div>
        `;
        // --- FIM: FAROL DE RETENÇÃO ---

        const pedidosFeitos = Number(cliente.total_pedidos);

        // Lógica Visual da Fidelidade
        let htmlFidelidade = '<span style="color:#999; font-size: 0.85rem;">Programa Desligado</span>';
        
        if (configsFidelidade.ativo) {
            const meta = configsFidelidade.meta;
            const progressoAtual = pedidosFeitos % meta; 
            const temPremioAguardando = (pedidosFeitos > 0 && progressoAtual === 0);
            
            // Se ele completou a meta, a barra fica cheia (100%). Se não, calcula a %.
            const porcentagemBarra = temPremioAguardando ? 100 : (progressoAtual / meta) * 100;
            const corBarra = temPremioAguardando ? '#25D366' : '#e91e63';
            
            const textoStatus = temPremioAguardando 
                ? `<span class="premio-destravado">🎁 Prêmio Disponível!</span>`
                : `<span class="status-fidelidade">${progressoAtual} / ${meta} pedidos</span>`;

            htmlFidelidade = `
                <div>
                    ${textoStatus}
                    <div class="barra-fundo">
                        <div class="barra-progresso" style="width: ${porcentagemBarra}%; background-color: ${corBarra};"></div>
                    </div>
                    <div style="font-size: 0.7rem; color: #888; margin-top: 3px;">Total histórico: ${pedidosFeitos} pedidos</div>
                </div>
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td>
                    <div style="font-weight: bold; color: #333; font-size: 1.05rem;">${nomeLimpo}</div>
                    <div style="color: #888; font-size: 0.85rem; margin-top: 2px;">📱 ${cliente.telefone}</div>
                    <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="background: #fff3e0; color: #e65100; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid #ffe0b2; display: inline-flex; align-items: center; gap: 4px;" title="Produto mais comprado por este cliente">
                            ❤️ ${cliente.produto_favorito || 'Diversos'}
                        </span>
                        <button onclick="abrirModalZap('${cliente.telefone}', '${nomeLimpo}')" style="background: #25D366; color: white; border: none; padding: 3px 8px; border-radius: 6px; cursor: pointer; font-size: 0.72rem; font-weight: 700; box-shadow: 0 2px 4px rgba(37,211,102,0.3); transition: 0.2s;">
                            💬 Enviar Promoção
                        </button>
                    </div>
                </td>
                <td style="font-weight: 900; color: #00bcd4;">${totalGasto}</td>
                <td style="color: #555;">${ultimaCompra}</td>
                <td style="width: 250px;">${htmlFidelidade}</td>
            </tr>
        `;
    });
}

// ==========================================
// SISTEMA DE FILTRO UNIFICADO (TEXTO + CARDS)
// ==========================================
let filtroStatusAtual = 'todos';
let limiteClientesAtual = 50;

function mudarLimite() {
    const select = document.getElementById('limite-exibicao');
    limiteClientesAtual = select.value === 'todos' ? 'todos' : Number(select.value);
    filtrarClientes();
}

function filtrarPorStatus(status) {
    // 1. Efeito Toggle: Se clicar no mesmo cartão que já está ativo, desmarca
    if (filtroStatusAtual === status) {
        filtroStatusAtual = 'todos';
    } else {
        filtroStatusAtual = status;
    }

    // 2. Atualiza o visual dos cartões na tela (Destaca o selecionado e apaga os outros)
    document.querySelectorAll('.card-kpi').forEach(card => {
        if (filtroStatusAtual === 'todos') {
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
        } else {
            if (card.dataset.status === filtroStatusAtual) {
                card.style.opacity = '1';
                card.style.transform = 'scale(1.02)'; // Dá um leve zoom no selecionado
            } else {
                card.style.opacity = '0.5'; // Apaga os não selecionados
                card.style.transform = 'scale(0.98)';
            }
        }
    });

    // 3. Roda a inteligência que redesenha a tabela
    filtrarClientes();
}

function filtrarClientes() {
    const termo = document.getElementById('busca-cliente').value.toLowerCase();
    const hoje = new Date();

    const filtrados = clientesGlobais.filter(c => {
        // --- REGRA 1: Passa no filtro de Texto? ---
        const nome = (c.nome || '').toLowerCase();
        const tel = (c.telefone || '').toLowerCase();
        const passouTexto = nome.includes(termo) || tel.includes(termo);

        // --- REGRA 2: Passa no filtro do Cartão (KPI)? ---
        let passouStatus = true;
        
        if (filtroStatusAtual !== 'todos') {
            let diffDias = 999; // Se não tem data, consideramos inativo
            if (c.ultima_compra) {
                const dataCompra = new Date(c.ultima_compra);
                if (!isNaN(dataCompra.getTime())) {
                    diffDias = Math.floor((hoje - dataCompra) / (1000 * 60 * 60 * 24));
                }
            }

            if (filtroStatusAtual === 'ativos') {
                passouStatus = (diffDias < 15);
            } else if (filtroStatusAtual === 'risco') {
                passouStatus = (diffDias >= 15 && diffDias < 30);
            } else if (filtroStatusAtual === 'inativos') {
                passouStatus = (diffDias >= 30);
            }
        }

        // O cliente só aparece na tabela se passar nos dois testes
        return passouTexto && passouStatus;
    });

    // 👇 A MÁGICA: Corta a lista de acordo com o limite escolhido
    let filtradosLimitados = filtrados;
    if (limiteClientesAtual !== 'todos') {
        filtradosLimitados = filtrados.slice(0, limiteClientesAtual);
    }

    renderizarTabela(filtradosLimitados); // Desenha só os cortados!
}

// ==========================================
// FUNÇÕES DE DISPARO WHATSAPP
// ==========================================
function abrirModalZap(telefone, nome) {
    if (!telefone || telefone === 'undefined') return alert("Este cliente não tem um telefone registado válido.");
    document.getElementById('zap-telefone-cliente').value = telefone;
    document.getElementById('zap-nome-cliente').innerText = nome;
    document.getElementById('zap-mensagem').value = '';
    document.getElementById('modal-zap').style.display = 'flex';
}

function fecharModalZap() {
    document.getElementById('modal-zap').style.display = 'none';
}

async function enviarMensagemZap() {
    const btn = document.getElementById('btn-enviar-zap');
    const telefone = document.getElementById('zap-telefone-cliente').value;
    const mensagem = document.getElementById('zap-mensagem').value;

    if (!mensagem.trim()) return alert("Escreva uma oferta ou mensagem antes de enviar!");

    btn.innerText = 'Enviando...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/whatsapp/disparo-manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telefone, mensagem })
        });
        
        const data = await res.json();
        
        if (data.sucesso) {
            alert("✅ Oferta enviada com sucesso direto para o WhatsApp do cliente!");
            fecharModalZap();
        } else {
            alert("❌ Erro: " + (data.erro || "Falha ao enviar a mensagem."));
        }
    } catch (e) {
        alert("❌ Erro de conexão com o servidor. A mensagem não foi enviada.");
    } finally {
        btn.innerText = 'Enviar Oferta 🚀';
        btn.disabled = false;
    }
}

window.onload = iniciarCRM;

// ==========================================
// NOVOS FILTROS E CONTADORES DO CRM
// ==========================================

let ordemCRM = { coluna: '', direcao: 'desc' };

// 1. Função que ordena a tabela ao clicar no título
function ordenarClientes(coluna) {
    if (ordemCRM.coluna === coluna) {
        ordemCRM.direcao = ordemCRM.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        ordemCRM.coluna = coluna;
        ordemCRM.direcao = 'desc'; // Sempre começa mostrando o "Maior" primeiro
    }

    clientesGlobais.sort((a, b) => {
        let valorA, valorB;

        if (coluna === 'gasto') {
            valorA = parseFloat(a.total_gasto || 0);
            valorB = parseFloat(b.total_gasto || 0);
        } else if (coluna === 'ultima_compra') {
            valorA = new Date(a.ultima_compra).getTime();
            valorB = new Date(b.ultima_compra).getTime();
        } else if (coluna === 'fidelidade') {
            valorA = parseInt(a.total_pedidos || 0);
            valorB = parseInt(b.total_pedidos || 0);
        }

        if (valorA < valorB) return ordemCRM.direcao === 'asc' ? -1 : 1;
        if (valorA > valorB) return ordemCRM.direcao === 'asc' ? 1 : -1;
        return 0;
    });

    // IMPORTANTE: Se a sua função de desenhar a tabela tiver outro nome (como desenharTabela ou renderizarTabelaClientes), troque o nome abaixo:
    filtrarClientes();
}

// 2. Função que calcula as bolinhas baseadas na Última Compra
function atualizarContadoresKPI() {
    let ativos = 0;
    let emRisco = 0;
    let inativos = 0;
    const hoje = new Date();

    clientesGlobais.forEach(c => {
        // 🛡️ Segurança: Se o cliente não tem data ou a data for inválida, consideramos Inativo
        if (!c.ultima_compra) {
            inativos++;
            return;
        }
        
        const dataCompra = new Date(c.ultima_compra);
        if (isNaN(dataCompra.getTime())) {
            inativos++;
            return;
        }

        // 🧠 A mesma matemática da tabela
        const dias = Math.floor((hoje - dataCompra) / (1000 * 60 * 60 * 24));

        if (dias < 15) {
            ativos++;        // Verde (Ativos: < 15 dias)
        } else if (dias < 30) {
            emRisco++;       // Laranja (Em Risco: 15 a 29 dias)
        } else {
            inativos++;      // Vermelho (Inativos: 30+ dias)
        }
    });

    document.getElementById('kpi-ativos').innerText = ativos;
    document.getElementById('kpi-risco').innerText = emRisco;
    document.getElementById('kpi-inativos').innerText = inativos;
}