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
};

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
    const container = document.getElementById('lista-mesas-mobile');
    container.innerHTML = '';
    
    // Mostra as 15 mesas configuradas no seu sistema
    for (let i = 1; i <= 15; i++) {
        const numeroStr = String(i).padStart(2, '0');
        const mesaOcupada = mesasAbertas.find(m => m.numero === numeroStr);
        
        if (mesaOcupada) {
            let totalMesa = 0;
            (mesaOcupada.itens || []).forEach(item => totalMesa += Number(item.preco));
            
            container.innerHTML += `
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
            container.innerHTML += `
                <div class="mesa-mobile-card mesa-livre" onclick="abrirNovaMesaMobile('${numeroStr}')">
                    <div style="font-weight: 800; font-size: 1.2rem; color: #333;">Mesa ${numeroStr}</div>
                    <div style="color: #25D366; font-weight: bold;">Liberada</div>
                </div>
            `;
        }
    }
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
    
    if (!produtoEmSelecao.grupos_ids || produtoEmSelecao.grupos_ids.length === 0) {
        confirmarItem(); return;
    }

    document.getElementById('modal-prod-nome').innerText = produtoEmSelecao.nome;
    const btnFooter = document.querySelector('#modal-adicionais .sheet-footer');
    if(btnFooter) btnFooter.innerHTML = `<button class="btn-primario" onclick="confirmarItem()">Adicionar <span id="modal-prod-preco">R$ 0,00</span></button>`;
    
    atualizarPrecoModal();
    const containerAdc = document.getElementById('modal-prod-adicionais');
    containerAdc.innerHTML = '';

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

    const itemMontado = {
        id: produtoEmSelecao.id, nome: produtoEmSelecao.nome + strAdicionais,
        preco: precoItemFinal, quantidade: 1, adicionaisSelecionados: [...adicionaisSelecionados]
    };

    if (itemEmEdicaoIndex !== null) {
        carrinho[itemEmEdicaoIndex] = itemMontado; 
        itemEmEdicaoIndex = null;
        fecharModalAdicionais(); atualizarBarraCarrinho(); abrirResumoPedido(); 
    } else {
        carrinho.push(itemMontado); 
        fecharModalAdicionais(); atualizarBarraCarrinho();
    }
}

function fecharModalAdicionais() { document.getElementById('modal-adicionais').style.display = 'none'; }

function atualizarBarraCarrinho() {
    const barra = document.getElementById('carrinho-flutuante');
    if (carrinho.length > 0) {
        barra.style.display = 'flex';
        document.getElementById('carrinho-qtd').innerText = carrinho.length;
        let total = carrinho.reduce((acc, item) => acc + item.preco, 0);
        document.getElementById('carrinho-total').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    } else { barra.style.display = 'none'; }
}

function abrirResumoPedido() {
    const container = document.getElementById('lista-resumo');
    container.innerHTML = '';

    // 👇 MUDA O TÍTULO E O BOTÃO SE FOR COMANDA RÁPIDA
    const footerContainer = document.querySelector('#modal-resumo .sheet-footer');
    
    if (modoComandaRapida) {
        // Modo Montagem: Mostra o botão de Imprimir e o de Enviar lado a lado
        footerContainer.innerHTML = `
            <div style="display: flex; gap: 10px; width: 100%;">
                <button class="btn-primario" onclick="imprimirComandaGarcom()" style="flex: 1; background: #607d8b; display: flex; justify-content: center; align-items: center; gap: 8px;">
                    <span class="material-symbols-outlined">print</span> Imprimir
                </button>
                <button class="btn-primario" onclick="enviarComanda()" id="btn-enviar-comanda" style="flex: 2; background: #e91e63; display: flex; justify-content: center; align-items: center; gap: 8px;">
                    <span class="material-symbols-outlined">receipt_long</span> Enviar p/ Caixa
                </button>
            </div>
        `;
        document.querySelector('#modal-resumo .sheet-header h3').innerHTML = '🍦 Resumo para Montagem';
    } else {
        // Modo Mesas: Mostra só o botão de enviar original
        footerContainer.innerHTML = `
            <button class="btn-primario" onclick="enviarComanda()" id="btn-enviar-comanda" style="width: 100%; background: #25D366; display: flex; justify-content: center; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined">send</span> Enviar para Cozinha
            </button>
        `;
        document.querySelector('#modal-resumo .sheet-header h3').innerHTML = '🛒 Enviar para Mesa';
    }

    carrinho.forEach((item, index) => {
        let nomePrincipal = item.nome;
        let adicionaisHtml = '';

        if (item.nome.includes('(') && item.nome.includes(')')) {
            const primeiroParenteses = item.nome.indexOf('(');
            const ultimoParenteses = item.nome.lastIndexOf(')');
            nomePrincipal = item.nome.substring(0, primeiroParenteses).trim();
            const adicionaisString = item.nome.substring(primeiroParenteses + 1, ultimoParenteses);
            const listaAdicionais = adicionaisString.split(',').map(a => a.trim()).filter(a => a !== '');
            
            listaAdicionais.forEach(adic => {
                // 👇 UX OTIMIZADA: Adicionais gigantes e coloridos como "Etiquetas" para facilitar a montagem
                adicionaisHtml += `<div style="font-size: 1rem; color: #e65100; background: #fff3e0; padding: 6px 10px; border-radius: 8px; margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #ffcc80; font-weight: bold;"><span class="material-symbols-outlined" style="font-size: 1.2rem;">add_circle</span> ${adic}</div>`;
            });
        }

        const prodRef = listaProdutos.find(p => p.id === item.id);
        const podeEditar = prodRef && prodRef.grupos_ids && prodRef.grupos_ids.length > 0;
        const btnEditarHtml = podeEditar ? `<span class="material-symbols-outlined" style="color: #00bcd4; cursor: pointer; padding: 10px; background: #e0f7fa; border-radius: 12px; transition: 0.2s;" title="Editar" onclick="editarItem(${index})">edit</span>` : '';

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
    if(btnFooter) btnFooter.innerHTML = `<button class="btn-primario" style="background: #00bcd4;" onclick="confirmarItem()">Atualizar <span id="modal-prod-preco"></span></button>`;
    
    atualizarPrecoModal();
    const containerAdc = document.getElementById('modal-prod-adicionais');
    containerAdc.innerHTML = '';

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

    // 👇 LÓGICA CORRIGIDA: Vai direto para VENDAS (Caixa/Kanban) e PULA as mesas!
    if (modoComandaRapida) {
        const ident = prompt("🍦 Montagem concluída!\nDigite o Nome do Cliente ou o Número da Comanda para enviar ao Caixa:");
        if (!ident || ident.trim() === '') return;

        const btn = document.getElementById('btn-enviar-comanda');
        const txtOriginal = btn.innerHTML;
        btn.innerHTML = "Enviando... ⏳"; btn.disabled = true;

        try {
            let totalCobrado = carrinho.reduce((acc, item) => acc + item.preco, 0);
            const nomesApenas = carrinho.map(item => item.nome).join(' + ');
            const nomeCurto = nomesApenas.length > 250 ? nomesApenas.substring(0, 247) + '...' : nomesApenas;

            const vendaPayload = {
                itens: carrinho,
                produto_nome: nomeCurto, 
                valor_total: totalCobrado, 
                total: totalCobrado,
                forma_pagamento: "A Cobrar (Comanda Rápida)", 
                status: "A Preparar", // Vai pro Kanban da Cozinha e pra tela de Vendas!
                origem: "Balcão",
                cliente_nome: ident.trim()
            };

            const resVenda = await fetch(`${API_URL}/vendas`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vendaPayload)
            });

            if (resVenda.ok) { 
                alert("✅ Comanda enviada direto para o Caixa e Cozinha!"); 
                voltarParaMesas(); 
                fecharResumo(); 
            } else {
                alert("Erro ao enviar comanda.");
            }
        } catch (e) {
            alert("Erro de conexão.");
        } finally {
            btn.innerHTML = txtOriginal; btn.disabled = false;
        }
        return; // 🛑 CORTA AQUI! Impede que o código debaixo (das mesas) rode.
    }

    // --- LÓGICA ORIGINAL DAS MESAS ABAIXO ---
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

            if (res.ok) { alert("✅ Itens adicionados com sucesso!"); voltarParaMesas(); fecharResumo(); } 
            else alert("Erro ao adicionar na mesa.");
        } else {
            const res = await fetch(`${API_URL}/mesas`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cracha}` },
                body: JSON.stringify({ numero: numeroMesaAtual, itens: carrinho })
            });

            if (res.ok) { alert("✅ Mesa aberta com sucesso!"); voltarParaMesas(); fecharResumo(); } 
            else alert("Erro ao abrir a mesa.");
        }
    } catch (e) {
        alert("Erro de conexão.");
    } finally {
        btn.innerHTML = `<span class="material-symbols-outlined">send</span> Enviar para Cozinha`; btn.disabled = false;
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
        listaMesa.innerHTML += `
            <div style="background: white; border: 1px solid #ddd; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #333;">1x ${item.nomeBase || item.nome.split('(')[0].trim()}</div>
                    <div style="color: #e91e63; font-weight: bold; font-size: 0.9rem;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="cancelarItemMesaMobile(${index})" style="background: #fff0f4; color: #f44336; border: none; padding: 8px; border-radius: 8px;">🗑️</button>
                    <button onclick="moverParaPagamentoMobile(${index})" style="background: #e91e63; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold;">Pagar ⬇</button>
                </div>
            </div>
        `;
    });

    itensSendoPagos.forEach((item, index) => {
        subtotalPag += Number(item.preco);
        listaPag.innerHTML += `
            <div style="background: white; border: 1px solid #00bcd4; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #00838f;">1x ${item.nomeBase || item.nome.split('(')[0].trim()}</div>
                    <div style="color: #00bcd4; font-weight: bold; font-size: 0.9rem;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
                </div>
                <button onclick="voltarParaMesaMobile(${index})" style="background: none; border: none; color: #f44336; font-size: 1.2rem;">⬆</button>
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
        let identificador = modoComandaRapida ? prompt("Digite o nome ou número da comanda para sair na impressão:") : (numeroMesaAtual || 'Mesa');
        if (!identificador || identificador.trim() === '') {
            btn.innerHTML = txtOriginal; btn.disabled = false;
            return;
        }

        // 📡 O celular dispara o comando invisível para a nuvem
        await fetch(`${API_URL}/imprimir/comanda`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                itens: carrinho, 
                dataHora: new Date().toLocaleString('pt-BR'),
                identificador: identificador.trim() 
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