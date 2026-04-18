/* =========================================
   1. ESTADO GLOBAL
   ========================================= */
// A lista agora começa vazia. Os dados virão da Nuvem!
let historicoVendas = [];

/* =========================================
   2. COMUNICAÇÃO COM A NUVEM (API FETCH)
   ========================================= */
async function carregarDadosDaNuvem() {
    try {
        // Pede as vendas reais para o nosso servidor
        const resposta = await fetch('https://icesoft-api.onrender.com/api/vendas');
        const vendasDoBanco = await resposta.json();

        // Traduz os dados do Banco para o formato que a nossa tela HTML espera
        historicoVendas = vendasDoBanco.map(venda => ({
            id: venda.codigo_venda,
            origem: "💻 Balcão",
            data: new Date(venda.data_hora).toLocaleString('pt-BR'),
            valor: parseFloat(venda.valor_total),
            status: venda.status,
            classe: venda.status === 'Concluída' ? 'concluida' : 'cancelada',
            filtro: 'hoje' // Para o MVP, assumimos tudo como 'hoje'
        }));

        // Agora que temos os dados reais, desenha a tela
        carregarDashboard('hoje');
        
    } catch (erro) {
        console.error("Erro ao conectar com a nuvem:", erro);
        document.getElementById('lista-vendas-tabela').innerHTML = '<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">⚠️ Falha de conexão com o Servidor Central. Não foi possível carregar os dados.</td></tr>';
    }
}

/* =========================================
   3. MOTOR ANALÍTICO (Cálculo de KPIs)
   ========================================= */
function carregarDashboard(periodoSelecionado) {
    const vendasFiltradas = historicoVendas.filter(venda => {
        if (periodoSelecionado === 'hoje') return venda.filtro === 'hoje';
        if (periodoSelecionado === 'semana') return venda.filtro === 'hoje' || venda.filtro === 'semana';
        return true; 
    });

    let faturamento = 0;
    let qtdVendasValidas = 0;

    const tabela = document.getElementById('lista-vendas-tabela');
    tabela.innerHTML = ''; 

    vendasFiltradas.forEach(venda => {
        if (venda.status !== 'Cancelada') {
            faturamento += venda.valor;
            qtdVendasValidas++;
        }

        tabela.innerHTML += `
            <tr>
                <td><strong>${venda.id}</strong></td>
                <td>${venda.origem}</td>
                <td>${venda.data}</td>
                <td>R$ ${venda.valor.toFixed(2).replace('.', ',')}</td>
                <td><span class="badge ${venda.classe}">${venda.status}</span></td>
                <td>
                    <button class="btn-acao" onclick="auditarVenda('${venda.id}')">Auditar</button>
                </td>
            </tr>
        `;
    });

    const ticketMedio = qtdVendasValidas > 0 ? (faturamento / qtdVendasValidas) : 0;

    document.getElementById('kpi-faturamento').innerText = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;
    document.getElementById('kpi-vendas').innerText = qtdVendasValidas;
    document.getElementById('kpi-ticket').innerText = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
}

/* =========================================
   4. CONTROLES DA TELA E INICIALIZAÇÃO
   ========================================= */
document.getElementById('filtro-tempo').addEventListener('change', function(evento) {
    carregarDashboard(evento.target.value);
});

function auditarVenda(idVenda) {
    alert(`Abertura do registro da venda ${idVenda}.\nNo futuro, isso abrirá o detalhamento com o Histórico de Alterações dessa nota.`);
}

// Assim que o dono abre o Dashboard, o sistema busca os dados da nuvem
window.onload = () => {
    carregarDadosDaNuvem();
};

/* =========================================
   5. INTELIGÊNCIA DE NEGÓCIO (RANKING)
   ========================================= */
async function carregarRankingMaisVendidos() {
    try {
        const resposta = await fetch('https://icesoft-api.onrender.com/api/ranking');
        const ranking = await resposta.json();

        // Pega a tabela INTEIRA para podermos trocar os cabeçalhos
        const tabelaCompleta = document.querySelector('.tabela-vendas');
        
        document.querySelector('.section-header h2').innerText = "📦 Ranking de Produtos Mais Vendidos";
        document.querySelector('.subtitle').innerText = "Os sorvetes favoritos dos seus clientes";
        
        tabelaCompleta.innerHTML = `
            <thead>
                <tr>
                    <th>Produto</th>
                    <th>Quantidade Vendida</th>
                    <th>Status de Estoque</th>
                </tr>
            </thead>
            <tbody id="lista-vendas-tabela">
                ${ranking.map(item => `
                    <tr>
                        <td><strong>${item.nome}</strong></td>
                        <td>${item.quantidade} unidades</td>
                        <td><span class="badge concluida">Em Alta 🔥</span></td>
                    </tr>
                `).join('')}
            </tbody>
        `;
    } catch (erro) {
        console.error("Erro no ranking:", erro);
    }
}

/* =========================================
   6. NAVEGAÇÃO DO MENU LATERAL
   ========================================= */
const botoesMenu = document.querySelectorAll('.menu-item');

// Clique na Aba: Visão Geral (Volta ao normal)
botoesMenu[0].addEventListener('click', function() {
    botoesMenu.forEach(m => m.classList.remove('ativo'));
    this.classList.add('ativo');
    
    document.querySelector('.section-header h2').innerText = "Últimas Vendas Registradas";
    document.querySelector('.subtitle').innerText = "Auditoria e gestão do fluxo de caixa";
    
    // Devolve o cabeçalho financeiro original para a tabela
    document.querySelector('.tabela-vendas').innerHTML = `
        <thead>
            <tr>
                <th>Cód. da Venda</th>
                <th>Origem</th>
                <th>Data / Hora</th>
                <th>Valor Total</th>
                <th>Status</th>
                <th>Ações</th>
            </tr>
        </thead>
        <tbody id="lista-vendas-tabela"></tbody>
    `;
    
    // Pede para a nuvem desenhar os dados financeiros de novo
    carregarDadosDaNuvem(); 
});

// Clique na Aba: Produtos Mais Vendidos
botoesMenu[2].addEventListener('click', function() {
    botoesMenu.forEach(m => m.classList.remove('ativo'));
    this.classList.add('ativo');
    carregarRankingMaisVendidos();
});

// Ligar o clique no botão do menu
document.querySelectorAll('.menu-item')[2].addEventListener('click', function() {
    // Remove 'ativo' de todos e coloca neste
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('ativo'));
    this.classList.add('ativo');
    carregarRankingMaisVendidos();
});