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
let categoriasCompletasDoBanco = []; // 🗺️ NOVA: Memória de todas as categorias
let pedidoMinimoDeliveryGlobal = 0;
let topAdicionaisGlobais = []; // 🏆 Memória dos Adicionais Favoritos
let cuponsGlobais = [];
let cupomAtivo = null;
let bairrosGlobais = []; // 🗺️ NOVA VARIÁVEL GLOBAL

// ==========================================
// 📊 SENSORES DO FUNIL DE VENDAS
// ==========================================
// Cria um "crachá" único para saber que os cliques são da mesma pessoa
const sessao_id = "sessao_" + Math.random().toString(36).substr(2, 9);

async function registrarEventoFunil(nomeEvento, nomeProduto = null) {
    try {
        await fetch(`${API_URL}/funil`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                evento: nomeEvento,
                produto_nome: nomeProduto,
                sessao_id: sessao_id
            })
        });
    } catch (e) {
        console.log("Sensor do funil falhou silenciosamente (não afeta o cliente):", e);
    }
}

// SENSOR 1: O cliente abriu a página!
registrarEventoFunil('Visitou o Cardápio');
// ==========================================

// ==========================================
// ⏱️ MOTOR DE PROMOÇÕES AGENDADAS (Relógio Biológico)
// ==========================================
function isPromocaoAtivaAgora(p) {
    // Se não tem promoção configurada, já corta aqui
    if (!p.tipo_promocao || p.tipo_promocao === 'nenhuma' || !(p.valor_promocao > 0)) return false;

    // Se o produto não tiver os novos campos de agendamento preenchidos, a promoção funciona 24h (modo antigo)
    if ((!p.promo_dias || p.promo_dias === '') && (!p.promo_inicio || p.promo_inicio === '')) return true;

    const agora = new Date();
    const diaAtual = agora.getDay().toString(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
    const horaAtualStr = agora.toTimeString().substring(0, 5); // Ex: "19:30"

    // 1. Checa o Dia da Semana (Ex: p.promo_dias = "4" para Quinta, ou "1,3,5" para Seg/Qua/Sex)
    if (p.promo_dias && p.promo_dias.trim() !== '') {
        if (!p.promo_dias.includes(diaAtual)) return false; // Se hoje não for o dia marcado, esconde a promo
    }

    // 2. Checa o Horário (Ex: das "18:00" às "23:59")
    if (p.promo_inicio && p.promo_fim && p.promo_inicio !== '' && p.promo_fim !== '') {
        if (horaAtualStr < p.promo_inicio || horaAtualStr > p.promo_fim) return false;
    }

    return true; // Se passou pelos testes de tempo, a promoção brilha na tela!
}

// ==========================================
// ⏱️ MOTOR DE CATEGORIAS AGENDADAS
// ==========================================
function isCategoriaAtivaAgora(cat) {
    // Se não tem agendamento configurado, a categoria fica visível 24h
    if ((!cat.dias_semana || cat.dias_semana === '') && (!cat.hora_inicio || cat.hora_inicio === '')) return true;

    const agora = new Date();
    const diaAtual = agora.getDay().toString(); // 0=Dom, 1=Seg...
    const horaAtualStr = agora.toTimeString().substring(0, 5); // Ex: "12:26"

    // 1. Checa o Dia da Semana
    if (cat.dias_semana && cat.dias_semana.trim() !== '') {
        if (!cat.dias_semana.includes(diaAtual)) return false; // Se hoje não for o dia marcado, esconde
    }

    // 2. Checa o Horário (Ex: das "14:00" às "18:00")
    if (cat.hora_inicio && cat.hora_fim && cat.hora_inicio !== '' && cat.hora_fim !== '') {
        if (cat.hora_fim < cat.hora_inicio) {
            // Lógica para lojas que viram a madrugada (Ex: 18:00 às 02:00)
            if (horaAtualStr < cat.hora_inicio && horaAtualStr > cat.hora_fim) return false;
        } else {
            // Horário normal no mesmo dia (Ex: 14:00 às 18:00)
            if (horaAtualStr < cat.hora_inicio || horaAtualStr > cat.hora_fim) return false;
        }
    }

    return true; // Se passou nos testes, exibe a categoria!
}

async function carregarTudo() {
    try {
        // 🌐 O "motor" agora busca as configurações no mesmo pacote!
        const [resProd, resGrupos, resBairros, resCat, resConfig, resRankingAdic] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/grupos`),
            fetch(`${API_URL}/bairros`),
            fetch(`${API_URL}/categorias`),
            fetch(`${API_URL}/configuracoes`), // 👈 Pedimos a gaveta de configs
            fetch(`${API_URL}/ranking/adicionais`) // 🏆 Pede o Top 3 Adicionais
        ]);

        try { topAdicionaisGlobais = await resRankingAdic.json(); } catch(e) { topAdicionaisGlobais = []; }

        let produtosBrutos = await resProd.json();
        
        // 📸 O NOVO FILTRO BLINDADO (Corrige a foto quebrada ignorando a sujeira do banco)
        produtosDaNuvem = produtosBrutos.map(p => {
            if (p.imagem_url && !p.imagem_url.includes('ibb.co')) {
                const nomeArquivo = p.imagem_url.split('/').pop(); 
                p.imagem_url = `https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/uploads/${nomeArquivo}`;
            }
            return p;
        }).filter(p => p.ativo !== false);

        // 📸 O NOVO FILTRO BLINDADO DAS FOTOS DOS ADICIONAIS
        let gruposBrutos = await resGrupos.json();
        gruposGlobais = gruposBrutos.filter(g => g.ativo !== false).map(g => {
            if (g.itens) {
                g.itens = g.itens.map(item => {
                    if (item.imagem_url && !item.imagem_url.includes('http')) {
                        const nomeArquivo = item.imagem_url.split('/').pop();
                        item.imagem_url = `https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/uploads/${nomeArquivo}`;
                    }
                    return item;
                });
            }
            return g;
        });
        bairrosGlobais = await resBairros.json(); 
        
        // 🛡️ O FILTRO MÁGICO DAS CATEGORIAS (Visíveis no App E no horário agendado)
        const todasCategorias = await resCat.json();
        categoriasCompletasDoBanco = todasCategorias.map(c => c.nome); // 👈 Memória fotográfica do banco

        categoriasGlobaisDelivery = todasCategorias.filter(c => 
            c.ativo !== false && 
            c.mostrar_cardapio !== false &&
            isCategoriaAtivaAgora(c) // 👈 A mágica acontece aqui!
        );

        renderizarCardapio(produtosDaNuvem);
        renderizarMenuCategorias(produtosDaNuvem);
        renderizarCarrossel(produtosDaNuvem);
        renderizarCidades(); // Desenha a caixa de cidades
        renderizarBairros(); // Desenha a caixa de bairros vazia e travada

        // ==========================================
        // 🚀 MÁGICA DO TÍTULO DINÂMICO
        // ==========================================
        const configs = await resConfig.json();
        const tituloDestaque = configs.titulo_carrossel_destaques || 'Destaques da Casa';
        const elementoTitulo = document.getElementById('titulo-ui-destaques');
        
        if (elementoTitulo) {
            // Mantém a estrelinha charmosa e injeta o texto que você digitou lá no painel!
            elementoTitulo.innerHTML = `${tituloDestaque}`;
        }

    } catch (e) { 
        console.error("Erro ao carregar do servidor novo:", e); 
    }
}

// ==========================================
// 🗺️ DESENHAR CIDADES E BAIRROS NO CHECKOUT
// ==========================================
function renderizarCidades() {
    const selectCidade = document.getElementById('cliente-cidade');
    if (!selectCidade) return;

    selectCidade.innerHTML = '<option value="" disabled selected>🏙️ Selecione sua Cidade</option>';

    // O sistema extrai as cidades automaticamente. 
    // Se a API ainda não tiver o campo 'cidade', ele usa "Quatis" como porto seguro.
    const cidadesUnicas = [...new Set(bairrosGlobais.map(b => b.cidade || 'Quatis'))];

    cidadesUnicas.forEach(cidade => {
        selectCidade.innerHTML += `<option value="${cidade}">${cidade}</option>`;
    });
}

function aoMudarCidade() {
    const selectCidade = document.getElementById('cliente-cidade');
    const cidadeEscolhida = selectCidade.value;
    renderizarBairros(cidadeEscolhida);
    atualizarTotalCheckout(); // Recalcula o total caso a taxa de entrega zere
}

function renderizarBairros(cidadeFiltro = null) {
    const selectBairro = document.getElementById('cliente-bairro');
    if (!selectBairro) return;

    selectBairro.innerHTML = '<option value="" data-taxa="0" disabled selected>📍 Selecione seu Bairro</option>';

    if (cidadeFiltro) {
        selectBairro.disabled = false; // Destrava a caixinha
        
        // Filtra apenas os bairros que pertencem à cidade escolhida
        const bairrosFiltrados = bairrosGlobais.filter(b => (b.cidade || 'Quatis') === cidadeFiltro);

        bairrosFiltrados.forEach(b => {
            const taxa = Number(b.taxa);
            const textoTaxa = taxa > 0 ? `Taxa: R$ ${taxa.toFixed(2).replace('.', ',')}` : 'Grátis';
            selectBairro.innerHTML += `<option value="${b.nome}" data-taxa="${taxa}">${b.nome} - ${textoTaxa}</option>`;
        });
    } else {
        selectBairro.disabled = true; // Mantém travado
        selectBairro.innerHTML = '<option value="" data-taxa="0" disabled selected>📍 Selecione primeiro a Cidade</option>';
    }
}

// ==========================================
// 🎨 O NOVO CARDÁPIO DINÂMICO (COM CATEGORIAS, FOTOS E TAGS!)
// ==========================================
function obterOrdemDasCategorias(listaProdutosAtual) {
    const categoriasPermitidas = categoriasGlobaisDelivery.map(c => c.nome);
    
    // Coleta TODAS as categorias usadas (Principais e Adicionais) pelos produtos
    let todasCategoriasUsadas = new Set();
    
    listaProdutosAtual.forEach(p => {
        todasCategoriasUsadas.add(p.categoria && p.categoria !== 'null' ? p.categoria : 'Diversos');
        
        if (p.categorias_adicionais) {
            try {
                let extras = typeof p.categorias_adicionais === 'string' ? JSON.parse(p.categorias_adicionais) : p.categorias_adicionais;
                if (Array.isArray(extras)) {
                    extras.forEach(ext => todasCategoriasUsadas.add(ext));
                }
            } catch(e) {}
        }
    });

    // 🛑 A CORTINA DE FERRO DAS CATEGORIAS:
    // Pega as categorias usadas, mas SÓ adiciona como "Extra" se ela não existir no banco de dados (ex: 'Diversos').
    // Se ela existe no banco (categoriasCompletasDoBanco), mas NÃO está nas permitidas, significa que ela está BLOQUEADA ou AGENDADA, então deve ser ESCONDIDA!
    const categoriasExtras = [...todasCategoriasUsadas].filter(c => 
        !categoriasPermitidas.includes(c) && !categoriasCompletasDoBanco.includes(c)
    );

    return [...categoriasPermitidas, ...categoriasExtras];
}

function renderizarCardapio(lista) {
    const container = document.getElementById('lista-produtos');
    container.innerHTML = '<h2 style="margin-bottom: 20px; color: #333;">Cardápio</h2>';

    const categoriasOrdenadas = obterOrdemDasCategorias(lista);

    categoriasOrdenadas.forEach((catNome, index) => {
        // Filtra os produtos desta categoria (mesma regra mágica de antes)
        const produtosDestaCategoria = lista.filter(p => {
            let catPrincipal = (p.categoria && p.categoria !== 'null') ? p.categoria : 'Diversos';
            if (catPrincipal === catNome) return true;

            if (p.categorias_adicionais) {
                try {
                    let extras = typeof p.categorias_adicionais === 'string' ? JSON.parse(p.categorias_adicionais) : p.categorias_adicionais;
                    if (Array.isArray(extras) && extras.includes(catNome)) return true;
                } catch(e) {}
            }
            return false;
        });
        
        if (produtosDestaCategoria.length === 0) return;

        // IDs únicos para o Acordeão funcionar
        const catId = 'categoria-' + catNome.replace(/[^a-zA-Z0-9]/g, '');
        const conteudoId = 'conteudo-' + catId;

        // Monta o recheio: a lista de produtos
        let produtosHtml = '';

        produtosDestaCategoria.forEach(p => {
            const descricaoLimpa = p.descricao && p.descricao !== 'null' ? p.descricao : '';
            const htmlDescricao = descricaoLimpa 
                ? `<p style="margin: 4px 0 8px 0; color: #777; font-size: 0.85rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${descricaoLimpa}</p>` 
                : ``;
            
            // O CÉREBRO DAS TAGS
            let tagHtml = '';
            if (p.tag && p.tag !== '') {
                const nomesTags = { 'so_hoje': 'Só hoje', 'mais_pedido': 'Mais pedido', 'oferta': 'Oferta', 'novidade': 'Novidade', 'poucas_unidades': 'Poucas Unidades' };
                tagHtml = `<div class="tag-flutuante tag-${p.tag}">${nomesTags[p.tag] || p.tag}</div>`;
            }

            // TAG DE ESTOQUE DINÂMICA
            if (p.controlar_estoque && p.mostrar_estoque) {
                const qtdEstoque = Number(p.estoque) || 0;
                let corFundo = qtdEstoque > 5 ? '#e8f5e9' : '#fff3e0'; 
                let corTexto = qtdEstoque > 5 ? '#2e7d32' : '#e65100'; 
                if (qtdEstoque <= 2) { corFundo = '#ffebee'; corTexto = '#c62828'; } 
                
                tagHtml += `<div style="position: absolute; bottom: -10px; right: -5px; background: ${corFundo}; color: ${corTexto}; font-size: 0.65rem; font-weight: 800; padding: 3px 8px; border-radius: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border: 1px solid ${corTexto}50; z-index: 15;">📦 Restam ${qtdEstoque}</div>`;
            }

            // MATEMÁTICA DA PROMOÇÃO (Preço Riscado)
            let precoHtml = `<div style="font-weight: 700; color: #333; font-size: 1rem; margin-top: 5px;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>`;
            
            if (isPromocaoAtivaAgora(p)) {
                let precoComDesconto = Number(p.preco);
                if (p.tipo_promocao === 'porcentagem') {
                    precoComDesconto -= precoComDesconto * (Number(p.valor_promocao) / 100);
                } else if (p.tipo_promocao === 'fixo') {
                    precoComDesconto -= Number(p.valor_promocao);
                }
                if (precoComDesconto < 0) precoComDesconto = 0;
                
                precoHtml = `
                    <div style="margin-top: 5px; display: flex; align-items: center; gap: 8px;">
                        <span style="text-decoration: line-through; color: #999; font-size: 0.85rem;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</span>
                        <strong style="color: #25D366; font-size: 1.1rem;">R$ ${precoComDesconto.toFixed(2).replace('.', ',')}</strong>
                    </div>
                `;
            }

            // Visual do Produto
            const visualProduto = p.imagem_url 
                ? `<div style="position: relative; flex-shrink: 0;">
                       ${tagHtml}
                       <img src="${p.imagem_url}" loading="lazy" style="width: 90px; height: 90px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                   </div>`
                : `<div style="position: relative; flex-shrink: 0;">
                       ${tagHtml}
                       <div style="font-size: 2.5rem; width: 90px; height: 90px; background: #f8f9fa; border-radius: 8px; display: flex; justify-content: center; align-items: center;">${p.emoji || '🍦'}</div>
                   </div>`;

            produtosHtml += `
                <div class="produto-card" onclick="verificarAdicao(${p.id})" style="display: flex; justify-content: space-between; align-items: center; background: white; margin-top: 12px; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #f0f0f0; cursor: pointer; transition: 0.2s;">
                    <div style="flex: 1; padding-right: 15px;">
                        <h3 style="margin: 0; color: #333; font-size: 1.05rem; font-weight: 600;">${p.nome}</h3>
                        ${htmlDescricao}
                        ${precoHtml}
                    </div>
                    ${visualProduto}
                </div>
            `;
        });

        // MÁGICA DO ACORDEÃO: Deixa apenas a primeira categoria aberta por padrão
        const isPrimeira = index === 0;
        const displayInicial = isPrimeira ? 'block' : 'none';
        const rotacaoSeta = isPrimeira ? 'transform: rotate(180deg);' : 'transform: rotate(0deg);';

        container.innerHTML += `
            <div style="margin-bottom: 20px;">
                <!-- A BARRA ELEGANTE DA CATEGORIA -->
                <h3 id="${catId}" onclick="toggleCategoriaCardapio('${conteudoId}', this)" style="color: #333; margin: 0 0 10px 0; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 1.1rem; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); border-left: 6px solid var(--cor-primaria, #e91e63); transition: transform 0.2s; user-select: none;">
                    
                    <!-- A CAIXA FLEXÍVEL DO TÍTULO (Mais escura e com espaçamento elegante) -->
                    <span style="flex: 1; padding-right: 15px; line-height: 1.3; word-break: break-word; font-weight: 700; letter-spacing: 0.5px;">${catNome}</span>
                    
                    <!-- A SETA COM A COR DA MARCA -->
                    <span class="seta-categoria" style="transition: transform 0.3s; color: var(--cor-primaria, #e91e63); font-size: 1.2rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; ${rotacaoSeta}">▼</span>
                
                </h3>
                
                <!-- O RECHEIO: Sem a caixa cinza por trás, deixando os produtos "flutuarem" no fundo -->
                <div id="${conteudoId}" style="display: ${displayInicial}; padding: 5px 0;">
                    ${produtosHtml}
                </div>
            </div>
        `;
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
    
    // SENSOR 2: Cliente se interessou por um produto!
    registrarEventoFunil('Visualizou Produto', produto.nome);

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
               <img src="${produto.imagem_url}" onclick="abrirFotoInteira(this.src)" style="width: 100%; height: 220px; object-fit: cover; border-top-left-radius: 25px; border-top-right-radius: 25px; display: block; background: #f8f9fa; cursor: pointer;">
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
                const matchTag = nomeCompleto.match(/\[(.*?)\]/); 
                
                if (matchTag) {
                    tagHtml += `<span class="tag-recomendacao">${matchTag[1]}</span>`;
                    nomeLimpoVisual = nomeCompleto.replace(/\[.*?\]/, '').trim(); 
                }

                // 🏆 NOVO: Gatilho da Prova Social 
                if (topAdicionaisGlobais.includes(nomeLimpoVisual.trim())) {
                    tagHtml += `<span style="font-size: 0.65rem; background: #c4eed0; color: #0f5223; padding: 3px 8px; border-radius: 12px; font-weight: bold; border: 1px solid #8fcf9e; margin-left: 6px; vertical-align: middle; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">🔥 Mais Pedido</span>`;
                }

                // 📸 FOTO DO ADICIONAL COM ZOOM
                const imgThumb = item.imagem_url
                    ? `<img src="${item.imagem_url}" onclick="event.stopPropagation(); abrirFotoInteira(this.src)" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover; border: 1px solid #eee; flex-shrink: 0; cursor: zoom-in; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">`
                    : ``; 

                // INFO (NOME E PREÇO) EMPILHADOS
                const nomePrecoHtml = `
                    <div style="display: flex; flex-direction: column; gap: 3px; justify-content: center;">
                        <div style="display: flex; align-items: center; flex-wrap: wrap;">
                            <span style="font-weight:600; color:#333; line-height: 1.2;">${nomeLimpoVisual}</span>
                            ${tagHtml}
                        </div>
                        <span style="color:#25D366; font-size:0.85rem; font-weight: 600;">${precoSeguro > 0 ? '+ R$ ' + precoSeguro.toFixed(2).replace('.', ',') : 'Grátis'}</span>
                    </div>
                `;

                if (grupo.limite === 1) {
                    return `
                    <div class="item-opcional-card" onclick="toggleOpcional(${grupo.id}, '${nomeCompleto}', ${precoSeguro}, '${identificador}')" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee; cursor:pointer;">
                        <div style="display:flex; align-items:center; gap:12px; flex: 1;">
                            ${imgThumb}
                            ${nomePrecoHtml}
                        </div>
                        <div style="flex-shrink: 0; padding-left: 10px;">
                            <!-- Caixinha de seleção movida para a Zona do Polegar (Direita) -->
                            <input type="checkbox" id="${identificador}" style="accent-color:var(--cor-primaria, #e91e63); pointer-events:none; flex-shrink: 0; width: 22px; height: 22px; margin: 0;">
                        </div>
                    </div>`;
                } else {
                    return `
                    <div class="item-opcional-card" style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee;">
                        <div style="display:flex; align-items:center; gap:12px; flex: 1;">
                            ${imgThumb}
                            ${nomePrecoHtml}
                        </div>
                        <div style="flex-shrink: 0; padding-left: 10px;">
                            <!-- Botão Inicial [+] super limpo -->
                            <div id="btn-add-ini-${identificador}" onclick="alterarQtdOpcional(${grupo.id}, '${nomeCompleto}', ${precoSeguro}, 1, '${identificador}')" style="background: #f0f2f5; color: var(--cor-primaria, #e91e63); border-radius: 8px; width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 1.5rem; cursor: pointer; border: 1px solid #e0e0e0; transition: 0.2s;">
                                +
                            </div>
                            <!-- Controle de Quantidade [- 1 +] -->
                            <div id="controle-qtd-${identificador}" style="display: none; align-items: center; background: #f4f7f6; border: 1px solid var(--cor-primaria, #e91e63); border-radius: 8px; padding: 2px;">
                                <button onclick="alterarQtdOpcional(${grupo.id}, '${nomeCompleto}', ${precoSeguro}, -1, '${identificador}')" style="background: none; border: none; font-size: 1.2rem; color: #555; cursor: pointer; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center;">-</button>
                                <span id="${identificador}" style="font-weight: bold; font-size: 1rem; color: #333; min-width: 24px; text-align: center;">0</span>
                                <button onclick="alterarQtdOpcional(${grupo.id}, '${nomeCompleto}', ${precoSeguro}, 1, '${identificador}')" style="background: none; border: none; font-size: 1.2rem; color: var(--cor-primaria, #e91e63); cursor: pointer; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center;">+</button>
                            </div>
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
        // Se já estava marcado, o cliente quer desmarcar
        escolhasAtuais.splice(index, 1); 
        chk.checked = false; 
    } else {
        // O cliente quer marcar uma nova opção
        const escolhasNoGrupo = escolhasAtuais.filter(e => e.grupoId === grupoId);
        
        if (grupo.limite === 1) {
            // Comportamento de "Radio Button": Se o limite é 1, remove a escolha anterior
            if (escolhasNoGrupo.length > 0) {
                const idxAnterior = escolhasAtuais.indexOf(escolhasNoGrupo[0]);
                escolhasAtuais.splice(idxAnterior, 1);
                
                // 🐛 CORREÇÃO AQUI: Procurar o prefixo 'opc-' e desmarcar a caixinha antiga
                document.querySelectorAll(`input[id^="opc-${grupoId}-"]`).forEach(c => c.checked = false);
            }
        } else {
            // Trava de segurança extra (para limites maiores que 1)
            if (escolhasNoGrupo.length >= grupo.limite) {
                alert(`⚠️ Você só pode escolher até ${grupo.limite} opção(ões) em ${grupo.nome}.`);
                return; // Corta a função aqui, não deixa marcar
            }
        }
        
        // Adiciona a nova escolha no carrinho virtual e marca a caixinha
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
    
    // 🚀 ALTERAÇÃO VISUAL: Esconde o botão [+] e mostra o [- 1 +] apenas quando selecionado
    const btnIni = document.getElementById(`btn-add-ini-${spanId}`);
    const controleQtd = document.getElementById(`controle-qtd-${spanId}`);
    if (btnIni && controleQtd) {
        if (qtdAtual > 0) {
            btnIni.style.display = 'none';
            controleQtd.style.display = 'flex';
        } else {
            btnIni.style.display = 'flex';
            controleQtd.style.display = 'none';
        }
    }

    atualizarPrecoDinamico();
}

function alterarQuantidadeModal(delta) {
    let novaQuantidade = quantidadeModal + delta;
    
    // 🛑 NOVA TRAVA DE ESTOQUE: Impede que o cliente escolha mais do que tem na loja
    if (produtoEmSelecao.controlar_estoque && delta > 0) {
        const estoqueReal = Number(produtoEmSelecao.estoque) || 0;
        if (novaQuantidade > estoqueReal) {
            alert(`Desculpe! Temos apenas ${estoqueReal} unidade(s) deste produto no momento.`);
            return; // Corta a função, o botão de [+] não faz nada!
        }
    }

    quantidadeModal = novaQuantidade;
    if (quantidadeModal < 1) quantidadeModal = 1; 
    
    const display = document.getElementById('quantidade-modal-display');
    if(display) display.innerText = quantidadeModal;
    
    atualizarPrecoDinamico();
}

function atualizarPrecoDinamico() {
    // 💰 Descobre o preço base verificando se tem promoção ativa
    let precoBase = Number(produtoEmSelecao.preco);
    if (isPromocaoAtivaAgora(produtoEmSelecao)) {
        if (produtoEmSelecao.tipo_promocao === 'porcentagem') {
            precoBase -= precoBase * (Number(produtoEmSelecao.valor_promocao) / 100);
        } else if (produtoEmSelecao.tipo_promocao === 'fixo') {
            precoBase -= Number(produtoEmSelecao.valor_promocao);
        }
        if (precoBase < 0) precoBase = 0;
    }

    const valorComplementos = escolhasAtuais.reduce((soma, e) => soma + (Number(e.preco) * e.quantidade), 0);
    const valorUnidade = precoBase + valorComplementos;
    const totalGeral = valorUnidade * quantidadeModal;
    
    document.getElementById('preco-dinamico').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
}

function confirmarEscolhasEAdicionar() {

    // SENSOR 3: Cliente tem intenção de compra!
    registrarEventoFunil('Adicionou ao Carrinho', produtoEmSelecao.nome);

    // 1. Validação de Grupos Obrigatórios
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

    // 2. Montagem do Nome Final com Adicionais
    let nomeFinal = produtoEmSelecao.nome;
    if (escolhasAtuais.length > 0) {
        let stringComplementos = escolhasAtuais.map(e => {
            if (e.quantidade > 1) return `${e.quantidade}x ${e.nome}`;
            return e.nome;
        }).join(', ');
        nomeFinal += ` (${stringComplementos})`;
    }

    // 3. 💰 MATEMÁTICA DO PREÇO BASE (Aplicando a Promoção se existir)
    let precoBase = Number(produtoEmSelecao.preco);
    if (isPromocaoAtivaAgora(produtoEmSelecao)) {
        if (produtoEmSelecao.tipo_promocao === 'porcentagem') {
            precoBase -= precoBase * (Number(produtoEmSelecao.valor_promocao) / 100);
        } else if (produtoEmSelecao.tipo_promocao === 'fixo') {
            precoBase -= Number(produtoEmSelecao.valor_promocao);
        }
        if (precoBase < 0) precoBase = 0; // Evita que o produto fique com valor negativo
    }

    // 4. Soma Final (Preço Base com Desconto + Valor dos Complementos)
    const valorComplementos = escolhasAtuais.reduce((soma, e) => soma + (Number(e.preco) * e.quantidade), 0);
    const precoFinal = precoBase + valorComplementos;
    
    // 5. Dispara para o Carrinho
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
    
    // 🛡️ TRAVA DE SEGURANÇA (Evita que o botão quebre se o HTML sumir)
    const modalCheckout = document.getElementById('modal-checkout');
    
    if (modalCheckout && modalCheckout.style.display === 'flex') {
        renderizarResumoCarrinho(); 
    }
}

function atualizarBarraCarrinho() {
    const barra = document.getElementById('carrinho-flutuante');
    
    // 👉 A MÁGICA: O gatilho roda PRIMEIRO para aplicar ou remover cupons automaticamente
    if (typeof atualizarBarraCupom === 'function') atualizarBarraCupom();

    if (carrinho.length > 0) {
        barra.classList.replace('carrinho-oculto', 'carrinho-visivel');
        barra.style.display = 'flex';

        // 🪄 O GATILHO DA PULSAÇÃO SUAVE
        const btnCarrinho = barra.querySelector('.btn-whatsapp');
        if (btnCarrinho) {
            btnCarrinho.classList.remove('botao-pulsando');
            void btnCarrinho.offsetWidth; // Pequeno truque para forçar o navegador a reiniciar a animação
            btnCarrinho.classList.add('botao-pulsando');
        }
        
        let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
        
        // 👇 Aplica o desconto na barrinha flutuante
        let desconto = 0;
        if (cupomAtivo) {
            let valorCupomNum = Number(cupomAtivo.valor) || 0;
            desconto = cupomAtivo.tipo === 'porcentagem' ? subtotal * (valorCupomNum / 100) : valorCupomNum;
        }
        
        let totalFinal = subtotal - desconto;
        if(totalFinal < 0) totalFinal = 0;

        document.getElementById('carrinho-qtd').innerText = `${carrinho.length} item(ns)`;
        document.getElementById('carrinho-total').innerText = `R$ ${totalFinal.toFixed(2).replace('.', ',')}`;
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

function removerItemCarrinho(index) { 
    carrinho.splice(index, 1); 
    atualizarBarraCarrinho(); // Recalcula a matemática e invalida cupons primeiro!
    renderizarResumoCarrinho(); // Depois desenha o checkout
}

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

function atualizarBotaoCTA() {
    const btnAvancar = document.getElementById('btn-avancar-checkout');
    if (!btnAvancar) return;

    if (passoCheckoutAtual === 1) {
        btnAvancar.innerText = 'Continuar para Pagamento';
        btnAvancar.style.background = 'var(--cor-primaria)';
        return;
    }

    // Se estiver no Passo 2 (Final)
    const pagamentoSelecionado = document.querySelector('input[name="forma_pag"]:checked');
    const valorTotalStr = document.getElementById('total-checkout-display').innerText;

    if (pagamentoSelecionado) {
        const pag = pagamentoSelecionado.value;
        if (pag === 'Pagamento via Pix Online') {
            btnAvancar.innerHTML = `Gerar Pix Seguro • <strong>${valorTotalStr}</strong>`;
            btnAvancar.style.background = '#32BCAD'; // Cor oficial do Pix
        } else {
            btnAvancar.innerHTML = `Finalizar Pedido • <strong>${valorTotalStr}</strong>`;
            btnAvancar.style.background = '#25D366'; // Verde conversão
        }
    } else {
        btnAvancar.innerHTML = `Finalizar Pedido • <strong>${valorTotalStr}</strong>`;
        btnAvancar.style.background = 'var(--cor-primaria)';
    }
}

// ==========================================
// 🚀 NOVO SISTEMA DE CHECKOUT EM PASSOS
// ==========================================
let passoCheckoutAtual = 1;

function finalizarPedidoWhatsApp() {
    // 🛑 Removemos as linhas que anulavam o cupomAtivo aqui!
    
    irParaPasso(1);
    
    renderizarResumoCarrinho();
    // 🚀 O Carrossel saiu daqui para não distrair no checkout!
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

    atualizarBotaoCTA();
}

function validarPasso1() {
    const nome = document.getElementById('cliente-nome').value.trim();
    const tel = document.getElementById('cliente-telefone').value.trim();
    const tipo = document.querySelector('input[name="tipo_entrega"]:checked').value;
    
    if (!nome || !tel) return "Preencha seu Nome e WhatsApp.";
    
    if (tipo === 'delivery') {
        let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
        if (pedidoMinimoDeliveryGlobal > 0 && subtotal < pedidoMinimoDeliveryGlobal) {
            return `O valor mínimo para Delivery é R$ ${pedidoMinimoDeliveryGlobal.toFixed(2).replace('.', ',')}.\nSeu subtotal é R$ ${subtotal.toFixed(2).replace('.', ',')}.\n\nAdicione mais itens ou altere para "Retirada na Loja".`;
        }

        const selectCidade = document.getElementById('cliente-cidade');
        const cidade = selectCidade ? selectCidade.value : null;
        const bairro = document.getElementById('cliente-bairro').value;
        const rua = document.getElementById('cliente-rua').value.trim();
        const numero = document.getElementById('cliente-numero').value.trim();
        
        // Agora o sistema barra o cliente se ele não escolher a Cidade!
        if (!cidade || !bairro || !rua || !numero) return "Preencha Cidade, Bairro, Rua e Número para a entrega.";
    }
    return null;
}

function validarPasso2() {
    const pag = document.querySelector('input[name="forma_pag"]:checked');
    if (!pag) return "Selecione uma forma de pagamento.";
    return null;
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
        
        // 🚀 O DESVIO DE FLUXO DIRETO (Adeus Passo 3)
        const pagamento = document.querySelector('input[name="forma_pag"]:checked').value;
        if (pagamento === 'Pagamento via Pix Online') {
            gerarEPagarPix();
        } else {
            processarEnvioWhatsApp();
        }
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

    // Agora o loop vai apenas até 2
    for (let i = 1; i <= 2; i++) {
        const indicador = document.getElementById(`ind-passo-${i}`);
        if(indicador) {
            indicador.className = 'progresso-passo'; 
            if (i < passo) indicador.classList.add('concluido');
            else if (i === passo) indicador.classList.add('ativo');
        }
    }

    const btnVoltar = document.getElementById('btn-voltar-topo');
    
    if (passo === 1) {
        btnVoltar.style.display = 'none';
    } else if (passo === 2) {
        btnVoltar.style.display = 'block';
    }
    
    // Atualiza o visual do botão dependendo do passo atual
    atualizarBotaoCTA();
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

    atualizarBotaoCTA()
}

// 🚀 Atualizada para receber o Status e o ID da transação do Pix (se houver)
async function salvarVendaDelivery(statusForcado = "Pendente Delivery", transacaoId = null) {
    let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
    let desconto = 0;
    
    if (cupomAtivo) {
        let valorCupomNum = Number(cupomAtivo.valor) || 0;
        desconto = cupomAtivo.tipo === 'porcentagem' ? subtotal * (valorCupomNum / 100) : valorCupomNum;
    }
    
    const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked').value;
    let taxaEntrega = 0;
    let endereco = "Retirada na Loja";
    
    if(tipoEntrega === 'delivery') {
        const selectCidade = document.getElementById('cliente-cidade');
        const cidade = selectCidade && selectCidade.value ? selectCidade.value : '';
        const selectBairro = document.getElementById('cliente-bairro');
        const opcaoSelecionada = selectBairro.options[selectBairro.selectedIndex];
        taxaEntrega = Number(opcaoSelecionada.getAttribute('data-taxa')) || 0;
        
        const bairro = selectBairro.value;
        const rua = document.getElementById('cliente-rua').value.trim();
        const num = document.getElementById('cliente-numero').value.trim();
        const comp = document.getElementById('cliente-complemento').value.trim();
        endereco = `${rua}, ${num} ${comp ? '- ' + comp : ''} - ${bairro} ${cidade ? '(' + cidade + ')' : ''}`;
    }

    let totalFinal = (subtotal - desconto) + taxaEntrega;
    if (totalFinal < 0) totalFinal = 0;

    let pagamento = document.querySelector('input[name="forma_pag"]:checked').value;
    if (pagamento === 'Dinheiro') {
        const troco = document.getElementById('cliente-troco').value.trim();
        if (troco) pagamento += ` (Troco para ${troco})`;
    }

    const nome = document.getElementById('cliente-nome').value.trim();
    const telefone = padronizarTelefone(document.getElementById('cliente-telefone').value.trim());
    
    // 🚀 CRM: Salva na observação se o cliente gastou o prêmio Fidelidade ou outro cupom
    let observacao = document.getElementById('cliente-observacao').value.trim();
    if (cupomAtivo) {
        observacao = observacao ? `${observacao} | [Cupom: ${cupomAtivo.codigo}]` : `[Cupom: ${cupomAtivo.codigo}]`;
    }

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
                status: statusForcado,
                cliente_nome: nome,
                cliente_telefone: telefone,
                cliente_endereco: endereco,
                origem: tipoEntrega === 'delivery' ? "Delivery" : "Balcão (App)",
                observacoes: observacao,
                transacao_id: transacaoId
            })
        });

        if (!res.ok) console.log("Aviso: Falha ao registrar na nuvem.");
    } catch (e) { 
        console.log("Aviso: Falha de rede ao registrar.");
    }
}

// ==========================================
// 📲 ENVIO PARA O WHATSAPP E RASTREIO
// ==========================================
let rastreioIntervalo = null;
let rastreioPedidoId = null;
let rastreioTelefoneCliente = "";

// ==========================================
// 📲 ENVIO DIRETO PARA A NUVEM E DISPARO DO PIXEL
// ==========================================
async function processarEnvioWhatsApp() {
    const btn = document.getElementById('btn-avancar-checkout');
    if(btn) {
        btn.innerText = "⏳ Enviando Pedido...";
        btn.disabled = true;
    }

    // 1. Salva o pedido direto no Banco de Dados
    await salvarVendaDelivery("Pendente Delivery"); 

    // 2. Calcula os valores totais exatos (Subtotal + Taxa - Desconto)
    let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
    let desconto = 0;
    let taxaEntrega = 0;

    if (cupomAtivo) {
        let valorCupomNum = Number(cupomAtivo.valor) || 0;
        desconto = cupomAtivo.tipo === 'porcentagem' ? subtotal * (valorCupomNum / 100) : valorCupomNum;
    }

    const tipoEntregaChecked = document.querySelector('input[name="tipo_entrega"]:checked');
    if (tipoEntregaChecked && tipoEntregaChecked.value === 'delivery') {
        const selectBairro = document.getElementById('cliente-bairro');
        if (selectBairro && selectBairro.selectedIndex >= 0 && selectBairro.value !== "Retirada no Local") {
            taxaEntrega = Number(selectBairro.options[selectBairro.selectedIndex].getAttribute('data-taxa')) || 0;
        }
    }

    let totalFinal = (subtotal + taxaEntrega) - desconto;
    if (totalFinal < 0) totalFinal = 0;

    // Registra o cupom se houver
    if (cupomAtivo) {
        await registrarUsoCupomNaNuvem(cupomAtivo.codigo, totalFinal);
    }

    // 📸 3. META PIXEL: Avisa o Facebook da Compra (COM O VALOR REAL) ANTES de limpar o carrinho!
    try {
        console.log("🎯 Disparando Pixel de Compra (Entrega). Valor BRL:", totalFinal);
        if (typeof fbq === 'function') {
            fbq('track', 'Purchase', { currency: 'BRL', value: totalFinal });
        }
    } catch(e) { console.log("⚠️ Erro no Pixel:", e); }

    // 4. Limpa o carrinho e esconde a tela de checkout
    carrinho = []; 
    atualizarBarraCarrinho(); 
    fecharModalCheckout();
    
    // 5. Captura o telefone para o Radar e abre a tela de rastreio instantaneamente
    rastreioTelefoneCliente = padronizarTelefone(document.getElementById('cliente-telefone').value.trim());
    abrirTelaRastreio();

    if(btn) {
        btn.innerText = "Enviar Pedido 🚀";
        btn.disabled = false;
    }
}
// ==========================================
// 📡 RADAR DE RASTREIO E FIDELIDADE
// ==========================================
async function abrirTelaRastreio() {
    document.getElementById('modal-rastreio').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    try {
        // Puxa as vendas para achar o ID exato desse pedido recém-criado e contar a fidelidade
        const res = await fetch(`${API_URL}/vendas/cliente/${encodeURIComponent(rastreioTelefoneCliente)}`);
        const comprasDesteCliente = await res.json();
        
        if (comprasDesteCliente.length > 0) {
            // O pedido mais recente é o de maior ID
            const ultimoPedido = comprasDesteCliente.reduce((max, p) => p.id > max.id ? p : max, comprasDesteCliente[0]);
            rastreioPedidoId = ultimoPedido.id;
            
            // 🧠 CORREÇÃO DO CRM: Calcula os pontos da cartela atual ignorando cancelados
            const comprasValidas = comprasDesteCliente.filter(c => c.status !== 'Cancelado');
            const totalPedidos = comprasValidas.length;
            const metaPontos = 10; 
            
            let pontosNaCartela = totalPedidos % metaPontos;
            // Se completou a cartela exata (ex: 10, 20), mostra 10 em vez de 0
            if (totalPedidos > 0 && pontosNaCartela === 0) pontosNaCartela = metaPontos;
            
            // Atualiza a bolha do CRM Fidelidade com o loop correto
            document.getElementById('rastreio-fidelidade-qtd').innerText = pontosNaCartela;
            
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
        const res = await fetch(`${API_URL}/vendas/cliente/${encodeURIComponent(rastreioTelefoneCliente)}`);
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
        if (configs.cupons_delivery) { try { cuponsGlobais = JSON.parse(configs.cupons_delivery); atualizarBarraCupom(); } catch(e) {} }
        if (configs.banner_loja && document.getElementById('img-banner-loja')) document.getElementById('img-banner-loja').src = configs.banner_loja;
        if (configs.logo_loja && document.getElementById('img-logo-loja')) document.getElementById('img-logo-loja').src = configs.logo_loja;
        if (configs.pedido_minimo_delivery) pedidoMinimoDeliveryGlobal = parseFloat(configs.pedido_minimo_delivery) || 0;

        if (configs.endereco_loja) {
            if(document.getElementById('loja-endereco-texto')) document.getElementById('loja-endereco-texto').innerText = configs.endereco_loja;
            if(document.getElementById('modal-endereco-texto')) document.getElementById('modal-endereco-texto').innerText = configs.endereco_loja;
        }
        if (configs.horarios_loja && document.getElementById('modal-horarios-texto')) document.getElementById('modal-horarios-texto').innerText = configs.horarios_loja;
        if (configs.pagamentos_loja && document.getElementById('modal-pagamentos-texto')) document.getElementById('modal-pagamentos-texto').innerText = configs.pagamentos_loja;

        const status = configs.status_delivery || 'aberto';
        // 🐛 CORREÇÃO: ID correto que está no HTML
        const statusText = document.getElementById('indicador-status-loja'); 
        
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

            // 🛡️ TRAVA DE SEGURANÇA
            if (statusText) {
                statusText.innerText = `🔴 Estamos fechados, abre ${textoAbertura}`;
                statusText.style.color = "#f44336"; 
            }
            
            const telaPreta = document.getElementById('overlay-loja-fechada');
            if (telaPreta) telaPreta.style.display = 'none';

            // ⏱️ Oculta o tempo de entrega se a loja estiver fechada
            const indicadorTempo = document.getElementById('indicador-tempo-entrega');
            if (indicadorTempo) indicadorTempo.style.display = 'none';

        } else {
            lojaAberta = true;
            if (statusText) {
                statusText.innerText = "🟢 Recebendo pedidos";
                statusText.style.color = "#25D366"; 
            }
            
            // ⏱️ Exibe o tempo de entrega em tempo real sincronizado com a Gestão!
            const indicadorTempo = document.getElementById('indicador-tempo-entrega');
            if (indicadorTempo) {
                indicadorTempo.innerHTML = `⏱️ Tempo de Entrega: ~ ${configs.tempo_entrega || 45} min`;
                indicadorTempo.style.display = 'flex';
            }
        }

    } catch (e) { console.error("Erro configurações:", e); }
}

// ==========================================
// RENDERIZAR O CARROSSEL SEGUINDO A ORDEM DO PAINEL
// ==========================================
function renderizarCarrossel(produtos) {
    const secao = document.getElementById('secao-destaques');
    const carrossel = document.getElementById('carrossel-produtos');
    if (!secao || !carrossel) return;

    // 1. Array vazio para guardar os produtos na ordem EXATA do painel
    const produtosDestaqueOrdenados = [];

    // 2. Lê a lista de IDs que foi salva no Gestão Delivery e adiciona na ordem
    idsDestaquesGlobais.forEach(idSalvo => {
        const prod = produtos.find(p => Number(p.id) === Number(idSalvo) && p.ativo !== false);
        if (prod) {
            produtosDestaqueOrdenados.push(prod);
        }
    });

    // Se não tiver nenhum destaque ativo, esconde a seção
    if (produtosDestaqueOrdenados.length === 0) return secao.style.display = 'none';

    secao.style.display = 'block'; 
    carrossel.innerHTML = '';
    
    // 3. Renderiza os produtos ordenados perfeitamente
    produtosDestaqueOrdenados.forEach(p => {
        // 🚀 O CÉREBRO DAS TAGS TAMBÉM NO CARROSSEL
        let tagHtml = '';
        if (p.tag && p.tag !== '') {
            const nomesTags = { 'so_hoje': 'Só hoje', 'mais_pedido': 'Mais pedido', 'oferta': 'Oferta', 'novidade': 'Novidade', 'poucas_unidades': 'Poucas Unidades' };
            tagHtml = `<div class="tag-flutuante tag-${p.tag}">${nomesTags[p.tag] || p.tag}</div>`;
        }

        // 💰 MATEMÁTICA DA PROMOÇÃO (Sincronizada com o Carrossel)
        let precoHtml = `<div class="preco" style="color: var(--cor-primaria); font-weight: bold; font-size: 1.1rem;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>`;
        
        if (isPromocaoAtivaAgora(p)) {
            let precoComDesconto = Number(p.preco);
            if (p.tipo_promocao === 'porcentagem') {
                precoComDesconto -= precoComDesconto * (Number(p.valor_promocao) / 100);
            } else if (p.tipo_promocao === 'fixo') {
                precoComDesconto -= Number(p.valor_promocao);
            }
            if (precoComDesconto < 0) precoComDesconto = 0;
            
            // Layout com preço riscado empilhado para caber bonitinho no card do carrossel
            precoHtml = `
                <div style="display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 5px;">
                    <span style="text-decoration: line-through; color: #999; font-size: 0.8rem; margin-bottom: -2px;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</span>
                    <strong class="preco" style="color: #25D366; font-size: 1.1rem;">R$ ${precoComDesconto.toFixed(2).replace('.', ',')}</strong>
                </div>
            `;
        }

        const visualProduto = p.imagem_url 
            ? `<div style="position: relative;">
                   ${tagHtml}
                   <img src="${p.imagem_url}" loading="lazy" style="width: 100%; height: 110px; object-fit: cover; border-radius: 10px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
               </div>`
            : `<div style="position: relative;">
                   ${tagHtml}
                   <div style="font-size: 3.5rem; text-align: center; margin-bottom: 10px; height: 110px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border-radius: 10px;">${p.emoji || '🍦'}</div>
               </div>`;

        carrossel.innerHTML += `
            <div class="card-destaque" onclick="verificarAdicao(${p.id})" style="display: flex; flex-direction: column; justify-content: space-between;">
                ${visualProduto}
                <div>
                    <h4 style="margin: 0 0 5px 0; font-size: 0.95rem;">${p.nome}</h4>
                    ${precoHtml}
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

    // 🛡️ O TRADUTOR: Pega os IDs da nuvem e força todos a virarem números de matemática
    const idsSeguros = idsUpsellGlobais.map(id => Number(id));
    
    // Procura os produtos garantindo que número bata com número!
    const produtosUpsell = produtosDaNuvem.filter(p => idsSeguros.includes(Number(p.id)) && p.ativo !== false);

    // Se não achar nada ou não tiver desconto, esconde
    if (produtosUpsell.length === 0 || descontoUpsellGlobal <= 0) {
        area.style.display = 'none';
        return;
    }

    area.style.display = 'block';
    carrossel.innerHTML = '';

    produtosUpsell.forEach(p => {
        const precoNormal = Number(p.preco);
        const descontoReais = precoNormal * (descontoUpsellGlobal / 100);
        const precoComDesconto = precoNormal - descontoReais;
        const nomeLimpo = p.nome.replace(/'/g, "\\'"); 

        const visualProduto = p.imagem_url 
            ? `<img src="${p.imagem_url}" loading="lazy" style="width: 100%; height: 75px; object-fit: cover; border-radius: 6px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">`
            : `<div style="font-size: 2.5rem; text-align: center; margin-bottom: 8px; height: 75px; display: flex; align-items: center; justify-content: center; background:#f8f9fa; border-radius: 6px;">${p.emoji || '🍦'}</div>`;

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
    // 🚀 Atualiza a tela do carrinho instantaneamente para o cliente ver!
    renderizarListaCarrinhoCliente();
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
        // Verifica se a categoria principal OU a adicional tem esse produto
        const temProduto = lista.some(p => {
            let catPrincipal = (p.categoria && p.categoria !== 'null') ? p.categoria : 'Diversos';
            if (catPrincipal === catNome) return true;
            
            if (p.categorias_adicionais) {
                try {
                    let extras = typeof p.categorias_adicionais === 'string' ? JSON.parse(p.categorias_adicionais) : p.categorias_adicionais;
                    if (Array.isArray(extras) && extras.includes(catNome)) return true;
                } catch(e) {}
            }
            return false;
        });

        if (temProduto) {
            html += `
            <div onclick="rolarParaCategoria('${catNome.replace(/'/g, "\\'")}')" style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; background: #ffffff; padding: 10px 20px; border-radius: 50px; border: 1px solid #e4e6eb; box-shadow: 0 4px 6px rgba(0,0,0,0.04); color: #333; font-family: 'Poppins', sans-serif; font-weight: bold; font-size: 0.95rem; transition: 0.2s;">
                ${catNome}
            </div>`;
        }
    });

    container.innerHTML = html;
}

// Ação que abre e fecha a sanfona ao clicar nela
window.toggleCategoriaCardapio = function(conteudoId, elementoHeader) {
    const conteudo = document.getElementById(conteudoId);
    const seta = elementoHeader.querySelector('.seta-categoria');
    
    if (conteudo.style.display === 'none' || conteudo.style.display === '') {
        // 1. Mostra a categoria
        conteudo.style.display = 'block';
        
        // 2. 🪄 O GATILHO DA DESCIDA SUAVE
        conteudo.classList.remove('animar-sanfona');
        void conteudo.offsetWidth; // Truque para reiniciar a animação
        conteudo.classList.add('animar-sanfona');

        if(seta) seta.style.transform = 'rotate(180deg)'; // Gira a setinha para cima
    } else {
        conteudo.style.display = 'none';
        if(seta) seta.style.transform = 'rotate(0deg)'; // Volta a setinha para baixo
    }
};

// Inteligência que liga as bolinhas de atalho (Story) com as sanfonas
window.rolarParaCategoria = function(nomeCategoria) {
    const catId = 'categoria-' + nomeCategoria.replace(/[^a-zA-Z0-9]/g, '');
    const headerElement = document.getElementById(catId);
    
    if (headerElement) {
        const conteudoId = 'conteudo-' + catId;
        const conteudo = document.getElementById(conteudoId);
        const seta = headerElement.querySelector('.seta-categoria');
        
        // Se a pessoa clicou no atalho e a sanfona estava fechada, o sistema abre ela com animação!
        if (conteudo && (conteudo.style.display === 'none' || conteudo.style.display === '')) {
            conteudo.style.display = 'block';
            
            conteudo.classList.remove('animar-sanfona');
            void conteudo.offsetWidth;
            conteudo.classList.add('animar-sanfona');

            if(seta) seta.style.transform = 'rotate(180deg)';
        }

        // Rola a tela suavemente até a categoria
        const y = headerElement.getBoundingClientRect().top + window.scrollY - 80; 
        window.scrollTo({ top: y, behavior: 'smooth' });
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
        // 1. Tira tudo que não é número
        let numeroLimpo = e.target.value.replace(/\D/g, '');

        // 2. O PULO DO GATO: Se começar com 55 e tiver números suficientes, arranca o 55 fora!
        if (numeroLimpo.startsWith('55') && numeroLimpo.length >= 12) {
            numeroLimpo = numeroLimpo.substring(2);
        }

        // 3. Aplica a Máscara Visual (XX) XXXXX-XXXX
        let x = numeroLimpo.match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
        if (!x) {
            e.target.value = '';
        } else {
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        }

        // 4. O Gatilho do CRM: Se o número estiver completinho (15 caracteres)
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

        const res = await fetch(`${API_URL}/vendas/cliente/${encodeURIComponent(telefoneFormatado)}`);
        const compras = await res.json();
        
        if (compras.length > 0) {
            // Filtra pedidos cancelados para não dar pontos indevidos (Cobre os dois gêneros de palavras)
            const comprasValidas = compras.filter(c => c.status !== 'Cancelado' && c.status !== 'Cancelada');
            
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
            
            // 🚀 CHAMA A BARRINHA DE FIDELIDADE PASSANDO O HISTÓRICO COMPLETO
            ativarBarrinhaFidelidade(comprasValidas);

        } else {
            // Cliente novo, nunca comprou
            if(badge) badge.style.display = 'none'; 
            
            // 🚀 CHAMA A BARRINHA ZERADA
            ativarBarrinhaFidelidade([]);
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
    renderizarUpsellCheckout(); // 🚀 AGORA ELE CARREGA O CARROSSEL AQUI
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
    
    // 👇 MATEMÁTICA DO DESCONTO NO CARRINHO
    let desconto = 0;
    let htmlDesconto = '';
    
    if (cupomAtivo) {
        let valorCupomNum = Number(cupomAtivo.valor) || 0;
        desconto = cupomAtivo.tipo === 'porcentagem' ? subtotal * (valorCupomNum / 100) : valorCupomNum;
        htmlDesconto = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.95rem; color: #4CAF50;">
                <span>Desconto (${cupomAtivo.codigo})</span>
                <strong>- R$ ${desconto.toFixed(2).replace('.', ',')}</strong>
            </div>
        `;
    }

    let totalFinal = subtotal - desconto;
    if(totalFinal < 0) totalFinal = 0;

    const areaTotais = document.getElementById('area-totais-carrinho');
    if(areaTotais) {
        areaTotais.innerHTML = `
            <div style="width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 1rem; color: #777;">
                    <span>Subtotal:</span>
                    <span>R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                ${htmlDesconto}
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                    <span style="font-size: 1.1rem; color: #333; font-weight: 600;">Total:</span>
                    <strong style="font-size: 1.5rem; color: var(--cor-primaria, #e91e63);">R$ ${totalFinal.toFixed(2).replace('.', ',')}</strong>
                </div>
            </div>
        `;
    }
    
    if (carrinho.length === 0) {
        fecharModalCarrinho();
        if (typeof atualizarBarraCarrinho === "function") atualizarBarraCarrinho();
    }
}

function removerItemCarrinhoCliente(index) {
    carrinho.splice(index, 1);
    atualizarBarraCarrinho(); // Recalcula a matemática e invalida cupons primeiro!
    renderizarListaCarrinhoCliente(); // Depois desenha o carrinho
}

function irParaCheckout() {
    
    // SENSOR 4: Cliente foi para a tela de pagamento/endereço!
    registrarEventoFunil('Iniciou Checkout');

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
// ⭐ BARRINHA DE FIDELIDADE DINÂMICA (ACUMULATIVA)
// ==========================================
function ativarBarrinhaFidelidade(comprasValidas) {
    let areaFidelidade = document.getElementById('area-fidelidade-checkout');
    
    if (!areaFidelidade) {
        areaFidelidade = document.createElement('div');
        areaFidelidade.id = 'area-fidelidade-checkout';
        areaFidelidade.style.cssText = "background: #fff; padding: 15px; border-radius: 12px; margin-bottom: 15px; border: 1px solid #e0e0e0; box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: 0.3s;";
        
        // 🚀 BARRINHA ANCORADA NO TOPO DO RESUMO!
        const ancoraFidelidade = document.getElementById('ancora-fidelidade');
        if (ancoraFidelidade && ancoraFidelidade.parentNode) {
            ancoraFidelidade.parentNode.insertBefore(areaFidelidade, ancoraFidelidade);
        }

        if(!document.getElementById('animacao-fidelidade')) {
            const style = document.createElement('style');
            style.id = 'animacao-fidelidade';
            style.innerHTML = `@keyframes piscarBarraFutura { 0% { opacity: 0.4; } 100% { opacity: 1; } }`;
            document.head.appendChild(style);
        }
    }

    areaFidelidade.style.display = 'block';

    // 🧮 A MATEMÁTICA DO ACÚMULO DE PRÊMIOS
    const metaPontos = 10; 
    const totalPedidos = comprasValidas.length;
    
    // Progresso atual na cartela (Ex: Se tem 12 pedidos, o resto é 2)
    const pontosNaCartela = totalPedidos % metaPontos;
    
    // Quantos prêmios ele já conquistou na vida? (Ex: 12 pedidos = 1 prêmio)
    const premiosGanhos = Math.floor(totalPedidos / metaPontos);
    
    // Quantos ele já usou? (Contamos no histórico de observações)
    const premiosUsados = comprasValidas.filter(v => v.observacoes && v.observacoes.includes('FIDELIDADE_VIP')).length;
    
    // O saldo real de prêmios que ele pode resgatar hoje
    let premiosDisponiveis = premiosGanhos - premiosUsados;
    if (premiosDisponiveis < 0) premiosDisponiveis = 0;

    // 📊 UI DO PRÊMIO DISPONÍVEL (Fica no topo se ele tiver saldo)
    let htmlPremio = '';
    if (premiosDisponiveis > 0) {
        htmlPremio = `
            <div style="background: linear-gradient(135deg, #fffbeb, #fff8e1); border: 1px solid #ffe082; padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                <strong style="color: #f57f17; font-size: 1.05rem;">🎁 Você tem ${premiosDisponiveis} prêmio(s) disponível(is)!</strong>
                <p style="font-size: 0.85rem; color: #555; margin: 5px 0 10px 0;">Use agora ou guarde para o próximo pedido.</p>
                <button id="btn-resgatar-fidelidade" onclick="resgatarFidelidade()" style="width: 100%; padding: 10px; background: #FF9800; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; animation: piscarBarraFutura 1s infinite alternate;">
                    Resgatar Prêmio Agora
                </button>
            </div>
        `;
    }

    // 📊 UI DA BARRA DE PROGRESSO (Sempre visível mostrando a cartela atual)
    const porcentagemAtual = (pontosNaCartela / metaPontos) * 100;
    const porcentagemFutura = (1 / metaPontos) * 100;

    let mensagem = `Você tem <strong>${pontosNaCartela}</strong> pontos e ganhará <strong style="color: #FF9800;">+ 1</strong> neste pedido!`;
    if (pontosNaCartela === metaPontos - 1) {
        mensagem = `Você tem <strong>${pontosNaCartela}</strong> pontos. Este pedido vai <strong>completar sua cartela!</strong> 🎉`;
    } else if (pontosNaCartela === 0 && totalPedidos === 0) {
        mensagem = `Ganhe seu <strong>1º ponto</strong> ao finalizar este pedido! 🎉`;
    } else if (pontosNaCartela === 0 && totalPedidos > 0) {
        mensagem = `Cartela nova! Ganhe o <strong>1º ponto</strong> desta rodada ao finalizar! 🎉`;
    }

    areaFidelidade.innerHTML = `
        ${htmlPremio}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="color: #333; font-size: 1rem;">⭐ Cartão Fidelidade</strong>
            <span style="background: var(--cor-primaria, #e91e63); color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">${pontosNaCartela} / ${metaPontos}</span>
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

// ==========================================
// 💸 MOTOR DE PIX DINÂMICO MERCADO PAGO
// ==========================================
let verificadorPix = null;

async function gerarEPagarPix() {
    const btn = document.getElementById('btn-avancar-checkout');
    btn.innerText = "⏳ Gerando Pix Seguro...";
    btn.disabled = true;

    // 1. Calcula o total exato do carrinho
    let subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
    let desconto = 0;
    if (cupomAtivo) {
        let valorCupomNum = Number(cupomAtivo.valor) || 0;
        desconto = cupomAtivo.tipo === 'porcentagem' ? subtotal * (valorCupomNum / 100) : valorCupomNum;
    }

    const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked').value;
    let taxaEntrega = 0;
    if(tipoEntrega === 'delivery') {
        const selectBairro = document.getElementById('cliente-bairro');
        taxaEntrega = Number(selectBairro.options[selectBairro.selectedIndex].getAttribute('data-taxa')) || 0;
    }

    let totalFinal = (subtotal - desconto) + taxaEntrega;
    if (totalFinal < 0) totalFinal = 0;

    const nome = document.getElementById('cliente-nome').value.trim();
    const telefone = padronizarTelefone(document.getElementById('cliente-telefone').value.trim());

    try {
        // 2. Aciona nosso backend para conversar com o Mercado Pago
        const res = await fetch(`${API_URL}/pagamento/pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: totalFinal, cliente_nome: nome, cliente_telefone: telefone })
        });

        const data = await res.json();

        if (data.sucesso) {
            // 3. Salva a venda travada como "Aguardando Pagamento"
            await salvarVendaDelivery("Aguardando Pagamento", data.transacao_id.toString());

            // 4. Prepara a Interface de Cobrança na tela
            document.getElementById('pix-qr-code').src = `data:image/jpeg;base64,${data.qr_code_base64}`;
            document.getElementById('pix-copia-cola').value = data.qr_code_copia_cola;
            document.getElementById('btn-copiar-pix').innerText = "📋 Copiar Código Pix";
            document.getElementById('pix-status-texto').innerHTML = "⏳ Aguardando pagamento...";
            document.getElementById('pix-status-texto').style.color = "#FF9800";
            document.getElementById('pix-qr-code').style.opacity = "1";

            document.getElementById('modal-pix').style.display = 'flex';
            fecharModalCheckout();

            // 5. Liga o Sonar: Checa a cada 5 segundos se o Webhook deu baixa no pagamento
            if(verificadorPix) clearInterval(verificadorPix);
            verificadorPix = setInterval(() => checarStatusPagamento(data.transacao_id), 5000);

        } else {
            alert("⚠️ Não foi possível gerar o Pix. Selecione outra forma de pagamento.");
            btn.innerText = "Enviar Pedido 🚀";
            btn.disabled = false;
        }
    } catch (e) {
        alert("❌ Erro de conexão ao tentar gerar o Pix.");
        btn.innerText = "Enviar Pedido 🚀";
        btn.disabled = false;
    }
}

function copiarPix() {
    const input = document.getElementById('pix-copia-cola');
    input.select();
    document.execCommand('copy');
    document.getElementById('btn-copiar-pix').innerText = "✅ Código Copiado!";
}

function cancelarPix() {
    if(verificadorPix) clearInterval(verificadorPix);
    document.getElementById('modal-pix').style.display = 'none';
    document.getElementById('modal-checkout').style.display = 'flex';
    const btn = document.getElementById('btn-avancar-checkout');
    btn.innerText = "Enviar Pedido 🚀";
    btn.disabled = false;
}

// ==========================================
// 📡 SONAR DO PIX COM DISPARO DE PIXEL META
// ==========================================
async function checarStatusPagamento(transacaoId) {
    try {
        const resStatus = await fetch(`${API_URL}/pagamento/pix/${transacaoId}/status`);
        const dataStatus = await resStatus.json();

        if (dataStatus.pago) {
            clearInterval(verificadorPix);

            document.getElementById('pix-status-texto').innerHTML = "✅ Pagamento Confirmado!";
            document.getElementById('pix-status-texto').style.color = "#4CAF50";
            document.getElementById('pix-qr-code').style.opacity = "0.2";

            // Calcula o valor para o Pixel
            let totalPix = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
            const tipoEntregaChecked = document.querySelector('input[name="tipo_entrega"]:checked');
            if (tipoEntregaChecked && tipoEntregaChecked.value === 'delivery') {
                const selectBairro = document.getElementById('cliente-bairro');
                if (selectBairro && selectBairro.selectedIndex >= 0 && selectBairro.value !== "Retirada no Local") {
                    totalPix += Number(selectBairro.options[selectBairro.selectedIndex].getAttribute('data-taxa')) || 0;
                }
            }

            // Aplica descontos no CRM caso haja cupom e ajusta o valor do Pixel
            if (cupomAtivo) {
                const resVenda = await fetch(`${API_URL}/vendas`);
                const vendas = await resVenda.json();
                const venda = vendas.find(v => v.transacao_id === transacaoId.toString());
                if(venda) {
                    await registrarUsoCupomNaNuvem(cupomAtivo.codigo, venda.valor_total);
                    totalPix = Number(venda.valor_total);
                }
            }

            // 📸 META PIXEL: Avisa o Facebook da Compra via PIX!
            try {
                console.log("🎯 Disparando Pixel de Compra (Pix). Valor BRL:", totalPix);
                if (typeof fbq === 'function') {
                    fbq('track', 'Purchase', { currency: 'BRL', value: totalPix });
                }
            } catch(e) { console.log("⚠️ Erro no Pixel:", e); }

            setTimeout(() => {
                document.getElementById('modal-pix').style.display = 'none';
                carrinho = [];
                atualizarBarraCarrinho();

                rastreioTelefoneCliente = padronizarTelefone(document.getElementById('cliente-telefone').value.trim());
                abrirTelaRastreio();
            }, 2000);
        }
    } catch (e) { }
}

// ==========================================
// EFEITO FOTO EXPANDIDA (LIGHTBOX)
// ==========================================
function abrirFotoInteira(urlImagem) {
    const lightbox = document.getElementById('lightbox-foto');
    const img = document.getElementById('lightbox-img');
    
    img.src = urlImagem;
    lightbox.style.display = 'flex';
    
    // Pequeno atraso para a animação do CSS funcionar graciosamente
    setTimeout(() => {
        lightbox.style.opacity = '1';
        img.style.transform = 'scale(1)';
    }, 10);
}

function fecharFotoInteira() {
    const lightbox = document.getElementById('lightbox-foto');
    const img = document.getElementById('lightbox-img');
    
    // Faz o efeito reverso (encolhe e some)
    lightbox.style.opacity = '0';
    img.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        lightbox.style.display = 'none';
        img.src = ''; // Limpa a memória
    }, 300);
}

// ==========================================
// 🎟️ GAMIFICAÇÃO: BARRA DE PROGRESSO DO CUPOM
// ==========================================
function atualizarBarraCupom() {
    const barraCupom = document.getElementById('barra-cupom-flutuante');
    if (!barraCupom) return;

    // Busca nas configurações se existe algum cupom marcado para aparecer no rodapé
    // (A variável 'destaque_rodape' será criada no Gestão Delivery depois)
    const cupomDestaque = cuponsGlobais.find(c => c.destaque_rodape === true);

    if (!cupomDestaque || !cupomDestaque.minimo || Number(cupomDestaque.minimo) <= 0) {
        barraCupom.style.display = 'none';
        return;
    }

    barraCupom.style.display = 'block';

    const subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco), 0);
    const minimo = Number(cupomDestaque.minimo);
    const falta = minimo - subtotal;
    
    let porcentagem = (subtotal / minimo) * 100;
    if (porcentagem > 100) porcentagem = 100;

    const textoChamada = document.getElementById('texto-cupom-chamada');
    const textoFalta = document.getElementById('texto-cupom-falta');
    const barraProgresso = document.getElementById('barra-cupom-progresso');

    const valorDescontoTxt = cupomDestaque.tipo === 'porcentagem' ? `${cupomDestaque.valor}% OFF` : `R$ ${Number(cupomDestaque.valor).toFixed(2).replace('.', ',')} OFF`;

    if (falta > 0) {
        textoChamada.innerHTML = `🎟️ Desbloqueie ${valorDescontoTxt}`;
        textoFalta.innerHTML = `Falta R$ ${falta.toFixed(2).replace('.', ',')}`;
        barraProgresso.style.background = '#FF9800'; // Laranja enquanto enche
        
        // Se o cliente remover algo e cair do mínimo, removemos o auto-aplicar
        if (cupomAtivo && cupomAtivo.codigo === cupomDestaque.codigo) {
            cupomAtivo = null;
            document.getElementById('input-cupom').value = '';
            document.getElementById('msg-cupom').style.display = 'none';
        }
    } else {
        textoChamada.innerHTML = `🎉 ${valorDescontoTxt} Liberado!`;
        textoFalta.innerHTML = `Aplicado no carrinho`;
        barraProgresso.style.background = '#25D366'; // Verde quando atinge a meta
        
        // Auto-aplica o cupom! (Se ele já não tiver outro cupom melhor digitado)
        if (!cupomAtivo || cupomAtivo.codigo === cupomDestaque.codigo) {
            cupomAtivo = cupomDestaque;
            const inputCupom = document.getElementById('input-cupom');
            const msgCupom = document.getElementById('msg-cupom');
            
            if (inputCupom && msgCupom) {
                inputCupom.value = cupomDestaque.codigo;
                msgCupom.innerText = `✅ Cupom de ${valorDescontoTxt} aplicado automaticamente!`;
                msgCupom.style.color = "#25D366";
                msgCupom.style.display = 'block';
            }
        }
    }

    barraProgresso.style.width = `${porcentagem}%`;

    // Empurra a barra do cupom para cima se o botão do carrinho flutuante aparecer
    if (carrinho.length > 0) {
        barraCupom.style.bottom = '85px'; // Sobe para ficar acima do "Ver Carrinho"
    } else {
        barraCupom.style.bottom = '0px'; // Fica colada embaixo
    }
    
    // Atualiza a matemática do checkout
    if (typeof atualizarTotalCheckout === 'function') atualizarTotalCheckout();
}

// ==========================================
// 📡 AVISAR O PDV QUE ESTOU ONLINE (SOCKET.IO)
// ==========================================
try {
    const socket = io('https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host');
    socket.on('connect', () => {
        socket.emit('entrou_no_cardapio'); // Avisa o servidor "Olá, abri o menu!"
    });
} catch(e) {
    console.log("⚠️ Falha ao conectar no radar", e);
}

// ==========================================
// 📱 UX MOBILE: EVITAR QUE O TECLADO CUBRA OS CAMPOS
// ==========================================
document.addEventListener('focusin', function(e) {
    const tag = e.target.tagName;
    
    // Verifica se o cliente tocou em um campo de digitação ou seleção
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        setTimeout(() => {
            // Empurra o campo suavemente para o centro do espaço livre da tela
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400); // 400ms é o tempo exato para o teclado terminar a animação de subida no Android/iOS
    }
});

// ==========================================
// 📲 MÁGICA DO APP NATIVO (PWA)
// ==========================================
let eventoInstalacaoPWA;

// 1. Acorda o Trabalhador Invisível
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
        console.log("✅ Motor do App (PWA) ativado com sucesso!");
    }).catch(err => console.log("⚠️ Erro no motor do App:", err));
}

// 2. Escuta quando o celular liberar a instalação
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Impede a barra padrão chata do Android
    eventoInstalacaoPWA = e; // Guarda a permissão na manga
    
    // Espera 4 segundos para não ser agressivo assim que o cliente abre o menu
    setTimeout(() => {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.style.display = 'flex';
            banner.style.animation = 'subirTela 0.4s ease-out'; // Aproveita sua animação já existente
        }
    }, 4000);
});

// 3. Ação do botão Instalar
window.instalarPWA = function() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'none';
    
    if (eventoInstalacaoPWA) {
        eventoInstalacaoPWA.prompt(); // Mostra a telinha oficial de instalação do celular
        eventoInstalacaoPWA.userChoice.then((escolha) => {
            if (escolha.outcome === 'accepted') {
                console.log('🎉 Cliente instalou o App Icesoft!');
            }
            eventoInstalacaoPWA = null;
        });
    }
};

// 4. Ação do botão "Agora não"
window.fecharBannerPWA = function() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'none';
};