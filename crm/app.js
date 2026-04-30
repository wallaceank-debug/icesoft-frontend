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
        renderizarTabela(clientesGlobais); // Repinta a tabela para atualizar as barrinhas!
        
        btn.innerText = 'Salvo! ✅';
        setTimeout(() => btn.innerText = 'Salvar Regras', 2000);
    } catch (e) {
        alert("Erro ao salvar regras de fidelidade.");
        btn.innerText = 'Salvar Regras';
    }
}

async function carregarClientes() {
    try {
        const res = await fetch(`${API_URL}/crm/clientes`);
        clientesGlobais = await res.json();
        renderizarTabela(clientesGlobais);
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
        const ultimaCompra = new Date(cliente.ultima_compra).toLocaleDateString('pt-BR');
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
                    <div style="font-weight: bold; color: #333;">${nomeLimpo}</div>
                    <div style="color: #888; font-size: 0.85rem;">📱 ${cliente.telefone}</div>
                </td>
                <td style="font-weight: 900; color: #00bcd4;">${totalGasto}</td>
                <td style="color: #555;">${ultimaCompra}</td>
                <td style="width: 250px;">${htmlFidelidade}</td>
            </tr>
        `;
    });
}

function filtrarClientes() {
    const termo = document.getElementById('busca-cliente').value.toLowerCase();
    const filtrados = clientesGlobais.filter(c => {
        const nome = (c.nome || '').toLowerCase();
        const tel = (c.telefone || '').toLowerCase();
        return nome.includes(termo) || tel.includes(termo);
    });
    renderizarTabela(filtrados);
}

window.onload = iniciarCRM;