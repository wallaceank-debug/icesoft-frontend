const API_URL = 'https://icesoft-api.onrender.com/api';

// Variáveis Globais (A memória do sistema)
let produtosDaNuvem = [];
let gruposGlobais = [];
let categoriasGlobais = []; 
let carrinho = [];
let categoriaAtiva = 'Todos'; 
let produtoEmSelecao = null;
let escolhasAtuais = [];
let subtotalGlobalPDV = 0;

window.onload = async () => {
    await carregarDadosIniciais();
};

async function carregarDadosIniciais() {
    try {
        const [resProd, resGrupos, resCat] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/grupos`),
            fetch(`${API_URL}/categorias`)
        ]);
        
        const todosProdutos = await resProd.json();
        const todosGrupos = await resGrupos.json();
        categoriasGlobais = await resCat.json(); // Puxa do servidor

        // Filtra só o que está ligado
        produtosDaNuvem = todosProdutos.filter(p => p.ativo !== false);
        gruposGlobais = todosGrupos.filter(g => g.ativo !== false);
        
        renderizarBotoesCategoria();
        filtrarE_RenderizarProdutos();
    } catch (e) { 
        console.error("Erro ao carregar dados:", e); 
        document.getElementById('grade-produtos').innerHTML = '<p style="padding: 20px; color: red;">Erro ao conectar. Atualize a página.</p>';
    }
}

// ==========================================
// FILTROS E CATEGORIAS DINÂMICAS
// ==========================================

function renderizarBotoesCategoria() {
    const nav = document.getElementById('barra-categorias');
    nav.innerHTML = '';
    
    // O botão "Todos" é fixo
    const classeTodos = categoriaAtiva === 'Todos' ? 'ativo' : '';
    nav.innerHTML += `<button class="categoria-btn ${classeTodos}" onclick="mudarCategoria('Todos')">Todos</button>`;

    // Puxa as categorias da memória global
    if (categoriasGlobais && categoriasGlobais.length > 0) {
        categoriasGlobais.forEach(cat => {
            const classeAtivo = cat.nome === categoriaAtiva ? 'ativo' : '';
            nav.innerHTML += `<button class="categoria-btn ${classeAtivo}" onclick="mudarCategoria('${cat.nome}')">${cat.nome}</button>`;
        });
    }
}

function mudarCategoria(novaCategoria) {
    categoriaAtiva = novaCategoria;
    renderizarBotoesCategoria();
    filtrarE_RenderizarProdutos();
}

function filtrarE_RenderizarProdutos() {
    let produtosFiltrados = produtosDaNuvem;
    if (categoriaAtiva !== 'Todos') {
        produtosFiltrados = produtosDaNuvem.filter(p => (p.categoria || "Outros") === categoriaAtiva);
    }
    renderizarGradeProdutos(produtosFiltrados);
}

function renderizarGradeProdutos(lista) {
    const container = document.getElementById('grade-produtos');
    container.innerHTML = '';

    if(lista.length === 0) {
        container.innerHTML = '<p style="padding: 20px; opacity: 0.7;">Nenhum produto encontrado nesta categoria.</p>';
        return;
    }

    lista.forEach(p => {
        container.innerHTML += `
            <div class="pdv-card" onclick="verificarAdicao(${p.id})">
                <div class="pdv-emoji">${p.emoji || '🍨'}</div>
                <div class="pdv-nome">${p.nome}</div>
                <div class="pdv-preco">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>
            </div>
        `;
    });
}

// ==========================================
// LÓGICA DE ADIÇÃO E MODAL (ADICIONAIS)
// ==========================================

function verificarAdicao(id) {
    const produto = produtosDaNuvem.find(p => p.id === id);
    if (!produto.grupos_ids || produto.grupos_ids.length === 0) {
        adicionarAoCarrinho(produto.nome, Number(produto.preco));
        return;
    }
    abrirModalEscolha(produto);
}

function abrirModalEscolha(produto) {
    produtoEmSelecao = produto;
    escolhasAtuais = [];
    
    document.getElementById('detalhes-produto-topo').innerHTML = `
        <h2 style="margin:0; color:#00bcd4;">${produto.nome}</h2>
        <p style="color:#777; margin:5px 0;">Selecione os adicionais solicitados</p>
    `;

    const container = document.getElementById('container-grupos-opcoes');
    container.innerHTML = '';
    
    // Usa a ordem que você definiu lá na Gestão
    const gruposDoProduto = produto.grupos_ids
        .map(id => gruposGlobais.find(g => g.id === Number(id)))
        .filter(g => g && g.ativo !== false); 

    gruposDoProduto.forEach(grupo => {
        const itensAtivos = (grupo.itens || []).filter(item => item.ativo !== false);
        if (itensAtivos.length === 0) return;

        let itensHtml = itensAtivos.map((item, idx) => {
            const chkId = `pdv-chk-${grupo.id}-${idx}`;
            return `
            <div class="item-opcional-card" onclick="toggleOpcional(${grupo.id}, '${item.nome}', ${item.preco}, '${chkId}')" 
                 style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="${chkId}" style="width:18px; height:18px; accent-color:#00bcd4; pointer-events:none;">
                    <span style="font-weight: 500;">${item.nome}</span>
                </div>
                <span style="color:#25D366; font-weight:bold;">${item.preco > 0 ? '+ R$ ' + Number(item.preco).toFixed(2) : 'Grátis'}</span>
            </div>`;
        }).join('');

        container.innerHTML += `
            <div style="margin-bottom:15px;">
                <div style="background:#f8f9fa; padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#333;">${grupo.nome}</strong>
                    <span style="font-size:0.75rem; color:white; background:#00bcd4; padding:2px 8px; border-radius:10px;">Até ${grupo.limite}</span>
                </div>
                ${itensHtml}
            </div>
        `;
    });

    atualizarPrecoDinamico();
    document.getElementById('modal-opcoes').style.display = 'flex';
}

function toggleOpcional(grupoId, nomeItem, preco, chkId) {
    const grupo = gruposGlobais.find(g => g.id === grupoId);
    const chk = document.getElementById(chkId);
    const index = escolhasAtuais.findIndex(e => e.nome === nomeItem && e.grupoId === grupoId);

    if (index > -1) {
        escolhasAtuais.splice(index, 1);
        chk.checked = false;
    } else {
        const escolhasNoGrupo = escolhasAtuais.filter(e => e.grupoId === grupoId);
        
        if (grupo.limite === 1) {
            if (escolhasNoGrupo.length > 0) {
                const idxAnterior = escolhasAtuais.indexOf(escolhasNoGrupo[0]);
                escolhasAtuais.splice(idxAnterior, 1);
                document.querySelectorAll(`input[id^="pdv-chk-${grupoId}-"]`).forEach(c => c.checked = false);
            }
        } else if (escolhasNoGrupo.length >= grupo.limite) {
            alert(`Limite de ${grupo.limite} itens atingido para este grupo.`);
            return;
        }
        
        escolhasAtuais.push({ grupoId, nome: nomeItem, preco: Number(preco) });
        chk.checked = true;
    }
    atualizarPrecoDinamico();
}

function atualizarPrecoDinamico() {
    const totalOpcionais = escolhasAtuais.reduce((soma, e) => soma + Number(e.preco), 0);
    const totalGeral = Number(produtoEmSelecao.preco) + totalOpcionais;
    document.getElementById('preco-dinamico').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
}

function fecharModalOpcoes() { document.getElementById('modal-opcoes').style.display = 'none'; }

function confirmarEscolhasEAdicionar() {
    let nomeFinal = produtoEmSelecao.nome;
    if (escolhasAtuais.length > 0) {
        nomeFinal += " (" + escolhasAtuais.map(e => e.nome).join(', ') + ")";
    }
    const precoFinal = Number(produtoEmSelecao.preco) + escolhasAtuais.reduce((soma, e) => soma + Number(e.preco), 0);
    adicionarAoCarrinho(nomeFinal, precoFinal);
    fecharModalOpcoes();
}

// ==========================================
// GESTÃO DO CARRINHO
// ==========================================

function adicionarAoCarrinho(nome, preco) {
    carrinho.push({ nome, preco: Number(preco) });
    renderizarCarrinho();
}

function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    renderizarCarrinho();
}

function renderizarCarrinho() {
    const container = document.getElementById('lista-carrinho');
    if (carrinho.length === 0) {
        container.innerHTML = '<div class="carrinho-vazio">Nenhum item adicionado</div>';
        document.getElementById('pdv-subtotal').innerText = "R$ 0,00";
        document.getElementById('pdv-total').innerText = "R$ 0,00";
        subtotalGlobalPDV = 0;
        return;
    }

    container.innerHTML = '';
    let subtotal = 0;

    carrinho.forEach((item, index) => {
        subtotal += item.preco;
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:start; padding:10px 0; border-bottom:1px solid #eee;">
                <div style="flex:1;">
                    <div style="font-weight:600; font-size:0.95rem; line-height:1.2;">${item.nome}</div>
                    <div style="color:#e91e63; font-weight:700;">R$ ${item.preco.toFixed(2).replace('.', ',')}</div>
                </div>
                <button onclick="removerDoCarrinho(${index})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.1rem; padding:0 5px;">🗑️</button>
            </div>
        `;
    });

    subtotalGlobalPDV = subtotal;
    document.getElementById('pdv-subtotal').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    document.getElementById('pdv-total').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
}

function limparCarrinho() {
    if (confirm("Deseja limpar todo o pedido?")) {
        carrinho = [];
        renderizarCarrinho();
    }
}

document.querySelector('.btn-limpar').onclick = limparCarrinho;
document.querySelector('.btn-cancelar').onclick = limparCarrinho;

// ==========================================
// SISTEMA DE COBRANÇA (CHECKOUT)
// ==========================================

function abrirModalCheckout() {
    if (carrinho.length === 0) {
        alert("⚠️ O carrinho está vazio! Adicione produtos antes de cobrar.");
        return;
    }
    
    document.getElementById('checkout-total').innerText = `R$ ${subtotalGlobalPDV.toFixed(2).replace('.', ',')}`;
    document.getElementById('checkout-recebido').value = '';
    document.getElementById('checkout-troco').innerText = 'R$ 0,00';
    document.getElementById('checkout-troco').style.color = '#25D366';
    
    document.getElementById('modal-checkout').style.display = 'flex';
    verificarMetodoPagamento(); 
    setTimeout(() => document.getElementById('checkout-recebido').focus(), 100);
}

function fecharModalCheckout() { document.getElementById('modal-checkout').style.display = 'none'; }

function verificarMetodoPagamento() {
    const metodo = document.getElementById('checkout-metodo').value;
    const areaTroco = document.getElementById('area-troco');
    areaTroco.style.display = (metodo === 'Dinheiro') ? 'block' : 'none';
}

function calcularTroco() {
    const recebido = parseFloat(document.getElementById('checkout-recebido').value) || 0;
    const troco = recebido - subtotalGlobalPDV;
    const displayTroco = document.getElementById('checkout-troco');
    
    if (troco >= 0) {
        displayTroco.innerText = `R$ ${troco.toFixed(2).replace('.', ',')}`;
        displayTroco.style.color = '#25D366';
    } else {
        displayTroco.innerText = `Faltam R$ ${Math.abs(troco).toFixed(2).replace('.', ',')}`;
        displayTroco.style.color = '#f44336'; 
    }
}

async function finalizarVendaPDV() {
    if (carrinho.length === 0) return alert("Carrinho vazio!");

    const metodo = document.getElementById('checkout-metodo').value;
    const itensFormatados = carrinho.map(item => ({ nome: "Balcão: " + item.nome, preco: item.preco }));
    
    const dadosDaVenda = {
        itens: JSON.stringify(itensFormatados), 
        produto_nome: JSON.stringify(itensFormatados), 
        valor_total: subtotalGlobalPDV,
        total: subtotalGlobalPDV,
        forma_pagamento: metodo,
        status: "Concluída"
    };

    try {
        const resposta = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosDaVenda)
        });

        if (resposta.ok) {
            alert(`✅ Venda Finalizada!\nPagamento: ${metodo}\nTotal: R$ ${subtotalGlobalPDV.toFixed(2).replace('.', ',')}`);
            carrinho = []; 
            renderizarCarrinho(); 
            fecharModalCheckout(); 
        } else {
            alert("Erro ao salvar no banco de dados.");
        }
    } catch (e) {
        alert("Erro de conexão com o servidor. Verifique a internet.");
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') {
        e.preventDefault(); 
        abrirModalCheckout();
    }
    if (e.key === 'Enter' && document.getElementById('modal-checkout').style.display === 'flex') {
        finalizarVendaPDV(); 
    }
});

document.querySelector('.btn-cobrar').onclick = abrirModalCheckout;