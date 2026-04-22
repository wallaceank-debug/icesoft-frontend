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
let caixaAtual = { id: null, status: 'Fechado' };

window.onload = async () => {
    await verificarStatusCaixa(); // NOVO: Checa a gaveta antes de tudo!
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
        // Se não tem adicional, manda a lista vazia []
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
// GESTÃO DO CARRINHO (NOVO VISUAL)
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
        document.getElementById('pdv-total').innerText = "R$ 0,00";
        subtotalGlobalPDV = 0;
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
    // NOVA TRAVA DE SEGURANÇA
    if (caixaAtual.status === 'Fechado') {
        return alert("⚠️ O Caixa está FECHADO! Clique no indicador no topo da tela para abrir o caixa antes de cobrar.");
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
            const recebido = parseFloat(document.getElementById('checkout-recebido').value) || subtotalGlobalPDV;
            const troco = recebido - subtotalGlobalPDV;
            
            // VERIFICA A CAIXINHA: Só chama a impressora se estiver marcada!
            const querImprimir = document.getElementById('checkout-imprimir').checked;
            if (querImprimir) {
                imprimirComanda(metodo, recebido, troco); 
            }

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
            // Fonte dos adicionais aumentada para 13px
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
            <strong style="font-size: 20px;">TOTAL: R$ ${subtotalGlobalPDV.toFixed(2).replace('.', ',')}</strong><br>
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
// CONTROLE DE CAIXA (Abertura e Fechamento)
// ==========================================

async function verificarStatusCaixa() {
    try {
        const resposta = await fetch(`${API_URL}/caixa/status`);
        const dados = await resposta.json();
        
        caixaAtual = dados; // Salva na memória
        
        const bolinha = document.getElementById('dot-caixa');
        const texto = document.getElementById('texto-status-caixa');
        
        if (caixaAtual.status === 'Aberto') {
            bolinha.style.backgroundColor = '#25D366'; // Verde
            texto.innerText = `Caixa Aberto`;
        } else {
            bolinha.style.backgroundColor = '#f44336'; // Vermelho
            texto.innerText = `Caixa Fechado`;
        }
    } catch (e) { console.error("Erro ao verificar caixa:", e); }
}

function abrirPainelCaixa() {
    const modal = document.getElementById('modal-caixa');
    const titulo = document.getElementById('titulo-modal-caixa');
    const msg = document.getElementById('msg-modal-caixa');
    const inputValor = document.getElementById('input-valor-caixa');
    const btn = document.getElementById('btn-acao-caixa');

    inputValor.value = '';

    if (caixaAtual.status === 'Fechado') {
        titulo.innerText = "🔑 Abrir Caixa";
        msg.innerText = "Informe o valor de Fundo de Caixa (Troco Inicial) para iniciar as vendas do dia.";
        btn.innerText = "ABRIR CAIXA";
        btn.style.backgroundColor = "#25D366";
    } else {
        titulo.innerText = "🔒 Fechar Caixa";
        msg.innerText = "Conte todo o dinheiro físico da gaveta e informe o valor abaixo (Fechamento Cego).";
        btn.innerText = "FECHAR CAIXA";
        btn.style.backgroundColor = "#f44336";
    }

    modal.style.display = 'flex';
}

async function processarCaixa() {
    const valor = parseFloat(document.getElementById('input-valor-caixa').value) || 0;
    
    try {
        if (caixaAtual.status === 'Fechado') {
            // ABRIR
            await fetch(`${API_URL}/caixa/abrir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valor_inicial: valor })
            });
            alert(`✅ Caixa ABERTO com sucesso! Fundo: R$ ${valor.toFixed(2)}`);
        } else {
            // FECHAR
            if(!confirm("Tem certeza que deseja FECHAR o caixa? Vendas não poderão mais ser realizadas.")) return;
            
            await fetch(`${API_URL}/caixa/fechar/${caixaAtual.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valor_informado: valor })
            });
            alert(`🔒 Caixa FECHADO! Valor informado: R$ ${valor.toFixed(2)}\n\n(O relatório de quebra será emitido em breve)`);
        }
        
        document.getElementById('modal-caixa').style.display = 'none';
        await verificarStatusCaixa(); // Atualiza a bolinha lá em cima
        
    } catch (e) {
        alert("❌ Erro ao comunicar com o servidor.");
    }
}
