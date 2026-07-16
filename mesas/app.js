const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';

let mesasAbertas = [];
let produtosNuvem = [];
let categoriasGlobais = [];
let gruposGlobais = []; // NOVA MEMÓRIA: Adicionais

// Memória do Modal de Lançamento
let mesaEmEdicao = null;
let idMesaEmAdicao = null; // NOVO: Lembra se estamos apenas adicionando itens em uma mesa existente
let carrinhoLancamento = [];
let categoriaAtivaMesa = 'Todos';

// Memória dos Adicionais
let produtoEmSelecaoMesa = null;
let escolhasAtuaisMesa = [];

window.onload = async () => {
    await carregarCardapio(); 
    await carregarMesas();
    await carregarClientesCRM();    

    // 🖱️ MÁGICA DO SCROLL: Transforma a rolagem vertical do mouse em horizontal
    const scrollCategorias = document.getElementById('categorias-mesa');
    if (scrollCategorias) {
        scrollCategorias.addEventListener('wheel', (evento) => {
            evento.preventDefault(); // Trava a tela para ela não descer junto
            scrollCategorias.scrollLeft += evento.deltaY * 1.5; // O 1.5 deixa a rolagem um pouco mais rápida e suave!
        });
    }
};

async function carregarCardapio() {
    try {
        // AGORA PUXA OS PRODUTOS, CATEGORIAS E GRUPOS JUNTOS
        const [resProd, resCat, resGrupos] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/categorias`),
            fetch(`${API_URL}/grupos`)
        ]);
        const todosProdutos = await resProd.json();
        const todosGrupos = await resGrupos.json();
        categoriasGlobais = await resCat.json();
        
        produtosNuvem = todosProdutos.filter(p => p.ativo !== false);
        gruposGlobais = todosGrupos.filter(g => g.ativo !== false);
    } catch (e) {
        console.error("Erro ao carregar cardápio:", e);
    }
}

async function carregarMesas() {
    try {
        const cracha = localStorage.getItem('icesoft_token');
        const resposta = await fetch(`${API_URL}/mesas`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${cracha}` }
        });
        
        if (resposta.status === 401 || resposta.status === 403) {
             window.location.href = '../login/index.html';
             return;
        }

        mesasAbertas = await resposta.json();
        renderizarGrade();
        updateMesasNotificationBadge(mesasAbertas.length);

    } catch (e) {
        document.getElementById('container-mesas').innerHTML = '<p style="color: red;">Erro ao conectar com o servidor.</p>';
    }
}

function renderizarGrade() {
    const container = document.getElementById('container-mesas');
    container.innerHTML = '';
    const TOTAL_MESAS = 15; 

    for (let i = 1; i <= TOTAL_MESAS; i++) {
        const numeroMesa = String(i).padStart(2, '0'); 
        const mesaOcupada = mesasAbertas.find(m => m.numero === numeroMesa);

        if (mesaOcupada) {
            let totalMesa = 0;
            const itens = mesaOcupada.itens || [];
            itens.forEach(item => totalMesa += Number(item.preco));

            // 🛡️ CORREÇÃO: Removido o width 100% que estava estourando a caixa e adicionado box-sizing
            container.innerHTML += `
                <div class="mesa-card mesa-ocupada" style="position: relative; padding: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
                    <div onclick="abrirMesaOcupada(${mesaOcupada.id})" style="padding: 15px; flex: 1; cursor: pointer; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                        <h2 style="margin: 0; font-size: 1.8rem; color: #022344;">Mesa ${numeroMesa}</h2>
                        <p style="margin: 8px 0 0 0; font-weight: bold; color: #333;">R$ ${totalMesa.toFixed(2).replace('.', ',')}</p>
                        <p style="margin: 2px 0 0 0; font-size: 0.85rem; color: #666;">${itens.length} itens</p>
                    </div>
                    <button onclick="event.stopPropagation(); abrirAdicaoMesa(${mesaOcupada.id}, '${numeroMesa}')" style="background: #00e676; color: white; border: none; width: 100%; padding: 10px; font-size: 1.6rem; font-weight: bold; cursor: pointer; line-height: 1; transition: 0.2s;">+</button>
                </div>
            `;
        } else {
            container.innerHTML += `
                <div class="mesa-card mesa-livre" onclick="abrirNovaMesa('${numeroMesa}')">
                    <h2 style="margin: 0; font-size: 2rem;">Mesa ${numeroMesa}</h2>
                    <p style="margin: 10px 0 0 0; color: #666;">Livre</p>
                </div>
            `;
        }
    }
}

function abrirModalNovaMesa() {
    let numero = prompt("Digite o número da mesa ou comanda:");
    if (numero) abrirNovaMesa(numero.padStart(2, '0'));
}

// ==========================================
// LÓGICA DO MINI-PDV (MODAL DE LANÇAMENTO)
// ==========================================

function abrirNovaMesa(numero) {
    mesaEmEdicao = numero;
    idMesaEmAdicao = null; // Informa ao sistema que é uma mesa NOVA
    carrinhoLancamento = [];
    categoriaAtivaMesa = 'Todos';
    
    document.getElementById('titulo-modal-mesa').innerText = `Lançando na Mesa ${numero}`;
    document.getElementById('modal-lancamento').style.display = 'flex';

    renderizarCategoriasMesa();
    filtrarProdutosMesa();
    renderizarCarrinhoMesa();
}

function abrirAdicaoMesa(id, numero) {
    mesaEmEdicao = numero;
    idMesaEmAdicao = id; // Informa ao sistema que a mesa JÁ EXISTE
    carrinhoLancamento = []; // Começa com o carrinho vazio só para os itens novos
    categoriaAtivaMesa = 'Todos';

    document.getElementById('titulo-modal-mesa').innerText = `Adicionando à Mesa ${numero}`;
    document.getElementById('modal-lancamento').style.display = 'flex';

    renderizarCategoriasMesa();
    filtrarProdutosMesa();
    renderizarCarrinhoMesa();
}

function fecharModalLancamento() {
    document.getElementById('modal-lancamento').style.display = 'none';
    mesaEmEdicao = null;
}

function renderizarCategoriasMesa() {
    const nav = document.getElementById('categorias-mesa');
    nav.innerHTML = '';
    
    // Aproveita as classes "categoria-btn" e "ativo" do nosso novo Design System
    const classeTodos = categoriaAtivaMesa === 'Todos' ? 'ativo' : '';
    nav.innerHTML += `<button class="categoria-btn ${classeTodos}" onclick="mudarCategoriaMesa('Todos')">Todos</button>`;

    categoriasGlobais.forEach(cat => {
        const classeAtivo = cat.nome === categoriaAtivaMesa ? 'ativo' : '';
        nav.innerHTML += `<button class="categoria-btn ${classeAtivo}" onclick="mudarCategoriaMesa('${cat.nome}')">${cat.nome}</button>`;
    });
}

function mudarCategoriaMesa(cat) {
    categoriaAtivaMesa = cat;
    renderizarCategoriasMesa();
    filtrarProdutosMesa();
}

function filtrarProdutosMesa() {
    const container = document.getElementById('produtos-mesa');
    container.innerHTML = '';
    
    let lista = produtosNuvem;
    if (categoriaAtivaMesa !== 'Todos') {
        lista = produtosNuvem.filter(p => (p.categoria || "Outros") === categoriaAtivaMesa);
    }

    if(lista.length === 0) {
        container.innerHTML = '<p style="padding: 20px; opacity: 0.7;">Nenhum produto encontrado nesta categoria.</p>';
        return;
    }

    lista.forEach(p => {
        const temAdicional = p.grupos_ids && p.grupos_ids.length > 0;
        
        // O famoso ícone vazado com ancoragem absoluta que criamos no PDV
        const iconAdicional = temAdicional ? `<span class="material-symbols-outlined icon-add-bottom" title="Contém Adicionais">add_circle</span>` : '';

        // 🚀 MÁGICA DA VELOCIDADE: Layout compacto em blocos (Sem fotos)
        container.innerHTML += `
            <div class="pdv-card" onclick="verificarAdicaoMesa(${p.id})">
                <div class="pdv-nome-area">
                    <div class="pdv-nome">${p.nome}</div>
                </div>
                <div style="margin-top: 4px;">
                    <div class="pdv-preco">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>
                </div>
                ${iconAdicional}
            </div>
        `;
    });
}

// ==========================================
// MÓDULO DE ADICIONAIS NAS MESAS
// ==========================================

function verificarAdicaoMesa(id) {
    const produtoOriginal = produtosNuvem.find(p => p.id === id);
    if (!produtoOriginal) return;

    // 🛡️ Criamos uma cópia segura para podermos mudar o nome e o preço do item sem afetar o cardápio base na memória
    let produtoAdicionado = JSON.parse(JSON.stringify(produtoOriginal));
    
    const nomeMinusculo = produtoAdicionado.nome.toLowerCase();

    // ⚖️ INTELIGÊNCIA DA BALANÇA: Detecta se é venda por peso
    if (nomeMinusculo.includes('kg') || nomeMinusculo.includes('kilo') || nomeMinusculo.includes('quilo') || nomeMinusculo.includes('peso')) {
        const pesoDigitado = prompt(`⚖️ BALANÇA: ${produtoAdicionado.nome}\nO valor do Quilo (1kg) é R$ ${Number(produtoAdicionado.preco).toFixed(2).replace('.', ',')}.\n\nDigite a quantidade pesada:\n(Ex: 250 para gramas ou 0.25 para Kg)`);
        
        if (!pesoDigitado) return; // Operador cancelou

        let pesoTransformado = parseFloat(pesoDigitado.replace(',', '.'));
        
        if (isNaN(pesoTransformado) || pesoTransformado <= 0) {
            alert("⚠️ Valor inválido. A adição foi cancelada.");
            return;
        }

        // Mágica: Se o operador digitar '250', o sistema entende que são gramas e converte pra 0.25kg automaticamente
        if (pesoTransformado >= 10) {
            pesoTransformado = pesoTransformado / 1000;
        }

        // Refaz o preço e o nome do produto com o peso exato e o valor fracionado
        produtoAdicionado.preco = Number(produtoOriginal.preco) * pesoTransformado;
        produtoAdicionado.nome = `${produtoOriginal.nome} (${(pesoTransformado * 1000).toFixed(0)}g)`;
    }

    // O fluxo continua: Se não tem adicionais, vai direto pro carrinho com o novo preço
    if (!produtoAdicionado.grupos_ids || produtoAdicionado.grupos_ids.length === 0) {
        adicionarAoCarrinhoMesa(produtoAdicionado.nome, [], Number(produtoAdicionado.preco));
        return;
    }
    
    // Se tiver adicionais, abre o modal já levando o valor pesado corretamente
    abrirModalEscolhaMesa(produtoAdicionado);
}

function abrirModalEscolhaMesa(produto) {
    produtoEmSelecaoMesa = produto;
    escolhasAtuaisMesa = [];
    
    document.getElementById('detalhes-produto-topo').innerHTML = `
        <h2 style="margin:0; color:#022344; font-size: 1.5rem; font-weight: 400;">${produto.nome}</h2>
    `;

    const container = document.getElementById('container-grupos-opcoes');
    container.innerHTML = '';
    
    const gruposDoProduto = produto.grupos_ids
        .map(id => gruposGlobais.find(g => g.id === Number(id)))
        .filter(g => g && g.ativo !== false); 

    gruposDoProduto.forEach((grupo, indexGrupo) => {
        const itensAtivos = (grupo.itens || []).filter(item => item.ativo !== false);
        if (itensAtivos.length === 0) return;

        let itensHtml = itensAtivos.map((item, idx) => {
            const chkId = `mesa-chk-${grupo.id}-${idx}`;
            const precoAdc = Number(item.preco) > 0 ? `<span style="color:#25D366; font-weight:600;">+ R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</span>` : '';
            
            return `
            <div onclick="toggleOpcionalMesa(${grupo.id}, '${item.nome}', ${item.preco}, '${chkId}')" 
                 style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #eee; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <input type="checkbox" id="${chkId}" style="width:20px; height:20px; accent-color:#022344; pointer-events:none;">
                    <span style="font-weight: 400; color: #022344; font-size: 1.1rem;">${item.nome}</span>
                </div>
                ${precoAdc}
            </div>`;
        }).join('');

        // 🪄 MÁGICA: Abre a primeira categoria por padrão e fecha as demais
        const isOpen = indexGrupo === 0;
        const displayBody = isOpen ? 'block' : 'none';
        const bgHeader = isOpen ? '#0d4a82' : '#022344'; 
        const iconHtml = isOpen 
            ? `<span style="background:white; color:#022344; font-size:0.85rem; font-weight:bold; padding:4px 10px; border-radius:4px;">Até ${grupo.limite}</span>` 
            : `<span class="material-symbols-outlined" style="color:white;">arrow_drop_down</span>`;

        container.innerHTML += `
            <div style="margin-bottom:10px;">
                <div onclick="toggleAccordionMesa(this)" style="background:${bgHeader}; color:white; padding:12px 15px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition: 0.2s;">
                    <strong style="font-size: 1.1rem; font-weight: 400;">${grupo.nome}:</strong>
                    <div class="grupo-icon-area">${iconHtml}</div>
                    <input type="hidden" class="grupo-limite-val" value="${grupo.limite}">
                </div>
                <div class="grupo-body-mesa" style="display:${displayBody}; padding: 5px 15px 10px 15px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                    ${itensHtml}
                </div>
            </div>
        `;
    });

    atualizarPrecoDinamicoMesa();
    document.getElementById('modal-opcoes').style.display = 'flex';
}

// 🪄 Controle inteligente da animação da Sanfona nas Mesas
window.toggleAccordionMesa = function(elementoHeader) {
    const body = elementoHeader.nextElementSibling;
    const iconArea = elementoHeader.querySelector('.grupo-icon-area');
    const limite = elementoHeader.querySelector('.grupo-limite-val').value;

    if (body.style.display === 'none') {
        body.style.display = 'block';
        elementoHeader.style.backgroundColor = '#0d4a82';
        iconArea.innerHTML = `<span style="background:white; color:#022344; font-size:0.85rem; font-weight:bold; padding:4px 10px; border-radius:4px;">Até ${limite}</span>`;
    } else {
        body.style.display = 'none';
        elementoHeader.style.backgroundColor = '#022344';
        iconArea.innerHTML = `<span class="material-symbols-outlined" style="color:white;">arrow_drop_down</span>`;
    }
};

function toggleOpcionalMesa(grupoId, nomeItem, preco, chkId) {
    const grupo = gruposGlobais.find(g => g.id === grupoId);
    const chk = document.getElementById(chkId);
    const index = escolhasAtuaisMesa.findIndex(e => e.nome === nomeItem && e.grupoId === grupoId);

    if (index > -1) {
        escolhasAtuaisMesa.splice(index, 1);
        chk.checked = false;
    } else {
        const escolhasNoGrupo = escolhasAtuaisMesa.filter(e => e.grupoId === grupoId);
        if (grupo.limite === 1) {
            if (escolhasNoGrupo.length > 0) {
                const idxAnterior = escolhasAtuaisMesa.indexOf(escolhasNoGrupo[0]);
                escolhasAtuaisMesa.splice(idxAnterior, 1);
                document.querySelectorAll(`input[id^="mesa-chk-${grupoId}-"]`).forEach(c => c.checked = false);
            }
        } else if (escolhasNoGrupo.length >= grupo.limite) {
            alert(`Limite de ${grupo.limite} itens atingido para este grupo.`);
            return;
        }
        
        escolhasAtuaisMesa.push({ grupoId, nome: nomeItem, preco: Number(preco) });
        chk.checked = true;
    }
    atualizarPrecoDinamicoMesa();
}

function atualizarPrecoDinamicoMesa() {
    const totalOpcionais = escolhasAtuaisMesa.reduce((soma, e) => soma + Number(e.preco), 0);
    const totalGeral = Number(produtoEmSelecaoMesa.preco) + totalOpcionais;
    document.getElementById('preco-dinamico').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
}

function fecharModalOpcoesMesa() { 
    document.getElementById('modal-opcoes').style.display = 'none'; 
}

function confirmarEscolhasEAdicionarMesa() {
    const nomeBase = produtoEmSelecaoMesa.nome;
    const listaAdicionais = escolhasAtuaisMesa.map(e => e.nome);
    const precoFinal = Number(produtoEmSelecaoMesa.preco) + escolhasAtuaisMesa.reduce((soma, e) => soma + Number(e.preco), 0);
    
    adicionarAoCarrinhoMesa(nomeBase, listaAdicionais, precoFinal);
    fecharModalOpcoesMesa();
}

// ==========================================
// CARRINHO E ENVIO PARA NUVEM
// ==========================================

function adicionarAoCarrinhoMesa(nomeBase, adicionais, precoFinal) {
    // Salvamos a estrutura detalhada para a notinha e painel de pagamento!
    carrinhoLancamento.push({
        nomeBase: nomeBase,
        adicionais: adicionais || [],
        nome: adicionais.length > 0 ? `${nomeBase} (${adicionais.join(', ')})` : nomeBase,
        preco: Number(precoFinal)
    });
    renderizarCarrinhoMesa();
}

function removerDoCarrinhoMesa(index) {
    carrinhoLancamento.splice(index, 1);
    renderizarCarrinhoMesa();
}

function renderizarCarrinhoMesa() {
    const container = document.getElementById('carrinho-mesa');
    let subtotal = 0;

    if (carrinhoLancamento.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center; margin-top:20px;">Nenhum item selecionado.</p>';
        document.getElementById('total-lancamento').innerText = 'R$ 0,00';
        return;
    }

    container.innerHTML = '';
    carrinhoLancamento.forEach((item, index) => {
        subtotal += item.preco;
        
        let htmlAdicionais = '';
        if (item.adicionais && item.adicionais.length > 0) {
            htmlAdicionais = item.adicionais.map(adc => `<div style="font-size: 0.8rem; color: #666; padding-left: 10px;">+ ${adc}</div>`).join('');
        }

        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:start; padding:10px 0; border-bottom:1px dashed #ddd;">
                <div style="flex:1;">
                    <div style="font-weight:bold; color:#333;">${item.nomeBase}</div>
                    ${htmlAdicionais}
                    <div style="color:#e91e63; font-weight:bold; font-size:0.9rem; margin-top: 5px;">R$ ${item.preco.toFixed(2).replace('.', ',')}</div>
                </div>
                <button onclick="removerDoCarrinhoMesa(${index})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.2rem; padding: 5px;">🗑️</button>
            </div>
        `;
    });

    document.getElementById('total-lancamento').innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
}

async function confirmarLancamentoMesa() {
    if (carrinhoLancamento.length === 0) return alert("Adicione produtos antes de confirmar!");

    try {
        const btn = document.querySelector('#modal-lancamento button.btn-confirmar') || document.activeElement;
        const textoOriginal = btn.innerText;
        btn.innerText = "Enviando...";

        const cracha = localStorage.getItem('icesoft_token');

        if (idMesaEmAdicao) {
            const mesaAtual = mesasAbertas.find(m => m.id === idMesaEmAdicao);
            const itensCombinados = (mesaAtual.itens || []).concat(carrinhoLancamento);

            const resposta = await fetch(`${API_URL}/mesas/${idMesaEmAdicao}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cracha}`
                },
                body: JSON.stringify({ itens: itensCombinados })
            });

            if (resposta.ok) { fecharModalLancamento(); await carregarMesas(); } 
            else { alert("Erro ao adicionar novos itens na mesa."); }

        } else {
            const resposta = await fetch(`${API_URL}/mesas`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cracha}`
                },
                body: JSON.stringify({ numero: mesaEmEdicao, itens: carrinhoLancamento })
            });

            if (resposta.ok) { fecharModalLancamento(); await carregarMesas(); } 
            else { alert("Erro ao abrir mesa no servidor."); }
        }
        
        btn.innerText = textoOriginal;
    } catch (e) {
        alert("Erro de conexão. Verifique a internet.");
    }
}

// ==========================================
// SISTEMA DE PAGAMENTO (PARCIAL E TOTAL)
// ==========================================
let idMesaEmPagamento = null;
let numeroMesaEmPagamento = '';
let itensRestantesNaMesa = []; // Lado Esquerdo
let itensSendoPagos = [];      // Lado Direito
let descontoMesa = 0;
let acrescimoMesa = 0;
let isPagamentoDivididoMesa = false; // Estado do botão de divisão

function abrirMesaOcupada(idMesa) {
    const mesa = mesasAbertas.find(m => m.id === idMesa);
    if (!mesa) return;

    idMesaEmPagamento = mesa.id;
    numeroMesaEmPagamento = mesa.numero;
    
    itensRestantesNaMesa = JSON.parse(JSON.stringify(mesa.itens || []));
    itensSendoPagos = []; 
    descontoMesa = 0;
    acrescimoMesa = 0;

    // Reseta a interface de pagamento para o padrão sempre que abrir uma mesa
    isPagamentoDivididoMesa = false;
    document.getElementById('mesa-metodo-1').value = 'Dinheiro';
    document.getElementById('recebido-pagamento-mesa').value = '';

    if (document.getElementById('mesa-cliente-telefone')) document.getElementById('mesa-cliente-telefone').value = '';
    if (document.getElementById('mesa-cliente-nome')) document.getElementById('mesa-cliente-nome').value = '';

    const areaPag2 = document.getElementById('area-pagamento-2-mesa');
    const btnAdd = document.getElementById('btn-add-pagamento-mesa');
    const inputValor1 = document.getElementById('mesa-valor-1');
    if(areaPag2) areaPag2.style.display = 'none';
    if(btnAdd) btnAdd.style.display = 'block';
    if(inputValor1) inputValor1.readOnly = true;

    document.getElementById('titulo-pagamento-mesa').innerText = `Mesa ${mesa.numero}`;
    document.getElementById('modal-pagamento-mesa').style.display = 'flex';

    renderizarTelasDePagamento();
    
    // 🛠️ CORREÇÃO: Força o sistema a mostrar a gaveta de troco se o padrão for Dinheiro
    verificarMetodoMesa(); 
}

function fecharModalPagamentoMesa() {
    document.getElementById('modal-pagamento-mesa').style.display = 'none';
}

function renderizarTelasDePagamento() {
    const listaMesa = document.getElementById('lista-itens-mesa');
    const listaPagamento = document.getElementById('lista-itens-pagamento');
    
    listaMesa.innerHTML = '';
    listaPagamento.innerHTML = '';
    let subtotalPagamento = 0;

    // 1. Itens restantes na mesa (Esquerda)
    if (itensRestantesNaMesa.length === 0) {
        listaMesa.innerHTML = '<p style="text-align:center; color:#888;">Nenhum item restando na mesa.</p>';
    } else {
        itensRestantesNaMesa.forEach((item, index) => {
            // LÓGICA DE UI: Desempacota os adicionais em linhas separadas
            let htmlAdicionais = '';
            if (item.adicionais && item.adicionais.length > 0) {
                htmlAdicionais = item.adicionais.map(adc => `
                    <div style="color: #666; font-size: 0.9rem; padding-left: 20px; margin-top: 4px;">
                        + ${adc}
                    </div>
                `).join('');
            }

            listaMesa.innerHTML += `
                <div style="background: white; border: 1px solid #eee; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 700; font-size: 1rem; color: #888;">1x</span>
                            <span style="font-weight: bold; color: #333; font-size: 1.1rem;">${item.nomeBase || item.nome}</span>
                        </div>
                        ${htmlAdicionais}
                        <div style="color: #e91e63; font-weight: 900; font-size: 1.1rem; margin-top: 8px; padding-left: 28px;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button onclick="removerItemDaMesa(${index})" style="background: #fff0f4; color: #f44336; border: 1px solid #ffcdd2; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 1rem;" title="Cancelar este item">🗑️</button>
                        <button onclick="moverParaPagamento(${index})" style="background: #e91e63; color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem;">Pagar ➡</button>
                    </div>
                </div>
            `;
        });
    }

    // 2. Itens sendo pagos agora (Direita)
    if (itensSendoPagos.length === 0) {
        listaPagamento.innerHTML = '<p style="text-align:center; color:#888;">Selecione os itens ao lado que serão pagos agora.</p>';
    } else {
        itensSendoPagos.forEach((item, index) => {
            subtotalPagamento += Number(item.preco);
            
            // LÓGICA DE UI: Repete a formatação limpa para o lado direito também
            let htmlAdicionais = '';
            if (item.adicionais && item.adicionais.length > 0) {
                htmlAdicionais = item.adicionais.map(adc => `
                    <div style="color: #666; font-size: 0.9rem; padding-left: 20px; margin-top: 4px;">
                        + ${adc}
                    </div>
                `).join('');
            }

            listaPagamento.innerHTML += `
                <div style="background: white; border: 1px solid #00bcd4; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <button onclick="voltarParaMesa(${index})" style="background: none; border: none; color: #f44336; cursor: pointer; font-size: 1.5rem; padding: 0 15px 0 5px;" title="Devolver para a mesa">⬅</button>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 700; font-size: 1rem; color: #888;">1x</span>
                            <span style="font-weight: bold; color: #00838f; font-size: 1.1rem;">${item.nomeBase || item.nome}</span>
                        </div>
                        ${htmlAdicionais}
                        <div style="color: #e91e63; font-weight: 900; font-size: 1.1rem; margin-top: 8px; padding-left: 28px;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
                    </div>
                </div>
            `;
        });
    }

    // 3. Calcula e Atualiza Totais
    let totalFinal = subtotalPagamento - descontoMesa + acrescimoMesa;
    if (totalFinal < 0) totalFinal = 0;

    document.getElementById('subtotal-pagamento-mesa').innerText = `R$ ${subtotalPagamento.toFixed(2).replace('.', ',')}`;
    document.getElementById('desconto-pagamento-mesa').innerText = `- R$ ${descontoMesa.toFixed(2).replace('.', ',')}`;
    document.getElementById('acrescimo-pagamento-mesa').innerText = `+ R$ ${acrescimoMesa.toFixed(2).replace('.', ',')}`;
    document.getElementById('total-pagamento-mesa').innerText = `R$ ${totalFinal.toFixed(2).replace('.', ',')}`;

    document.getElementById('btn-finalizar-mesa').dataset.total = totalFinal;

    if (!isPagamentoDivididoMesa) {
        const inputValor1 = document.getElementById('mesa-valor-1');
        if(inputValor1) inputValor1.value = totalFinal.toFixed(2);
    }
    calcularTrocoMesa();
}

function moverParaPagamento(index) {
    itensSendoPagos.push(itensRestantesNaMesa.splice(index, 1)[0]);
    renderizarTelasDePagamento();
}

function voltarParaMesa(index) {
    itensRestantesNaMesa.push(itensSendoPagos.splice(index, 1)[0]);
    renderizarTelasDePagamento();
}

function moverTodosParaPagamento() {
    itensSendoPagos = itensSendoPagos.concat(itensRestantesNaMesa);
    itensRestantesNaMesa = [];
    renderizarTelasDePagamento();
}

function pedirDescontoMesa() {
    let valor = prompt("✏️ Digite o valor do DESCONTO em R$:");
    if (valor !== null) {
        descontoMesa = parseFloat(valor.replace(',', '.')) || 0;
        renderizarTelasDePagamento();
    }
}

function pedirAcrescimoMesa() {
    let valor = prompt("✏️ Digite o valor do ACRÉSCIMO em R$:");
    if (valor !== null) {
        acrescimoMesa = parseFloat(valor.replace(',', '.')) || 0;
        renderizarTelasDePagamento();
    }
}

// ==========================================
// FUNÇÕES DE DIVISÃO E TROCO (MESAS)
// ==========================================

function togglePagamentoDivididoMesa() {
    isPagamentoDivididoMesa = !isPagamentoDivididoMesa;
    const areaPag2 = document.getElementById('area-pagamento-2-mesa');
    const btnAdd = document.getElementById('btn-add-pagamento-mesa');
    const inputValor1 = document.getElementById('mesa-valor-1');
    
    if (isPagamentoDivididoMesa) {
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
    calcularTrocoMesa();
    verificarMetodoMesa();
}

function verificarMetodoMesa() {
    const m1 = document.getElementById('mesa-metodo-1').value;
    const m2 = isPagamentoDivididoMesa ? document.getElementById('mesa-metodo-2').value : null;
    const areaTroco = document.getElementById('area-troco-mesa');
    
    if (m1 === 'Dinheiro' || m2 === 'Dinheiro') {
        areaTroco.style.display = 'block';
    } else {
        areaTroco.style.display = 'none';
        document.getElementById('recebido-pagamento-mesa').value = ''; 
    }
    calcularTrocoMesa();
}

function calcularTrocoMesa() {
    const total = Number(document.getElementById('btn-finalizar-mesa').dataset.total) || 0;
    
    let v1 = parseFloat(document.getElementById('mesa-valor-1').value) || 0;
    if (v1 > total) {
        v1 = total;
        document.getElementById('mesa-valor-1').value = v1.toFixed(2);
    }
    
    let v2 = 0;
    if (isPagamentoDivididoMesa) {
        v2 = total - v1;
        document.getElementById('mesa-valor-2').value = v2.toFixed(2);
    } else {
        v1 = total;
        document.getElementById('mesa-valor-1').value = v1.toFixed(2);
    }

    const m1 = document.getElementById('mesa-metodo-1').value;
    const m2 = isPagamentoDivididoMesa ? document.getElementById('mesa-metodo-2').value : null;
    
    let dinheiroEsperado = 0;
    if (m1 === 'Dinheiro') dinheiroEsperado += v1;
    if (m2 === 'Dinheiro') dinheiroEsperado += v2;

    const recebido = parseFloat(document.getElementById('recebido-pagamento-mesa').value) || 0;
    const display = document.getElementById('troco-pagamento-mesa');
    
    if (dinheiroEsperado > 0) {
        const troco = recebido - dinheiroEsperado;
        if (troco >= 0) {
            display.innerText = `R$ ${troco.toFixed(2).replace('.', ',')}`;
            display.style.color = '#25D366';
        } else {
            display.innerText = `Faltam R$ ${Math.abs(troco).toFixed(2).replace('.', ',')}`;
            display.style.color = '#f44336';
        }
    } else {
        display.innerText = `R$ 0,00`;
        display.style.color = '#25D366';
    }
}

// ==========================================
// FINALIZAR E MANDAR PRO SERVIDOR
// ==========================================
async function finalizarPagamentoMesa() {
    if (itensSendoPagos.length === 0) return alert("Selecione pelo menos um item para pagar!");

    const totalCobrado = Number(document.getElementById('btn-finalizar-mesa').dataset.total);
    
    const m1 = document.getElementById('mesa-metodo-1').value;
    const v1 = parseFloat(document.getElementById('mesa-valor-1').value) || 0;
    let metodoFinalTexto = m1;

    if (isPagamentoDivididoMesa) {
        const m2 = document.getElementById('mesa-metodo-2').value;
        const v2 = parseFloat(document.getElementById('mesa-valor-2').value) || 0;
        
        if (v1 <= 0 || v2 <= 0) return alert("⚠️ Ambos os valores devem ser maiores que zero na divisão.");
        if (m1 === m2) return alert("⚠️ As duas formas de pagamento não podem ser iguais.");
        
        metodoFinalTexto = `${m1} e ${m2}`;
    }

    let dinheiroEsperado = 0;
    if (m1 === 'Dinheiro') dinheiroEsperado += v1;
    if (isPagamentoDivididoMesa && document.getElementById('mesa-metodo-2').value === 'Dinheiro') {
        dinheiroEsperado += parseFloat(document.getElementById('mesa-valor-2').value);
    }

    const recebido = parseFloat(document.getElementById('recebido-pagamento-mesa').value) || 0;
    if (dinheiroEsperado > 0 && recebido < dinheiroEsperado) {
        return alert(`⚠️ O cliente precisa entregar pelo menos R$ ${dinheiroEsperado.toFixed(2)} em dinheiro.`);
    }

    const btn = document.getElementById('btn-finalizar-mesa');
    btn.innerText = "Processando...";
    btn.disabled = true;

    try {
        const itensFormatadosDashboard = itensSendoPagos.map(item => {
            return { 
                nome: `Mesa ${numeroMesaEmPagamento} - ${item.nome}`, 
                preco: item.preco 
            };
        });

        // 🛠️ FIX: Cria um resumo de texto limpo para não estourar o limite do Banco de Dados
        const nomesApenas = itensSendoPagos.map(item => item.nome).join(' + ');
        const nomeCurto = nomesApenas.length > 250 ? nomesApenas.substring(0, 247) + '...' : nomesApenas;

        const clienteTelefone = document.getElementById('mesa-cliente-telefone') ? document.getElementById('mesa-cliente-telefone').value.trim() : '';
        const clienteNome = document.getElementById('mesa-cliente-nome') ? document.getElementById('mesa-cliente-nome').value.trim() : '';

        const vendaPayload = {
            itens: itensFormatadosDashboard, // Enviamos como lista, o servidor cuida da formatação pesada
            produto_nome: nomeCurto, // Título resumido que cabe perfeitamente no limite do banco
            valor_total: totalCobrado,
            total: totalCobrado,
            forma_pagamento: metodoFinalTexto, 
            status: "Concluída",
            origem: "Mesas",
            cliente_telefone: clienteTelefone,
            cliente_nome: clienteNome
        };

        const resVenda = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vendaPayload)
        });

        if (!resVenda.ok) throw new Error("Erro ao salvar a venda financeira.");

        if (itensRestantesNaMesa.length === 0) {
            await fetch(`${API_URL}/mesas/${idMesaEmPagamento}`, { method: 'DELETE' });
            alert(`✅ Mesa ${numeroMesaEmPagamento} encerrada com sucesso!\nPagamento: ${metodoFinalTexto}`);
        } else {
            await fetch(`${API_URL}/mesas/${idMesaEmPagamento}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itens: itensRestantesNaMesa })
            });
            alert(`✅ Pagamento parcial registrado!\nPagamento: ${metodoFinalTexto}\nA mesa continua aberta com o restante.`);
        }

        fecharModalPagamentoMesa();
        await carregarMesas(); 

    } catch (e) {
        alert("Erro ao processar: " + e.message);
    } finally {
        btn.innerText = "💰 Confirmar Pagamento";
        btn.disabled = false;
    }
}

// ==========================================
// FUNÇÃO PARA CANCELAR ITEM INDIVIDUAL DA MESA
// ==========================================
async function removerItemDaMesa(index) {
    const confirmacao = confirm("⚠️ Tem certeza que deseja cancelar este item?\nEle será removido da mesa e do sistema.");
    if (!confirmacao) return;

    // Remove o item da lista visual da esquerda
    itensRestantesNaMesa.splice(index, 1);
    
    // Junta os itens que sobraram na mesa com os que já estão separados para pagar (se houver)
    const todosItensAtuais = itensRestantesNaMesa.concat(itensSendoPagos);

    try {
        if (todosItensAtuais.length === 0) {
            // Se o operador deletou o único/último item que tinha na mesa, a mesa some do banco
            await fetch(`${API_URL}/mesas/${idMesaEmPagamento}`, { method: 'DELETE' });
            alert("✅ Último item cancelado. Mesa liberada!");
            fecharModalPagamentoMesa();
        } else {
            // Se ainda tem itens, atualiza o banco de dados apenas com o que sobrou
            await fetch(`${API_URL}/mesas/${idMesaEmPagamento}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itens: todosItensAtuais })
            });
        }
        
        // Recarrega as telas para mostrar a alteração
        renderizarTelasDePagamento();
        await carregarMesas(); 

    } catch (e) {
        console.error("Erro ao cancelar item:", e);
        alert("🔌 Erro de conexão ao tentar cancelar o item. Verifique a internet.");
    }
}

// ==========================================
// 🔍 PESQUISA RÁPIDA DE PRODUTOS
// ==========================================
function pesquisarProdutoMesa() {
    const termo = document.getElementById('input-busca-mesa').value.toLowerCase();
    
    // 🎯 MÁGICA: Ele acha os produtos pelo clique da função, sem depender de classes ou IDs!
    const todosProdutosNaTela = document.querySelectorAll('[onclick^="verificarAdicaoMesa"]');
    
    todosProdutosNaTela.forEach(cardProduto => {
        // Pega todo o texto escrito no card do produto (Nome, Preço, etc)
        const textoCard = cardProduto.innerText.toLowerCase();
        
        // Se o que você digitou estiver no texto do card, ele mostra. Se não, ele esconde!
        if (textoCard.includes(termo)) {
            cardProduto.style.display = ''; 
        } else {
            cardProduto.style.display = 'none'; 
        }
    });
}

// Função para atualizar a bolinha vermelha no menu
function updateMesasNotificationBadge(count) {
    const badge = document.getElementById('mesas-notification-badge');
    if (!badge) return; // Proteção caso o elemento não exista na tela

    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex'; // Mostra o aviso se houver mesas ocupadas
    } else {
        badge.style.display = 'none'; // Esconde se estiver tudo vazio
    }
}

// ==========================================
// 🎁 INTELIGÊNCIA DE FIDELIDADE (CRM)
// ==========================================
let clientesCRMGlobal = [];

async function carregarClientesCRM() {
    try {
        const cracha = localStorage.getItem('icesoft_token');
        const res = await fetch(`${API_URL}/crm/clientes`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${cracha}` }
        });
        
        // Se for barrado, sai silenciosamente para não quebrar a tela de mesas
        if (res.status === 401 || res.status === 403) return;

        clientesCRMGlobal = await res.json();
    } catch(e) { console.log("Erro ao carregar CRM nas mesas", e); }
}

function buscarClienteCRM(telefoneDigitado) {
    if (!telefoneDigitado) return;
    
    // Limpa o que a pessoa digitou para deixar só os números (tira espaços, traços)
    const numeroLimpo = telefoneDigitado.replace(/\D/g, '');
    
    // Procura na memória se já existe alguém com esse número
    const cliente = clientesCRMGlobal.find(c => c.telefone && c.telefone.replace(/\D/g, '') === numeroLimpo);
    
    // Se achou, preenche o nome como num passe de mágica!
    if (cliente && cliente.nome) {
        document.getElementById('mesa-cliente-nome').value = cliente.nome;
    }
}