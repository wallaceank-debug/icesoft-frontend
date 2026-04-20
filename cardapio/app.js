let carrinho = [];
let produtosDaNuvem = [];
let gruposGlobais = [];
let produtoEmSelecao = null;
let escolhasAtuais = [];


// ==========================================
// 1. CARREGAR DADOS DA NUVEM (FILTRANDO INATIVOS)
// ==========================================
async function carregarTudo() {
    try {
        const [resProd, resGrupos] = await Promise.all([
            fetch('https://icesoft-api.onrender.com/api/produtos'),
            fetch('https://icesoft-api.onrender.com/api/grupos')
        ]);
        
        const todosProdutos = await resProd.json();
        const todosGrupos = await resGrupos.json();

        // MÁGICA: Só guarda na memória o que estiver ATIVO (ligado na chavinha)
        produtosDaNuvem = todosProdutos.filter(p => p.ativo !== false);
        gruposGlobais = todosGrupos.filter(g => g.ativo !== false);
        
        renderizarCardapio(produtosDaNuvem);
    } catch (e) { 
        console.error("Erro ao carregar:", e); 
    }
}

// ==========================================
// 2. DESENHAR CARDÁPIO
// ==========================================
function renderizarCardapio(lista) {
    const container = document.getElementById('lista-produtos');
    container.innerHTML = '';
    lista.forEach(p => {
        container.innerHTML += `
            <div class="produto-card" style="display: flex; background: white; margin-bottom: 15px; padding: 15px; border-radius: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); align-items: center; gap: 15px;">
                <div style="font-size: 2.5rem;">${p.emoji}</div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; color: #333;">${p.nome}</h3>
                    <p style="margin: 5px 0; color: #777; font-size: 0.85rem;">${p.descricao}</p>
                    <div style="font-weight: bold; color: #e91e63;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>
                </div>
                <button onclick="verificarAdicao(${p.id})" style="background: #e91e63; color: white; border: none; width: 40px; height: 40px; border-radius: 50%; font-size: 1.5rem; cursor: pointer;">+</button>
            </div>
        `;
    });
}

// ==========================================
// 3. REGRAS DE ADIÇÃO (COM OU SEM GRUPO)
// ==========================================
function verificarAdicao(id) {
    const produto = produtosDaNuvem.find(p => p.id === id);
    if (!produto.grupos_ids || produto.grupos_ids.length === 0) {
        adicionarAoCarrinho(produto.nome, Number(produto.preco));
        return;
    }
    abrirModalEscolha(produto);
}

// ==========================================
// 4. JANELINHA DE ADICIONAIS (FILTRANDO ITENS)
// ==========================================
function abrirModalEscolha(produto) {
    produtoEmSelecao = produto;
    escolhasAtuais = [];
    
    document.getElementById('detalhes-produto-topo').innerHTML = `
        <h2 style="margin:0; color:#e91e63;">${produto.nome}</h2>
        <p style="color:#777; margin:5px 0;">Escolha seus complementos</p>
    `;

    const container = document.getElementById('container-grupos-opcoes');
    container.innerHTML = '';
    
    // Pega os grupos vinculados que estão ativos
    const gruposDoProduto = gruposGlobais.filter(g => produto.grupos_ids.includes(g.id));

    gruposDoProduto.forEach(grupo => {
        // MÁGICA: Só pega os adicionais (ex: Morango) que estiverem ATIVOS
        const itensAtivos = (grupo.itens || []).filter(item => item.ativo !== false);

        // Se o grupo não tem nenhum item ativo, nem mostra o grupo na tela!
        if (itensAtivos.length === 0) return;

        let itensHtml = itensAtivos.map((item, idx) => {
            let precoSeguro = Number(item.preco) || 0;
            let nomeSeguro = item.nome.replace(/'/g, "\\'"); 
            let chkId = `chk-${grupo.id}-${idx}`;

            return `
            <div class="item-opcional-card" onclick="toggleOpcional(${grupo.id}, '${nomeSeguro}', ${precoSeguro}, '${chkId}')" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="${chkId}" style="accent-color:#e91e63; pointer-events:none;">
                    <span>${item.nome}</span>
                </div>
                <span style="color:#25D366; font-size:0.9rem;">${precoSeguro > 0 ? '+ R$ ' + precoSeguro.toFixed(2).replace('.', ',') : 'Grátis'}</span>
            </div>`;
        }).join('');

        container.innerHTML += `
            <div style="margin-bottom:20px;">
                <div style="background:#f8f8f8; padding:10px; border-radius:10px; display:flex; justify-content:space-between;">
                    <strong style="color:#333;">${grupo.nome}</strong>
                    <span style="font-size:0.75rem; color:#e91e63; background:white; padding:2px 8px; border-radius:10px;">Até ${grupo.limite}</span>
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
        // Se já estava marcado, a pessoa quer desmarcar
        escolhasAtuais.splice(index, 1);
        chk.checked = false;
    } else {
        const escolhasNoGrupo = escolhasAtuais.filter(e => e.grupoId === grupoId);
        
        // UX DE OURO: Se o limite é 1 e ele escolheu outro, troca automaticamente!
        if (grupo.limite === 1) {
            if (escolhasNoGrupo.length > 0) {
                // Remove o antigo da memória
                const idxAnterior = escolhasAtuais.indexOf(escolhasNoGrupo[0]);
                escolhasAtuais.splice(idxAnterior, 1);
                // Desmarca todos os quadradinhos desse grupo visualmente
                const todosChkDoGrupo = document.querySelectorAll(`input[id^="chk-${grupoId}-"]`);
                todosChkDoGrupo.forEach(c => c.checked = false);
            }
        } 
        // Se o limite for maior que 1 e já estourou
        else if (escolhasNoGrupo.length >= grupo.limite) {
            alert(`Você só pode escolher até ${grupo.limite} opção(ões) em ${grupo.nome}`);
            return;
        }
        
        // Adiciona a nova escolha
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

function confirmarEscolhasEAdicionar() {
    let nomeFinal = produtoEmSelecao.nome;
    if (escolhasAtuais.length > 0) {
        nomeFinal += " (" + escolhasAtuais.map(e => e.nome).join(', ') + ")";
    }
    const precoFinal = Number(produtoEmSelecao.preco) + escolhasAtuais.reduce((soma, e) => soma + Number(e.preco), 0);
    
    adicionarAoCarrinho(nomeFinal, precoFinal);
    fecharModalOpcoes();
}

function fecharModalOpcoes() { 
    document.getElementById('modal-opcoes').style.display = 'none'; 
}

// ==========================================
// 5. O CARRINHO DE COMPRAS
// ==========================================
function adicionarAoCarrinho(nome, preco) {
    carrinho.push({ nome, preco: Number(preco) });
    atualizarBarraCarrinho();
}

function atualizarBarraCarrinho() {
    const barra = document.getElementById('carrinho-flutuante');
    const txtQtd = document.getElementById('carrinho-qtd');
    const txtTotal = document.getElementById('carrinho-total');

    if (carrinho.length > 0) {
        barra.classList.remove('carrinho-oculto');
        barra.classList.add('carrinho-visivel');
        barra.style.display = 'flex'; // Força a exibição
        
        let total = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
        txtQtd.innerText = `${carrinho.length} item(ns)`;
        txtTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    } else {
        barra.classList.remove('carrinho-visivel');
        barra.classList.add('carrinho-oculto');
        barra.style.display = 'none'; // Esconde com segurança
    }
}

// Função para mostrar os itens no resumo antes de enviar
function renderizarResumoCarrinho() {
    const container = document.getElementById('lista-resumo-itens');
    if (carrinho.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; font-size:0.8rem;">Carrinho vazio</p>';
        fecharModalCheckout(); // Fecha se não tiver nada
        return;
    }

    container.innerHTML = '';
    carrinho.forEach((item, index) => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.85rem; border-bottom:1px solid #eee; padding-bottom:5px;">
                <div style="flex:1;">
                    <strong>${item.nome}</strong><br>
                    <span style="color:#e91e63;">R$ ${item.preco.toFixed(2).replace('.', ',')}</span>
                </div>
                <button onclick="removerItemCarrinho(${index})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.1rem; padding:5px;">🗑️</button>
            </div>
        `;
    });
}

// Função para deletar um item específico
function removerItemCarrinho(index) {
    carrinho.splice(index, 1); // Remove o item da lista
    atualizarBarraCarrinho();  // Atualiza o total rosa lá embaixo
    renderizarResumoCarrinho(); // Atualiza a lista da janelinha
}

// ==========================================
// INTEGRAÇÃO COM O DASHBOARD (BANCO DE DADOS)
// ==========================================
async function salvarVendaDelivery() {
    // 1. Calcula o total do carrinho
    const totalPedido = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
    
    // 2. Pega a forma de pagamento real que o cliente escolheu na janelinha
    let metodoPag = "WhatsApp / Online";
    const inputPagamento = document.getElementById('cliente-pagamento'); // ID CORRIGIDO
    if (inputPagamento && inputPagamento.value) metodoPag = inputPagamento.value;

    // 3. Monta o PACOTE UNIVERSAL (Com a etiqueta 'Delivery')
    const itensFormatados = carrinho.map(item => {
        return { nome: "Delivery: " + item.nome, preco: item.preco };
    });
    
    const dadosDaVenda = {
        itens: JSON.stringify(itensFormatados), 
        produto_nome: JSON.stringify(itensFormatados),
        valor_total: totalPedido,
        total: totalPedido,
        forma_pagamento: metodoPag,
        status: "Pendente Delivery"
    };

    try {
        await fetch('https://icesoft-api.onrender.com/api/vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosDaVenda)
        });
        console.log("✅ Cópia do pedido enviada para o Dashboard!");
    } catch (e) {
        console.error("⚠️ Ocorreu um erro silencioso, mas o WhatsApp vai abrir normal:", e);
    }
}

// ==========================================
// 6. CHECKOUT E WHATSAPP FINAL (BLINDADO)
// ==========================================
function finalizarPedidoWhatsApp() {
    const modal = document.getElementById('modal-checkout');
    renderizarResumoCarrinho(); // Carrega a lista de itens
    modal.style.display = 'flex';
}

function fecharModalCheckout() {
    const modal = document.getElementById('modal-checkout');
    modal.style.display = 'none'; // Força o fechamento imediato
}

// ADICIONAMOS "async" AQUI PARA ELE SABER ESPERAR O BANCO DE DADOS
async function processarEnvioWhatsApp() {
    const nome = document.getElementById('cliente-nome').value.trim();
    const telefoneCliente = document.getElementById('cliente-telefone').value.trim(); // PEGA O CELULAR
    const endereco = document.getElementById('cliente-endereco').value.trim();
    const pagamento = document.getElementById('cliente-pagamento').value;

    if (!nome || !telefoneCliente || !endereco || !pagamento) {
        alert("⚠️ Preencha todos os campos, incluindo seu telefone!");
        return;
    }

    // 🚀 O ESPIÃO ENTRA EM AÇÃO! Manda para o banco de dados antes de ir pro WhatsApp
    await salvarVendaDelivery();

    const telefoneDono = "5524992308585"; // SEU NÚMERO
    
    let textoPedido = "🍦 *NOVO PEDIDO - ICESOFT* 🍦\n\n";
    textoPedido += `👤 *Cliente:* ${nome}\n`;
    textoPedido += `📱 *WhatsApp:* ${telefoneCliente}\n`; // ADICIONA NO TEXTO
    textoPedido += `📍 *Endereço:* ${endereco}\n`;
    textoPedido += `💳 *Pagamento:* ${pagamento}\n\n`;
    textoPedido += "📦 *Itens do Pedido:*\n";

    let total = 0;
    carrinho.forEach(item => {
        textoPedido += `▪️ 1x ${item.nome} - R$ ${Number(item.preco).toFixed(2).replace('.', ',')}\n`;
        total += Number(item.preco);
    });

    textoPedido += `\n💰 *Total: R$ ${total.toFixed(2).replace('.', ',')}*`;

    // ABRE O WHATSAPP
    window.location.href = `https://api.whatsapp.com/send?phone=${telefoneDono}&text=${encodeURIComponent(textoPedido)}`;
    
    carrinho = [];
    atualizarBarraCarrinho();
    fecharModalCheckout();
}

window.onload = carregarTudo;