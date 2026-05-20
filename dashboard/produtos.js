const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let chartAdicionais;
let dadosTabelaGlobal = []; // NOVO: Guarda os dados para podermos ordenar na hora
let ordenacaoAtual = { coluna: 'faturamento', direcao: 'desc' }; // NOVO: Estado da ordenação

window.onload = () => { carregarRaioX(); };

async function carregarRaioX() {
    let inicioInput = document.getElementById('filtro-inicio').value;
    let fimInput = document.getElementById('filtro-fim').value;

    if (!inicioInput || !fimInput) {
        const hoje = new Date();
        const trintaDias = new Date();
        trintaDias.setDate(hoje.getDate() - 30);
        
        inicioInput = trintaDias.toISOString().split('T')[0];
        fimInput = hoje.toISOString().split('T')[0];
        
        document.getElementById('filtro-inicio').value = inicioInput;
        document.getElementById('filtro-fim').value = fimInput;
    }

    try {
        const [resVendas, resVisitas] = await Promise.all([
            fetch(`${API_URL}/vendas?inicio=${inicioInput}&fim=${fimInput}`),
            fetch(`${API_URL}/relatorios/raiox-produtos?inicio=${inicioInput}&fim=${fimInput}`)
        ]);

        // 🛡️ CORREÇÃO DE DADOS: Ignora cancelados E vendas do Balcão/Mesas (Pois não geram visitas online)
        const vendas = (await resVendas.json()).filter(v => 
            v.status !== 'Cancelada' && 
            v.status !== 'Cancelado' &&
            !String(v.origem).toLowerCase().includes('balcão') &&
            !String(v.origem).toLowerCase().includes('mesa')
        );
        const visitasDB = (await resVisitas.json()).visitas;

        processarRaioX(vendas, visitasDB);
    } catch (erro) {
        console.error("Erro ao carregar Raio-X:", erro);
        alert("Falha ao puxar os dados. Verifique a conexão.");
    }
}

function processarRaioX(vendas, visitasDB) {
    let produtosStats = {};
    let adicionaisStats = {};
    let faturamentoTotal = 0;

    // 1. Processar Vendas e Adicionais (Apenas Online agora)
    vendas.forEach(v => {
        let itens = typeof v.itens === 'string' ? JSON.parse(v.itens || '[]') : (v.itens || []);
        
        itens.forEach(item => {
            let nomeProduto = item.nome || item.produto_nome || item.nomeBase;
            if (!nomeProduto) return;
            
            nomeProduto = nomeProduto.replace('Delivery: ', '').split('(')[0].trim();
            let preco = parseFloat(item.preco || 0);
            let qtd = parseInt(item.quantidade || 1);
            let totalItem = preco * qtd;

            if (!produtosStats[nomeProduto]) {
                produtosStats[nomeProduto] = { vendas: 0, faturamento: 0, visitas: 0 };
            }
            produtosStats[nomeProduto].vendas += qtd;
            produtosStats[nomeProduto].faturamento += totalItem;
            faturamentoTotal += totalItem;

            if (item.adicionais || item.opcoes_escolhidas) {
                let extras = item.adicionais || item.opcoes_escolhidas;
                extras.forEach(add => {
                    let nomeAdd = add.nome || add;
                    adicionaisStats[nomeAdd] = (adicionaisStats[nomeAdd] || 0) + qtd;
                });
            }
        });
    });

    // 2. Mesclar com as Visitas do Funil
    visitasDB.forEach(v => {
        let nomeLimpo = v.produto_nome.trim();
        if (produtosStats[nomeLimpo]) {
            produtosStats[nomeLimpo].visitas += parseInt(v.visitas);
        } else {
            produtosStats[nomeLimpo] = { vendas: 0, faturamento: 0, visitas: parseInt(v.visitas) };
        }
    });

    // 3. Montar Array e Calcular Curva ABC
    let arrayProdutos = Object.keys(produtosStats).map(nome => {
        let stats = produtosStats[nome];
        let conversao = stats.visitas > 0 ? ((stats.vendas / stats.visitas) * 100).toFixed(1) : (stats.vendas > 0 ? 100 : 0);
        return { nome, ...stats, conversao: parseFloat(conversao) };
    });

    // Ordena por faturamento para o ABC base
    arrayProdutos.sort((a, b) => b.faturamento - a.faturamento);

    let faturamentoAcumulado = 0;
    arrayProdutos.forEach(p => {
        faturamentoAcumulado += p.faturamento;
        let percentual = (faturamentoAcumulado / faturamentoTotal) * 100;
        
        if (percentual <= 80) p.curva = 'A';
        else if (percentual <= 95) p.curva = 'B';
        else p.curva = 'C';
    });

    // Guarda na memória e renderiza a tabela ordenável
    dadosTabelaGlobal = arrayProdutos;
    ordenarTabela('faturamento', true); 

    // 4. Atualizar KPIs
    document.getElementById('kpi-top-produto').innerText = arrayProdutos[0] ? arrayProdutos[0].nome : '-';
    let piorConversao = arrayProdutos.filter(p => p.visitas > 10).sort((a, b) => a.conversao - b.conversao)[0];
    document.getElementById('kpi-pior-conversao').innerText = piorConversao ? `${piorConversao.nome} (${piorConversao.conversao}%)` : '-';

    // 5. Gráfico de Adicionais
    let arrayAdicionais = Object.entries(adicionaisStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('kpi-top-adicional').innerText = arrayAdicionais.length > 0 ? arrayAdicionais[0][0] : '-';
    desenharGraficoAdicionais(arrayAdicionais);
}

// ==========================================
// 📊 ORDENAÇÃO DINÂMICA DA TABELA
// ==========================================
window.ordenarTabela = function(coluna, forcarDescendente = false) {
    if (!forcarDescendente && ordenacaoAtual.coluna === coluna) {
        ordenacaoAtual.direcao = ordenacaoAtual.direcao === 'desc' ? 'asc' : 'desc';
    } else {
        ordenacaoAtual.coluna = coluna;
        ordenacaoAtual.direcao = 'desc';
    }

    dadosTabelaGlobal.sort((a, b) => {
        let valA = a[coluna];
        let valB = b[coluna];

        if (typeof valA === 'string') {
            return ordenacaoAtual.direcao === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return ordenacaoAtual.direcao === 'asc' ? valA - valB : valB - valA;
    });

    const colunasSortable = ['curva', 'nome', 'visitas', 'vendas', 'conversao', 'faturamento'];
    colunasSortable.forEach(c => {
        const icone = document.getElementById(`icone-${c}`);
        if (icone) {
            if (c === coluna) {
                icone.innerText = ordenacaoAtual.direcao === 'desc' ? '⬇️' : '⬆️';
            } else {
                icone.innerText = (c === 'curva' || c === 'nome') ? '' : '↕️';
            }
        }
    });

    const tbody = document.getElementById('tabela-abc');
    tbody.innerHTML = '';
    dadosTabelaGlobal.forEach(p => {
        let corCurva = p.curva === 'A' ? '#4CAF50' : (p.curva === 'B' ? '#FF9800' : '#F44336');
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee; transition: 0.2s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'">
                <td style="padding: 10px; font-weight: bold; color: ${corCurva}; text-align: center;">${p.curva}</td>
                <td style="padding: 10px;">${p.nome}</td>
                <td style="padding: 10px; text-align: center;">${p.visitas} 👀</td>
                <td style="padding: 10px; text-align: center;">${p.vendas} 🛒</td>
                <td style="padding: 10px; text-align: center;">${p.conversao}%</td>
                <td style="padding: 10px; font-weight: bold;">R$ ${p.faturamento.toFixed(2).replace('.', ',')}</td>
            </tr>
        `;
    });
}

function desenharGraficoAdicionais(dados) {
    const ctx = document.getElementById('graficoAdicionais').getContext('2d');
    if (chartAdicionais) chartAdicionais.destroy();

    chartAdicionais = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.map(d => d[0]),
            datasets: [{
                label: 'Vezes Escolhido',
                data: dados.map(d => d[1]),
                backgroundColor: '#FF9800',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}