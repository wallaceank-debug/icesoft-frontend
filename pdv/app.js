const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';

// Variáveis Globais (A memória do sistema)
let produtosDaNuvem = [];
let gruposGlobais = [];
let categoriasGlobais = []; 
let carrinho = [];
let categoriaAtiva = 'Todos'; 
let produtoEmSelecao = null;
let escolhasAtuais = [];
let subtotalGlobalPDV = 0;
let caixaAtual = { id: null, status: 'Fechado' };

// Memória dos Descontos e Acréscimos
let descontoGlobal = 0;
let acrescimoGlobal = 0;
let totalFinalGlobal = 0; 

window.onload = async () => {
    await verificarStatusCaixa(); 
    await carregarDadosIniciais();
    await carregarStatusLoja();
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
        categoriasGlobais = await resCat.json(); 

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
    
    const classeTodos = categoriaAtiva === 'Todos' ? 'ativo' : '';
    nav.innerHTML += `<button class="categoria-btn ${classeTodos}" onclick="mudarCategoria('Todos')">Todos</button>`;

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
        adicionarAoCarrinho(produto.nome, [], Number(produto.preco));
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
    const nomeBase = produtoEmSelecao.nome;
    const listaAdicionais = escolhasAtuais.map(e => e.nome);
    const precoFinal = Number(produtoEmSelecao.preco) + escolhasAtuais.reduce((soma, e) => soma + Number(e.preco), 0);
    
    adicionarAoCarrinho(nomeBase, listaAdicionais, precoFinal);
    fecharModalOpcoes();
}

// ==========================================
// MÓDULO DE DESCONTOS E ACRÉSCIMOS
// ==========================================

function pedirDesconto() {
    let valor = prompt("✏️ Digite o valor do DESCONTO em R$ (Ex: 5.50)\n(Ou deixe em branco para zerar):");
    if (valor !== null) {
        descontoGlobal = parseFloat(valor.replace(',', '.')) || 0;
        atualizarTotais();
    }
}

function pedirAcrescimo() {
    let valor = prompt("✏️ Digite o valor do ACRÉSCIMO/TAXA em R$ (Ex: 2.00)\n(Ou deixe em branco para zerar):");
    if (valor !== null) {
        acrescimoGlobal = parseFloat(valor.replace(',', '.')) || 0;
        atualizarTotais();
    }
}

function atualizarTotais() {
    totalFinalGlobal = subtotalGlobalPDV - descontoGlobal + acrescimoGlobal;
    if (totalFinalGlobal < 0) totalFinalGlobal = 0; 

    const divDesconto = document.getElementById('pdv-desconto');
    const divAcrescimo = document.getElementById('pdv-acrescimo');
    const divTotal = document.getElementById('pdv-total');

    if (divDesconto) divDesconto.innerText = `- R$ ${descontoGlobal.toFixed(2).replace('.', ',')}`;
    if (divAcrescimo) divAcrescimo.innerText = `+ R$ ${acrescimoGlobal.toFixed(2).replace('.', ',')}`;
    if (divTotal) divTotal.innerText = `R$ ${totalFinalGlobal.toFixed(2).replace('.', ',')}`;

    const checkoutTotal = document.getElementById('checkout-total');
    if (checkoutTotal) checkoutTotal.innerText = `R$ ${totalFinalGlobal.toFixed(2).replace('.', ',')}`;
    
    if (typeof calcularTroco === "function") calcularTroco(); 
}

// ==========================================
// GESTÃO DO CARRINHO
// ==========================================

function adicionarAoCarrinho(nomeBase, adicionais, preco) {
    carrinho.push({ nomeBase, adicionais, preco: Number(preco), qtd: 1 });
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
        subtotalGlobalPDV = 0;
        atualizarTotais(); 
        return;
    }

    container.innerHTML = '';
    let subtotal = 0;

    carrinho.forEach((item, index) => {
        subtotal += item.preco;

        let htmlAdicionais = '';
        if (item.adicionais && item.adicionais.length > 0) {
            htmlAdicionais = item.adicionais.map(adc => `
                <div style="color: #666; font-size: 0.85rem; padding-left: 25px; margin-top: 3px;">
                    + ${adc}
                </div>
            `).join('');
        }

        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:start; padding:15px 0; border-bottom:1px dashed #ddd;">
                <div style="flex:1;">
                    <div style="display:flex; align-items: center; gap: 8px;">
                        <span style="font-weight:700; font-size:0.95rem; color:#888;">${item.qtd}x</span>
                        <span style="font-weight:700; font-size:1.1rem; line-height:1.2; color:#333;">${item.nomeBase}</span>
                    </div>
                    ${htmlAdicionais}
                    <div style="color:#e91e63; font-weight:700; margin-top: 8px; padding-left: 25px;">R$ ${item.preco.toFixed(2).replace('.', ',')}</div>
                </div>
                <button onclick="removerDoCarrinho(${index})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.3rem; padding:5px; transition: 0.2s;">🗑️</button>
            </div>
        `;
    });

    subtotalGlobalPDV = subtotal;
    document.getElementById('pdv-subtotal').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    atualizarTotais(); 
}

function limparCarrinho() {
    if (confirm("Deseja limpar todo o pedido?")) {
        carrinho = [];
        descontoGlobal = 0;
        acrescimoGlobal = 0;
        renderizarCarrinho();
    }
}

document.querySelector('.btn-limpar').onclick = limparCarrinho;
document.querySelector('.btn-cancelar').onclick = limparCarrinho;

// ==========================================
// SISTEMA DE COBRANÇA (CHECKOUT)
// ==========================================

function abrirModalCheckout() {
    if (caixaAtual.status === 'Fechado') {
        return alert("⚠️ O Caixa está FECHADO! Clique no indicador no topo da tela para abrir o caixa antes de cobrar.");
    }
    
    document.getElementById('checkout-total').innerText = `R$ ${totalFinalGlobal.toFixed(2).replace('.', ',')}`;
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
    const troco = recebido - totalFinalGlobal;
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
    
    const itensFormatados = carrinho.map(item => {
        let nomeCompleto = "Balcão: " + item.nomeBase;
        if (item.adicionais && item.adicionais.length > 0) {
            nomeCompleto += " (" + item.adicionais.join(', ') + ")";
        }
        return { nome: nomeCompleto, preco: item.preco };
    });
    
    const dadosDaVenda = {
        itens: JSON.stringify(itensFormatados), 
        produto_nome: JSON.stringify(itensFormatados), 
        valor_total: totalFinalGlobal,
        total: totalFinalGlobal,
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
            const recebido = parseFloat(document.getElementById('checkout-recebido').value) || totalFinalGlobal;
            const troco = recebido - totalFinalGlobal;
            
            const querImprimir = document.getElementById('checkout-imprimir').checked;
            if (querImprimir) {
                imprimirComanda(metodo, recebido, troco); 
            }

            alert(`✅ Venda Finalizada!\nPagamento: ${metodo}\nTotal: R$ ${totalFinalGlobal.toFixed(2).replace('.', ',')}`);
            carrinho = []; 
            descontoGlobal = 0;
            acrescimoGlobal = 0;
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

// ==========================================
// MÓDULO DE IMPRESSÃO (ELGIN i8 - 80mm)
// ==========================================

function imprimirComanda(metodoPagamento, valorRecebido, troco) {
    const cupom = document.getElementById('cupom-impressao');
    const dataHora = new Date().toLocaleString('pt-BR');

    let itensHtml = '';
    carrinho.forEach(item => {
        let textoAdicionais = '';
        if (item.adicionais && item.adicionais.length > 0) {
            textoAdicionais = item.adicionais.map(adc => `<div style="font-size: 13px; padding-left: 10px;">- ${adc}</div>`).join('');
        }

        itensHtml += `
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 15px;">
                    <span style="font-weight: 900;">${item.qtd}x ${item.nomeBase}</span>
                    <span style="font-weight: 900;">R$ ${item.preco.toFixed(2).replace('.', ',')}</span>
                </div>
                ${textoAdicionais}
            </div>
        `;
    });

    let extraHtml = '';
    if (descontoGlobal > 0) {
        extraHtml += `<div style="text-align: right; font-size: 14px; color: #555;">Desconto: - R$ ${descontoGlobal.toFixed(2).replace('.', ',')}</div>`;
    }
    if (acrescimoGlobal > 0) {
        extraHtml += `<div style="text-align: right; font-size: 14px; color: #555;">Acréscimo: + R$ ${acrescimoGlobal.toFixed(2).replace('.', ',')}</div>`;
    }

    cupom.innerHTML = `
        <div style="text-align: center; margin-bottom: 15px;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 900;">SORVETERIA ICESOFT</h2>
            <p style="margin: 2px 0; font-size: 14px;">Cupom Não Fiscal</p>
            <p style="margin: 2px 0; font-size: 14px;">${dataHora}</p>
        </div>
        
        <div style="border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 10px 0; margin-bottom: 15px;">
            ${itensHtml}
        </div>
        
        <div style="text-align: right; font-size: 15px;">
            <div style="font-size: 14px; color: #555;">Subtotal: R$ ${subtotalGlobalPDV.toFixed(2).replace('.', ',')}</div>
            ${extraHtml}
            <strong style="font-size: 20px; display: block; margin-top: 5px;">TOTAL: R$ ${totalFinalGlobal.toFixed(2).replace('.', ',')}</strong><br>
            Pagamento: ${metodoPagamento}<br>
            ${metodoPagamento === 'Dinheiro' ? `Recebido: R$ ${valorRecebido.toFixed(2).replace('.', ',')}<br>Troco: R$ ${troco.toFixed(2).replace('.', ',')}` : ''}
        </div>
        
        <div style="text-align: center; margin-top: 20px; font-size: 14px;">
            <p style="margin: 2px 0;">Obrigado pela preferência!</p>
            <p style="margin: 2px 0;">~ Icesoft Sistema PDV ~</p>
        </div>
    `;

    cupom.style.display = 'block';
    window.print();
    cupom.style.display = 'none';
}

// ==========================================
// CONTROLE DE CAIXA (Painel e Movimentações)
// ==========================================
let tipoMovimentacaoAtual = ''; 

async function verificarStatusCaixa() {
    try {
        const resposta = await fetch(`${API_URL}/caixa/status`);
        caixaAtual = await resposta.json();
        
        const bolinha = document.getElementById('dot-caixa');
        const texto = document.getElementById('texto-status-caixa');
        
        if (caixaAtual.status === 'Aberto') {
            bolinha.style.backgroundColor = '#25D366';
            texto.innerText = `Caixa Aberto`;
        } else {
            bolinha.style.backgroundColor = '#f44336';
            texto.innerText = `Caixa Fechado`;
        }
    } catch (e) { console.error("Erro ao verificar caixa:", e); }
}

function abrirPainelCaixa() {
    const container = document.getElementById('conteudo-modal-caixa');
    
    if (caixaAtual.status === 'Fechado') {
        container.innerHTML = `
            <h2 style="color:#333; margin-top:0;">🔑 Abrir Caixa</h2>
            <p style="color:#666; font-size:0.95rem; margin-bottom: 20px;">Informe o Fundo de Caixa (Troco Inicial) para iniciar as vendas.</p>
            <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:20px; border: 1px solid #eee;">
                <label style="color:#555; font-weight:600; font-size:1rem;">Valor em Dinheiro (R$)</label>
                <input type="number" id="input-valor-caixa" class="input-padrao" placeholder="Ex: 100.00" style="width:100%; margin-top:10px; font-size:1.5rem; text-align: center; padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="document.getElementById('modal-caixa').style.display='none'" style="flex: 1; padding: 12px; font-size: 1rem; border: 1px solid #ccc; background: #f0f0f0; border-radius: 8px; cursor: pointer;">Cancelar</button>
                <button onclick="processarCaixa('abrir')" style="flex: 2; padding: 12px; font-size: 1.1rem; background-color: #25D366; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">ABRIR CAIXA</button>
            </div>
        `;
    } else {
        const dataAbertura = new Date(caixaAtual.data_abertura).toLocaleString('pt-BR');
        container.innerHTML = `
            <h2 style="color:#333; margin-top:0;">💵 Gerenciar Caixa</h2>
            <p style="color:#666; font-size:0.85rem; margin-bottom: 20px;">Aberto em: ${dataAbertura}</p>
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                <button onclick="abrirModalMovimentacao('Suprimento')" style="padding: 15px; font-size: 1.1rem; background-color: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">➕ Suprimento (Entrada)</button>
                <button onclick="abrirModalMovimentacao('Sangria')" style="padding: 15px; font-size: 1.1rem; background-color: #FF9800; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">➖ Sangria (Retirada)</button>
            </div>

            <hr style="border: 0; border-top: 1px solid #eee; margin-bottom: 20px;">

            <button onclick="abrirTelaFechamento()" style="width: 100%; padding: 15px; font-size: 1.1rem; background-color: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">🔒 INICIAR FECHAMENTO</button>
            <button onclick="document.getElementById('modal-caixa').style.display='none'" style="width: 100%; padding: 12px; margin-top: 10px; font-size: 1rem; border: 1px solid #ccc; background: #f0f0f0; border-radius: 8px; cursor: pointer;">Voltar</button>
        `;
    }

    document.getElementById('modal-caixa').style.display = 'flex';
}

async function abrirTelaFechamento() {
    const container = document.getElementById('conteudo-modal-caixa');
    
    container.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <h2 style="color:#333; margin-bottom: 10px;">⏳ Calculando...</h2>
            <p style="color: #666;">Buscando vendas e movimentações no servidor.</p>
        </div>
    `;

    try {
        const res = await fetch(`${API_URL}/caixa/resumo/${caixaAtual.id}`);
        const resumo = await res.json();
        
        if (!res.ok) throw new Error(resumo.erro || "Falha ao calcular resumo");

        window.esperadoAtual = resumo.esperado; 

        container.innerHTML = `
            <h2 style="color:#333; margin-top:0; border-bottom: 2px solid #eee; padding-bottom: 10px;">Conferência de Caixa</h2>

            <div style="text-align: left; margin-bottom: 20px; font-size: 0.95rem; color: #555;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                    <span>Abertura de Caixa (+)</span>
                    <span style="color: #25D366; font-weight: bold;">R$ ${resumo.fundo.toFixed(2).replace('.', ',')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                    <span>Vendas em Dinheiro (+)</span>
                    <span style="color: #25D366; font-weight: bold;">R$ ${resumo.vendas_dinheiro.toFixed(2).replace('.', ',')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                    <span>Reforços/Suprimento (+)</span>
                    <span style="color: #2196F3; font-weight: bold;">R$ ${resumo.suprimentos.toFixed(2).replace('.', ',')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                    <span>Retiradas/Sangrias (-)</span>
                    <span style="color: #f44336; font-weight: bold;">R$ ${resumo.sangrias.toFixed(2).replace('.', ',')}</span>
                </div>
                <hr style="border: 0; border-top: 1px dashed #ccc; margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 1.1rem; color: #333;">
                    <strong>Esperado na Gaveta</strong>
                    <strong>R$ ${resumo.esperado.toFixed(2).replace('.', ',')}</strong>
                </div>
            </div>

            <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:10px; border: 1px solid #ccc;">
                <label style="color:#333; font-weight:700; font-size:1rem;">Dinheiro Real na Gaveta</label>
                <input type="number" id="input-valor-caixa" class="input-padrao" placeholder="Ex: 150.00" style="width:100%; margin-top:10px; font-size:1.5rem; text-align: center; padding: 10px; border: 1px solid #00bcd4; border-radius: 8px; font-weight: bold;" onkeyup="calcularDiferencaCaixa()" onchange="calcularDiferencaCaixa()">
            </div>

            <div id="area-diferenca" style="margin-bottom: 20px; font-size: 1.1rem; font-weight: bold; height: 25px;">
            </div>

            <div style="display: flex; gap: 10px;">
                <button onclick="abrirPainelCaixa()" style="flex: 1; padding: 12px; font-size: 1rem; border: 1px solid #ccc; background: #f0f0f0; border-radius: 8px; cursor: pointer;">Voltar</button>
                <button onclick="processarCaixa('fechar')" style="flex: 2; padding: 12px; font-size: 1rem; background-color: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">🔒 CONFIRMAR</button>
            </div>
        `;
    } catch(e) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h2 style="color: #f44336; margin-top: 0;">❌ Ops! Erro</h2>
                <p style="color: #555;">Falha ao calcular os valores.<br><span style="font-size: 0.8rem; color: #f44336; font-weight:bold;">${e.message}</span></p>
                <button onclick="abrirPainelCaixa()" style="margin-top: 15px; width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #ccc; background: #f0f0f0; cursor: pointer; font-weight: bold;">Tentar Novamente</button>
            </div>
        `;
    }
}

async function processarCaixa(acao) {
    const valor = parseFloat(document.getElementById('input-valor-caixa').value) || 0;
    try {
        if (acao === 'abrir') {
            await fetch(`${API_URL}/caixa/abrir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valor_inicial: valor })
            });
            alert(`✅ Caixa ABERTO! Fundo: R$ ${valor.toFixed(2)}`);
        } else if (acao === 'fechar') {
            if(!confirm("Atenção: Conferiu os valores? O caixa será fechado definitivamente.")) return;
            
            await fetch(`${API_URL}/caixa/fechar/${caixaAtual.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valor_informado: valor, valor_sistema: window.esperadoAtual }) 
            });
            alert(`🔒 Caixa FECHADO com sucesso!`);
        }
        
        document.getElementById('modal-caixa').style.display = 'none';
        await verificarStatusCaixa(); 
    } catch (e) { alert("❌ Erro ao comunicar com o servidor."); }
}

function calcularDiferencaCaixa() {
    const valorInformado = parseFloat(document.getElementById('input-valor-caixa').value);
    const divDiferenca = document.getElementById('area-diferenca');
    
    if (isNaN(valorInformado)) {
        divDiferenca.innerHTML = "";
        return;
    }

    const esperado = window.esperadoAtual || 0;
    const diferenca = valorInformado - esperado;

    if (Math.abs(diferenca) < 0.01) { 
        divDiferenca.innerHTML = `<span style="color: #25D366;">✅ Bateu! Nenhuma diferença.</span>`;
    } else if (diferenca < 0) {
        divDiferenca.innerHTML = `<span style="color: #f44336;">⚠️ Quebra (Falta): - R$ ${Math.abs(diferenca).toFixed(2).replace('.', ',')}</span>`;
    } else {
        divDiferenca.innerHTML = `<span style="color: #2196F3;">⚠️ Sobra: + R$ ${diferenca.toFixed(2).replace('.', ',')}</span>`;
    }
}

function abrirModalMovimentacao(tipo) {
    tipoMovimentacaoAtual = tipo;
    document.getElementById('titulo-movimentacao').innerText = `Registrar ${tipo}`;
    document.getElementById('input-valor-mov').value = '';
    document.getElementById('input-motivo-mov').value = '';
    
    const btn = document.getElementById('btn-salvar-mov');
    btn.style.backgroundColor = (tipo === 'Sangria') ? '#FF9800' : '#2196F3';
    
    document.getElementById('modal-movimentacao').style.display = 'flex';
}

async function salvarMovimentacao() {
    const valor = parseFloat(document.getElementById('input-valor-mov').value);
    const motivo = document.getElementById('input-motivo-mov').value;

    if (!valor || valor <= 0) return alert("Digite um valor válido!");
    if (!motivo) return alert("Informe o motivo da movimentação!");

    try {
        const resposta = await fetch(`${API_URL}/caixa/movimentacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                caixa_id: caixaAtual.id,
                tipo: tipoMovimentacaoAtual,
                valor: valor,
                motivo: motivo
            })
        });

        if (resposta.ok) {
            alert(`✅ ${tipoMovimentacaoAtual} de R$ ${valor.toFixed(2)} registrada!`);
            document.getElementById('modal-movimentacao').style.display = 'none';
        } else {
            alert("Erro ao registrar no banco de dados.");
        }
    } catch (e) {
        alert("Erro de conexão com o servidor.");
    }
}

// ==========================================
// 🏪 CONTROLE DE STATUS DA LOJA (COM TENTATIVAS AUTOMÁTICAS)
// ==========================================
async function alterarStatusLoja(statusDesejado) {
    let tentativas = 8; // ⏱️ Aumentamos para 8 tentativas!
    
    // Aviso mais claro para você saber que pode demorar um pouquinho
    mostrarAvisoFlutuante("🔄 Acordando o servidor... (Pode levar até 30s)", "#FF9800");

    while (tentativas > 0) {
        try {
            const res = await fetch('https://icesoft-api.onrender.com/api/loja/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: statusDesejado }) 
            });
            
            if (!res.ok) throw new Error("Servidor acordando");

            // Se chegou aqui, o servidor respondeu certo!
            mostrarAvisoFlutuante(`✅ Loja agora está: ${statusDesejado.toUpperCase()}`, "#4CAF50");
            return; 

        } catch (e) {
            tentativas--;
            console.log("Aguardando servidor acordar... Tentativas restantes:", tentativas);
            
            if (tentativas === 0) {
                mostrarAvisoFlutuante("⚠️ O servidor dormiu pesado. Clique na chave novamente.", "#f44336");
            } else {
                // ⏱️ Espera 4 segundos antes de tentar bater na porta de novo
                await new Promise(r => setTimeout(r, 4000));
            }
        }
    }
}

// ==========================================
// 🎨 AVISOS ELEGANTES (Estilo iFood)
// ==========================================
function mostrarAvisoFlutuante(mensagem, cor) {
    // Remove avisos antigos para não acumular na tela
    const avisoAntigo = document.getElementById('aviso-toast');
    if (avisoAntigo) avisoAntigo.remove();

    const div = document.createElement('div');
    div.id = 'aviso-toast';
    div.innerText = mensagem;
    div.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: ${cor}; 
        color: white; 
        padding: 15px 25px; 
        border-radius: 8px; 
        font-weight: bold; 
        z-index: 9999; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.2); 
        transition: opacity 0.5s ease-out; 
        font-family: 'Inter', sans-serif;
    `;
    
    document.body.appendChild(div);
    
    // Faz o aviso sumir suavemente depois de 3 segundos
    setTimeout(() => { div.style.opacity = '0'; }, 3000);
    setTimeout(() => { div.remove(); }, 3500);
}

// Isso garante que ele só vai tentar baixar a cortina DEPOIS que o site carregar inteiro!
window.addEventListener('DOMContentLoaded', () => {
    verificarStatusLoja();
    // Continua vigiando a cada 30 segundos
    setInterval(verificarStatusLoja, 30000);
});
