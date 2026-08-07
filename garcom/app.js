const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';

let listaProdutos = [];
let categoriasGlobais = [];
let gruposGlobais = [];
let carrinho = [];

// 🪑 MEMÓRIA DE MESAS
let mesasAbertas = [];
let idMesaAtual = null;
let numeroMesaAtual = null;

// 💰 MEMÓRIA DE PAGAMENTO
let itensRestantesNaMesa = [];
let itensSendoPagos = [];
let isPagamentoDivididoMesa = false;

// 🍨 MEMÓRIA DE EDIÇÃO E ADICIONAIS
let produtoEmSelecao = null;
let adicionaisSelecionados = [];
let itemEmEdicaoIndex = null;

window.onload = async () => {
    await carregarDadosBasicos();
    recuperarEstadoPedido(); // 👇 NOVO: Tenta recuperar o pedido caso a página tenha recarregado
};

// 👇 NOVA FUNÇÃO: Puxa da memória o carrinho que estava sendo montado
function recuperarEstadoPedido() {
    const memoria = localStorage.getItem('icesoft_estado_pedido');
    if (memoria) {
        const estadoSalvo = JSON.parse(memoria);
        
        // Se havia itens no carrinho, nós restauramos a tela de produtos
        if (estadoSalvo.carrinho && estadoSalvo.carrinho.length > 0) {
            carrinho = estadoSalvo.carrinho;
            idMesaAtual = estadoSalvo.idMesaAtual;
            numeroMesaAtual = estadoSalvo.numeroMesaAtual;
            modoComandaRapida = estadoSalvo.modoComandaRapida;

            // Esconde o mapa de mesas e mostra a lista de produtos
            document.getElementById('tela-mesas').style.display = 'none';
            document.getElementById('tela-produtos').style.display = 'block';
            document.getElementById('btn-voltar-header').style.display = 'block';
            document.getElementById('icone-header').style.display = 'none';
            
            // Corrige o título do topo para refletir a mesa ou comanda
            if (modoComandaRapida) {
                document.getElementById('titulo-header').innerText = `Lançar Comanda`;
            } else {
                document.getElementById('titulo-header').innerText = idMesaAtual ? `Add à Mesa ${numeroMesaAtual}` : `Lançando na Mesa ${numeroMesaAtual}`;
            }

            atualizarBarraCarrinho(); // Recalcula e mostra a barrinha de preço embaixo
        }
    }
}

async function carregarDadosBasicos() {
    try {
        const cracha = localStorage.getItem('icesoft_token');
        const [resProd, resCat, resGrp, resMesas] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/categorias`),
            fetch(`${API_URL}/grupos`),
            fetch(`${API_URL}/mesas`, { headers: { 'Authorization': `Bearer ${cracha}` } })
        ]);

        const produtosBrutos = await resProd.json();
        listaProdutos = produtosBrutos.filter(p => p.ativo !== false && !(p.controlar_estoque && Number(p.estoque) <= 0));

        categoriasGlobais = await resCat.json();
        
        const gruposBrutos = await resGrp.json();
        gruposGlobais = gruposBrutos.filter(g => g.ativo !== false).map(g => {
            let itensDoGrupo = typeof g.itens === 'string' ? JSON.parse(g.itens) : g.itens;
            if (itensDoGrupo) g.itens = itensDoGrupo.filter(item => item.ativo !== false);
            return g;
        });

        if (resMesas.ok) {
            mesasAbertas = await resMesas.json();
        }

        renderizarMesasMobile();
        renderizarCategorias();
        renderizarProdutos('Todos');
    } catch (e) {
        alert("Erro ao conectar com o servidor.");
    }
}

// ==========================================
// 1. TELA DE MAPA DE MESAS (Início)
// ==========================================
function renderizarMesasMobile() {
    const containerMesas = document.getElementById('lista-mesas-mobile');
    const containerComandas = document.getElementById('lista-comandas-mobile');
    
    if (containerMesas) containerMesas.innerHTML = '';
    if (containerComandas) containerComandas.innerHTML = '';
    
    let comandasExistem = false;

    // 1. Renderiza as 15 Mesas Físicas
    for (let i = 1; i <= 15; i++) {
        const numeroStr = String(i).padStart(2, '0');
        const mesaOcupada = mesasAbertas.find(m => m.numero === numeroStr);
        
        if (mesaOcupada) {
            let totalMesa = 0;
            (mesaOcupada.itens || []).forEach(item => totalMesa += Number(item.preco));
            
            containerMesas.innerHTML += `
                <div class="mesa-mobile-card mesa-ocupada" onclick="abrirMesaExistenteMobile(${mesaOcupada.id}, '${numeroStr}')">
                    <div>
                        <div style="font-weight: 800; font-size: 1.2rem; color: #333;">Mesa ${numeroStr}</div>
                        <div style="font-size: 0.85rem; color: #666;">${(mesaOcupada.itens || []).length} itens na mesa</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #e91e63; font-weight: 900; font-size: 1.1rem;">R$ ${totalMesa.toFixed(2).replace('.', ',')}</div>
                        <button onclick="event.stopPropagation(); abrirPagamentoMobile(${mesaOcupada.id})" style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: bold; margin-top: 5px; cursor: pointer;">Pagar</button>
                    </div>
                </div>
            `;
        } else {
            containerMesas.innerHTML += `
                <div class="mesa-mobile-card mesa-livre" onclick="abrirNovaMesaMobile('${numeroStr}')">
                    <div style="font-weight: 800; font-size: 1.2rem; color: #333;">Mesa ${numeroStr}</div>
                    <div style="color: #25D366; font-weight: bold;">Liberada</div>
                </div>
            `;
        }
    }

    // 2. Inteligência: Renderiza Comandas Virtuais (Qualquer nome/número que não seja de 01 a 15)
    const comandasVirtuais = mesasAbertas.filter(m => {
        const num = parseInt(m.numero);
        return isNaN(num) || num > 15 || num < 1 || String(num).padStart(2, '0') !== m.numero;
    });

    comandasVirtuais.forEach(comanda => {
        comandasExistem = true;
        let totalComanda = 0;
        (comanda.itens || []).forEach(item => totalComanda += Number(item.preco));
        
        containerComandas.innerHTML += `
            <div class="mesa-mobile-card mesa-ocupada" style="border-left-color: #e91e63;" onclick="abrirMesaExistenteMobile(${comanda.id}, '${comanda.numero}')">
                <div>
                    <div style="font-weight: 800; font-size: 1.2rem; color: #333;"><span class="material-symbols-outlined" style="font-size: 1.1rem; vertical-align: middle;">person</span> ${comanda.numero}</div>
                    <div style="font-size: 0.85rem; color: #666;">${(comanda.itens || []).length} itens na comanda</div>
                </div>
                <div style="text-align: right;">
                    <div style="color: #e91e63; font-weight: 900; font-size: 1.1rem;">R$ ${totalComanda.toFixed(2).replace('.', ',')}</div>
                    <button onclick="event.stopPropagation(); abrirPagamentoMobile(${comanda.id})" style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: bold; margin-top: 5px; cursor: pointer;">Pagar</button>
                </div>
            </div>
        `;
    });

    if (!comandasExistem && containerComandas) {
        containerComandas.innerHTML = '<p style="text-align: center; color: #888; font-size: 0.9rem; padding: 10px;">Nenhuma comanda aberta.</p>';
    }
}

// NOVA FUNÇÃO: Cria a Ficha Digital usando o nome do cliente
function abrirNovaComandaVirtual() {
    const nomeCliente = prompt("Digite o Nome do Cliente ou Identificação da Comanda:\n(Ex: João, Camisa Azul, Ficha 42)");
    if (!nomeCliente || nomeCliente.trim() === '') return;
    
    modoComandaRapida = false; // Desativa fluxos de pagamento imediatos
    idMesaAtual = null;
    numeroMesaAtual = nomeCliente.trim();
    carrinho = [];
    atualizarBarraCarrinho();
    
    document.getElementById('tela-mesas').style.display = 'none';
    document.getElementById('tela-produtos').style.display = 'block';
    document.getElementById('btn-voltar-header').style.display = 'block';
    document.getElementById('icone-header').style.display = 'none';
    document.getElementById('titulo-header').innerText = `Comanda: ${numeroMesaAtual}`;
}

// ==========================================
// 2. NAVEGAÇÃO ENTRE TELAS
// ==========================================
function abrirNovaMesaMobile(numero) {
    idMesaAtual = null;
    numeroMesaAtual = numero;
    carrinho = [];
    atualizarBarraCarrinho();
    
    document.getElementById('tela-mesas').style.display = 'none';
    document.getElementById('tela-produtos').style.display = 'block';
    document.getElementById('btn-voltar-header').style.display = 'block';
    document.getElementById('icone-header').style.display = 'none';
    document.getElementById('titulo-header').innerText = `Lançando na Mesa ${numero}`;
}

function abrirModalNovaMesaMobile() {
    let num = prompt("Digite o número da mesa ou nome do cliente:");
    if (num) abrirNovaMesaMobile(num.padStart(2, '0'));
}

function abrirMesaExistenteMobile(id, numero) {
    idMesaAtual = id;
    numeroMesaAtual = numero;
    carrinho = []; // Carrinho zera, pois vamos lançar NOVOS produtos nesta mesa
    atualizarBarraCarrinho();
    
    document.getElementById('tela-mesas').style.display = 'none';
    document.getElementById('tela-produtos').style.display = 'block';
    document.getElementById('btn-voltar-header').style.display = 'block';
    document.getElementById('icone-header').style.display = 'none';
    document.getElementById('titulo-header').innerText = `Add à Mesa ${numero}`;
}

// 👇 NOVA VARIÁVEL GLOBAL
let modoComandaRapida = false;

// 👇 NOVA FUNÇÃO: Entrar no modo de Comanda Rápida (Sem pedir mesa)
function abrirComandaRapida() {
    modoComandaRapida = true;
    idMesaAtual = null;
    numeroMesaAtual = null;
    carrinho = [];
    atualizarBarraCarrinho();
    
    document.getElementById('tela-mesas').style.display = 'none';
    document.getElementById('tela-produtos').style.display = 'block';
    document.getElementById('btn-voltar-header').style.display = 'block';
    document.getElementById('icone-header').style.display = 'none';
    document.getElementById('titulo-header').innerText = `Lançar Comanda`;
}

function voltarParaMesas() {
    modoComandaRapida = false; // 👇 NOVO: Reseta o modo de comanda ao voltar
    document.getElementById('tela-mesas').style.display = 'flex';
    document.getElementById('tela-produtos').style.display = 'none';
    document.getElementById('btn-voltar-header').style.display = 'none';
    document.getElementById('icone-header').style.display = 'block';
    document.getElementById('titulo-header').innerText = 'Mapa de Mesas';
    carrinho = [];
    atualizarBarraCarrinho();
    carregarDadosBasicos(); // Puxa atualizações que o caixa pode ter feito
}

// ==========================================
// 3. SELEÇÃO DE PRODUTOS E ADICIONAIS (Mantido)
// ==========================================
function renderizarCategorias() {
    const container = document.getElementById('menu-categorias');
    let html = `<button class="btn-categoria ativo" onclick="filtrarCategoria('Todos', this)">Todos</button>`;
    categoriasGlobais.forEach(cat => {
        if (cat.mostrar_cardapio !== false) html += `<button class="btn-categoria" onclick="filtrarCategoria('${cat.nome}', this)">${cat.nome}</button>`;
    });
    container.innerHTML = html;
}

function filtrarCategoria(nomeCat, elementoBtn) {
    document.querySelectorAll('.btn-categoria').forEach(btn => btn.classList.remove('ativo'));
    elementoBtn.classList.add('ativo');
    renderizarProdutos(nomeCat);
}

function renderizarProdutos(filtroCat) {
    const container = document.getElementById('lista-produtos');
    container.innerHTML = '';
    const filtrados = filtroCat === 'Todos' ? listaProdutos : listaProdutos.filter(p => p.categoria === filtroCat || (p.categorias_adicionais && p.categorias_adicionais.includes(filtroCat)));

    filtrados.forEach(p => {
        const iconAdicional = (p.grupos_ids && p.grupos_ids.length > 0) ? `<span class="material-symbols-outlined" style="color:#00bcd4; font-size:18px;">add_circle</span>` : '';
        container.innerHTML += `
            <div class="produto-card" onclick="abrirProduto(${p.id})">
                <div>
                    <div class="prod-nome">${p.nome} ${iconAdicional}</div>
                    <div class="prod-preco">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>
                </div>
            </div>
        `;
    });
}

function abrirProduto(id) {
    produtoEmSelecao = listaProdutos.find(p => p.id === id);
    adicionaisSelecionados = [];
    itemEmEdicaoIndex = null; 

    // O modal agora sempre abre (mesmo sem adicionais) para permitir digitar a observação
    document.getElementById('modal-prod-nome').innerText = produtoEmSelecao.nome;
    
    const btnFooter = document.querySelector('#modal-adicionais .sheet-footer');
    if(btnFooter) {
        btnFooter.style.flexDirection = 'column'; // Empilha a caixa de texto sobre o botão
        btnFooter.innerHTML = `
            <input type="text" id="obs-item" class="input-garcom" placeholder="Nome do cliente ou observação (Opcional)" style="margin-bottom: 12px; border: 1px solid #ccc; background: #fff;">
            <button class="btn-primario" onclick="confirmarItem()">Adicionar <span id="modal-prod-preco">R$ 0,00</span></button>
        `;
    }
    
    atualizarPrecoModal();
    const containerAdc = document.getElementById('modal-prod-adicionais');
    containerAdc.innerHTML = '';

    if (produtoEmSelecao.grupos_ids && produtoEmSelecao.grupos_ids.length > 0) {
        produtoEmSelecao.grupos_ids.forEach(grupoId => {
            const grupo = gruposGlobais.find(g => g.id === grupoId);
            if (!grupo || !grupo.itens) return;
            let htmlGrupo = `<div class="grupo-adc"><div class="grupo-adc-titulo">${grupo.nome}</div>`;
            grupo.itens.forEach(item => {
                const precoAdc = Number(item.preco) > 0 ? `(+ R$ ${Number(item.preco).toFixed(2).replace('.', ',')})` : '';
                htmlGrupo += `
                    <label class="item-adc">
                        <span>${item.nome} <small style="color:#888;">${precoAdc}</small></span>
                        <input type="checkbox" value='${JSON.stringify(item)}' onchange="toggleAdicional(this)">
                    </label>
                `;
            });
            htmlGrupo += `</div>`;
            containerAdc.innerHTML += htmlGrupo;
        });
    } else {
        containerAdc.innerHTML = '<p style="color: #888; text-align: center; margin-top: 10px; font-style: italic;">Adicione uma observação abaixo se necessário.</p>';
    }

    document.getElementById('modal-adicionais').style.display = 'flex';
}

function toggleAdicional(checkbox) {
    const item = JSON.parse(checkbox.value);
    if (checkbox.checked) adicionaisSelecionados.push(item);
    else adicionaisSelecionados = adicionaisSelecionados.filter(a => a.nome !== item.nome);
    atualizarPrecoModal();
}

function atualizarPrecoModal() {
    let total = Number(produtoEmSelecao.preco);
    adicionaisSelecionados.forEach(adc => total += Number(adc.preco));
    document.getElementById('modal-prod-preco').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function confirmarItem() {
    let precoItemFinal = Number(produtoEmSelecao.preco);
    let strAdicionais = adicionaisSelecionados.length > 0 ? ` (${adicionaisSelecionados.map(a => a.nome).join(', ')})` : '';
    adicionaisSelecionados.forEach(adc => precoItemFinal += Number(adc.preco));

    const inputObs = document.getElementById('obs-item');
    const observacaoText = inputObs ? inputObs.value.trim() : '';
    
    let nomeFinal = produtoEmSelecao.nome + strAdicionais;
    if (observacaoText !== '') {
        nomeFinal += ` - Obs: ${observacaoText}`;
    }

    const itemMontado = {
        id: produtoEmSelecao.id, 
        nome: nomeFinal,
        preco: precoItemFinal, 
        quantidade: 1, 
        adicionaisSelecionados: [...adicionaisSelecionados],
        observacao: observacaoText
    };

    // 👇 FLUXO NOVO: Se está editando direto da tela de pagamento
    if (itemEmEdicaoMesaIndex !== null) {
        itensRestantesNaMesa[itemEmEdicaoMesaIndex] = itemMontado;
        itemEmEdicaoMesaIndex = null;
        fecharModalAdicionais();
        salvarAlteracaoMesaAPI(); // Dispara o salvamento no banco de dados e volta pro pagamento
        return;
    }

    if (itemEmEdicaoIndex !== null) {
        carrinho[itemEmEdicaoIndex] = itemMontado; 
        itemEmEdicaoIndex = null;
        fecharModalAdicionais(); atualizarBarraCarrinho(); abrirResumoPedido(); 
    } else {
        carrinho.push(itemMontado); 
        fecharModalAdicionais(); atualizarBarraCarrinho();
    }
}

function fecharModalAdicionais() { 
    document.getElementById('modal-adicionais').style.display = 'none'; 
    // 👇 Garante que se o garçom fechar o modal no "X", a tela de pagamento reabre
    if (itemEmEdicaoMesaIndex !== null) {
        itemEmEdicaoMesaIndex = null;
        document.getElementById('modal-pagamento-mobile').style.display = 'flex';
    }
}

function atualizarBarraCarrinho() {
    const barra = document.getElementById('carrinho-flutuante');
    if (carrinho.length > 0) {
        barra.style.display = 'flex';
        document.getElementById('carrinho-qtd').innerText = carrinho.length;
        let total = carrinho.reduce((acc, item) => acc + item.preco, 0);
        document.getElementById('carrinho-total').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    } else { barra.style.display = 'none'; }

    // 👇 NOVO: Salva os dados do pedido atual no celular (Prevenção contra reload)
    const estadoApp = {
        carrinho: carrinho,
        idMesaAtual: idMesaAtual,
        numeroMesaAtual: numeroMesaAtual,
        modoComandaRapida: modoComandaRapida
    };
    localStorage.setItem('icesoft_estado_pedido', JSON.stringify(estadoApp));
}

function abrirResumoPedido() {
    const container = document.getElementById('lista-resumo');
    container.innerHTML = '';

    const footerContainer = document.querySelector('#modal-resumo .sheet-footer');
    footerContainer.innerHTML = `
        <button class="btn-primario" onclick="enviarComanda()" id="btn-enviar-comanda" style="width: 100%; background: #25D366; display: flex; justify-content: center; align-items: center; gap: 8px;">
            <span class="material-symbols-outlined">send</span> Enviar p/ Preparo
        </button>
    `;
    document.querySelector('#modal-resumo .sheet-header h3').innerHTML = `🛒 Confirmação`;

    carrinho.forEach((item, index) => {
        let nomePrincipal = item.nome;
        let adicionaisHtml = '';

        if (item.observacao) {
            adicionaisHtml += `<div style="font-size: 1rem; color: #d32f2f; background: #ffebee; padding: 6px 10px; border-radius: 8px; margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #ffcdd2; font-weight: bold;"><span class="material-symbols-outlined" style="font-size: 1.2rem;">person</span> ${item.observacao}</div>`;
            nomePrincipal = nomePrincipal.replace(` - Obs: ${item.observacao}`, ''); 
        }

        if (nomePrincipal.includes('(') && nomePrincipal.includes(')')) {
            const primeiroParenteses = nomePrincipal.indexOf('(');
            const ultimoParenteses = nomePrincipal.lastIndexOf(')');
            const adicionaisString = nomePrincipal.substring(primeiroParenteses + 1, ultimoParenteses);
            nomePrincipal = nomePrincipal.substring(0, primeiroParenteses).trim();
            const listaAdicionais = adicionaisString.split(',').map(a => a.trim()).filter(a => a !== '');
            
            listaAdicionais.forEach(adic => {
                adicionaisHtml += `<div style="font-size: 1rem; color: #e65100; background: #fff3e0; padding: 6px 10px; border-radius: 8px; margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #ffcc80; font-weight: bold;"><span class="material-symbols-outlined" style="font-size: 1.2rem;">add_circle</span> ${adic}</div>`;
            });
        }

        const btnEditarHtml = `<span class="material-symbols-outlined" style="color: #00bcd4; cursor: pointer; padding: 10px; background: #e0f7fa; border-radius: 12px; transition: 0.2s;" title="Editar" onclick="editarItem(${index})">edit</span>`;

        container.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px dashed #ddd; padding: 15px 0;">
                <div style="flex: 1; padding-right: 15px;">
                    <div style="font-weight: 900; font-size: 1.25rem; color: #333; background: #f0f2f5; padding: 8px 12px; border-radius: 8px; display: inline-block;">1x ${nomePrincipal}</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;">${adicionaisHtml}</div>
                    <div style="color: #e91e63; font-weight: 900; font-size: 1.1rem; margin-top: 12px;">R$ ${item.preco.toFixed(2).replace('.', ',')}</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; align-items: center; margin-top: 5px;">
                    ${btnEditarHtml}
                    <span class="material-symbols-outlined" style="color: #f44336; cursor: pointer; padding: 10px; background: #ffebee; border-radius: 12px; transition: 0.2s;" title="Remover" onclick="removerItem(${index})">delete</span>
                </div>
            </div>
        `;
    });
    document.getElementById('modal-resumo').style.display = 'flex';
}

window.editarItem = function(index) {
    itemEmEdicaoIndex = index;
    const itemCarrinho = carrinho[index];
    produtoEmSelecao = listaProdutos.find(p => p.id === itemCarrinho.id);
    adicionaisSelecionados = [...(itemCarrinho.adicionaisSelecionados || [])];
    
    document.getElementById('modal-prod-nome').innerText = produtoEmSelecao.nome + " (Edição)";
    
    const btnFooter = document.querySelector('#modal-adicionais .sheet-footer');
    if(btnFooter) {
        btnFooter.style.flexDirection = 'column';
        const obsAtual = itemCarrinho.observacao || '';
        btnFooter.innerHTML = `
            <input type="text" id="obs-item" class="input-garcom" placeholder="Nome do cliente ou observação (Opcional)" style="margin-bottom: 12px; border: 1px solid #ccc; background: #fff;" value="${obsAtual}">
            <button class="btn-primario" style="background: #00bcd4;" onclick="confirmarItem()">Atualizar <span id="modal-prod-preco"></span></button>
        `;
    }
    
    atualizarPrecoModal();
    const containerAdc = document.getElementById('modal-prod-adicionais');
    containerAdc.innerHTML = '';

    if (produtoEmSelecao.grupos_ids && produtoEmSelecao.grupos_ids.length > 0) {
        produtoEmSelecao.grupos_ids.forEach(grupoId => {
            const grupo = gruposGlobais.find(g => g.id === grupoId);
            if (!grupo || !grupo.itens) return;
            let htmlGrupo = `<div class="grupo-adc"><div class="grupo-adc-titulo">${grupo.nome}</div>`;
            grupo.itens.forEach(itemGrupo => {
                const precoAdc = Number(itemGrupo.preco) > 0 ? `(+ R$ ${Number(itemGrupo.preco).toFixed(2).replace('.', ',')})` : '';
                const isChecked = adicionaisSelecionados.some(a => a.nome === itemGrupo.nome) ? 'checked' : '';
                htmlGrupo += `
                    <label class="item-adc">
                        <span>${itemGrupo.nome} <small style="color:#888;">${precoAdc}</small></span>
                        <input type="checkbox" value='${JSON.stringify(itemGrupo)}' onchange="toggleAdicional(this)" ${isChecked}>
                    </label>
                `;
            });
            htmlGrupo += `</div>`;
            containerAdc.innerHTML += htmlGrupo;
        });
    } else {
        containerAdc.innerHTML = '<p style="color: #888; text-align: center; margin-top: 10px; font-style: italic;">Adicione uma observação abaixo se necessário.</p>';
    }

    fecharResumo();
    document.getElementById('modal-adicionais').style.display = 'flex';
}

function removerItem(index) { carrinho.splice(index, 1); atualizarBarraCarrinho(); if(carrinho.length > 0) abrirResumoPedido(); else fecharResumo(); }
function fecharResumo() { document.getElementById('modal-resumo').style.display = 'none'; }

// ==========================================
// 4. ENVIAR PARA A COZINHA E CAIXA
// ==========================================
async function enviarComanda() {
    if (carrinho.length === 0) return alert("Adicione produtos antes de enviar!");

    const btn = document.getElementById('btn-enviar-comanda');
    btn.innerHTML = "Enviando... ⏳"; btn.disabled = true;
    const cracha = localStorage.getItem('icesoft_token');

    try {
        if (idMesaAtual) {
            const mesa = mesasAbertas.find(m => m.id === idMesaAtual);
            const itensCombinados = (mesa.itens || []).concat(carrinho);

            const res = await fetch(`${API_URL}/mesas/${idMesaAtual}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cracha}` },
                body: JSON.stringify({ itens: itensCombinados })
            });

            if (res.ok) { alert("✅ Itens adicionados à comanda!"); localStorage.removeItem('icesoft_estado_pedido'); voltarParaMesas(); fecharResumo(); } 
            else alert("Erro ao adicionar.");
        } else {
            const res = await fetch(`${API_URL}/mesas`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cracha}` },
                body: JSON.stringify({ numero: numeroMesaAtual, itens: carrinho })
            });

            if (res.ok) { alert("✅ Nova Comanda aberta!"); localStorage.removeItem('icesoft_estado_pedido'); voltarParaMesas(); fecharResumo(); } 
            else alert("Erro ao abrir.");
        }
    } catch (e) {
        alert("Erro de conexão.");
    } finally {
        btn.innerHTML = `<span class="material-symbols-outlined">send</span> Enviar p/ Preparo`; btn.disabled = false;
    }
}

// ==========================================
// 5. SISTEMA DE PAGAMENTO E DIVISÃO (MOBILE)
// ==========================================
function abrirPagamentoMobile(id) {
    const mesa = mesasAbertas.find(m => m.id === id);
    if (!mesa) return;

    idMesaAtual = mesa.id;
    numeroMesaAtual = mesa.numero;
    itensRestantesNaMesa = JSON.parse(JSON.stringify(mesa.itens || []));
    itensSendoPagos = [];
    isPagamentoDivididoMesa = false;

    document.getElementById('titulo-pagamento-mobile').innerText = `Pagamento Mesa ${mesa.numero}`;
    document.getElementById('pag-metodo-1').value = 'Dinheiro';
    document.getElementById('area-pag-2').style.display = 'none';
    document.getElementById('btn-dividir-pagamento').style.display = 'block';

    renderizarTelaPagamentoMobile();
    document.getElementById('modal-pagamento-mobile').style.display = 'flex';
}

function fecharPagamentoMobile() { document.getElementById('modal-pagamento-mobile').style.display = 'none'; }

function renderizarTelaPagamentoMobile() {
    const listaMesa = document.getElementById('pag-itens-mesa');
    const listaPag = document.getElementById('pag-itens-selecionados');
    
    listaMesa.innerHTML = ''; listaPag.innerHTML = '';
    let subtotalPag = 0;

    itensRestantesNaMesa.forEach((item, index) => {
        // 💡 LÓGICA DE EXTRAÇÃO DE ADICIONAIS/OBSERVAÇÕES
        let nomePrincipal = item.nomeBase || item.nome.split('(')[0].split(' - Obs:')[0].trim();
        let detalhesTexto = item.nome.replace(nomePrincipal, '').trim();
        
        let btnVerAdicionais = '';
        let divDetalhes = '';
        
        if (detalhesTexto.length > 0) {
            // Limpa parênteses soltos e formata a exibição
            let textoLimpo = detalhesTexto.replace(/^\(|\)$/g, '').trim(); 
            btnVerAdicionais = `<span onclick="document.getElementById('detalhes-item-${index}').style.display = document.getElementById('detalhes-item-${index}').style.display === 'none' ? 'block' : 'none'" style="color: #00bcd4; font-size: 0.8rem; text-decoration: underline; cursor: pointer; margin-left: 8px;">Ver Detalhes</span>`;
            divDetalhes = `<div id="detalhes-item-${index}" style="display: none; font-size: 0.85rem; color: #e65100; background: #fff3e0; padding: 8px; border-radius: 6px; margin-top: 5px; border: 1px dashed #ffcc80;">${textoLimpo}</div>`;
        }

        listaMesa.innerHTML += `
            <div style="background: white; border: 1px solid #ddd; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div style="flex: 1; padding-right: 10px;">
                    <div style="font-weight: bold; color: #333; display: flex; align-items: center; flex-wrap: wrap;">
                        1x ${nomePrincipal} ${btnVerAdicionais}
                    </div>
                    ${divDetalhes}
                    <div style="color: #e91e63; font-weight: bold; font-size: 0.9rem; margin-top: 4px;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                    <button onclick="editarItemMesaMobile(${index})" style="background: #e0f7fa; color: #00bcd4; border: none; padding: 8px; border-radius: 8px; cursor: pointer;" title="Editar Pedido">✏️</button>
                    <button onclick="cancelarItemMesaMobile(${index})" style="background: #fff0f4; color: #f44336; border: none; padding: 8px; border-radius: 8px; cursor: pointer;" title="Cancelar Item">🗑️</button>
                    <button onclick="moverParaPagamentoMobile(${index})" style="background: #e91e63; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer;">Pagar ⬇</button>
                </div>
            </div>
        `;
    });

    itensSendoPagos.forEach((item, index) => {
        subtotalPag += Number(item.preco);
        let nomePrincipal = item.nomeBase || item.nome.split('(')[0].split(' - Obs:')[0].trim();
        
        listaPag.innerHTML += `
            <div style="background: white; border: 1px solid #00bcd4; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #00838f;">1x ${nomePrincipal}</div>
                    <div style="color: #00bcd4; font-weight: bold; font-size: 0.9rem;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
                </div>
                <button onclick="voltarParaMesaMobile(${index})" style="background: none; border: none; color: #f44336; font-size: 1.2rem; cursor: pointer;">⬆</button>
            </div>
        `;
    });

    document.getElementById('pag-subtotal').innerText = `R$ ${subtotalPag.toFixed(2).replace('.', ',')}`;
    document.getElementById('btn-finalizar-pag-mobile').dataset.total = subtotalPag;
    calcularDivisaoMobile(subtotalPag);
}

function moverParaPagamentoMobile(index) { itensSendoPagos.push(itensRestantesNaMesa.splice(index, 1)[0]); renderizarTelaPagamentoMobile(); }
function voltarParaMesaMobile(index) { itensRestantesNaMesa.push(itensSendoPagos.splice(index, 1)[0]); renderizarTelaPagamentoMobile(); }

async function cancelarItemMesaMobile(index) {
    if(!confirm("Cancelar este item da mesa?")) return;
    itensRestantesNaMesa.splice(index, 1);
    const todosItens = itensRestantesNaMesa.concat(itensSendoPagos);
    
    try {
        if(todosItens.length === 0) {
            await fetch(`${API_URL}/mesas/${idMesaAtual}`, { method: 'DELETE' });
            alert("Mesa liberada!"); fecharPagamentoMobile();
        } else {
            await fetch(`${API_URL}/mesas/${idMesaAtual}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itens: todosItens })
            });
        }
        await carregarDadosBasicos();
        if(document.getElementById('modal-pagamento-mobile').style.display === 'flex') renderizarTelaPagamentoMobile();
    } catch(e) { alert("Erro ao cancelar."); }
}

function togglePagamentoDivididoMobile() {
    isPagamentoDivididoMesa = !isPagamentoDivididoMesa;
    document.getElementById('area-pag-2').style.display = isPagamentoDivididoMesa ? 'block' : 'none';
    document.getElementById('btn-dividir-pagamento').style.display = isPagamentoDivididoMesa ? 'none' : 'block';
    
    const inputV1 = document.getElementById('pag-valor-1');
    inputV1.readOnly = !isPagamentoDivididoMesa;
    if(isPagamentoDivididoMesa) inputV1.addEventListener('keyup', calcularDivisaoMobileEvent);
    else inputV1.removeEventListener('keyup', calcularDivisaoMobileEvent);
    
    renderizarTelaPagamentoMobile();
}

function calcularDivisaoMobileEvent() {
    const total = Number(document.getElementById('btn-finalizar-pag-mobile').dataset.total) || 0;
    calcularDivisaoMobile(total);
}

function calcularDivisaoMobile(total) {
    let v1 = parseFloat(document.getElementById('pag-valor-1').value) || 0;
    if (!isPagamentoDivididoMesa) {
        document.getElementById('pag-valor-1').value = total.toFixed(2);
    } else {
        if (v1 > total) { v1 = total; document.getElementById('pag-valor-1').value = v1.toFixed(2); }
        let v2 = total - v1;
        document.getElementById('pag-valor-2').value = v2.toFixed(2);
    }
}

async function finalizarPagamentoMobile() {
    if (itensSendoPagos.length === 0) return alert("Selecione itens para pagar!");

    const totalCobrado = Number(document.getElementById('btn-finalizar-pag-mobile').dataset.total);
    const m1 = document.getElementById('pag-metodo-1').value;
    let metodoFinalTexto = m1;

    if (isPagamentoDivididoMesa) {
        const m2 = document.getElementById('pag-metodo-2').value;
        const v1 = parseFloat(document.getElementById('pag-valor-1').value) || 0;
        const v2 = parseFloat(document.getElementById('pag-valor-2').value) || 0;
        if (v1 <= 0 || v2 <= 0) return alert("Valores de divisão inválidos.");
        if (m1 === m2) return alert("As formas não podem ser iguais.");
        metodoFinalTexto = `${m1} e ${m2}`;
    }

    const btn = document.getElementById('btn-finalizar-pag-mobile');
    btn.innerText = "Processando..."; btn.disabled = true;

    try {
        const nomesApenas = itensSendoPagos.map(item => item.nome).join(' + ');
        const nomeCurto = nomesApenas.length > 250 ? nomesApenas.substring(0, 247) + '...' : nomesApenas;

        const vendaPayload = {
            itens: itensSendoPagos.map(i => ({nome: `Mesa ${numeroMesaAtual} - ${i.nome}`, preco: i.preco})),
            produto_nome: nomeCurto, valor_total: totalCobrado, total: totalCobrado,
            forma_pagamento: metodoFinalTexto, status: "Concluída", origem: "Mesas"
        };

        const resVenda = await fetch(`${API_URL}/vendas`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vendaPayload)
        });

        if (!resVenda.ok) throw new Error("Erro na venda.");

        if (itensRestantesNaMesa.length === 0) {
            await fetch(`${API_URL}/mesas/${idMesaAtual}`, { method: 'DELETE' });
            alert(`✅ Mesa ${numeroMesaAtual} encerrada!`);
        } else {
            await fetch(`${API_URL}/mesas/${idMesaAtual}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itens: itensRestantesNaMesa })
            });
            alert(`✅ Pagamento parcial registrado!`);
        }

        fecharPagamentoMobile(); await carregarDadosBasicos(); 
    } catch (e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "Confirmar Pagamento"; btn.disabled = false;
    }
}

// ==========================================
// 🖨️ MOTOR DE IMPRESSÃO REMOTA (COMANDA RÁPIDA)
// ==========================================
async function imprimirComandaGarcom() {
    if (carrinho.length === 0) return alert("O carrinho está vazio!");

    const btn = document.querySelector('button[onclick="imprimirComandaGarcom()"]');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined">wifi</span> Enviando p/ PC...'; 
    btn.disabled = true;

    try {
        let identificador = numeroMesaAtual || 'Mesa';
        
        // 👇 Lê a identificação direto da nova caixa de texto
        if (modoComandaRapida) {
            const inputIdent = document.getElementById('comanda-identificacao');
            if (!inputIdent || inputIdent.value.trim() === '') {
                alert("⚠️ Preencha o Nome ou Identificação no painel de Pagamento antes de imprimir!");
                btn.innerHTML = txtOriginal; btn.disabled = false;
                return;
            }
            identificador = inputIdent.value.trim();
        }

        await fetch(`${API_URL}/imprimir/comanda`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                itens: carrinho, 
                dataHora: new Date().toLocaleString('pt-BR'),
                identificador: identificador
            })
        });
        
        btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Impresso no PC!';
        btn.style.background = '#4CAF50';
        setTimeout(() => {
            btn.innerHTML = txtOriginal;
            btn.style.background = '#607d8b';
            btn.disabled = false;
        }, 3000);
        
    } catch(e) {
        alert("❌ Falha ao enviar comando para o PC. Verifique a internet.");
        btn.innerHTML = txtOriginal; 
        btn.disabled = false;
    }
}

// ==========================================
// MOTOR DE PAGAMENTO DIVIDIDO (COMANDA RÁPIDA)
// ==========================================
let isDivisaoComandaAtiva = false;

window.toggleDivisaoComanda = function() {
    isDivisaoComandaAtiva = !isDivisaoComandaAtiva;
    const areaDivisao = document.getElementById('area-comanda-divisao');
    const btnDividir = document.getElementById('btn-dividir-comanda');
    const inputValor1 = document.getElementById('comanda-valor-1');
    let totalCarrinho = carrinho.reduce((acc, item) => acc + item.preco, 0);

    if (isDivisaoComandaAtiva) {
        areaDivisao.style.display = 'block';
        btnDividir.innerText = '- Remover Divisão';
        btnDividir.style.color = '#f44336';
        btnDividir.style.borderColor = '#f44336';
        
        inputValor1.readOnly = false;
        inputValor1.style.background = 'white';
        inputValor1.addEventListener('keyup', window.calcularDivisaoComanda);
    } else {
        areaDivisao.style.display = 'none';
        btnDividir.innerText = '+ Dividir Pagamento';
        btnDividir.style.color = '#00bcd4';
        btnDividir.style.borderColor = '#00bcd4';
        
        inputValor1.readOnly = true;
        inputValor1.style.background = '#eee';
        inputValor1.value = totalCarrinho.toFixed(2);
        inputValor1.removeEventListener('keyup', window.calcularDivisaoComanda);
    }
}

window.calcularDivisaoComanda = function() {
    let total = carrinho.reduce((acc, item) => acc + item.preco, 0);
    let v1 = parseFloat(document.getElementById('comanda-valor-1').value) || 0;
    
    // Trava matemática: O valor 1 não pode ser maior que o total da comanda
    if (v1 > total) {
        v1 = total;
        document.getElementById('comanda-valor-1').value = v1.toFixed(2);
    }
    
    let v2 = total - v1;
    document.getElementById('comanda-valor-2').value = v2.toFixed(2);
}

// ==========================================
// 6. MOTOR DE EDIÇÃO PÓS-LANÇAMENTO (TELA DE PAGAMENTO)
// ==========================================
let itemEmEdicaoMesaIndex = null; 

window.editarItemMesaMobile = function(index) {
    const itemMesa = itensRestantesNaMesa[index];
    produtoEmSelecao = listaProdutos.find(p => p.id === itemMesa.id);
    
    if (!produtoEmSelecao) {
        alert("Não é possível editar este produto (referência original não encontrada). Cancele o item e lance novamente.");
        return;
    }

    itemEmEdicaoMesaIndex = index;
    itemEmEdicaoIndex = null; // Evita conflito com o carrinho padrão
    adicionaisSelecionados = [...(itemMesa.adicionaisSelecionados || [])];
    
    document.getElementById('modal-prod-nome').innerText = produtoEmSelecao.nome + " (Edição)";
    
    const btnFooter = document.querySelector('#modal-adicionais .sheet-footer');
    if(btnFooter) {
        btnFooter.style.flexDirection = 'column';
        const obsAtual = itemMesa.observacao || '';
        btnFooter.innerHTML = `
            <input type="text" id="obs-item" class="input-garcom" placeholder="Nome do cliente ou observação (Opcional)" style="margin-bottom: 12px; border: 1px solid #ccc; background: #fff;" value="${obsAtual}">
            <button class="btn-primario" style="background: #FF9800;" onclick="confirmarItem()">Salvar Alteração <span id="modal-prod-preco"></span></button>
        `;
    }
    
    atualizarPrecoModal();
    const containerAdc = document.getElementById('modal-prod-adicionais');
    containerAdc.innerHTML = '';

    if (produtoEmSelecao.grupos_ids && produtoEmSelecao.grupos_ids.length > 0) {
        produtoEmSelecao.grupos_ids.forEach(grupoId => {
            const grupo = gruposGlobais.find(g => g.id === grupoId);
            if (!grupo || !grupo.itens) return;
            let htmlGrupo = `<div class="grupo-adc"><div class="grupo-adc-titulo">${grupo.nome}</div>`;
            grupo.itens.forEach(itemGrupo => {
                const precoAdc = Number(itemGrupo.preco) > 0 ? `(+ R$ ${Number(itemGrupo.preco).toFixed(2).replace('.', ',')})` : '';
                const isChecked = adicionaisSelecionados.some(a => a.nome === itemGrupo.nome) ? 'checked' : '';
                htmlGrupo += `
                    <label class="item-adc">
                        <span>${itemGrupo.nome} <small style="color:#888;">${precoAdc}</small></span>
                        <input type="checkbox" value='${JSON.stringify(itemGrupo)}' onchange="toggleAdicional(this)" ${isChecked}>
                    </label>
                `;
            });
            htmlGrupo += `</div>`;
            containerAdc.innerHTML += htmlGrupo;
        });
    } else {
        containerAdc.innerHTML = '<p style="color: #888; text-align: center; margin-top: 10px; font-style: italic;">Adicione uma observação abaixo se necessário.</p>';
    }

    // Esconde a tela de pagamento e invoca o modal de edição de produtos
    document.getElementById('modal-pagamento-mobile').style.display = 'none';
    document.getElementById('modal-adicionais').style.display = 'flex';
}

async function salvarAlteracaoMesaAPI() {
    const todosItens = itensRestantesNaMesa.concat(itensSendoPagos);
    const cracha = localStorage.getItem('icesoft_token');
    
    try {
        // Envia a comanda atualizada para o servidor
        await fetch(`${API_URL}/mesas/${idMesaAtual}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cracha}` },
            body: JSON.stringify({ itens: todosItens })
        });
        
        await carregarDadosBasicos(); // Atualiza a memória global
        renderizarTelaPagamentoMobile(); // Recalcula a conta total e re-renderiza
        document.getElementById('modal-pagamento-mobile').style.display = 'flex'; // Traz a tela de pagamento de volta
        
    } catch(e) {
        alert("Erro ao sincronizar a alteração com o servidor.");
    }
}