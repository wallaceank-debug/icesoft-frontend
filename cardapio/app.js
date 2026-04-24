let carrinho = [];
let produtosDaNuvem = [];
let gruposGlobais = [];
let produtoEmSelecao = null;
let escolhasAtuais = [];
let idsDestaquesGlobais = [];

let idsUpsellGlobais = [];
let descontoUpsellGlobal = 0;

let cuponsGlobais = [];
let cupomAtivo = null;
let bairrosGlobais = []; // 🗺️ NOVA VARIÁVEL GLOBAL

async function carregarTudo() {
    try {
        // 🌐 NOVO: O "motor" agora busca produtos, grupos e BAIRROS ao mesmo tempo!
        const [resProd, resGrupos, resBairros] = await Promise.all([
            fetch('https://icesoft-api.onrender.com/api/produtos'),
            fetch('https://icesoft-api.onrender.com/api/grupos'),
            fetch('https://icesoft-api.onrender.com/api/bairros')
        ]);
        
        produtosDaNuvem = (await resProd.json()).filter(p => p.ativo !== false);
        gruposGlobais = (await resGrupos.json()).filter(g => g.ativo !== false);
        bairrosGlobais = await resBairros.json(); // 📥 Guarda os bairros da nuvem
        
        renderizarMenuCategorias(produtosDaNuvem);
        renderizarCardapio(produtosDaNuvem);
        renderizarCarrossel(produtosDaNuvem);
        
        // 🗺️ NOVO: Pede para desenhar a caixinha de bairros na sacola!
        renderizarBairros();
    } catch (e) { console.error("Erro ao carregar:", e); }
}

// ==========================================
// 🎨 O NOVO CARDÁPIO DINÂMICO (COM CATEGORIAS E FOTOS)
// ==========================================
function renderizarCardapio(lista) {
    const container = document.getElementById('lista-produtos');
    const navCategorias = document.getElementById('nav-categorias'); 
    
    container.innerHTML = '<h2 style="margin-bottom: 20px;">Cardápio Completo</h2>';
    if (navCategorias) navCategorias.innerHTML = '';

    // 1. Agrupa os produtos por categoria e captura o primeiro emoji pra ilustrar
    const mapCategorias = new Map();
    lista.forEach(p => {
        const catNome = p.categoria && p.categoria !== 'null' ? p.categoria : 'Diversos';
        if (!mapCategorias.has(catNome)) {
            mapCategorias.set(catNome, p.emoji || '🍦');
        }
    });

    // 2. Monta as Bolinhas (Stories) e as Seções do Cardápio
    mapCategorias.forEach((emojiGeral, catNome) => {
        // Cria um ID seguro para a página rolar até ele
        const catId = 'categoria-' + catNome.replace(/[^a-zA-Z0-9]/g, '');

        // Injeta a bolinha no menu de navegação do topo
        if (navCategorias) {
            navCategorias.innerHTML += `
                <div onclick="rolarParaCategoria('${catId}')" style="cursor: pointer; flex: 0 0 auto; transition: 0.2s;">
                    <div style="font-size: 1.8rem; border: 2px solid var(--cor-primaria, #e91e63); width: 65px; height: 65px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px auto; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                        ${emojiGeral}
                    </div>
                    <span style="font-size: 0.85rem; font-weight: bold; color: #555;">${catNome}</span>
                </div>
            `;
        }

        // Injeta o Título da Categoria no corpo do Cardápio
        container.innerHTML += `<h3 id="${catId}" style="color: var(--cor-primaria, #e91e63); margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 5px;">${catNome}</h3>`;

        // Filtra e injeta apenas os Produtos desta Categoria abaixo do título
        const produtosDestaCategoria = lista.filter(p => (p.categoria && p.categoria !== 'null' ? p.categoria : 'Diversos') === catNome);
        
        produtosDestaCategoria.forEach(p => {
            // Prepara a descrição (se não existir, não mostra nada)
            const descricaoLimpa = p.descricao && p.descricao !== 'null' ? p.descricao : '';
            const htmlDescricao = descricaoLimpa 
                ? `<p style="margin: 4px 0 8px 0; color: #777; font-size: 0.85rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${descricaoLimpa}</p>` 
                : ``;
            
            // 📸 FOTO OU EMOJI (Agora com o design quadrado igual Anota.ai)
            const visualProduto = p.imagem_url 
                ? `<img src="${p.imagem_url}" style="width: 90px; height: 90px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); flex-shrink: 0;">`
                : `<div style="font-size: 2.5rem; width: 90px; height: 90px; background: #f8f9fa; border-radius: 8px; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">${p.emoji || '🍦'}</div>`;

            // 🟢 CARD CLICÁVEL: O onclick agora fica na div principal e removemos o botão "+"
            container.innerHTML += `
                <div class="produto-card" onclick="verificarAdicao(${p.id})" style="display: flex; justify-content: space-between; align-items: center; background: white; margin-bottom: 12px; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #f0f0f0; cursor: pointer; transition: 0.2s;">
                    
                    <div style="flex: 1; padding-right: 15px;">
                        <h3 style="margin: 0; color: #333; font-size: 1.05rem; font-weight: 600;">${p.nome}</h3>
                        ${htmlDescricao}
                        <div style="font-weight: 700; color: #333; font-size: 1rem; margin-top: 5px;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>
                    </div>
                    
                    ${visualProduto}
                    
                </div>
            `;
        });
    });
}

// 🪄 Função de Mágica (Desce a página suavemente até a categoria clicada)
function rolarParaCategoria(id) {
    const elemento = document.getElementById(id);
    if (elemento) {
        // Pega a distância do item até o topo e dá um pequeno respiro de 20px
        const y = elemento.getBoundingClientRect().top + window.scrollY - 20; 
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
}

// ==========================================
// RESTANTE DO SISTEMA DE VENDAS
// ==========================================
function verificarAdicao(id) {
    const produto = produtosDaNuvem.find(p => p.id === id);
    if (!produto.grupos_ids || produto.grupos_ids.length === 0) return adicionarAoCarrinho(produto.nome, Number(produto.preco));
    abrirModalEscolha(produto);
}

function abrirModalEscolha(produto) {
    produtoEmSelecao = produto;
    escolhasAtuais = [];
    
    // ==========================================
    // 📸 NOVO TOPO DO MODAL (FOTO GIGANTE + DESCRIÇÃO)
    // ==========================================
    const topo = document.getElementById('detalhes-produto-topo');
    
    // 1. Prepara a descrição (se houver)
    const descricaoHTML = produto.descricao && produto.descricao !== 'null'
        ? `<p style="color: #666; font-size: 0.95rem; margin-top: 8px; line-height: 1.4; text-align: left;">${produto.descricao}</p>`
        : ``;

    // 2. A Mágica do CSS: Margem negativa para colar nas bordas do modal!
    const visualTopo = produto.imagem_url
        ? `<img src="${produto.imagem_url}" style="width: calc(100% + 40px); height: 220px; object-fit: cover; margin: -20px -20px 15px -20px; border-top-left-radius: 25px; border-top-right-radius: 25px; display: block; background: #f8f9fa;">`
        : `<div style="font-size: 4rem; padding-bottom: 10px; text-align: center;">${produto.emoji || '🍦'}</div>`;

    // 3. Injeta tudo na tela
    topo.innerHTML = `
        ${visualTopo}
        <h2 style="margin: 0; color: #333; font-size: 1.4rem; text-align: left;">${produto.nome}</h2>
        ${descricaoHTML}
        <div style="background: #f0f2f5; margin: 15px -20px 0 -20px; padding: 10px 20px;">
            <p style="color: var(--cor-primaria, #e91e63); margin: 0; font-weight: bold; font-size: 0.95rem; text-transform: uppercase;">Escolha seus complementos</p>
        </div>
    `;
    // ==========================================

    const container = document.getElementById('container-grupos-opcoes');
    container.innerHTML = '';
    
    const gruposDoProduto = produto.grupos_ids.map(id => gruposGlobais.find(g => g.id === Number(id))).filter(g => g && g.ativo !== false);
    
    gruposDoProduto.forEach(grupo => {
        const itensAtivos = (grupo.itens || []).filter(item => item.ativo !== false);
        if (itensAtivos.length === 0) return;

        let itensHtml = itensAtivos.map((item, idx) => {
            let precoSeguro = Number(item.preco) || 0;
            let nomeSeguro = item.nome.replace(/'/g, "\\'"); 
            let chkId = `chk-${grupo.id}-${idx}`;
            return `
            <div class="item-opcional-card" onclick="toggleOpcional(${grupo.id}, '${nomeSeguro}', ${precoSeguro}, '${chkId}')" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:10px;"><input type="checkbox" id="${chkId}" style="accent-color:var(--cor-primaria, #e91e63); pointer-events:none;"><span>${item.nome}</span></div>
                <span style="color:#25D366; font-size:0.9rem; font-weight: 600;">${precoSeguro > 0 ? '+ R$ ' + precoSeguro.toFixed(2).replace('.', ',') : 'Grátis'}</span>
            </div>`;
        }).join('');

        container.innerHTML += `<div style="margin-bottom:20px; margin-top: 15px;"><div style="background:#fff; border: 1px solid #eee; padding:12px; border-radius:10px; display:flex; justify-content:space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.02);"><strong style="color:#333; font-size: 1.05rem;">${grupo.nome}</strong><span style="font-size:0.75rem; color: white; background: var(--cor-primaria, #e91e63); padding:4px 10px; border-radius:20px; font-weight: bold;">Até ${grupo.limite}</span></div>${itensHtml}</div>`;
    });
    
    atualizarPrecoDinamico();
    document.getElementById('modal-opcoes').style.display = 'flex';
}

function toggleOpcional(grupoId, nomeItem, preco, chkId) {
    const grupo = gruposGlobais.find(g => g.id === grupoId);
    const chk = document.getElementById(chkId);
    const index = escolhasAtuais.findIndex(e => e.nome === nomeItem && e.grupoId === grupoId);

    if (index > -1) { escolhasAtuais.splice(index, 1); chk.checked = false; } else {
        const escolhasNoGrupo = escolhasAtuais.filter(e => e.grupoId === grupoId);
        if (grupo.limite === 1) {
            if (escolhasNoGrupo.length > 0) {
                const idxAnterior = escolhasAtuais.indexOf(escolhasNoGrupo[0]);
                escolhasAtuais.splice(idxAnterior, 1);
                document.querySelectorAll(`input[id^="chk-${grupoId}-"]`).forEach(c => c.checked = false);
            }
        } else if (escolhasNoGrupo.length >= grupo.limite) { return alert(`Você só pode escolher até ${grupo.limite} opção(ões) em ${grupo.nome}`); }
        
        escolhasAtuais.push({ grupoId, nome: nomeItem, preco: Number(preco) });
        chk.checked = true;
    }
    atualizarPrecoDinamico();
}

function atualizarPrecoDinamico() {
    const totalGeral = Number(produtoEmSelecao.preco) + escolhasAtuais.reduce((soma, e) => soma + Number(e.preco), 0);
    document.getElementById('preco-dinamico').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
}

function confirmarEscolhasEAdicionar() {
    let nomeFinal = produtoEmSelecao.nome + (escolhasAtuais.length > 0 ? " (" + escolhasAtuais.map(e => e.nome).join(', ') + ")" : "");
    const precoFinal = Number(produtoEmSelecao.preco) + escolhasAtuais.reduce((soma, e) => soma + Number(e.preco), 0);
    adicionarAoCarrinho(nomeFinal, precoFinal);
    fecharModalOpcoes();
}

function fecharModalOpcoes() { document.getElementById('modal-opcoes').style.display = 'none'; }

function adicionarAoCarrinho(nome, preco) { 
    carrinho.push({ nome, preco: Number(preco) }); 
    atualizarBarraCarrinho();
    if (document.getElementById('modal-checkout').style.display === 'flex') {
        renderizarResumoCarrinho(); 
    }
}

function atualizarBarraCarrinho() {
    const barra = document.getElementById('carrinho-flutuante');
    if (carrinho.length > 0) {
        barra.classList.replace('carrinho-oculto', 'carrinho-visivel');
        barra.style.display = 'flex';
        let total = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
        document.getElementById('carrinho-qtd').innerText = `${carrinho.length} item(ns)`;
        document.getElementById('carrinho-total').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    } else {
        barra.classList.replace('carrinho-visivel', 'carrinho-oculto');
        barra.style.display = 'none';
    }
}

function renderizarResumoCarrinho() {
    const container = document.getElementById('lista-resumo-itens');
    if (carrinho.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; font-size:0.8rem;">Carrinho vazio</p>';
        return fecharModalCheckout();
    }
    container.innerHTML = '';
    carrinho.forEach((item, index) => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.85rem; border-bottom:1px solid #eee; padding-bottom:5px;">
                <div style="flex:1;"><strong>${item.nome}</strong><br><span style="color:var(--cor-primaria, #e91e63);">R$ ${item.preco.toFixed(2).replace('.', ',')}</span></div>
                <button onclick="removerItemCarrinho(${index})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.1rem; padding:5px;">🗑️</button>
            </div>
        `;
    });
    atualizarTotalCheckout();
}

function removerItemCarrinho(index) { carrinho.splice(index, 1); atualizarBarraCarrinho(); renderizarResumoCarrinho(); }

function aplicarCupom() {
    const input = document.getElementById('input-cupom');
    const codigo = input.value.trim().toUpperCase();
    const msg = document.getElementById('msg-cupom');

    if (!codigo) { cupomAtivo = null; msg.style.display = 'none'; atualizarTotalCheckout(); return; }

    const cupomEncontrado = cuponsGlobais.find(c => c.codigo === codigo);

    if (!cupomEncontrado) {
        msg.innerText = "❌ Cupom inválido ou expirado.";
        msg.style.color = "#f44336";
        msg.style.display = 'block';
        cupomAtivo = null;
    } else {
        cupomAtivo = cupomEncontrado;
        const textoDesconto = cupomAtivo.tipo === 'porcentagem' ? `${cupomAtivo.valor}%` : `R$ ${Number(cupomAtivo.valor).toFixed(2).replace('.', ',')}`;
        msg.innerText = `✅ Cupom de ${textoDesconto} aplicado!`;
        msg.style.color = "#4CAF50";
        msg.style.display = 'block';
    }
    atualizarTotalCheckout();
}

// ==========================================
// 🧮 NOVO CÁLCULO DE TOTAL (COM TAXA DE ENTREGA)
// ==========================================
function atualizarTotalCheckout() {
    // 1. Calcula o Subtotal (Só os produtos)
    let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
    document.getElementById('subtotal-display').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    
    // 2. Lê a Taxa do Bairro selecionado
    const selectBairro = document.getElementById('cliente-bairro');
    let taxaEntrega = 0;
    
    if (selectBairro.value) {
        // Pega o valor "data-taxa" escondido dentro da opção selecionada
        const opcaoSelecionada = selectBairro.options[selectBairro.selectedIndex];
        taxaEntrega = Number(opcaoSelecionada.getAttribute('data-taxa')) || 0;
        document.getElementById('taxa-entrega-display').innerText = `R$ ${taxaEntrega.toFixed(2).replace('.', ',')}`;
    } else {
        document.getElementById('taxa-entrega-display').innerText = `Selecione acima ⬆️`;
    }

    // 3. Aplica os Cupons (O desconto incide apenas sobre os produtos, não sobre a entrega)
    let desconto = 0;
    const linhaDesconto = document.getElementById('desconto-display-linha');
    const valorDesconto = document.getElementById('desconto-display-valor');

    if (cupomAtivo) {
        if (cupomAtivo.tipo === 'porcentagem') desconto = subtotal * (cupomAtivo.valor / 100);
        else desconto = cupomAtivo.valor;
        
        linhaDesconto.style.display = 'flex';
        valorDesconto.innerText = `- R$ ${desconto.toFixed(2).replace('.', ',')}`;
    } else {
        linhaDesconto.style.display = 'none';
    }

    // 4. A Conta Final
    let totalFinal = (subtotal - desconto) + taxaEntrega;
    if (totalFinal < 0) totalFinal = 0; // Evita cliente ganhar dinheiro do nada 😂

    document.getElementById('total-checkout-display').innerText = `R$ ${totalFinal.toFixed(2).replace('.', ',')}`;
}

async function salvarVendaDelivery() {
    let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
    let desconto = 0;
    if (cupomAtivo) {
        desconto = cupomAtivo.tipo === 'porcentagem' ? subtotal * (cupomAtivo.valor / 100) : cupomAtivo.valor;
    }
    let totalFinal = subtotal - desconto;
    if (totalFinal < 0) totalFinal = 0;

    // Pega os dados do HTML
    const pagamento = document.getElementById('cliente-pagamento').value || "WhatsApp / Online";
    const nome = document.getElementById('cliente-nome').value.trim();
    const telefone = document.getElementById('cliente-telefone').value.trim();
    const endereco = document.getElementById('cliente-endereco').value.trim();

    const itensFormatados = carrinho.map(item => ({ nome: "Delivery: " + item.nome, preco: item.preco }));
    
    try {
        const res = await fetch('https://icesoft-api.onrender.com/api/vendas', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                itens: JSON.stringify(itensFormatados), 
                produto_nome: "Pedido App Delivery", 
                valor_total: totalFinal, 
                total: totalFinal, 
                forma_pagamento: pagamento, 
                status: "Pendente Delivery",
                cliente_nome: nome,
                cliente_telefone: telefone,
                cliente_endereco: endereco
            })
        });

        // 🧹 LIMPEZA FEITA AQUI: Avisos amigáveis para o cliente!
        if (!res.ok) {
            alert("Poxa, tivemos um probleminha para processar seu pedido. Por favor, chame a gente no WhatsApp!");
        }

    } catch (e) { 
        // 🧹 LIMPEZA FEITA AQUI TAMBÉM!
        alert("Ops! Parece que sua internet oscilou. Verifique a conexão e tente novamente.");
    }
}

function finalizarPedidoWhatsApp() {
    const modal = document.getElementById('modal-checkout');
    cupomAtivo = null;
    document.getElementById('input-cupom').value = '';
    document.getElementById('msg-cupom').style.display = 'none';

    renderizarResumoCarrinho();
    renderizarUpsellCheckout(); 
    modal.style.display = 'flex';
}

function fecharModalCheckout() { document.getElementById('modal-checkout').style.display = 'none'; }

// ==========================================
// 📲 NOVO ENVIO PARA O WHATSAPP
// ==========================================
async function processarEnvioWhatsApp() {
    const nome = document.getElementById('cliente-nome').value.trim();
    const telefoneCliente = document.getElementById('cliente-telefone').value.trim();
    const bairro = document.getElementById('cliente-bairro').value;
    const rua = document.getElementById('cliente-endereco').value.trim();
    const pagamento = document.getElementById('cliente-pagamento').value;

    if (!nome || !telefoneCliente || !bairro || !rua || !pagamento) {
        return alert("⚠️ Por favor, preencha todos os campos e selecione seu bairro!");
    }

    // Pega a taxa do bairro para botar no recibo
    const selectBairro = document.getElementById('cliente-bairro');
    const opcaoSelecionada = selectBairro.options[selectBairro.selectedIndex];
    const taxaEntrega = Number(opcaoSelecionada.getAttribute('data-taxa')) || 0;

    const enderecoCompleto = `${bairro} - ${rua}`;
    
    // Atualiza o input escondido (caso você salve no banco de dados)
    document.getElementById('cliente-endereco').value = enderecoCompleto;

    await salvarVendaDelivery(); // Salva no banco (sua função continua a mesma)

    let textoPedido = `🍦 *NOVO PEDIDO - ICESOFT* 🍦\n\n`;
    textoPedido += `👤 *Cliente:* ${nome}\n`;
    textoPedido += `📱 *WhatsApp:* ${telefoneCliente}\n`;
    textoPedido += `📍 *Endereço:* ${enderecoCompleto}\n`;
    textoPedido += `💳 *Pagamento:* ${pagamento}\n\n`;
    textoPedido += `📦 *Itens do Pedido:*\n`;
    
    let subtotal = 0;
    carrinho.forEach(item => { 
        textoPedido += `▪️ 1x ${item.nome} - R$ ${Number(item.preco).toFixed(2).replace('.', ',')}\n`; 
        subtotal += Number(item.preco); 
    });
    
    textoPedido += `\n🛵 *Taxa de Entrega:* R$ ${taxaEntrega.toFixed(2).replace('.', ',')}`;

    if (cupomAtivo) {
        let desconto = cupomAtivo.tipo === 'porcentagem' ? subtotal * (cupomAtivo.valor / 100) : cupomAtivo.valor;
        textoPedido += `\n🏷️ *Cupom (*${cupomAtivo.codigo}*):* - R$ ${desconto.toFixed(2).replace('.', ',')}`;
        let totalFinal = (subtotal - desconto) + taxaEntrega;
        textoPedido += `\n💰 *Total Final: R$ ${totalFinal.toFixed(2).replace('.', ',')}*`;
    } else {
        let totalFinal = subtotal + taxaEntrega;
        textoPedido += `\n💰 *Total Final: R$ ${totalFinal.toFixed(2).replace('.', ',')}*`;
    }

    window.location.href = `https://api.whatsapp.com/send?phone=5524992308585&text=${encodeURIComponent(textoPedido)}`;
    carrinho = []; atualizarBarraCarrinho(); fecharModalCheckout();
}

async function carregarConfiguracoesLoja() {
    try {
        const res = await fetch(`https://icesoft-api.onrender.com/api/configuracoes`);
        const configs = await res.json();
        
        if (configs.cor_primaria) document.documentElement.style.setProperty('--cor-primaria', configs.cor_primaria);
        if (configs.nome_loja) document.getElementById('loja-nome-exibicao').innerText = `🍦 ${configs.nome_loja}`;
        if (configs.mensagem_boas_vindas) document.getElementById('loja-mensagem-exibicao').innerText = configs.mensagem_boas_vindas;
        if (configs.carrossel_destaques) { try { idsDestaquesGlobais = JSON.parse(configs.carrossel_destaques); } catch(e) {} }
        if (configs.upsell_desconto) descontoUpsellGlobal = Number(configs.upsell_desconto);
        if (configs.carrossel_upsell) { try { idsUpsellGlobais = JSON.parse(configs.carrossel_upsell); } catch(e) {} }
        if (configs.cupons_delivery) { try { cuponsGlobais = JSON.parse(configs.cupons_delivery); } catch(e) {} }

    } catch (e) { console.error("Erro configurações:", e); }
}

function renderizarCarrossel(produtos) {
    const secao = document.getElementById('secao-destaques');
    const carrossel = document.getElementById('carrossel-produtos');
    const produtosDestaque = produtos.filter(p => idsDestaquesGlobais.includes(Number(p.id)) && p.ativo !== false);

    if (produtosDestaque.length === 0) return secao.style.display = 'none';

    secao.style.display = 'block'; 
    carrossel.innerHTML = '';
    
    produtosDestaque.forEach(p => {
        // 📸 A MÁGICA DA FOTO: Altura fixa para todos os cards ficarem perfeitamente iguais!
        const visualProduto = p.imagem_url 
            ? `<img src="${p.imagem_url}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 10px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`
            : `<div style="font-size: 3.5rem; text-align: center; margin-bottom: 10px; height: 110px; display: flex; align-items: center; justify-content: center;">${p.emoji || '🍦'}</div>`;

        carrossel.innerHTML += `
            <div class="card-destaque" onclick="verificarAdicao(${p.id})" style="display: flex; flex-direction: column; justify-content: space-between;">
                ${visualProduto}
                <div>
                    <h4 style="margin: 0 0 5px 0;">${p.nome}</h4>
                    <div class="preco">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>
                </div>
                <button class="btn-add-destaque">+ Adicionar</button>
            </div>
        `;
    });
}

function renderizarUpsellCheckout() {
    const area = document.getElementById('area-upsell-checkout');
    const carrossel = document.getElementById('carrossel-upsell');
    const produtosUpsell = produtosDaNuvem.filter(p => idsUpsellGlobais.includes(Number(p.id)) && p.ativo !== false);

    if (produtosUpsell.length === 0 || descontoUpsellGlobal <= 0) return area.style.display = 'none';

    area.style.display = 'block';
    carrossel.innerHTML = '';

    produtosUpsell.forEach(p => {
        const precoNormal = Number(p.preco);
        const descontoReais = precoNormal * (descontoUpsellGlobal / 100);
        const precoComDesconto = precoNormal - descontoReais;
        const nomeLimpo = p.nome.replace(/'/g, "\\'"); 

        // 📸 A MÁGICA DA FOTO NO UPSELL: Versão menor (75px) para caber no checkout!
        const visualProduto = p.imagem_url 
            ? `<img src="${p.imagem_url}" style="width: 100%; height: 75px; object-fit: cover; border-radius: 6px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">`
            : `<div style="font-size: 2.5rem; text-align: center; margin-bottom: 8px; height: 75px; display: flex; align-items: center; justify-content: center;">${p.emoji || '🍦'}</div>`;

        carrossel.innerHTML += `
            <div style="flex: 0 0 130px; background: white; border-radius: 10px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; text-align: center; border: 1px solid #ffb3c6;">
                
                ${visualProduto}
                
                <h5 style="margin: 0 0 5px 0; font-size: 0.85rem; color: #333; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.nome}</h5>
                
                <div>
                    <div style="text-decoration: line-through; color: #999; font-size: 0.75rem;">R$ ${precoNormal.toFixed(2).replace('.', ',')}</div>
                    <div style="font-weight: bold; color: #e91e63; font-size: 1rem;">R$ ${precoComDesconto.toFixed(2).replace('.', ',')}</div>
                </div>
                
                <button onclick="adicionarOfertaAoCarrinho('${nomeLimpo}', ${precoComDesconto})" style="margin-top: 8px; background: #e91e63; color: white; border: none; padding: 5px; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 0.8rem;">+ Adicionar</button>
            </div>
        `;
    });
}

function adicionarOfertaAoCarrinho(nome, precoDesconto) {
    adicionarAoCarrinho("🔥 Oferta: " + nome, precoDesconto);
}

async function verificarStatusLoja() {
    try {
        const res = await fetch(`https://icesoft-api.onrender.com/api/loja/status`);
        const cortina = document.getElementById('overlay-loja-fechada');
        if (cortina) {
            if ((await res.json()).status === 'fechado') { cortina.style.display = 'flex'; document.body.style.overflow = 'hidden'; } 
            else { cortina.style.display = 'none'; document.body.style.overflow = 'auto'; }
        }
    } catch (e) { console.error("Erro loja:", e); }
}

window.addEventListener('DOMContentLoaded', async () => {
    await carregarConfiguracoesLoja(); 
    await carregarTudo(); 
    verificarStatusLoja(); setInterval(verificarStatusLoja, 30000);
});

// ==========================================
// 🛑 SISTEMA DE TRAVA: A CORTINA DE FERRO
// ==========================================
async function verificarStatusLoja() {
    try {
        const res = await fetch('https://icesoft-api.onrender.com/api/loja/status');
        const data = await res.json();

        // Pegamos o status, transformamos em minúsculo e tiramos espaços em branco
        const statusAtual = data.status ? data.status.toLowerCase().trim() : '';

        if (statusAtual === 'fechado') {
            let cortina = document.getElementById('cortina-loja-fechada');
            if (!cortina) {
                cortina = document.createElement('div');
                cortina.id = 'cortina-loja-fechada';
                cortina.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 99999; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; text-align: center; padding: 20px; box-sizing: border-box; backdrop-filter: blur(5px);";
                cortina.innerHTML = `
                    <h1 style="font-size: 4rem; margin: 0;">😴</h1>
                    <h2 style="margin: 10px 0; color: #ffeb3b; font-family: 'Poppins', sans-serif;">Poxa, estamos fechados!</h2>
                    <p style="font-size: 1.1rem; max-width: 400px; font-family: 'Poppins', sans-serif; color: #ccc;">Nossa loja não está recebendo pedidos no momento. Volte mais tarde!</p>
                `;
                document.body.appendChild(cortina);
                document.body.style.overflow = 'hidden'; 
            }
        } else {
            const cortina = document.getElementById('cortina-loja-fechada');
            if (cortina) {
                cortina.remove();
                document.body.style.overflow = 'auto'; 
            }
        }
    } catch (e) {
        alert("🕵️ ERRO DO ESPIÃO: Não consegui falar com o servidor!");
    }
}

verificarStatusLoja();

// ==========================================
// 🎨 DESENHA O MENU DE CATEGORIAS DINÂMICO
// ==========================================
function renderizarMenuCategorias(produtos) {
    const container = document.getElementById('menu-categorias-dinamico');
    if (!container) return;

    // Pega as categorias únicas que vieram do banco de dados (já com os emojis originais)
    const categoriasUnicas = [...new Set(produtos.map(p => p.categoria).filter(c => c))];

    let html = '';

    categoriasUnicas.forEach(categoria => {
        // Criamos um botão "Pill" limpo. O onclick chama a nossa função ninja!
        html += `
        <div onclick="rolarParaCategoria('${categoria.replace(/'/g, "\\'")}')" style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; background: #ffffff; padding: 10px 20px; border-radius: 50px; border: 1px solid #e4e6eb; box-shadow: 0 4px 6px rgba(0,0,0,0.04); color: #333; font-family: 'Poppins', sans-serif; font-weight: bold; font-size: 0.95rem; transition: 0.2s;">
            ${categoria}
        </div>`;
    });

    container.innerHTML = html;
}

// 🥷 FUNÇÃO NINJA DE ROLAGEM
window.rolarParaCategoria = function(nomeCategoria) {
    // Procura todos os títulos (H2 e H3) dentro da área do cardápio
    const titulos = document.querySelectorAll('#lista-produtos h2, #lista-produtos h3');
    
    for (let titulo of titulos) {
        // Se achar o título na tela, rola até ele!
        if (titulo.innerText.trim().includes(nomeCategoria.trim()) || nomeCategoria.trim().includes(titulo.innerText.trim())) {
            
            // Rola suavemente deixando uma margem de 80px pra não grudar no topo da tela
            const posicaoY = titulo.getBoundingClientRect().top + window.scrollY - 80; 
            window.scrollTo({ top: posicaoY, behavior: 'smooth' });
            
            break; // Para de procurar depois que achar
        }
    }
};

// ==========================================
// 🔍 SISTEMA DE BUSCA EM TEMPO REAL
// ==========================================
const inputBusca = document.getElementById('busca-produtos');

if (inputBusca) {
    inputBusca.addEventListener('input', function() {
        // 1. Pega o que o cliente digitou, joga pra minúsculo e remove acentos (ex: "acai" acha "Açaí")
        const termo = this.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // 2. Filtra a nossa lista mestre de produtos que já veio do banco de dados
        const produtosFiltrados = produtosDaNuvem.filter(p => {
            const nome = p.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const descricao = p.descricao && p.descricao !== 'null' ? p.descricao.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
            
            // Retorna verdadeiro se o que o cliente digitou existir no NOME ou na DESCRIÇÃO do produto
            return nome.includes(termo) || descricao.includes(termo);
        });

        // 3. Apaga o cardápio antigo e desenha de novo SÓ com os produtos encontrados!
        renderizarCardapio(produtosFiltrados);
    });
}
