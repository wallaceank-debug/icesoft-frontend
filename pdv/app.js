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
        const visualProduto = p.imagem_url 
            ? `<img src="${p.imagem_url}" style="width: 100%; height: 90px; object-fit: cover; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">`
            : `<div class="pdv-emoji" style="height: 90px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin-bottom: 8px;">${p.emoji || '🍨'}</div>`;

        container.innerHTML += `
            <div class="pdv-card" onclick="verificarAdicao(${p.id})" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 160px;">
                <div>
                    ${visualProduto}
                    <div class="pdv-nome" style="line-height: 1.2;">${p.nome}</div>
                </div>
                <div class="pdv-preco" style="margin-top: 8px;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>
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
                <div style="color: #666; font-size: 0.85rem; padding-left: 25px; margin-top: 3px;">+ ${adc}</div>
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

// ==========================================
// SISTEMA DE COBRANÇA (CHECKOUT DIVIDIDO)
// ==========================================
let isPagamentoDividido = false;

function abrirModalCheckout() {
    if (caixaAtual.status === 'Fechado') {
        return alert("⚠️ O Caixa está FECHADO! Clique no indicador no topo da tela para abrir o caixa antes de cobrar.");
    }
    
    document.getElementById('checkout-total').innerText = `R$ ${totalFinalGlobal.toFixed(2).replace('.', ',')}`;
    isPagamentoDividido = false;
    document.getElementById('area-pagamento-2').style.display = 'none';
    document.getElementById('btn-add-pagamento').style.display = 'block';
    
    document.getElementById('checkout-metodo-1').value = 'Dinheiro';
    document.getElementById('checkout-valor-1').value = totalFinalGlobal.toFixed(2);
    document.getElementById('checkout-valor-1').readOnly = true; 
    
    document.getElementById('checkout-recebido').value = '';
    document.getElementById('checkout-troco').innerText = 'R$ 0,00';
    document.getElementById('checkout-troco').style.color = '#25D366';
    
    document.getElementById('modal-checkout').style.display = 'flex';
    verificarMetodoPagamento(); 
    
    setTimeout(() => {
        if(document.getElementById('checkout-metodo-1').value === 'Dinheiro'){
            document.getElementById('checkout-recebido').focus();
        }
    }, 100);
}

function fecharModalCheckout() { document.getElementById('modal-checkout').style.display = 'none'; }

function togglePagamentoDividido() {
    isPagamentoDividido = !isPagamentoDividido;
    const areaPag2 = document.getElementById('area-pagamento-2');
    const btnAdd = document.getElementById('btn-add-pagamento');
    const inputValor1 = document.getElementById('checkout-valor-1');
    
    if (isPagamentoDividido) {
        areaPag2.style.display = 'block';
        btnAdd.style.display = 'none';
        inputValor1.readOnly = false; 
        inputValor1.focus();
        inputValor1.select();
    } else {
        areaPag2.style.display = 'none';
        btnAdd.style.display = 'block';
        inputValor1.readOnly = true; 
    }
    calcularTroco();
    verificarMetodoPagamento();
}

function verificarMetodoPagamento() {
    const m1 = document.getElementById('checkout-metodo-1').value;
    const m2 = isPagamentoDividido ? document.getElementById('checkout-metodo-2').value : null;
    const areaTroco = document.getElementById('area-troco');
    
    if (m1 === 'Dinheiro' || m2 === 'Dinheiro') {
        areaTroco.style.display = 'block';
    } else {
        areaTroco.style.display = 'none';
        document.getElementById('checkout-recebido').value = ''; 
    }
    calcularTroco();
}

function calcularTroco() {
    let v1 = parseFloat(document.getElementById('checkout-valor-1').value) || 0;
    
    if (v1 > totalFinalGlobal) {
        v1 = totalFinalGlobal; 
        document.getElementById('checkout-valor-1').value = v1.toFixed(2);
    }
    
    let v2 = 0;
    if (isPagamentoDividido) {
        v2 = totalFinalGlobal - v1;
        document.getElementById('checkout-valor-2').value = v2.toFixed(2); 
    } else {
        v1 = totalFinalGlobal;
        document.getElementById('checkout-valor-1').value = v1.toFixed(2);
    }

    const m1 = document.getElementById('checkout-metodo-1').value;
    const m2 = isPagamentoDividido ? document.getElementById('checkout-metodo-2').value : null;
    
    let dinheiroEsperado = 0;
    if (m1 === 'Dinheiro') dinheiroEsperado += v1;
    if (m2 === 'Dinheiro') dinheiroEsperado += v2;

    const recebido = parseFloat(document.getElementById('checkout-recebido').value) || 0;
    const displayTroco = document.getElementById('checkout-troco');

    if (dinheiroEsperado > 0) {
        const troco = recebido - dinheiroEsperado;
        if (troco >= 0) {
            displayTroco.innerText = `R$ ${troco.toFixed(2).replace('.', ',')}`;
            displayTroco.style.color = '#25D366';
        } else {
            displayTroco.innerText = `Faltam R$ ${Math.abs(troco).toFixed(2).replace('.', ',')}`;
            displayTroco.style.color = '#f44336'; 
        }
    } else {
        displayTroco.innerText = `R$ 0,00`;
        displayTroco.style.color = '#25D366';
    }
}

async function finalizarVendaPDV() {
    if (carrinho.length === 0) return alert("Carrinho vazio!");

    const m1 = document.getElementById('checkout-metodo-1').value;
    const v1 = parseFloat(document.getElementById('checkout-valor-1').value) || 0;
    let metodoFinalTexto = m1;
    
    if (isPagamentoDividido) {
        const m2 = document.getElementById('checkout-metodo-2').value;
        const v2 = parseFloat(document.getElementById('checkout-valor-2').value) || 0;
        if (v1 <= 0 || v2 <= 0) return alert("⚠️ Ambos os valores devem ser maiores que zero na divisão.");
        if (m1 === m2) return alert("⚠️ As duas formas de pagamento não podem ser iguais.");
        metodoFinalTexto = `${m1} e ${m2}`; 
    }
    
    let dinheiroEsperado = 0;
    if (m1 === 'Dinheiro') dinheiroEsperado += v1;
    if (isPagamentoDividido && document.getElementById('checkout-metodo-2').value === 'Dinheiro') {
        dinheiroEsperado += parseFloat(document.getElementById('checkout-valor-2').value);
    }

    const recebido = parseFloat(document.getElementById('checkout-recebido').value) || 0;
    let trocoComprovante = 0;

    if (dinheiroEsperado > 0) {
        if (recebido < dinheiroEsperado) {
            return alert(`⚠️ O cliente precisa entregar pelo menos R$ ${dinheiroEsperado.toFixed(2)} em dinheiro.`);
        }
        trocoComprovante = recebido - dinheiroEsperado;
    }

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
        forma_pagamento: metodoFinalTexto, 
        status: "Concluída",
        origem: "Balcão"
    };

    try {
        const resposta = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosDaVenda)
        });

        if (resposta.ok) {
            const querImprimir = document.getElementById('checkout-imprimir').checked;
            if (querImprimir) {
                const valorImpressao = dinheiroEsperado > 0 ? recebido : totalFinalGlobal; 
                imprimirComanda(metodoFinalTexto, valorImpressao, trocoComprovante); 
            }

            alert(`✅ Venda Finalizada!\nPagamento: ${metodoFinalTexto}\nTotal: R$ ${totalFinalGlobal.toFixed(2).replace('.', ',')}`);
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
    if (descontoGlobal > 0) extraHtml += `<div style="text-align: right; font-size: 14px; color: #555;">Desconto: - R$ ${descontoGlobal.toFixed(2).replace('.', ',')}</div>`;
    if (acrescimoGlobal > 0) extraHtml += `<div style="text-align: right; font-size: 14px; color: #555;">Acréscimo: + R$ ${acrescimoGlobal.toFixed(2).replace('.', ',')}</div>`;

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
// CONTROLE DE CAIXA
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
    container.innerHTML = `<div style="text-align: center; padding: 30px;"><h2 style="color:#333; margin-bottom: 10px;">⏳ Calculando...</h2><p style="color: #666;">Buscando vendas e movimentações no servidor.</p></div>`;

    try {
        const res = await fetch(`${API_URL}/caixa/resumo/${caixaAtual.id}`);
        const resumo = await res.json();
        if (!res.ok) throw new Error(resumo.erro || "Falha ao calcular resumo");

        window.esperadoAtual = resumo.esperado; 

        container.innerHTML = `
            <h2 style="color:#333; margin-top:0; border-bottom: 2px solid #eee; padding-bottom: 10px;">Conferência de Caixa</h2>
            <div style="text-align: left; margin-bottom: 20px; font-size: 0.95rem; color: #555;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Abertura de Caixa (+)</span><span style="color: #25D366; font-weight: bold;">R$ ${resumo.fundo.toFixed(2).replace('.', ',')}</span></div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Vendas em Dinheiro (+)</span><span style="color: #25D366; font-weight: bold;">R$ ${resumo.vendas_dinheiro.toFixed(2).replace('.', ',')}</span></div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Reforços/Suprimento (+)</span><span style="color: #2196F3; font-weight: bold;">R$ ${resumo.suprimentos.toFixed(2).replace('.', ',')}</span></div>
                <div style="display: flex; justify-content: space-between; padding: 5px 0;"><span>Retiradas/Sangrias (-)</span><span style="color: #f44336; font-weight: bold;">R$ ${resumo.sangrias.toFixed(2).replace('.', ',')}</span></div>
                <hr style="border: 0; border-top: 1px dashed #ccc; margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 1.1rem; color: #333;"><strong>Esperado na Gaveta</strong><strong>R$ ${resumo.esperado.toFixed(2).replace('.', ',')}</strong></div>
            </div>
            <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:10px; border: 1px solid #ccc;">
                <label style="color:#333; font-weight:700; font-size:1rem;">Dinheiro Real na Gaveta</label>
                <input type="number" id="input-valor-caixa" class="input-padrao" placeholder="Ex: 150.00" style="width:100%; margin-top:10px; font-size:1.5rem; text-align: center; padding: 10px; border: 1px solid #00bcd4; border-radius: 8px; font-weight: bold;" onkeyup="calcularDiferencaCaixa()" onchange="calcularDiferencaCaixa()">
            </div>
            <div id="area-diferenca" style="margin-bottom: 20px; font-size: 1.1rem; font-weight: bold; height: 25px;"></div>
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
    
    if (isNaN(valorInformado)) { divDiferenca.innerHTML = ""; return; }
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
    document.getElementById('btn-salvar-mov').style.backgroundColor = (tipo === 'Sangria') ? '#FF9800' : '#2196F3';
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
            body: JSON.stringify({ caixa_id: caixaAtual.id, tipo: tipoMovimentacaoAtual, valor: valor, motivo: motivo })
        });
        if (resposta.ok) {
            alert(`✅ ${tipoMovimentacaoAtual} de R$ ${valor.toFixed(2)} registrada!`);
            document.getElementById('modal-movimentacao').style.display = 'none';
        } else alert("Erro ao registrar no banco de dados.");
    } catch (e) { alert("Erro de conexão com o servidor."); }
}

// ==========================================
// 🏪 CONTROLE DE STATUS DA LOJA 
// ==========================================
async function verificarStatusLoja() {
    try {
        const res = await fetch(`${API_URL}/loja/status`);
        if (res.ok) {
            const dados = await res.json();
            const checkbox = document.getElementById('toggle-delivery');
            if (checkbox) checkbox.checked = (dados.status === 'aberto');
        }
    } catch (e) { console.log("Aguardando servidor carregar status..."); }
}

async function carregarStatusLoja() { await verificarStatusLoja(); }

async function alterarStatusLoja() {
    const checkbox = document.getElementById('toggle-delivery');
    const novoStatus = checkbox.checked ? 'aberto' : 'fechado';
    try {
        if (checkbox.parentElement) checkbox.parentElement.style.opacity = '0.5';
        await fetch(`${API_URL}/loja/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });
        if (checkbox.parentElement) setTimeout(() => checkbox.parentElement.style.opacity = '1', 500);
    } catch(e) {
        alert("🔌 Erro ao ligar/desligar a loja. Verifique a internet.");
        checkbox.checked = !checkbox.checked; 
    }
}

function mostrarAvisoFlutuante(mensagem, cor) {
    const avisoAntigo = document.getElementById('aviso-toast');
    if (avisoAntigo) avisoAntigo.remove();
    const div = document.createElement('div');
    div.id = 'aviso-toast';
    div.innerText = mensagem;
    div.style.cssText = `position: fixed; top: 20px; right: 20px; background: ${cor}; color: white; padding: 15px 25px; border-radius: 8px; font-weight: bold; z-index: 9999; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: opacity 0.5s ease-out;`;
    document.body.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; }, 3000);
    setTimeout(() => { div.remove(); }, 3500);
}

window.addEventListener('DOMContentLoaded', () => {
    verificarStatusLoja();
    setInterval(verificarStatusLoja, 30000);
});

// ==========================================
// 💾 TRANSFERÊNCIA PARA MESAS 
// ==========================================
async function abrirModalTransferirMesa() {
    if (carrinho.length === 0) return alert("⚠️ O carrinho está vazio! Adicione itens antes de transferir.");
    document.getElementById('modal-transferir-mesa').style.display = 'flex';
    const grid = document.getElementById('grid-mesas-livres');
    grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #666;">Buscando mesas livres...</p>';

    try {
        const resposta = await fetch(`${API_URL}/mesas`);
        const mesasOcupadas = await resposta.json();
        const numerosOcupados = mesasOcupadas.map(m => m.numero);
        
        grid.innerHTML = '';
        let temMesaLivre = false;

        for (let i = 1; i <= 15; i++) {
            const numeroFormatado = String(i).padStart(2, '0');
            if (!numerosOcupados.includes(numeroFormatado)) {
                temMesaLivre = true;
                grid.innerHTML += `
                    <button onclick="transferirParaMesa('${numeroFormatado}')" style="background: #e0f7fa; border: 1px solid #00bcd4; color: #00838f; padding: 15px 10px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s;">
                        Mesa ${numeroFormatado}
                    </button>`;
            }
        }
        if (!temMesaLivre) grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #f44336; font-weight: bold;">Todas as 15 mesas estão ocupadas no momento!</p>';
    } catch (e) { grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: red;">Erro ao buscar mesas.</p>'; }
}

function fecharModalTransferirMesa() { document.getElementById('modal-transferir-mesa').style.display = 'none'; }

async function transferirParaMesa(numeroMesa) {
    const itensParaMesa = carrinho.map(item => {
        const listaAdicionais = item.adicionais || [];
        const nomeCompleto = listaAdicionais.length > 0 ? `${item.nomeBase} (${listaAdicionais.join(', ')})` : item.nomeBase;
        return { nomeBase: item.nomeBase, adicionais: listaAdicionais, nome: nomeCompleto, preco: item.preco };
    });

    try {
        const resposta = await fetch(`${API_URL}/mesas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero: numeroMesa, itens: itensParaMesa })
        });
        if (resposta.ok) {
            mostrarAvisoFlutuante(`✅ Pedido transferido para a Mesa ${numeroMesa}!`, "#4CAF50");
            carrinho = []; descontoGlobal = 0; acrescimoGlobal = 0; renderizarCarrinho(); fecharModalTransferirMesa();
        } else alert("Erro ao transferir pedido para a mesa.");
    } catch (e) { alert("Erro de conexão. Verifique a internet."); }
}

// ==========================================
// 🛵 SISTEMA DE LANÇAMENTO DELIVERY NO PDV
// ==========================================
function abrirModalDeliveryPDV() {
    if (carrinho.length === 0) return alert("⚠️ Adicione produtos ao carrinho antes de lançar o Delivery!");
    document.getElementById('pdv-cliente-telefone').value = '';
    document.getElementById('pdv-cliente-nome').value = '';
    document.getElementById('pdv-cliente-bairro').value = '';
    document.getElementById('pdv-cliente-rua').value = '';
    document.getElementById('pdv-cliente-numero').value = '';
    document.getElementById('pdv-cliente-complemento').value = '';
    document.getElementById('pdv-cliente-troco').value = '';
    document.getElementById('badge-crm-pdv').style.display = 'none';
    document.getElementById('modal-delivery-pdv').style.display = 'flex';
}

function fecharModalDeliveryPDV() { document.getElementById('modal-delivery-pdv').style.display = 'none'; }

document.getElementById('pdv-cliente-telefone').addEventListener('input', function (e) {
    let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
    e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');

    if (e.target.value.length === 15) {
        buscarDadosClientePDV(e.target.value);
    } else {
        document.getElementById('badge-crm-pdv').style.display = 'none';
    }
});

async function buscarDadosClientePDV(telefoneFormatado) {
    const badge = document.getElementById('badge-crm-pdv');
    badge.innerText = '⏳ Buscando...';
    badge.style.background = '#FF9800';
    badge.style.display = 'inline-block';

    try {
        const res = await fetch(`${API_URL}/vendas`);
        const vendas = await res.json();
        const compras = vendas.filter(v => v.cliente_telefone === telefoneFormatado);

        if(compras.length > 0) {
            const ultimo = compras.reduce((max, p) => p.id > max.id ? p : max, compras[0]);
            document.getElementById('pdv-cliente-nome').value = ultimo.cliente_nome || '';

            const endereco = ultimo.cliente_endereco || '';
            if(endereco && !endereco.includes('Retirada')) {
                let partes = endereco.split(' - ');
                let bairroSalvo = partes.pop().trim();
                document.getElementById('pdv-cliente-bairro').value = bairroSalvo;

                if (partes.length > 0) {
                    let ruaNum = partes[0].split(',');
                    document.getElementById('pdv-cliente-rua').value = ruaNum[0] ? ruaNum[0].trim() : '';
                    document.getElementById('pdv-cliente-numero').value = ruaNum[1] ? ruaNum[1].trim() : '';
                    let comp = partes.length > 1 ? partes.slice(1).join(' - ').trim() : '';
                    document.getElementById('pdv-cliente-complemento').value = comp;
                }
            }
            badge.innerText = '✅ Cliente Encontrado';
            badge.style.background = '#25D366';
        } else {
            badge.style.display = 'none';
        }
    } catch(e) { badge.style.display = 'none'; }
}

function padronizarTelefonePDV(numeroBruto) {
    let limpo = numeroBruto.replace(/\D/g, ''); 
    if (limpo.startsWith('55') && limpo.length > 11) limpo = limpo.substring(2); 
    if (limpo.length === 11) return `(${limpo.substring(0,2)}) ${limpo.substring(2,7)}-${limpo.substring(7,11)}`;
    if (limpo.length === 10) return `(${limpo.substring(0,2)}) ${limpo.substring(2,6)}-${limpo.substring(6,10)}`;
    return numeroBruto; 
}

async function finalizarDeliveryPDV() {
    const btnSalvar = document.querySelector('#modal-delivery-pdv button[onclick="finalizarDeliveryPDV()"]');
    const telefoneBruto = document.getElementById('pdv-cliente-telefone').value.trim();
    if (!telefoneBruto) return alert("O número de WhatsApp é obrigatório!");
    
    const telefone = padronizarTelefonePDV(telefoneBruto);
    const nome = document.getElementById('pdv-cliente-nome').value.trim() || "Cliente Balcão/Telefone";
    const bairro = document.getElementById('pdv-cliente-bairro').value.trim();
    const rua = document.getElementById('pdv-cliente-rua').value.trim();
    const numero = document.getElementById('pdv-cliente-numero').value.trim();
    const complemento = document.getElementById('pdv-cliente-complemento').value.trim();
    
    let enderecoCompleto = "Retirada na Loja";
    if (rua && numero && bairro) enderecoCompleto = `${rua}, ${numero} ${complemento ? '- ' + complemento : ''} - ${bairro}`;

    let pagamento = document.getElementById('pdv-forma-pagamento').value;
    const troco = document.getElementById('pdv-cliente-troco').value.trim();
    if (pagamento === 'Dinheiro' && troco) pagamento += ` (Troco para ${troco})`;

    let totalCobranca = totalFinalGlobal; // Usando os cálculos reais com desconto
    
    // Converte os produtos do PDV para o Kanban entender perfeitamente
    const itensFormatados = carrinho.map(item => {
        let nomeCompleto = "Delivery: " + item.nomeBase;
        if (item.adicionais && item.adicionais.length > 0) {
            nomeCompleto += " (" + item.adicionais.join(', ') + ")";
        }
        return { nome: nomeCompleto, preco: item.preco };
    });

    btnSalvar.innerText = 'Enviando...';
    btnSalvar.disabled = true;

    try {
        const res = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itens: JSON.stringify(itensFormatados),
                produto_nome: "Pedido Lançado via PDV",
                valor_total: totalCobranca,
                total: totalCobranca,
                forma_pagamento: pagamento,
                status: "Pendente Delivery", 
                cliente_nome: nome,
                cliente_telefone: telefone,
                cliente_endereco: enderecoCompleto,
                origem: "WhatsApp / Telefone",
                observacoes: "Lançado internamente pelo PDV"
            })
        });

        if (res.ok) {
            fecharModalDeliveryPDV();
            alert("✅ Pedido de Delivery enviado para a cozinha com sucesso!");
            carrinho = [];
            descontoGlobal = 0;
            acrescimoGlobal = 0;
            renderizarCarrinho(); 
        } else {
            alert("❌ Erro ao enviar pedido. Verifique a conexão.");
        }
    } catch (e) {
        alert("❌ Erro de rede ao conectar com o servidor.");
    } finally {
        btnSalvar.innerText = '🚀 Enviar p/ Cozinha';
        btnSalvar.disabled = false;
    }
}