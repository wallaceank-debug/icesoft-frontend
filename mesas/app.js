const API_URL = 'https://api.108.174.146.77.nip.io/api';

let mesasAbertas = [];
let produtosNuvem = [];
let categoriasGlobais = [];
let gruposGlobais = []; // NOVA MEMÓRIA: Adicionais

// Memória do Modal de Lançamento
let mesaEmEdicao = null;
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

            container.innerHTML += `
                <div class="mesa-card mesa-ocupada" onclick="abrirMesaOcupada(${mesaOcupada.id})">
                    <h2 style="margin: 0; font-size: 2rem;">Mesa ${numeroMesa}</h2>
                    <p style="margin: 10px 0 0 0; font-weight: bold; color: #555;">R$ ${totalMesa.toFixed(2).replace('.', ',')}</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #888;">${itens.length} itens</p>
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
    carrinhoLancamento = [];
    categoriaAtivaMesa = 'Todos';
    
    document.getElementById('titulo-modal-mesa').innerText = `Lançando na Mesa ${numero}`;
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
        // AGORA CHAMA A VERIFICAÇÃO DE ADICIONAIS ANTES DE PULAR PRO CARRINHO
        container.innerHTML += `
            <div onclick="verificarAdicaoMesa(${p.id})" style="background:white; border:1px solid #ddd; border-radius:10px; padding:15px; text-align:center; cursor:pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <div style="font-size:2rem;">${p.emoji || '🍨'}</div>
                <div style="font-weight:bold; color:#333; font-size:0.9rem; margin:10px 0;">${p.nome}</div>
                <div style="color:#e91e63; font-weight:bold;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</div>
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
            await carregarMesas(); // Recarrega o mapa atualizado
        } else {
            alert("Erro ao abrir mesa no servidor.");
            btn.innerText = textoOriginal;
        }
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

function abrirMesaOcupada(idMesa) {
    const mesa = mesasAbertas.find(m => m.id === idMesa);
    if (!mesa) return;

    idMesaEmPagamento = mesa.id;
    numeroMesaEmPagamento = mesa.numero;
    
    // Fazemos uma cópia exata dos itens da mesa para o Lado Esquerdo
    itensRestantesNaMesa = JSON.parse(JSON.stringify(mesa.itens || []));
    itensSendoPagos = []; // Lado direito começa vazio
    descontoMesa = 0;
    acrescimoMesa = 0;

    document.getElementById('titulo-pagamento-mesa').innerText = `Mesa ${mesa.numero}`;
    document.getElementById('modal-pagamento-mesa').style.display = 'flex';

    renderizarTelasDePagamento();
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

    // 1. Desenha os Itens que ainda estão na mesa (Lado Esquerdo)
    if (itensRestantesNaMesa.length === 0) {
        listaMesa.innerHTML = '<p style="text-align:center; color:#888;">Nenhum item restando na mesa.</p>';
    } else {
        itensRestantesNaMesa.forEach((item, index) => {
            listaMesa.innerHTML += `
                <div style="background: white; border: 1px solid #eee; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div>
                        <div style="font-weight: bold; color: #333; font-size: 0.95rem;">${item.nomeBase || item.nome}</div>
                        <div style="color: #666; font-size: 0.9rem;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
                    </div>
                    <button onclick="moverParaPagamento(${index})" style="background: #e91e63; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 0.85rem;">Pagar ➡</button>
                </div>
            `;
        });
    }

    // 2. Desenha os Itens que estão sendo pagos (Lado Direito)
    if (itensSendoPagos.length === 0) {
        listaPagamento.innerHTML = '<p style="text-align:center; color:#888;">Selecione os itens ao lado que serão pagos agora.</p>';
    } else {
        itensSendoPagos.forEach((item, index) => {
            subtotalPagamento += Number(item.preco);
            listaPagamento.innerHTML += `
                <div style="background: white; border: 1px solid #00bcd4; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <button onclick="voltarParaMesa(${index})" style="background: none; border: none; color: #f44336; cursor: pointer; font-size: 1.2rem;" title="Devolver para a mesa">⬅</button>
                    <div style="flex: 1; margin-left: 10px;">
                        <div style="font-weight: bold; color: #00838f; font-size: 0.95rem;">${item.nomeBase || item.nome}</div>
                        <div style="color: #333; font-weight: bold;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</div>
                    </div>
                </div>
            `;
        });
    }

    // 3. Calcula os Totais com Desconto/Acréscimo
    let totalFinal = subtotalPagamento - descontoMesa + acrescimoMesa;
    if (totalFinal < 0) totalFinal = 0;

    document.getElementById('subtotal-pagamento-mesa').innerText = `R$ ${subtotalPagamento.toFixed(2).replace('.', ',')}`;
    document.getElementById('desconto-pagamento-mesa').innerText = `- R$ ${descontoMesa.toFixed(2).replace('.', ',')}`;
    document.getElementById('acrescimo-pagamento-mesa').innerText = `+ R$ ${acrescimoMesa.toFixed(2).replace('.', ',')}`;
    document.getElementById('total-pagamento-mesa').innerText = `R$ ${totalFinal.toFixed(2).replace('.', ',')}`;

    // Guarda o valor na memória invisível do botão para usarmos na hora de salvar
    document.getElementById('btn-finalizar-mesa').dataset.total = totalFinal;
}

// Ações de mover os itens de um lado para o outro
function moverParaPagamento(index) {
    const item = itensRestantesNaMesa.splice(index, 1)[0];
    itensSendoPagos.push(item);
    renderizarTelasDePagamento();
}

function voltarParaMesa(index) {
    const item = itensSendoPagos.splice(index, 1)[0];
    itensRestantesNaMesa.push(item);
    renderizarTelasDePagamento();
}

function moverTodosParaPagamento() {
    itensSendoPagos = itensSendoPagos.concat(itensRestantesNaMesa);
    itensRestantesNaMesa = [];
    renderizarTelasDePagamento();
}

// Descontos e Acréscimos (Igual ao PDV)
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
// FUNÇÕES DE CÁLCULO DE TROCO (MESA)
// ==========================================
function verificarMetodoMesa() {
    const metodo = document.getElementById('metodo-pagamento-mesa').value;
    document.getElementById('area-troco-mesa').style.display = (metodo === 'Dinheiro') ? 'block' : 'none';
}

function calcularTrocoMesa() {
    const recebido = parseFloat(document.getElementById('recebido-pagamento-mesa').value) || 0;
    const total = Number(document.getElementById('btn-finalizar-mesa').dataset.total) || 0;
    const troco = recebido - total;
    const display = document.getElementById('troco-pagamento-mesa');
    
    if (troco >= 0) {
        display.innerText = `R$ ${troco.toFixed(2).replace('.', ',')}`;
        display.style.color = '#25D366';
    } else {
        display.innerText = `Faltam R$ ${Math.abs(troco).toFixed(2).replace('.', ',')}`;
        display.style.color = '#f44336';
    }
}

// O Grande Momento: Finalizar e Mandar pro Servidor!
async function finalizarPagamentoMesa() {
    if (itensSendoPagos.length === 0) return alert("Selecione pelo menos um item para pagar!");

    const metodo = document.getElementById('metodo-pagamento-mesa').value;
    const totalCobrado = Number(document.getElementById('btn-finalizar-mesa').dataset.total);
    const btn = document.getElementById('btn-finalizar-mesa');
    
    btn.innerText = "Processando...";
    btn.disabled = true;

    try {
        // MÁGICA AQUI: Colocamos a etiqueta "Mesa XX:" no nome de cada produto
        const itensFormatadosDashboard = itensSendoPagos.map(item => {
            return { 
                nome: `Mesa ${numeroMesaEmPagamento} - ${item.nome}`, 
                preco: item.preco 
            };
        });

        // PARTE 1: Registrar a Venda Oficial no seu Caixa (Dashboard)
        const vendaPayload = {
            itens: JSON.stringify(itensFormatadosDashboard),
            produto_nome: JSON.stringify(itensFormatadosDashboard),
            valor_total: totalCobrado,
            total: totalCobrado,
            forma_pagamento: metodo,
            status: "Concluída"
        };

        const resVenda = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vendaPayload)
        });

        if (!resVenda.ok) throw new Error("Erro ao salvar a venda financeira.");

        // PARTE 2: Atualizar ou Fechar a Mesa
        if (itensRestantesNaMesa.length === 0) {
            // Conta paga por completo -> Exclui a mesa
            await fetch(`${API_URL}/mesas/${idMesaEmPagamento}`, { method: 'DELETE' });
            alert(`✅ Mesa ${numeroMesaEmPagamento} encerrada com sucesso!`);
        } else {
            // Pagamento Parcial -> Atualiza a mesa só com o que sobrou
            await fetch(`${API_URL}/mesas/${idMesaEmPagamento}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itens: itensRestantesNaMesa })
            });
            alert(`✅ Pagamento parcial registrado! A mesa continua aberta.`);
        }

        // Tudo deu certo, recarrega a tela!
        fecharModalPagamentoMesa();
        await carregarMesas(); 

    } catch (e) {
        alert("Erro ao processar: " + e.message);
    } finally {
        btn.innerText = "💰 Confirmar Pagamento";
        btn.disabled = false;
    }
}
