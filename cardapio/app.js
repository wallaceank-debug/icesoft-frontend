const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';

let carrinho = [];
let produtosDaNuvem = [];
let gruposGlobais = [];
let produtoEmSelecao = null;
let escolhasAtuais = [];
let idsDestaquesGlobais = [];
let lojaAberta = true; // Impede adicionar se estiver fechada
let idsUpsellGlobais = [];
let descontoUpsellGlobal = 0;
let categoriasGlobaisDelivery = [];
let pedidoMinimoDeliveryGlobal = 0;

let cuponsGlobais = [];
let cupomAtivo = null;
let bairrosGlobais = []; // 🗺️ NOVA VARIÁVEL GLOBAL

async function carregarTudo() {
    try {
        // 🌐 O "motor" agora busca as configurações no mesmo pacote!
        const [resProd, resGrupos, resBairros, resCat, resConfig] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/grupos`),
            fetch(`${API_URL}/bairros`),
            fetch(`${API_URL}/categorias`),
            fetch(`${API_URL}/configuracoes`) // 👈 AQUI! Pedimos a gaveta de configs
        ]);

        let produtosBrutos = await resProd.json();
        
        // 📸 O NOVO FILTRO BLINDADO (Corrige a foto quebrada ignorando a sujeira do banco)
        produtosDaNuvem = produtosBrutos.map(p => {
            if (p.imagem_url && !p.imagem_url.includes('ibb.co')) {
                const nomeArquivo = p.imagem_url.split('/').pop(); 
                p.imagem_url = `https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/uploads/${nomeArquivo}`;
            }
            return p;
        }).filter(p => p.ativo !== false);

        gruposGlobais = (await resGrupos.json()).filter(g => g.ativo !== false);
        bairrosGlobais = await resBairros.json(); 
        
        // 🛡️ O FILTRO MÁGICO DAS CATEGORIAS (Apenas as visíveis no App)
        const todasCategorias = await resCat.json();
        categoriasGlobaisDelivery = todasCategorias.filter(c => c.ativo !== false && c.mostrar_cardapio !== false);

        renderizarCardapio(produtosDaNuvem);
        renderizarMenuCategorias(produtosDaNuvem);
        renderizarCarrossel(produtosDaNuvem);
        renderizarBairros();
        
        // 🗺️ Pede para desenhar a caixinha de bairros na sacola!
        renderizarBairros();

        // ==========================================
        // 🚀 MÁGICA DO TÍTULO DINÂMICO
        // ==========================================
        const configs = await resConfig.json();
        const tituloDestaque = configs.titulo_carrossel_destaques || 'Destaques da Casa';
        const elementoTitulo = document.getElementById('titulo-ui-destaques');
        
        if (elementoTitulo) {
            // Mantém a estrelinha charmosa e injeta o texto que você digitou lá no painel!
            elementoTitulo.innerHTML = `⭐ ${tituloDestaque}`;
        }

    } catch (e) { 
        console.error("Erro ao carregar do servidor novo:", e); 
    }
}

// ==========================================
// 🗺️ DESENHAR BAIRROS NO CHECKOUT
// ==========================================
function renderizarBairros() {
    const selectBairro = document.getElementById('cliente-bairro');
    if (!selectBairro) return;

    selectBairro.innerHTML = '<option value="" data-taxa="0" disabled selected>📍 Selecione seu Bairro</option>';

    bairrosGlobais.forEach(b => {
        const taxa = Number(b.taxa);
        const textoTaxa = taxa > 0 ? `Taxa: R$ ${taxa.toFixed(2).replace('.', ',')}` : 'Grátis';
        selectBairro.innerHTML += `<option value="${b.nome}" data-taxa="${taxa}">${b.nome} - ${textoTaxa}</option>`;
    });

    selectBairro.innerHTML += '<option value="Retirada no Local" data-taxa="0">🏬 Retirada na Loja - Grátis</option>';
}

// ==========================================
// 🎨 O NOVO CARDÁPIO DINÂMICO (COM CATEGORIAS E FOTOS)
// ==========================================
function obterOrdemDasCategorias(listaProdutosAtual) {
    // 1. Pega apenas o nome das categorias que têm permissão de aparecer no App
    const categoriasPermitidas = categoriasGlobaisDelivery.map(c => c.nome);

    // 2. Filtra os produtos para mostrar apenas os que pertencem a categorias permitidas
    const produtosPermitidos = listaProdutosAtual.filter(p => 
        categoriasPermitidas.includes(p.categoria && p.categoria !== 'null' ? p.categoria : 'Diversos')
    );

    // 3. Monta a ordem oficial baseada APENAS nas categorias permitidas
    const categoriasExtras = [...new Set(produtosPermitidos.map(p => p.categoria && p.categoria !== 'null' ? p.categoria : 'Diversos'))]
        .filter(c => !categoriasPermitidas.includes(c));

    return [...categoriasPermitidas, ...categoriasExtras];
}

function renderizarCardapio(lista) {
    const container = document.getElementById('lista-produtos');
    container.innerHTML = '<h2 style="margin-bottom: 20px;">Cardápio Completo</h2>';

    const categoriasOrdenadas = obterOrdemDasCategorias(lista);

    categoriasOrdenadas.forEach(catNome => {
        const produtosDestaCategoria = lista.filter(p => (p.categoria && p.categoria !== 'null' ? p.categoria : 'Diversos') === catNome);
        
        if (produtosDestaCategoria.length === 0) return;

        const catId = 'categoria-' + catNome.replace(/[^a-zA-Z0-9]/g, '');

        container.innerHTML += `<h3 id="${catId}" style="color: var(--cor-primaria, #e91e63); margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 5px;">${catNome}</h3>`;

        produtosDestaCategoria.forEach(p => {
            const descricaoLimpa = p.descricao && p.descricao !== 'null' ? p.descricao : '';
            const htmlDescricao = descricaoLimpa 
                ? `<p style="margin: 4px 0 8px 0; color: #777; font-size: 0.85rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${descricaoLimpa}</p>` 
                : ``;
            
            const visualProduto = p.imagem_url 
                ? `<img src="${p.imagem_url}" loading="lazy" style="width: 90px; height: 90px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); flex-shrink: 0;">`
                : `<div style="font-size: 2.5rem; width: 90px; height: 90px; background: #f8f9fa; border-radius: 8px; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">${p.emoji || '🍦'}</div>`;

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

function rolarParaCategoria(id) {
    const elemento = document.getElementById(id);
    if (elemento) {
        const y = elemento.getBoundingClientRect().top + window.scrollY - 20; 
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
}

// ==========================================
// SISTEMA DE ADIÇÃO E MODAL DE PRODUTO
// ==========================================
let quantidadeModal = 1; 

function verificarAdicao(id) {
    if (!lojaAberta) {
        alert("🛑 A loja está fechada no momento! Verifique nosso horário de funcionamento no topo da página.");
        return;
    }
    
    const produto = produtosDaNuvem.find(p => p.id === id);
    abrirModalEscolha(produto);
}

function abrirModalEscolha(produto) {
    produtoEmSelecao = produto;
    escolhasAtuais = [];
    quantidadeModal = 1; 
    
    if(document.getElementById('quantidade-modal-display')) {
        document.getElementById('quantidade-modal-display').innerText = quantidadeModal;
    }

    const topo = document.getElementById('detalhes-produto-topo');
    
    const descricaoHTML = produto.descricao && produto.descricao !== 'null'
        ? `<p style="color: #666; font-size: 0.95rem; margin-top: 8px; line-height: 1.4; text-align: left;">${produto.descricao}</p>`
        : ``;

    const visualTopo = produto.imagem_url
        ? `<div id="area-arraste" style="position: relative; margin: -20px -20px 15px -20px; width: calc(100% + 40px);">
               <div style="position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: 45px; height: 5px; background: rgba(255,255,255,0.9); border-radius: 10px; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
               <img src="${produto.imagem_url}" style="width: 100%; height: 220px; object-fit: cover; border-top-left-radius: 25px; border-top-right-radius: 25px; display: block; background: #f8f9fa;">
           </div>`
        : `<div id="area-arraste" style="position: relative; font-size: 4rem; padding-top: 20px; padding-bottom: 10px; text-align: center;">
               <div style="position: absolute; top: 5px; left: 50%; transform: translateX(-50%); width: 45px; height: 5px; background: #ccc; border-radius: 10px; z-index: 10;"></div>
               ${produto.emoji || '🍦'}
           </div>`;

    const temAdicionais = produto.grupos_ids && produto.grupos_ids.length > 0;
    const htmlFaixaComplementos = temAdicionais 
        ? `<div style="background: #f0f2f5; margin: 15px -20px 0 -20px; padding: 10px 20px;">
            <p style="color: var(--cor-primaria, #e91e63); margin: 0; font-weight: bold; font-size: 0.95rem; text-transform: uppercase;">Escolha seus complementos</p>
           </div>`
        : ``;

    topo.innerHTML = `
        ${visualTopo}
        <h2 style="margin: 0; color: #333; font-size: 1.4rem; text-align: left;">${produto.nome}</h2>
        ${descricaoHTML}
        ${htmlFaixaComplementos}
    `;

    const container = document.getElementById('container-grupos-opcoes');
    container.innerHTML = '';
    
    if (temAdicionais) {
        const gruposDoProduto = produto.grupos_ids.map(id => gruposGlobais.find(g => g.id === Number(id))).filter(g => g && g.ativo !== false);
        
        gruposDoProduto.forEach(grupo => {
            const itensAtivos = (grupo.itens || []).filter(item => item.ativo !== false);
            if (itensAtivos.length === 0) return;

            let itensHtml = itensAtivos.map((item, idx) => {
                let precoSeguro = Number(item.preco) || 0;
                let nomeCompleto = item.nome.replace(/'/g, "\\'"); 
                let identificador = `opc-${grupo.id}-${idx}`;

                // 🚀 O INTERCEPTADOR DE TAGS ENTRA EM AÇÃO AQUI
                let tagHtml = '';
                let nomeLimpoVisual = nomeCompleto;
                const matchTag = nomeCompleto.match(/\[(.*?)\]/); // Procura qualquer texto entre [ ]
                
                if (matchTag) {
                    tagHtml = `<span class="tag-recomendacao">${matchTag[1]}</span>`;
                    nomeLimpoVisual = nomeCompleto.replace(/\[.*?\]/, '').trim(); // Remove a tag do nome para ficar limpo
                }

                if (grupo.limite === 1) {
                    return `
                    <div class="item-opcional-card" onclick="toggleOpcional(${grupo.id}, '${nomeCompleto}', ${precoSeguro}, '${identificador}')" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee; cursor:pointer;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" id="${identificador}" style="accent-color:var(--cor-primaria, #e91e63); pointer-events:none;">
                            <span style="font-weight: 500; color: #333;">${nomeLimpoVisual} ${tagHtml}</span>
                        </div>
                        <span style="color:#25D366; font-size:0.9rem; font-weight: 600;">${precoSeguro > 0 ? '+ R$ ' + precoSeguro.toFixed(2).replace('.', ',') : 'Grátis'}</span>
                    </div>`;
                } else {
                    return `
                    <div class="item-opcional-card" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee;">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <div style="display: flex; align-items: center;">
                                <span style="font-weight:600; color:#333;">${nomeLimpoVisual}</span>
                                ${tagHtml}
                            </div>
                            <span style="color:#25D366; font-size:0.85rem; font-weight: 600;">${precoSeguro > 0 ? '+ R$ ' + precoSeguro.toFixed(2).replace('.', ',') : 'Grátis'}</span>
                        </div>
                        <div style="display: flex; align-items: center; background: #f4f7f6; border: 1px solid #ddd; border-radius: 8px; padding: 2px;">
                            <button onclick="alterarQtdOpcional(${grupo.id}, '${nomeCompleto}', ${precoSeguro}, -1, '${identificador}')" style="background: none; border: none; font-size: 1.2rem; color: #555; cursor: pointer; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center;">-</button>
                            <span id="${identificador}" style="font-weight: bold; font-size: 1rem; color: #333; min-width: 24px; text-align: center;">0</span>
                            <button onclick="alterarQtdOpcional(${grupo.id}, '${nomeCompleto}', ${precoSeguro}, 1, '${identificador}')" style="background: none; border: none; font-size: 1.2rem; color: var(--cor-primaria, #e91e63); cursor: pointer; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center;">+</button>
                        </div>
                    </div>`;
                }
            }).join('');

            const isObrigatorio = (grupo.obrigatorio == 1 || grupo.obrigatorio == true || grupo.obrigatorio === 'true');
            const badgeObrigatorio = isObrigatorio
                ? `<span style="font-size:0.7rem; color: white; background: #f44336; padding:3px 8px; border-radius:10px; margin-left: 8px; font-weight: bold;">Obrigatório</span>`
                : `<span style="font-size:0.7rem; color: #666; background: #e0e0e0; padding:3px 8px; border-radius:10px; margin-left: 8px; font-weight: bold;">Opcional</span>`;

            container.innerHTML += `<div style="margin-bottom:20px; margin-top: 15px;"><div style="background:#fff; border: 1px solid #eee; padding:12px; border-radius:10px; display:flex; justify-content:space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.02);"><strong style="color:#333; font-size: 1.05rem; display: flex; align-items: center;">${grupo.nome} ${badgeObrigatorio}</strong><span style="font-size:0.75rem; color: white; background: var(--cor-primaria, #e91e63); padding:4px 10px; border-radius:20px; font-weight: bold;">Até ${grupo.limite}</span></div>${itensHtml}</div>`;
        });
    }
    
    atualizarPrecoDinamico();
    document.getElementById('modal-opcoes').style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
    aplicarGestoSwipe();
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
        if (escolhasNoGrupo.length > 0) {
            const idxAnterior = escolhasAtuais.indexOf(escolhasNoGrupo[0]);
            escolhasAtuais.splice(idxAnterior, 1);
            document.querySelectorAll(`input[id^="chk-${grupoId}-"]`).forEach(c => c.checked = false);
        }
        
        escolhasAtuais.push({ grupoId, nome: nomeItem, preco: Number(preco), quantidade: 1 });
        chk.checked = true;
    }
    atualizarPrecoDinamico();
}

function alterarQtdOpcional(grupoId, nomeItem, preco, delta, spanId) {
    const grupo = gruposGlobais.find(g => g.id === grupoId);
    
    let totalSelecionadoNoGrupo = 0;
    escolhasAtuais.forEach(e => {
        if (e.grupoId === grupoId) totalSelecionadoNoGrupo += e.quantidade;
    });

    const index = escolhasAtuais.findIndex(e => e.nome === nomeItem && e.grupoId === grupoId);
    let itemAtual = index > -1 ? escolhasAtuais[index] : null;
    let qtdAtual = itemAtual ? itemAtual.quantidade : 0;

    if (delta > 0) { 
        if (totalSelecionadoNoGrupo >= grupo.limite) {
            return alert(`Você só pode escolher até ${grupo.limite} opção(ões) em ${grupo.nome}`);
        }
        qtdAtual++;
        if (itemAtual) {
            itemAtual.quantidade = qtdAtual;
        } else {
            escolhasAtuais.push({ grupoId, nome: nomeItem, preco: Number(preco), quantidade: qtdAtual });
        }
    } else if (delta < 0) { 
        if (qtdAtual > 0) {
            qtdAtual--;
            if (qtdAtual === 0) {
                escolhasAtuais.splice(index, 1); 
            } else {
                itemAtual.quantidade = qtdAtual;
            }
        }
    }

    document.getElementById(spanId).innerText = qtdAtual;
    atualizarPrecoDinamico();
}

function alterarQuantidadeModal(delta) {
    quantidadeModal += delta;
    if (quantidadeModal < 1) quantidadeModal = 1; 
    
    const display = document.getElementById('quantidade-modal-display');
    if(display) display.innerText = quantidadeModal;
    
    atualizarPrecoDinamico();
}

function atualizarPrecoDinamico() {
    const valorComplementos = escolhasAtuais.reduce((soma, e) => soma + (Number(e.preco) * e.quantidade), 0);
    const valorUnidade = Number(produtoEmSelecao.preco) + valorComplementos;
    const totalGeral = valorUnidade * quantidadeModal;
    
    document.getElementById('preco-dinamico').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
}

function confirmarEscolhasEAdicionar() {
    if (produtoEmSelecao.grupos_ids && produtoEmSelecao.grupos_ids.length > 0) {
        const gruposDoProduto = produtoEmSelecao.grupos_ids.map(id => gruposGlobais.find(g => g.id === Number(id))).filter(g => g && g.ativo !== false);

        for (let grupo of gruposDoProduto) {
            const isObrigatorio = (grupo.obrigatorio == 1 || grupo.obrigatorio == true || grupo.obrigatorio === 'true');
            if (isObrigatorio) {
                const escolhasNesteGrupo = escolhasAtuais.filter(e => e.grupoId === grupo.id);
                if (escolhasNesteGrupo.length === 0) {
                    alert(`⚠️ O grupo "${grupo.nome}" é OBRIGATÓRIO.\nPor favor, selecione pelo menos uma opção!`);
                    return; 
                }
            }
        }
    }

    let nomeFinal = produtoEmSelecao.nome;
    if (escolhasAtuais.length > 0) {
        let stringComplementos = escolhasAtuais.map(e => {
            if (e.quantidade > 1) return `${e.quantidade}x ${e.nome}`;
            return e.nome;
        }).join(', ');
        nomeFinal += ` (${stringComplementos})`;
    }

    const valorComplementos = escolhasAtuais.reduce((soma, e) => soma + (Number(e.preco) * e.quantidade), 0);
    const precoFinal = Number(produtoEmSelecao.preco) + valorComplementos;
    
    for (let i = 0; i < quantidadeModal; i++) {
        adicionarAoCarrinho(nomeFinal, precoFinal);
    }
    
    fecharModalOpcoes();
}

function fecharModalOpcoes() { 
    document.getElementById('modal-opcoes').style.display = 'none'; 
    document.body.style.overflow = 'auto'; 
}

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

    let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);

    if (!codigo) { cupomAtivo = null; msg.style.display = 'none'; atualizarTotalCheckout(); return; }

    const cupom = cuponsGlobais.find(c => c.codigo === codigo);

    if (!cupom) {
        msg.innerText = "❌ Cupom inválido ou não existe.";
        msg.style.color = "#f44336";
        msg.style.display = 'block';
        cupomAtivo = null;
        atualizarTotalCheckout();
        return;
    }

    // 🛑 TRAVA 1: Limite de Usos
    if (cupom.limite > 0 && (cupom.usos_atuais || 0) >= cupom.limite) {
        msg.innerText = "❌ Este cupom esgotou o limite de usos.";
        msg.style.color = "#f44336";
        msg.style.display = 'block';
        cupomAtivo = null;
        atualizarTotalCheckout();
        return;
    }

    // 🛑 TRAVA 2: Valor Mínimo
    if (cupom.minimo > 0 && subtotal < cupom.minimo) {
        msg.innerText = `❌ Exige compras acima de R$ ${Number(cupom.minimo).toFixed(2).replace('.', ',')}.`;
        msg.style.color = "#f44336";
        msg.style.display = 'block';
        cupomAtivo = null;
        atualizarTotalCheckout();
        return;
    }

    // 🛑 TRAVA 3: Validade (Data)
    if (cupom.validade) {
        const hoje = new Date().toISOString().split('T')[0];
        if (hoje > cupom.validade) {
            msg.innerText = "❌ Este cupom está expirado.";
            msg.style.color = "#f44336";
            msg.style.display = 'block';
            cupomAtivo = null;
            atualizarTotalCheckout();
            return;
        }
    }

    // ✅ Passou na auditoria!
    cupomAtivo = cupom;
    const textoDesconto = cupomAtivo.tipo === 'porcentagem' ? `${cupomAtivo.valor}%` : `R$ ${Number(cupomAtivo.valor).toFixed(2).replace('.', ',')}`;
    msg.innerText = `✅ Cupom de ${textoDesconto} aplicado!`;
    msg.style.color = "#25D366";
    msg.style.display = 'block';
    
    atualizarTotalCheckout();
}

// ==========================================
// 🚀 NOVO SISTEMA DE CHECKOUT EM PASSOS
// ==========================================
let passoCheckoutAtual = 1;

function finalizarPedidoWhatsApp() {
    cupomAtivo = null;
    document.getElementById('input-cupom').value = '';
    document.getElementById('msg-cupom').style.display = 'none';
    
    irParaPasso(1);
    
    renderizarResumoCarrinho();
    renderizarUpsellCheckout(); 
    document.getElementById('modal-checkout').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function fecharModalCheckout() { 
    document.getElementById('modal-checkout').style.display = 'none'; 
    document.body.style.overflow = 'auto';
}

function mudarTipoEntrega() {
    const tipo = document.querySelector('input[name="tipo_entrega"]:checked').value;
    const areaEndereco = document.getElementById('area-endereco');
    
    document.getElementById('label-entrega').classList.remove('ativo');
    document.getElementById('label-retirada').classList.remove('ativo');
    document.querySelectorAll('#label-entrega .radio-customizado, #label-retirada .radio-customizado').forEach(el => el.classList.remove('marcado'));

    if (tipo === 'delivery') {
        document.getElementById('label-entrega').classList.add('ativo');
        document.querySelector('#label-entrega .radio-customizado').classList.add('marcado');
        areaEndereco.style.display = 'block';
    } else {
        document.getElementById('label-retirada').classList.add('ativo');
        document.querySelector('#label-retirada .radio-customizado').classList.add('marcado');
        areaEndereco.style.display = 'none';
        document.getElementById('cliente-bairro').value = "Retirada no Local";
    }
    atualizarTotalCheckout();
}

function selecionarPagamento(elemento, forma) {
    document.querySelectorAll('input[name="forma_pag"]').forEach(radio => radio.checked = false);
    elemento.querySelector('input').checked = true;
    
    document.querySelectorAll('#checkout-passo-2 .card-selecao').forEach(card => {
        card.classList.remove('ativo');
        card.querySelector('.radio-customizado').classList.remove('marcado');
    });
    
    elemento.classList.add('ativo');
    elemento.querySelector('.radio-customizado').classList.add('marcado');

    const areaTroco = document.getElementById('area-troco');
    if (forma === 'Dinheiro') {
        areaTroco.style.display = 'block';
    } else {
        areaTroco.style.display = 'none';
        document.getElementById('cliente-troco').value = '';
    }
}

function validarPasso1() {
    const nome = document.getElementById('cliente-nome').value.trim();
    const tel = document.getElementById('cliente-telefone').value.trim();
    const tipo = document.querySelector('input[name="tipo_entrega"]:checked').value;
    
    if (!nome || !tel) return "Preencha seu Nome e WhatsApp.";
    
    if (tipo === 'delivery') {
        // 🛑 A NOVA TRAVA DE PEDIDO MÍNIMO ACONTECE AQUI!
        let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
        if (pedidoMinimoDeliveryGlobal > 0 && subtotal < pedidoMinimoDeliveryGlobal) {
            return `O valor mínimo para Delivery é R$ ${pedidoMinimoDeliveryGlobal.toFixed(2).replace('.', ',')}.\nSeu subtotal é R$ ${subtotal.toFixed(2).replace('.', ',')}.\n\nAdicione mais itens ou altere para "Retirada na Loja".`;
        }

        const bairro = document.getElementById('cliente-bairro').value;
        const rua = document.getElementById('cliente-rua').value.trim();
        const numero = document.getElementById('cliente-numero').value.trim();
        if (!bairro || !rua || !numero) return "Preencha Bairro, Rua e Número para a entrega.";
    }
    return null;
}

function validarPasso2() {
    const pag = document.querySelector('input[name="forma_pag"]:checked');
    if (!pag) return "Selecione uma forma de pagamento.";
    return null;
}

function construirResumoPasso3() {
    const nome = document.getElementById('cliente-nome').value.trim();
    // 🚀 Passando pelo Padronizador
    const tel = padronizarTelefone(document.getElementById('cliente-telefone').value.trim());
    const tipo = document.querySelector('input[name="tipo_entrega"]:checked').value;
    const pag = document.querySelector('input[name="forma_pag"]:checked').value;
    
    document.getElementById('resumo-identificacao').innerHTML = `<strong>👤 Nome:</strong> ${nome}<br><strong>📱 Tel:</strong> ${tel}`;
    
    if (tipo === 'delivery') {
        const bairro = document.getElementById('cliente-bairro').value;
        const rua = document.getElementById('cliente-rua').value.trim();
        const num = document.getElementById('cliente-numero').value.trim();
        const comp = document.getElementById('cliente-complemento').value.trim();
        const textoComp = comp ? ` - ${comp}` : '';
        document.getElementById('resumo-endereco').innerHTML = `<strong>🛵 Entrega em:</strong><br>${rua}, ${num}${textoComp}<br>${bairro}`;
    } else {
        document.getElementById('resumo-endereco').innerHTML = `<strong>🏬 Retirada na Loja</strong>`;
    }

    let textoPagamento = `💳 ${pag}`;
    if (pag === 'Dinheiro') {
        const troco = document.getElementById('cliente-troco').value.trim();
        textoPagamento += troco ? ` (Troco para ${troco})` : ` (Sem troco)`;
    }
    document.getElementById('resumo-pagamento').innerText = textoPagamento;
}

function avancarPassoCheckout() {
    if (passoCheckoutAtual === 1) {
        const erro = validarPasso1();
        if (erro) return alert("⚠️ " + erro);
        irParaPasso(2);
    } 
    else if (passoCheckoutAtual === 2) {
        const erro = validarPasso2();
        if (erro) return alert("⚠️ " + erro);
        construirResumoPasso3();
        atualizarTotalCheckout(); 
        irParaPasso(3);
    }
    else if (passoCheckoutAtual === 3) {
        processarEnvioWhatsApp();
    }
}

function voltarPassoCheckout() {
    if (passoCheckoutAtual > 1) {
        irParaPasso(passoCheckoutAtual - 1);
    }
}

function irParaPasso(passo) {
    passoCheckoutAtual = passo;
    
    document.querySelectorAll('.checkout-passo').forEach(el => el.classList.remove('ativo'));
    document.getElementById(`checkout-passo-${passo}`).classList.add('ativo');

    for (let i = 1; i <= 3; i++) {
        const indicador = document.getElementById(`ind-passo-${i}`);
        indicador.className = 'progresso-passo'; 
        if (i < passo) indicador.classList.add('concluido');
        else if (i === passo) indicador.classList.add('ativo');
    }

    const btnAvancar = document.getElementById('btn-avancar-checkout');
    const btnVoltar = document.getElementById('btn-voltar-topo');
    
    if (passo === 1) {
        btnVoltar.style.display = 'none';
        btnAvancar.innerText = 'Continuar para Pagamento';
        btnAvancar.style.background = '#333';
    } else if (passo === 2) {
        btnVoltar.style.display = 'block';
        btnAvancar.innerText = 'Revisar Pedido';
        btnAvancar.style.background = '#333';
    } else if (passo === 3) {
        btnVoltar.style.display = 'block';
        btnAvancar.innerText = 'Enviar Pedido 🚀';
        btnAvancar.style.background = '#25D366'; 
    }
}

function atualizarTotalCheckout() {
    let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
    const subtotalDisplay = document.getElementById('subtotal-display');
    if (subtotalDisplay) subtotalDisplay.innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    
    const tipoEntregaChecked = document.querySelector('input[name="tipo_entrega"]:checked');
    const tipoEntrega = tipoEntregaChecked ? tipoEntregaChecked.value : 'delivery';
    let taxaEntrega = 0;
    
    const taxaDisplay = document.getElementById('taxa-entrega-display');
    if (tipoEntrega === 'delivery') {
        const selectBairro = document.getElementById('cliente-bairro');
        if (selectBairro && selectBairro.value && selectBairro.value !== "Retirada no Local") {
            const opcaoSelecionada = selectBairro.options[selectBairro.selectedIndex];
            taxaEntrega = Number(opcaoSelecionada.getAttribute('data-taxa')) || 0;
            if (taxaDisplay) {
                taxaDisplay.innerText = `R$ ${taxaEntrega.toFixed(2).replace('.', ',')}`;
                taxaDisplay.style.color = "#666";
            }
        } else {
            if (taxaDisplay) taxaDisplay.innerText = `Selecione o bairro`;
        }
    } else {
        if (taxaDisplay) {
            taxaDisplay.innerText = `Grátis`;
            taxaDisplay.style.color = "#25D366";
        }
    }

    let desconto = 0;
    const linhaDesconto = document.getElementById('desconto-display-linha');
    const valorDesconto = document.getElementById('desconto-display-valor');

    if (cupomAtivo) {
        // 🛡️ TRAVA DE MATEMÁTICA: Força a ser número
        let valorCupomNum = Number(cupomAtivo.valor) || 0;
        
        if (cupomAtivo.tipo === 'porcentagem') {
            desconto = subtotal * (valorCupomNum / 100);
        } else {
            desconto = valorCupomNum;
        }
        
        if (linhaDesconto) linhaDesconto.style.display = 'flex';
        if (valorDesconto) valorDesconto.innerText = `- R$ ${desconto.toFixed(2).replace('.', ',')}`;
    } else {
        if (linhaDesconto) linhaDesconto.style.display = 'none';
    }

    let totalFinal = (subtotal - desconto) + taxaEntrega;
    if (totalFinal < 0) totalFinal = 0; 
    
    const totalDisplay = document.getElementById('total-checkout-display');
    if (totalDisplay) totalDisplay.innerText = `R$ ${totalFinal.toFixed(2).replace('.', ',')}`;
}

async function salvarVendaDelivery() {
    let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
    let desconto = 0;
    
    if (cupomAtivo) {
        // 🛡️ TRAVA DE MATEMÁTICA AQUI TAMBÉM
        let valorCupomNum = Number(cupomAtivo.valor) || 0;
        desconto = cupomAtivo.tipo === 'porcentagem' ? subtotal * (valorCupomNum / 100) : valorCupomNum;
    }
    
    const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked').value;
    let taxaEntrega = 0;
    let endereco = "Retirada na Loja";
    
    if(tipoEntrega === 'delivery') {
        const selectBairro = document.getElementById('cliente-bairro');
        const opcaoSelecionada = selectBairro.options[selectBairro.selectedIndex];
        taxaEntrega = Number(opcaoSelecionada.getAttribute('data-taxa')) || 0;
        
        const bairro = selectBairro.value;
        const rua = document.getElementById('cliente-rua').value.trim();
        const num = document.getElementById('cliente-numero').value.trim();
        const comp = document.getElementById('cliente-complemento').value.trim();
        endereco = `${rua}, ${num} ${comp ? '- ' + comp : ''} - ${bairro}`;
    }

    let totalFinal = (subtotal - desconto) + taxaEntrega;
    if (totalFinal < 0) totalFinal = 0;

    let pagamento = document.querySelector('input[name="forma_pag"]:checked').value;
    if (pagamento === 'Dinheiro') {
        const troco = document.getElementById('cliente-troco').value.trim();
        if (troco) pagamento += ` (Troco para ${troco})`;
    }

    const nome = document.getElementById('cliente-nome').value.trim();
    // 🚀 Salvando no Banco de Dados perfeitamente padronizado
    const telefone = padronizarTelefone(document.getElementById('cliente-telefone').value.trim());
    const observacao = document.getElementById('cliente-observacao').value.trim();

    const itensFormatados = carrinho.map(item => ({ nome: "Delivery: " + item.nome, preco: item.preco }));
    
    try {
        const res = await fetch(`${API_URL}/vendas`, {
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
                cliente_endereco: endereco,
                origem: tipoEntrega === 'delivery' ? "Delivery" : "Balcão (App)",
                observacoes: observacao
            })
        });

        if (!res.ok) console.log("Aviso: Falha ao registrar na nuvem, mas seguirá pro WhatsApp.");
    } catch (e) { 
        console.log("Aviso: Falha de rede ao registrar, mas seguirá pro WhatsApp.");
    }
}

// ==========================================
// 📲 ENVIO PARA O WHATSAPP E RASTREIO
// ==========================================
let rastreioIntervalo = null;
let rastreioPedidoId = null;
let rastreioTelefoneCliente = "";

async function processarEnvioWhatsApp() {
    const nome = document.getElementById('cliente-nome').value.trim();
    // 🚀 Passando para o Rastreio/WhatsApp padronizado
    rastreioTelefoneCliente = padronizarTelefone(document.getElementById('cliente-telefone').value.trim());
    const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked').value;
    const pagamento = document.querySelector('input[name="forma_pag"]:checked').value;
    
    let enderecoFormatado = "🏬 *Retirada na Loja*";
    let taxaEntrega = 0;
    
    if (tipoEntrega === 'delivery') {
        const selectBairro = document.getElementById('cliente-bairro');
        const bairro = selectBairro.value;
        const rua = document.getElementById('cliente-rua').value.trim();
        const num = document.getElementById('cliente-numero').value.trim();
        const comp = document.getElementById('cliente-complemento').value.trim();
        
        taxaEntrega = Number(selectBairro.options[selectBairro.selectedIndex].getAttribute('data-taxa')) || 0;
        enderecoFormatado = `📍 *Endereço:* ${rua}, ${num} ${comp ? '- ' + comp : ''} - ${bairro}`;
    }

    await salvarVendaDelivery(); 

    let textoPedido = `🍦 *NOVO PEDIDO - ICESOFT* 🍦\n\n`;
    textoPedido += `👤 *Cliente:* ${nome}\n`;
    textoPedido += `📱 *WhatsApp:* ${rastreioTelefoneCliente}\n`;
    textoPedido += `${enderecoFormatado}\n`;
    
    let txtPagamento = `💳 *Pagamento:* ${pagamento}`;
    if (pagamento === 'Dinheiro') {
        const troco = document.getElementById('cliente-troco').value.trim();
        txtPagamento += troco ? ` (Troco para ${troco})` : ` (Sem troco)`;
    }
    textoPedido += `${txtPagamento}\n\n`;

    const observacao = document.getElementById('cliente-observacao').value.trim();
    if (observacao) textoPedido += `📝 *Observações:* ${observacao}\n\n`;

    textoPedido += `📦 *Itens do Pedido:*\n`;
    let subtotal = 0;
    carrinho.forEach(item => { 
        textoPedido += `▪️ 1x ${item.nome} - R$ ${Number(item.preco).toFixed(2).replace('.', ',')}\n`; 
        subtotal += Number(item.preco); 
    });
    
    if (tipoEntrega === 'delivery') {
        textoPedido += `\n🛵 *Taxa de Entrega:* R$ ${taxaEntrega.toFixed(2).replace('.', ',')}`;
    }

    let totalFinal = subtotal + taxaEntrega;

    if (cupomAtivo) {
        // 🛡️ TRAVA DE MATEMÁTICA FINAL
        let valorCupomNum = Number(cupomAtivo.valor) || 0;
        let desconto = cupomAtivo.tipo === 'porcentagem' ? subtotal * (valorCupomNum / 100) : valorCupomNum;
        
        textoPedido += `\n🏷️ *Cupom (*${cupomAtivo.codigo}*):* - R$ ${desconto.toFixed(2).replace('.', ',')}`;
        totalFinal = totalFinal - desconto;
        if (totalFinal < 0) totalFinal = 0; // Se o cupom for maior que a compra, não fica negativo!
        
        // Agora sim o gatilho vai disparar!
        await registrarUsoCupomNaNuvem(cupomAtivo.codigo, totalFinal);
    }
    
    
    textoPedido += `\n💰 *Total Final: R$ ${totalFinal.toFixed(2).replace('.', ',')}*`;

    window.open(`https://api.whatsapp.com/send?phone=5524992308585&text=${encodeURIComponent(textoPedido)}`, '_blank');
    
    carrinho = []; 
    atualizarBarraCarrinho(); 
    fecharModalCheckout();
    
    abrirTelaRastreio();
}

// ==========================================
// 📡 RADAR DE RASTREIO E FIDELIDADE
// ==========================================
async function abrirTelaRastreio() {
    document.getElementById('modal-rastreio').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    try {
        // Puxa as vendas para achar o ID exato desse pedido recém-criado e contar a fidelidade
        const res = await fetch(`${API_URL}/vendas`);
        const vendas = await res.json();
        
        // Filtra pelo telefone do cliente atual
        const comprasDesteCliente = vendas.filter(v => v.cliente_telefone === rastreioTelefoneCliente);
        
        if (comprasDesteCliente.length > 0) {
            // O pedido mais recente é o de maior ID
            const ultimoPedido = comprasDesteCliente.reduce((max, p) => p.id > max.id ? p : max, comprasDesteCliente[0]);
            rastreioPedidoId = ultimoPedido.id;
            
            // Atualiza a bolha do CRM Fidelidade
            document.getElementById('rastreio-fidelidade-qtd').innerText = comprasDesteCliente.length;
            
            // Atualiza a cor visual na tela
            atualizarStatusVisualRastreio(ultimoPedido.status);
            
            // Liga o radar (Busca no servidor a cada 10 segundos)
            if(rastreioIntervalo) clearInterval(rastreioIntervalo);
            rastreioIntervalo = setInterval(buscarStatusAtualizado, 10000);
        }
    } catch (e) {
        console.log("Erro ao iniciar o radar de rastreio.", e);
    }
}

async function buscarStatusAtualizado() {
    if (!rastreioPedidoId) return;
    try {
        const res = await fetch(`${API_URL}/vendas`);
        const vendas = await res.json();
        const pedidoVigiado = vendas.find(v => v.id === rastreioPedidoId);
        
        if (pedidoVigiado) {
            atualizarStatusVisualRastreio(pedidoVigiado.status);
        }
    } catch(e) {}
}

function atualizarStatusVisualRastreio(statusKanban) {
    const passos = ['step-pendente', 'step-preparando', 'step-entrega', 'step-entregue'];
    
    // Zera tudo
    passos.forEach(p => document.getElementById(p).classList.remove('ativo', 'concluido'));

    let nivelAtivo = 0;
    const statusLimpo = statusKanban ? statusKanban.trim() : '';

    if (statusLimpo === 'Pendente Delivery') nivelAtivo = 0;
    else if (statusLimpo === 'A Preparar') nivelAtivo = 1;
    else if (statusLimpo === 'Saiu p/ Entrega') nivelAtivo = 2;
    else if (statusLimpo === 'Entregue') nivelAtivo = 3;
    else if (statusLimpo === 'Cancelado') {
        document.getElementById('step-pendente').innerHTML = '<div class="icon-rastreio" style="background:#f44336; color:white;">❌</div><div class="text-rastreio" style="color:#f44336;">Pedido Cancelado</div>';
        document.getElementById('step-pendente').classList.add('ativo');
        if(rastreioIntervalo) clearInterval(rastreioIntervalo);
        return;
    }

    // Pinta de verde (concluído) tudo o que ficou para trás
    for (let i = 0; i < nivelAtivo; i++) {
        document.getElementById(passos[i]).classList.add('concluido');
    }
    
    // Pinta de laranja piscante o passo atual
    document.getElementById(passos[nivelAtivo]).classList.add('ativo');
    
    // Se foi entregue, desliga o radar para economizar internet do cliente
    if (nivelAtivo === 3 && rastreioIntervalo) {
        clearInterval(rastreioIntervalo);
    }
}

function fecharTelaRastreio() {
    document.getElementById('modal-rastreio').style.display = 'none';
    document.body.style.overflow = 'auto';
    if(rastreioIntervalo) clearInterval(rastreioIntervalo);
}

async function carregarConfiguracoesLoja() {
    try {
        const res = await fetch(`${API_URL}/configuracoes`);
        const configs = await res.json();
        
        if (configs.cor_primaria) document.documentElement.style.setProperty('--cor-primaria', configs.cor_primaria);
        if (configs.nome_loja && document.getElementById('loja-nome-exibicao')) document.getElementById('loja-nome-exibicao').innerText = `${configs.nome_loja}`;
        if (configs.mensagem_boas_vindas && document.getElementById('loja-mensagem-exibicao')) document.getElementById('loja-mensagem-exibicao').innerText = configs.mensagem_boas_vindas;
        if (configs.carrossel_destaques) { try { idsDestaquesGlobais = JSON.parse(configs.carrossel_destaques); } catch(e) {} }
        if (configs.upsell_desconto) descontoUpsellGlobal = Number(configs.upsell_desconto);
        if (configs.carrossel_upsell) { try { idsUpsellGlobais = JSON.parse(configs.carrossel_upsell); } catch(e) {} }
        if (configs.cupons_delivery) { try { cuponsGlobais = JSON.parse(configs.cupons_delivery); } catch(e) {} }
        if (configs.banner_loja && document.getElementById('img-banner-loja')) document.getElementById('img-banner-loja').src = configs.banner_loja;
        if (configs.logo_loja && document.getElementById('img-logo-loja')) document.getElementById('img-logo-loja').src = configs.logo_loja;
        if (configs.pedido_minimo_delivery) pedidoMinimoDeliveryGlobal = parseFloat(configs.pedido_minimo_delivery) || 0;

        if (configs.endereco_loja) {
            document.getElementById('loja-endereco-texto').innerText = configs.endereco_loja;
            document.getElementById('modal-endereco-texto').innerText = configs.endereco_loja;
        }
        if (configs.horarios_loja) document.getElementById('modal-horarios-texto').innerText = configs.horarios_loja;
        if (configs.pagamentos_loja) document.getElementById('modal-pagamentos-texto').innerText = configs.pagamentos_loja;

        const status = configs.status_delivery || 'aberto';
        const statusText = document.getElementById('loja-status-exibicao');
        
        if (status === 'fechado') {
            lojaAberta = false;
            let textoAbertura = "em breve";
            
            try {
                const horarios = JSON.parse(configs.horarios_funcionamento_auto);
                const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
                const hoje = new Date();
                const diaAtual = hoje.getDay(); 
                const horaAtual = hoje.getHours() * 60 + hoje.getMinutes();

                if (horarios[diaAtual] && horarios[diaAtual].ativo && horarios[diaAtual].abre) {
                    const [h, m] = horarios[diaAtual].abre.split(':').map(Number);
                    if (horaAtual < (h * 60 + m)) textoAbertura = `hoje às ${horarios[diaAtual].abre}`;
                }
                
                if (textoAbertura === "em breve") {
                    for (let i = 1; i <= 6; i++) {
                        let proximoDia = (diaAtual + i) % 7;
                        if (horarios[proximoDia] && horarios[proximoDia].ativo) {
                            const nomeDia = (i === 1) ? "Amanhã" : diasSemana[proximoDia];
                            textoAbertura = `${nomeDia} às ${horarios[proximoDia].abre}`;
                            break;
                        }
                    }
                }
            } catch(e) {}

            statusText.innerText = `● Estamos fechados no momento, abre ${textoAbertura}`;
            statusText.style.color = "#f44336"; 
            
            const telaPreta = document.getElementById('overlay-loja-fechada');
            if (telaPreta) telaPreta.style.display = 'none';

        } else {
            lojaAberta = true;
            statusText.innerText = "● Recebendo pedidos";
            statusText.style.color = "#25D366"; 
        }

    } catch (e) { console.error("Erro configurações:", e); }
}

function renderizarCarrossel(produtos) {
    const secao = document.getElementById('secao-destaques');
    const carrossel = document.getElementById('carrossel-produtos');
    if (!secao || !carrossel) return;

    const produtosDestaque = produtos.filter(p => idsDestaquesGlobais.includes(Number(p.id)) && p.ativo !== false);

    if (produtosDestaque.length === 0) return secao.style.display = 'none';

    secao.style.display = 'block'; 
    carrossel.innerHTML = '';
    
    produtosDestaque.forEach(p => {
        const visualProduto = p.imagem_url 
            ? `<img src="${p.imagem_url}" loading="lazy" style="width: 100%; height: 110px; object-fit: cover; border-radius: 10px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`
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
    if (!area || !carrossel) return;

    const produtosUpsell = produtosDaNuvem.filter(p => idsUpsellGlobais.includes(Number(p.id)) && p.ativo !== false);

    if (produtosUpsell.length === 0 || descontoUpsellGlobal <= 0) return area.style.display = 'none';

    area.style.display = 'block';
    carrossel.innerHTML = '';

    produtosUpsell.forEach(p => {
        const precoNormal = Number(p.preco);
        const descontoReais = precoNormal * (descontoUpsellGlobal / 100);
        const precoComDesconto = precoNormal - descontoReais;
        const nomeLimpo = p.nome.replace(/'/g, "\\'"); 

        const visualProduto = p.imagem_url 
            ? `<img src="${p.imagem_url}" loading="lazy" style="width: 100%; height: 75px; object-fit: cover; border-radius: 6px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">`
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

// ==========================================
// 🛑 SISTEMA DE TRAVA: A CORTINA DE FERRO
// ==========================================
async function verificarStatusLoja() {
    try {
        const res = await fetch(`${API_URL}/status`);
        const data = await res.json();

        const statusAtual = data.status ? data.status.toLowerCase().trim() : '';

        if (statusAtual === 'fechado') {
            let cortina = document.getElementById('cortina-loja-fechada');
            if (!cortina) {
                cortina = document.createElement('div');
                cortina.id = 'cortina-loja-fechada';
                cortina.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 99999; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; text-align: center; padding: 20px; box-sizing: border-box; backdrop-filter: blur(5px);";
                cortina.innerHTML = `
                    <h1 style="font-size: 4rem; margin: 0;">😴</h1>
                    <h2 style="margin: 10px 0; color: #ffeb3b; font-family: 'Inter', sans-serif;">Poxa, estamos fechados!</h2>
                    <p style="font-size: 1.1rem; max-width: 400px; font-family: 'Inter', sans-serif; color: #ccc;">Nossa loja não está recebendo pedidos no momento. Volte mais tarde!</p>
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
        console.log("Servidor dormindo ou internet oscilou. Tentando de novo na próxima rodada silenciosamente...");
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    await carregarConfiguracoesLoja(); 
    await carregarTudo(); 
    verificarStatusLoja(); 
    setTimeout(() => {
        const telaLoading = document.getElementById('tela-carregamento');
        if (telaLoading) {
            telaLoading.style.opacity = '0'; 
            setTimeout(() => telaLoading.style.display = 'none', 400); 
        }
    }, 500); 

    setInterval(verificarStatusLoja, 30000);
});

// ==========================================
// 🎨 DESENHA O MENU DE CATEGORIAS DINÂMICO
// ==========================================
function renderizarMenuCategorias(lista) {
    const container = document.getElementById('menu-categorias-dinamico');
    if (!container) return;

    const categoriasOrdenadas = obterOrdemDasCategorias(lista);
    let html = '';

    categoriasOrdenadas.forEach(catNome => {
        const temProduto = lista.some(p => (p.categoria && p.categoria !== 'null' ? p.categoria : 'Diversos') === catNome);
        if (temProduto) {
            html += `
            <div onclick="rolarParaCategoria('${catNome.replace(/'/g, "\\'")}')" style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; background: #ffffff; padding: 10px 20px; border-radius: 50px; border: 1px solid #e4e6eb; box-shadow: 0 4px 6px rgba(0,0,0,0.04); color: #333; font-family: 'Poppins', sans-serif; font-weight: bold; font-size: 0.95rem; transition: 0.2s;">
                ${catNome}
            </div>`;
        }
    });

    container.innerHTML = html;
}

window.rolarParaCategoria = function(nomeCategoria) {
    const titulos = document.querySelectorAll('#lista-produtos h2, #lista-produtos h3');
    
    for (let titulo of titulos) {
        if (titulo.innerText.trim().includes(nomeCategoria.trim()) || nomeCategoria.trim().includes(titulo.innerText.trim())) {
            const posicaoY = titulo.getBoundingClientRect().top + window.scrollY - 80; 
            window.scrollTo({ top: posicaoY, behavior: 'smooth' });
            break; 
        }
    }
};

// ==========================================
// 🔍 SISTEMA DE BUSCA EM TEMPO REAL
// ==========================================
const inputBusca = document.getElementById('busca-produtos');

if (inputBusca) {
    inputBusca.addEventListener('input', function() {
        const termo = this.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const produtosFiltrados = produtosDaNuvem.filter(p => {
            const nome = p.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const descricao = p.descricao && p.descricao !== 'null' ? p.descricao.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
            
            return nome.includes(termo) || descricao.includes(termo);
        });

        renderizarCardapio(produtosFiltrados);
    });
}

// ==========================================
// 👆 GESTO DE DESLIZAR PARA FECHAR (SWIPE TO CLOSE)
// ==========================================
function aplicarGestoSwipe() {
    const areaArraste = document.getElementById('area-arraste');
    const modalBox = document.querySelector('#modal-opcoes > div'); 
    
    if (!areaArraste || !modalBox) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const novaArea = areaArraste.cloneNode(true);
    areaArraste.parentNode.replaceChild(novaArea, areaArraste);

    novaArea.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        isDragging = true;
        modalBox.style.transition = 'none'; 
    }, { passive: true });

    novaArea.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        const diferenca = currentY - startY;

        if (diferenca > 0) {
            modalBox.style.transform = `translateY(${diferenca}px)`;
        }
    }, { passive: true });

    novaArea.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const diferenca = currentY - startY;

        modalBox.style.transition = 'transform 0.3s ease-out';

        if (diferenca > 100) {
            fecharModalOpcoes();
            setTimeout(() => { modalBox.style.transform = 'translateY(0)'; }, 300);
        } else {
            modalBox.style.transform = 'translateY(0)';
        }
    });
}

// ==========================================
// MODAL DE INFORMAÇÕES DA LOJA
// ==========================================
function abrirModalInfoLoja() {
    document.getElementById('modal-info-loja').style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
}

function fecharModalInfoLoja() {
    document.getElementById('modal-info-loja').style.display = 'none';
    document.body.style.overflow = 'auto'; 
}

// ==========================================
// 🛡️ CRM INTELIGENTE: MÁSCARA E AUTOPREENCHIMENTO
// ==========================================
const inputTelefone = document.getElementById('cliente-telefone');
if(inputTelefone) {
    inputTelefone.addEventListener('input', function (e) {
        // 1. Aplica a Máscara Visual (XX) XXXXX-XXXX
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
        e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');

        // 2. O Gatilho: Se o número estiver completinho (15 caracteres)
        if (e.target.value.length === 15) {
            buscarDadosClienteCRM(e.target.value);
        } else {
                // Se ele apagar um número, esconde o selo CRM e a Barrinha Fidelidade
                if (document.getElementById('badge-crm')) document.getElementById('badge-crm').style.display = 'none';
                
                const areaFid = document.getElementById('area-fidelidade-checkout');
                if (areaFid) areaFid.style.display = 'none';
            }
    });
}

function padronizarTelefone(numeroBruto) {
    let limpo = numeroBruto.replace(/\D/g, ''); 
    if (limpo.startsWith('55') && limpo.length > 11) limpo = limpo.substring(2); 
    
    if (limpo.length === 11) {
        return `(${limpo.substring(0,2)}) ${limpo.substring(2,7)}-${limpo.substring(7,11)}`;
    } else if (limpo.length === 10) {
        return `(${limpo.substring(0,2)}) ${limpo.substring(2,6)}-${limpo.substring(6,10)}`;
    }
    return numeroBruto; 
}

// 3. A Mágica de Puxar a Ficha do Cliente
async function buscarDadosClienteCRM(telefoneFormatado) {
    const badge = document.getElementById('badge-crm');
    
    try {
        if(badge) {
            badge.innerText = '⏳ Buscando...';
            badge.style.background = '#FF9800';
            badge.style.boxShadow = 'none';
            badge.style.display = 'block';
        }

        const res = await fetch(`${API_URL}/vendas`);
        const vendas = await res.json();
        
        // Acha o histórico do cliente pelo WhatsApp
        const compras = vendas.filter(v => v.cliente_telefone === telefoneFormatado);
        
        if (compras.length > 0) {
            // Filtra pedidos cancelados para não dar pontos indevidos
            const comprasValidas = compras.filter(c => c.status !== 'Cancelado');
            
            // Pega o pedido mais recente dele
            const ultimoPedido = compras.reduce((max, p) => p.id > max.id ? p : max, compras[0]);
            
            // 🎯 Preenche o NOME
            if (ultimoPedido.cliente_nome) {
                document.getElementById('cliente-nome').value = ultimoPedido.cliente_nome;
            }

            // 🎯 Preenche o ENDEREÇO
            const endereco = ultimoPedido.cliente_endereco;
            if (endereco && !endereco.includes("Retirada")) {
                document.querySelector('input[name="tipo_entrega"][value="delivery"]').checked = true;
                mudarTipoEntrega();

                let partes = endereco.split(' - ');
                let bairroSalvo = partes.pop().trim(); 
                
                const selectBairro = document.getElementById('cliente-bairro');
                let optionBairro = Array.from(selectBairro.options).find(opt => opt.value === bairroSalvo);
                if(optionBairro) {
                    selectBairro.value = bairroSalvo;
                    atualizarTotalCheckout(); 
                }

                if (partes.length > 0) {
                    let ruaNum = partes[0].split(',');
                    document.getElementById('cliente-rua').value = ruaNum[0] ? ruaNum[0].trim() : '';
                    document.getElementById('cliente-numero').value = ruaNum[1] ? ruaNum[1].trim() : '';
                    let complemento = partes.length > 1 ? partes.slice(1).join(' - ').trim() : '';
                    document.getElementById('cliente-complemento').value = complemento;
                }
            }

            if(badge) {
                badge.innerText = '✅ Cliente Encontrado';
                badge.style.background = '#25D366';
                badge.style.boxShadow = '0 2px 5px rgba(37, 211, 102, 0.3)';
            }
            
            // 🚀 CHAMA A BARRINHA DE FIDELIDADE COM OS PONTOS ATUAIS
            ativarBarrinhaFidelidade(comprasValidas.length);

        } else {
            // Cliente novo, nunca comprou
            if(badge) badge.style.display = 'none'; 
            
            // 🚀 CHAMA A BARRINHA ZERADA PARA INCENTIVAR A PRIMEIRA COMPRA
            ativarBarrinhaFidelidade(0);
        }

    } catch (e) {
        console.log("Falha ao buscar CRM invisível:", e);
        if(badge) badge.style.display = 'none';
    }
}

// ==========================================
// 🛒 VISUALIZAÇÃO DO CARRINHO (PRÉ-CHECKOUT)
// ==========================================
function abrirModalCarrinho() {
    // 🔒 TRAVA DE SEGURANÇA
    if (!isLojaAbertaGlobal) {
        alert(`⚠️ ${mensagemFechadaGlobal}`);
        return;
    }
    
    if (carrinho.length === 0) {
        alert("Seu carrinho está vazio! Adicione algumas delícias primeiro.");
        return;
    }
    
    renderizarListaCarrinhoCliente();
    document.getElementById('modal-carrinho-cliente').style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
}

function fecharModalCarrinho() {
    document.getElementById('modal-carrinho-cliente').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function renderizarListaCarrinhoCliente() {
    const container = document.getElementById('lista-itens-carrinho-cliente');
    container.innerHTML = '';
    
    let subtotal = 0;
    
    carrinho.forEach((item, index) => {
        subtotal += Number(item.preco);
        
        let desc = '';
        // Tratamento inteligente para separar o nome base dos adicionais na tela
        if (item.nome.includes('(')) {
            const partes = item.nome.split('(');
            const nomePrincipal = partes[0].trim();
            const adicionais = '(' + partes.slice(1).join('(');
            desc = `
                <div style="font-weight: 700; color: #333; font-size: 1.05rem;">1x ${nomePrincipal.replace('Delivery: ', '')}</div>
                <div style="color: #777; font-size: 0.85rem; margin-top: 4px; line-height: 1.3;">${adicionais}</div>
            `;
        } else {
            desc = `<div style="font-weight: 700; color: #333; font-size: 1.05rem;">1x ${item.nome.replace('Delivery: ', '')}</div>`;
        }

        container.innerHTML += `
            <div class="item-carrinho-cliente">
                <div style="flex: 1; padding-right: 15px;">
                    ${desc}
                    <div style="color: var(--cor-primaria, #e91e63); font-weight: 800; margin-top: 6px; font-size: 1.1rem;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
                </div>
                <button onclick="removerItemCarrinhoCliente(${index})" class="btn-remover-item" title="Remover item">🗑️</button>
            </div>
        `;
    });
    
    document.getElementById('subtotal-carrinho-cliente').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    
    if (carrinho.length === 0) {
        fecharModalCarrinho();
        if (typeof atualizarBarraCarrinho === "function") atualizarBarraCarrinho();
    }
}

function removerItemCarrinhoCliente(index) {
    carrinho.splice(index, 1);
    renderizarListaCarrinhoCliente();
    if (typeof atualizarBarraCarrinho === "function") atualizarBarraCarrinho();
}

function irParaCheckout() {
    fecharModalCarrinho();
    finalizarPedidoWhatsApp(); // Avança para a tela do formulário e pagamento
}

// ==========================================
// 🕒 INTELIGÊNCIA DE HORÁRIOS E TRAVAS
// ==========================================
let isLojaAbertaGlobal = true;
let mensagemFechadaGlobal = "Estamos fechados no momento.";

// Inicia a vigilância assim que o cardápio carrega
setTimeout(iniciarVerificacaoHorario, 500);

async function iniciarVerificacaoHorario() {
    await verificarSeLojaEstaAberta();
    // O sistema fica checando silenciosamente a cada 1 minuto (60000 ms)
    setInterval(verificarSeLojaEstaAberta, 60000); 
}

async function verificarSeLojaEstaAberta() {
    try {
        const [resStatus, resConfig] = await Promise.all([
            fetch(`${API_URL}/loja/status`),
            fetch(`${API_URL}/configuracoes`)
        ]);
        
        const statusData = await resStatus.json();
        const configData = await resConfig.json();
        
        // 1. CHECA A TRAVA MANUAL DE EMERGÊNCIA (Botão do PDV)
        if (statusData.status === 'fechado') {
            bloquearLoja("Pausamos os pedidos momentaneamente. Voltamos em breve!");
            return;
        }

        // 2. CHECA A ESCALA AUTOMÁTICA
        if (!configData.horarios_funcionamento_auto) {
            liberarLoja(); 
            return;
        }

        const horarios = JSON.parse(configData.horarios_funcionamento_auto);
        const agora = new Date();
        const diaHoje = agora.getDay(); // Retorna 0 (Dom) a 6 (Sáb)
        const configHoje = horarios[diaHoje];

        // Se o checkbox do dia estiver desmarcado
        if (!configHoje || !configHoje.ativo) {
            bloquearLoja("Estamos fechados hoje! Voltamos no nosso próximo dia de funcionamento.");
            return;
        }

        // Converte as horas para "minutos desde a meia-noite" para a matemática funcionar
        const horaAtual = agora.getHours() * 60 + agora.getMinutes();
        const [hAbre, mAbre] = configHoje.abre.split(':').map(Number);
        const [hFecha, mFecha] = configHoje.fecha.split(':').map(Number);
        
        const minutosAbre = hAbre * 60 + mAbre;
        const minutosFecha = hFecha * 60 + mFecha;

        let abertoAgora = false;

        if (minutosFecha < minutosAbre) {
            // Lógica para lojas que viram a madrugada (Ex: 18:00 às 02:00)
            if (horaAtual >= minutosAbre || horaAtual <= minutosFecha) {
                abertoAgora = true;
            }
        } else {
            // Horário normal (Ex: 14:00 às 22:00)
            if (horaAtual >= minutosAbre && horaAtual <= minutosFecha) {
                abertoAgora = true;
            }
        }

        if (abertoAgora) {
            liberarLoja();
        } else {
            bloquearLoja(`Estamos fechados! Nosso horário hoje é das ${configHoje.abre} às ${configHoje.fecha}.`);
        }

    } catch(e) {
        console.log("Falha ao verificar horário, mantendo aberto por segurança:", e);
    }
}

function bloquearLoja(mensagem) {
    isLojaAbertaGlobal = false;
    mensagemFechadaGlobal = mensagem;
    
    // Mostra o Banner Vermelho
    const banner = document.getElementById('banner-loja-fechada');
    const texto = document.getElementById('texto-loja-fechada');
    if(banner && texto) {
        texto.innerText = mensagem;
        banner.style.display = 'block';
    }

    // Muda o textinho debaixo do nome da loja para Fechado
    const indicador = document.getElementById('indicador-status-loja');
    if (indicador) {
        indicador.innerHTML = '🔴 Fechado no momento';
        indicador.style.color = '#f44336';
    }
}

function liberarLoja() {
    isLojaAbertaGlobal = true;
    
    // Esconde o Banner Vermelho
    const banner = document.getElementById('banner-loja-fechada');
    if(banner) banner.style.display = 'none';

    // Volta o textinho para Recebendo Pedidos
    const indicador = document.getElementById('indicador-status-loja');
    if (indicador) {
        indicador.innerHTML = '🟢 Recebendo pedidos';
        indicador.style.color = '#25D366';
    }
}

// ==========================================
// 🎟️ MÁQUINA DE CUPONS (GRAVAR USO E RENDA)
// ==========================================
async function registrarUsoCupomNaNuvem(codigoCupom, valorFinalPedido) {
    try {
        const res = await fetch(`${API_URL}/configuracoes`, { cache: 'no-store' });
        const configs = await res.json();
        
        if (configs.cupons_delivery) {
            let cupons = JSON.parse(configs.cupons_delivery);
            
            // Procura o cupom forçando tudo para maiúsculo e tirando espaços falsos
            const codigoFormatado = codigoCupom.trim().toUpperCase();
            const index = cupons.findIndex(c => c.codigo.trim().toUpperCase() === codigoFormatado);
            
            if (index !== -1) {
                // Soma como número para evitar falhas
                cupons[index].usos_atuais = Number(cupons[index].usos_atuais || 0) + 1;
                cupons[index].receita_gerada = Number(cupons[index].receita_gerada || 0) + Number(valorFinalPedido);
                
                await fetch(`${API_URL}/configuracoes`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cupons_delivery: JSON.stringify(cupons) })
                });
            }
        }
    } catch (e) {
        console.error("Falha silenciosa ao registrar uso do cupom:", e);
    }
}

// ==========================================
// ⭐ BARRINHA DE FIDELIDADE DINÂMICA
// ==========================================
function ativarBarrinhaFidelidade(pontosAtuais) {
    let areaFidelidade = document.getElementById('area-fidelidade-checkout');
    
    if (!areaFidelidade) {
        areaFidelidade = document.createElement('div');
        areaFidelidade.id = 'area-fidelidade-checkout';
        areaFidelidade.style.cssText = "background: #fff; padding: 15px; border-radius: 12px; margin-bottom: 15px; border: 1px solid #e0e0e0; box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: 0.3s;";
        
        const areaUpsell = document.getElementById('area-upsell-checkout');
        if (areaUpsell && areaUpsell.parentNode) {
            areaUpsell.parentNode.insertBefore(areaFidelidade, areaUpsell);
        }

        if(!document.getElementById('animacao-fidelidade')) {
            const style = document.createElement('style');
            style.id = 'animacao-fidelidade';
            style.innerHTML = `@keyframes piscarBarraFutura { 0% { opacity: 0.4; } 100% { opacity: 1; } }`;
            document.head.appendChild(style);
        }
    }

    areaFidelidade.style.display = 'block';

    // 🧮 Lógica de Pontos (Cartela de 10 espaços)
    const metaPontos = 10; 
    const pontosNaCartela = pontosAtuais % metaPontos;
    
    // 🎯 O GATILHO: Se for múltiplo de 10 e maior que zero
    const temPremioLiberado = (pontosAtuais > 0 && pontosNaCartela === 0);

    // 🧠 A MÁGICA DO LOOP: Define o número que vai aparecer na tela.
    // Se completou a meta, mostra 10. Se já passou de 10 (ex: 11, 23), mostra só o "resto" (1, 3).
    const pontosExibicao = temPremioLiberado ? metaPontos : pontosNaCartela;

    if (temPremioLiberado) {
        // 🏆 MODO RESGATE (Visual Dourado de Celebração)
        areaFidelidade.style.background = 'linear-gradient(135deg, #fffbeb, #fff8e1)';
        areaFidelidade.style.borderColor = '#ffe082';
        
        areaFidelidade.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="color: #f57f17; font-size: 1.1rem;">🏆 Cartela Completa!</strong>
                <span style="background: #f57f17; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">${pontosExibicao} Pontos</span>
            </div>
            <p style="font-size: 0.9rem; color: #555; margin-top: 10px; margin-bottom: 15px; text-align: center;">
                Parabéns! Você completou sua cartela de fidelidade e ganhou um <strong>super desconto</strong> neste pedido!
            </p>
            <button id="btn-resgatar-fidelidade" onclick="resgatarFidelidade()" style="width: 100%; padding: 12px; background: #FF9800; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.05rem; cursor: pointer; box-shadow: 0 4px 6px rgba(255, 152, 0, 0.3); animation: piscarBarraFutura 1s infinite alternate;">
                🎁 Resgatar Prêmio Agora
            </button>
        `;
    } else {
        // 📊 MODO NORMAL (Barra de Progresso)
        areaFidelidade.style.background = '#fff';
        areaFidelidade.style.borderColor = '#e0e0e0';

        // Usa os pontos de exibição (que nunca passam de 9) para preencher o verde na tela
        const porcentagemAtual = (pontosExibicao / metaPontos) * 100;
        const porcentagemFutura = (1 / metaPontos) * 100;

        let mensagem = `Você tem <strong>${pontosExibicao}</strong> pontos e ganhará <strong style="color: #FF9800;">+ 1</strong> após finalizar este pedido!`;
        
        if (pontosExibicao === metaPontos - 1) {
            mensagem = `Você tem <strong>${pontosExibicao}</strong> pontos. Este pedido vai <strong>completar sua cartela!</strong> 🎉`;
        } else if (pontosExibicao === 0) {
            mensagem = `Ganhe seu <strong>1º ponto</strong> ao finalizar este pedido! 🎉`;
        }

        areaFidelidade.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="color: #333; font-size: 1rem;">⭐ Cartão Fidelidade</strong>
                <span style="background: var(--cor-primaria, #e91e63); color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">${pontosExibicao} Pontos</span>
            </div>
            <div style="background: #f0f0f0; border-radius: 10px; height: 12px; width: 100%; overflow: hidden; display: flex; position: relative;">
                <div style="background: #4CAF50; height: 100%; width: ${porcentagemAtual}%; transition: 1s ease-in-out;"></div>
                <div style="background: #FF9800; height: 100%; width: ${porcentagemFutura}%; transition: 1s ease-in-out; animation: piscarBarraFutura 1s infinite alternate;" title="Ponto que será ganho hoje"></div>
            </div>
            <p style="font-size: 0.85rem; color: #666; margin-top: 10px; margin-bottom: 0; text-align: center;">
                ${mensagem}
            </p>
        `;
    }
}

async function resgatarFidelidade() {
    // 1. Muda o botão para "carregando" enquanto busca as regras na nuvem
    const btn = document.getElementById('btn-resgatar-fidelidade');
    if (btn) {
        btn.innerHTML = '⏳ Resgatando...';
        btn.disabled = true;
    }

    try {
        // 2. Busca as configurações fresquinhas lá do seu Painel de Gestão
        const res = await fetch(`${API_URL}/configuracoes`);
        const configs = await res.json();
        
        // 3. Lê DIRETAMENTE as gavetas que o seu F12 encontrou!
        const tipoGravado = configs.fidelidade_tipo || 'Valor Fixo';
        const VALOR_DO_PREMIO = Number(configs.fidelidade_valor) || 0;

        // 4. Traduz a linguagem do Painel CRM para a linguagem do Carrinho
        let tipoDoCupom = 'fixo';
        if (tipoGravado === 'Desconto em %' || tipoGravado === 'porcentagem' || tipoGravado === '%') {
            tipoDoCupom = 'porcentagem';
        }

        // 5. Se o cliente já tiver digitado outro cupom, a gente pergunta se ele quer trocar
        if (cupomAtivo && cupomAtivo.codigo !== 'FIDELIDADE_VIP') {
            if(!confirm("Você já tem um cupom aplicado. Deseja substituí-lo pelo prêmio de fidelidade?")) {
                if (btn) {
                    btn.innerHTML = '🎁 Resgatar Prêmio Agora';
                    btn.disabled = false;
                }
                return; 
            }
        }

        // 6. Criamos o "Cupom Fantasma" com os dados exatos do seu CRM
        cupomAtivo = { 
            codigo: 'FIDELIDADE_VIP', 
            tipo: tipoDoCupom, 
            valor: VALOR_DO_PREMIO 
        };

        // 7. Refaz as contas do carrinho para abater o valor
        atualizarTotalCheckout();

        // 8. Muda o botão visualmente para dar aquele efeito de satisfação
        if (btn) {
            btn.innerHTML = '✅ Desconto Aplicado com Sucesso!';
            btn.style.background = '#4CAF50';
            btn.style.boxShadow = 'none';
            btn.style.animation = 'none';
            btn.disabled = true; 
        }

        // 9. Mostra o textinho verde dinâmico (R$ ou %) logo acima do botão Finalizar
        const msg = document.getElementById('msg-cupom');
        if (msg) {
            const textoPremio = tipoDoCupom === 'porcentagem' ? `${VALOR_DO_PREMIO}%` : `R$ ${VALOR_DO_PREMIO.toFixed(2).replace('.', ',')}`;
            msg.innerText = `✅ Prêmio Fidelidade de ${textoPremio} aplicado!`;
            msg.style.color = "#25D366";
            msg.style.display = 'block';
        }

        // 10. Limpa a caixinha de texto de cupons normais para não confundir
        const inputCupom = document.getElementById('input-cupom');
        if (inputCupom) inputCupom.value = '';

    } catch (erro) {
        console.error("Falha ao ler o CRM:", erro);
        alert("⚠️ Houve um pequeno erro ao se conectar com o sistema de fidelidade. Tente novamente.");
        if (btn) {
            btn.innerHTML = '🎁 Resgatar Prêmio Agora';
            btn.disabled = false;
        }
    }
}
