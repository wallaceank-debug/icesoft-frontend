/* =========================================
   0. CATRACA DE SEGURANÇA
   ========================================= */
if (!localStorage.getItem('icesoft_token')) {
    alert("Acesso Negado! Por favor, faça login.");
    window.location.href = '/login/'; 
}

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

// Função para listar os produtos na tabela de gestão (AGORA COM BOTÃO EXCLUIR)
async function carregarProdutosGestao() {
    const resposta = await fetch('https://icesoft-api.onrender.com/api/produtos');
    const produtos = await resposta.json();
    const tabela = document.getElementById('tabela-produtos-gestao');
    tabela.innerHTML = '';

    produtos.forEach(p => {
        tabela.innerHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-size: 1.5rem;">${p.emoji}</td>
                <td><strong>${p.nome}</strong></td>
                <td>R$ ${p.preco.toFixed(2)}</td>
                <td>
                    <button onclick='prepararEdicao(${JSON.stringify(p)})' style="background:#2196F3; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-right:5px;">Editar</button>
                    <button onclick='excluirProduto(${p.id})' style="background:#f44336; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Excluir</button>
                </td>
            </tr>
        `;
    });
}

// Abre o modal para NOVO produto
function abrirModalProduto() {
    document.getElementById('modal-titulo').innerText = "Cadastrar Produto";
    document.getElementById('prod-id').value = "";
    document.getElementById('prod-nome').value = "";
    document.getElementById('prod-desc').value = "";
    document.getElementById('prod-preco').value = "";
    document.getElementById('prod-emoji').value = "";
    document.getElementById('modal-produto').style.display = 'flex';
}

// Abre o modal preenchido para EDITAR
function prepararEdicao(produto) {
    document.getElementById('modal-titulo').innerText = "Editar Produto";
    document.getElementById('prod-id').value = produto.id;
    document.getElementById('prod-nome').value = produto.nome;
    document.getElementById('prod-desc').value = produto.descricao;
    document.getElementById('prod-preco').value = produto.preco;
    document.getElementById('prod-emoji').value = produto.emoji;
    document.getElementById('modal-produto').style.display = 'flex';
}

function fecharModalProduto() {
    document.getElementById('modal-produto').style.display = 'none';
}

// A FUNÇÃO PRINCIPAL: Salva na Nuvem
async function salvarProduto() {
    const id = document.getElementById('prod-id').value;
    const dados = {
        nome: document.getElementById('prod-nome').value,
        descricao: document.getElementById('prod-desc').value,
        preco: parseFloat(document.getElementById('prod-preco').value),
        emoji: document.getElementById('prod-emoji').value
    };

    let url = 'https://icesoft-api.onrender.com/api/produtos';
    let metodo = 'POST'; // Padrão é criar novo

    if (id) {
        url = `https://icesoft-api.onrender.com/api/produtos/${id}`;
        metodo = 'PUT'; // Se tem ID, estamos editando
    }

    const resposta = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    if (resposta.ok) {
        alert("Sucesso! O cardápio foi atualizado.");
        fecharModalProduto();
        carregarProdutosGestao(); // Recarrega a tabela
    } else {
        alert("Erro ao salvar produto.");
    }
}

// Função para Excluir o Produto
async function excluirProduto(id) {
    // A caixa de confirmação de segurança (para você não apagar sem querer)
    const confirmacao = confirm("⚠️ Tem certeza que deseja excluir este sorvete? Ele sumirá do cardápio dos clientes!");
    
    if (confirmacao) {
        try {
            const resposta = await fetch(`https://icesoft-api.onrender.com/api/produtos/${id}`, {
                method: 'DELETE'
            });

            if (resposta.ok) {
                alert("🗑️ Produto excluído com sucesso!");
                carregarProdutosGestao(); // Recarrega a tabela instantaneamente
            } else {
                alert("Erro ao excluir o produto.");
            }
        } catch (erro) {
            console.error("Erro na exclusão:", erro);
            alert("Erro de conexão ao tentar excluir.");
        }
    }
}

// Chamar a lista assim que o Dashboard carregar
carregarProdutosGestao();