const API_URL = 'https://icesoft-api.onrender.com/api';
let produtosDaNuvem = [];
let gruposGlobais = [];
let carrinho = [];

// Variáveis para o item que está sendo personalizado no momento
let produtoEmSelecao = null;
let escolhasAtuais = [];

window.onload = async () => {
    await carregarDadosIniciais();
};

async function carregarDadosIniciais() {
    try {
        const [resProd, resGrupos] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/grupos`)
        ]);
        
        const todosProdutos = await resProd.json();
        const todosGrupos = await resGrupos.json();

        // Filtra só o que tá ligado
        produtosDaNuvem = todosProdutos.filter(p => p.ativo !== false);
        gruposGlobais = todosGrupos.filter(g => g.ativo !== false);
        
        renderizarGradeProdutos(produtosDaNuvem);
    } catch (e) { console.error("Erro ao carregar dados:", e); }
}

function renderizarGradeProdutos(lista) {
    const container = document.getElementById('grade-produtos');
    container.innerHTML = '';
    lista.forEach(p => {
        container.innerHTML += `
            <div class="pdv-card" onclick="verificarAdicao(${p.id})">
                <div class="pdv-emoji">${p.emoji}</div>
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
    
    const gruposDoProduto = gruposGlobais.filter(g => produto.grupos_ids.includes(g.id));

    gruposDoProduto.forEach(grupo => {
        // Filtra os itens desligados
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
// GESTÃO DO CARRINHO (LADO DIREITO)
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

    document.getElementById('pdv-subtotal').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    document.getElementById('pdv-total').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
}

function limparCarrinho() {
    if (confirm("Deseja limpar todo o pedido?")) {
        carrinho = [];
        renderizarCarrinho();
    }
}

// Vincular botão de limpar
document.querySelector('.btn-limpar').onclick = limparCarrinho;
document.querySelector('.btn-cancelar').onclick = limparCarrinho;

// ==========================================
// SISTEMA DE COBRANÇA (CHECKOUT PDV) E TROCO
// ==========================================
let subtotalGlobalPDV = 0; // Guarda o valor total para facilitar o cálculo do troco

// Sobrescrevendo a função renderizarCarrinho para salvar o valor Global
const renderizarCarrinhoAntiga = renderizarCarrinho;
renderizarCarrinho = function() {
    renderizarCarrinhoAntiga(); // Chama a função original que já desenha a lista
    // Atualiza a variável global calculando o total do carrinho atual
    subtotalGlobalPDV = carrinho.reduce((soma, item) => soma + item.preco, 0);
};

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
    verificarMetodoPagamento(); // Atualiza a visão da caixa de troco
    
    // Foca automaticamente no campo de dinheiro para o caixa digitar rápido
    setTimeout(() => document.getElementById('checkout-recebido').focus(), 100);
}

function fecharModalCheckout() {
    document.getElementById('modal-checkout').style.display = 'none';
}

function verificarMetodoPagamento() {
    const metodo = document.getElementById('checkout-metodo').value;
    const areaTroco = document.getElementById('area-troco');
    // Só mostra a área de dar troco se o pagamento for em Dinheiro
    areaTroco.style.display = (metodo === 'Dinheiro') ? 'block' : 'none';
}

function calcularTroco() {
    const recebido = parseFloat(document.getElementById('checkout-recebido').value) || 0;
    const troco = recebido - subtotalGlobalPDV;
    const displayTroco = document.getElementById('checkout-troco');
    
    if (troco >= 0) {
        displayTroco.innerText = `R$ ${troco.toFixed(2).replace('.', ',')}`;
        displayTroco.style.color = '#25D366'; // Verde (tudo ok)
    } else {
        displayTroco.innerText = `Faltam R$ ${Math.abs(troco).toFixed(2).replace('.', ',')}`;
        displayTroco.style.color = '#f44336'; // Vermelho (dinheiro insuficiente)
    }
}

async function finalizarVendaPDV() {
    if (carrinho.length === 0) return alert("Carrinho vazio!");

    // 1. Pega o método de pagamento que o caixa selecionou na janelinha
    const metodo = document.getElementById('checkout-metodo').value;

    const itensFormatados = carrinho.map(item => {
        return { nome: "Balcão: " + item.nome, preco: item.preco };
    });
    
    // PACOTE UNIVERSAL: Mandamos todas as chaves possíveis para o servidor não se perder
    const dadosDaVenda = {
        itens: JSON.stringify(itensFormatados), 
        produto_nome: JSON.stringify(itensFormatados), // Garantia
        valor_total: subtotalGlobalPDV,
        total: subtotalGlobalPDV, // A palavra mágica que faltava!
        forma_pagamento: metodo,
        status: "Concluída"
    };

    // RADARES ATIVADOS 🕵️‍♂️
    console.log("🚀 1. PREPARANDO ENVIO:", dadosDaVenda);

    try {
        const resposta = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosDaVenda)
        });

        const respostaDoServidor = await resposta.json();
        console.log("📩 2. O BANCO DE DADOS RESPONDEU:", respostaDoServidor);

        if (resposta.ok) {
            // Sucesso Total! Avisa o usuário, limpa o carrinho e fecha a janela (usando as funções corretas)
            alert(`✅ Venda Finalizada!\nPagamento: ${metodo}\nTotal: R$ ${subtotalGlobalPDV.toFixed(2).replace('.', ',')}`);
            
            carrinho = []; 
            renderizarCarrinho(); 
            fecharModalCheckout(); 
        } else {
            console.error("❌ 3. ERRO DO BANCO:", respostaDoServidor);
            alert("Erro ao salvar no banco de dados.");
        }
    } catch (e) {
        console.error("❌ 3. ERRO DE CONEXÃO FATAL:", e);
        alert("Erro de conexão com o servidor. Verifique a internet.");
    }
}

// ==========================================
// ATALHOS DE TECLADO E BOTÕES (VELOCIDADE DE CAIXA)
// ==========================================
document.addEventListener('keydown', (e) => {
    // F12 para abrir cobrança
    if (e.key === 'F12') {
        e.preventDefault(); 
        abrirModalCheckout();
    }
    // Enter para confirmar a venda se a janela estiver aberta
    if (e.key === 'Enter' && document.getElementById('modal-checkout').style.display === 'flex') {
        finalizarVendaPDV(); // Agora a função puxa o método de pagamento sozinha!
    }
});

// Vincular o botão verde físico da tela principal
document.querySelector('.btn-cobrar').onclick = abrirModalCheckout;