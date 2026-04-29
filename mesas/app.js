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
        const resposta = await fetch(`${API_URL}/mesas`);
        mesasAbertas = await resposta.json();
        renderizarGrade();
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

            // Cartão da mesa ocupada com o botão "+" verde colado no rodapé
            container.innerHTML += `
                <div class="mesa-card mesa-ocupada" style="position: relative; padding: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
                    <div onclick="abrirMesaOcupada(${mesaOcupada.id})" style="padding: 20px; flex: 1;">
                        <h2 style="margin: 0; font-size: 2rem;">Mesa ${numeroMesa}</h2>
                        <p style="margin: 10px 0 0 0; font-weight: bold; color: #333;">R$ ${totalMesa.toFixed(2).replace('.', ',')}</p>
                        <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #666;">${itens.length} itens</p>
                    </div>
                    <button onclick="event.stopPropagation(); abrirAdicaoMesa(${mesaOcupada.id}, '${numeroMesa}')" style="background: #00c853; color: white; border: none; width: 100%; padding: 8px; font-size: 2rem; font-weight: bold; cursor: pointer; line-height: 1; transition: 0.2s;">+</button>
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
    nav.innerHTML = `<button class="categoria-btn ${categoriaAtivaMesa === 'Todos' ? 'ativo' : ''}" onclick="mudarCategoriaMesa('Todos')" style="padding: 8px 15px; border:none; border-radius:20px; cursor:pointer; font-weight:bold; background: ${categoriaAtivaMesa === 'Todos' ? '#00bcd4' : '#eee'}; color: ${categoriaAtivaMesa === 'Todos' ? 'white' : '#555'};">Todos</button>`;

    categoriasGlobais.forEach(cat => {
        const isAtivo = cat.nome === categoriaAtivaMesa;
        nav.innerHTML += `<button onclick="mudarCategoriaMesa('${cat.nome}')" style="padding: 8px 15px; border:none; border-radius:20px; cursor:pointer; font-weight:bold; background: ${isAtivo ? '#00bcd4' : '#eee'}; color: ${isAtivo ? 'white' : '#555'}; white-space: nowrap;">${cat.nome}</button>`;
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

    lista.forEach(p => {
        // 📸 LÓGICA DA FOTO: Se tiver imagem, mostra ela. Se não, mostra o emoji.
        const visualProduto = p.imagem_url 
            ? `<img src="${p.imagem_url}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;">`
            : `<div style="font-size: 2.5rem; height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">${p.emoji || '🍨'}</div>`;

        container.innerHTML += `
            <div class="produto-item-pdv" onclick="verificarAdicaoMesa(${p.id})" style="background:white; border:1px solid #ddd; border-radius:10px; padding:12px; text-align:center; cursor:pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.05); transition: 0.2s; display: flex; flex-direction: column; justify-content: space-between; min-height: 150px;">
                <div>
                    ${visualProduto}
                    <div style="font-weight:bold; color:#333; font-size:0.85rem; line-height: 1.2; margin-bottom: 5px;">${p.nome}</div>
                </div>
                <div style="color:#e91e63; font-weight:900; font-size: 1rem;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>
            </div>
        `;
    });
}

// ==========================================
// MÓDULO DE ADICIONAIS NAS MESAS
// ==========================================

function verificarAdicaoMesa(id) {
    const produto = produtosNuvem.find(p => p.id === id);
    if (!produto.grupos_ids || produto.grupos_ids.length === 0) {
        // Se não tem adicionais, vai direto pro carrinho
        adicionarAoCarrinhoMesa(produto.nome, [], Number(produto.preco));
        return;
    }
    abrirModalEscolhaMesa(produto);
}

function abrirModalEscolhaMesa(produto) {
    produtoEmSelecaoMesa = produto;
    escolhasAtuaisMesa = [];
    
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
            const chkId = `mesa-chk-${grupo.id}-${idx}`;
            return `
            <div onclick="toggleOpcionalMesa(${grupo.id}, '${item.nome}', ${item.preco}, '${chkId}')" 
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

    atualizarPrecoDinamicoMesa();
    document.getElementById('modal-opcoes').style.display = 'flex';
}

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

        if (idMesaEmAdicao) {
            // MESA JÁ EXISTE: Soma os itens antigos com os novos e atualiza (PUT)
            const mesaAtual = mesasAbertas.find(m => m.id === idMesaEmAdicao);
            const itensAntigos = mesaAtual.itens || [];
            const itensCombinados = itensAntigos.concat(carrinhoLancamento);

            const resposta = await fetch(`${API_URL}/mesas/${idMesaEmAdicao}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itens: itensCombinados })
            });

            if (resposta.ok) {
                fecharModalLancamento();
                await carregarMesas(); 
            } else { alert("Erro ao adicionar novos itens na mesa."); }

        } else {
            // MESA NOVA: Cria a mesa do zero (POST)
            const resposta = await fetch(`${API_URL}/mesas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    numero: mesaEmEdicao,
                    itens: carrinhoLancamento
                })
            });

            if (resposta.ok) {
                fecharModalLancamento();
                await carregarMesas(); 
            } else { alert("Erro ao abrir mesa no servidor."); }
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

        const vendaPayload = {
            itens: itensFormatadosDashboard, // Enviamos como lista, o servidor cuida da formatação pesada
            produto_nome: nomeCurto, // Título resumido que cabe perfeitamente no limite do banco
            valor_total: totalCobrado,
            total: totalCobrado,
            forma_pagamento: metodoFinalTexto, 
            status: "Concluída",
            origem: "Mesas"
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