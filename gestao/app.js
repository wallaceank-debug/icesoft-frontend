const API_URL = 'https://icesoft-api.onrender.com/api';
let listaProdutos = [];
let listaGrupos = [];
let grupoSelecionadoId = null;

window.onload = async () => {
    await carregarTudo();
};

async function carregarTudo() {
    try {
        const [resProd, resGrupos] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/grupos`)
        ]);
        listaProdutos = await resProd.json();
        listaGrupos = await resGrupos.json();

        renderizarProdutos();
        renderizarGrupos();

        if (grupoSelecionadoId) selecionarGrupo(grupoSelecionadoId);
    } catch (e) { console.error("Erro", e); }
}

function renderizarProdutos() {
    const div = document.getElementById('lista-produtos');
    div.innerHTML = '';
    listaProdutos.forEach(p => {
        const isAtivo = p.ativo !== false;
        const classeInativo = isAtivo ? '' : 'item-inativo';
        div.innerHTML += `
            <div class="item-linha">
                <div class="item-info ${classeInativo}" onclick="abrirEdicaoProduto(${p.id})">
                    <span class="item-nome">${p.emoji} ${p.nome}</span>
                    <span class="item-detalhe">R$ ${Number(p.preco).toFixed(2)}</span>
                </div>
                <div class="item-acoes">
                    <label class="switch">
                        <input type="checkbox" onchange="toggleProduto(${p.id}, this.checked)" ${isAtivo ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button class="btn-icone" onclick="excluirProduto(${p.id})">🗑️</button>
                </div>
            </div>
        `;
    });
}

async function toggleProduto(id, statusAtivo) {
    try {
        await fetch(`${API_URL}/produtos/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: statusAtivo })
        });
        await carregarTudo();
    } catch(e) { alert("Erro ao mudar status"); }
}

function renderizarGrupos() {
    const div = document.getElementById('lista-grupos');
    div.innerHTML = '';
    listaGrupos.forEach(g => {
        const isAtivo = g.ativo !== false;
        const classeInativo = isAtivo ? '' : 'item-inativo';
        const isSelecionado = g.id === grupoSelecionadoId ? 'selecionado' : '';
        div.innerHTML += `
            <div class="item-linha ${isSelecionado}">
                <div class="item-info ${classeInativo}" onclick="selecionarGrupo(${g.id})">
                    <span class="item-nome">${g.nome}</span>
                    <span class="item-detalhe">Limite: ${g.limite} | ${(g.itens||[]).length} itens</span>
                </div>
                <div class="item-acoes">
                    <button class="btn-icone" onclick="abrirEdicaoGrupo(${g.id})">✏️</button>
                    <label class="switch">
                        <input type="checkbox" onchange="toggleGrupo(${g.id}, this.checked)" ${isAtivo ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;
    });
}

function selecionarGrupo(id) {
    grupoSelecionadoId = id;
    renderizarGrupos();
    renderizarAdicionais();
    document.getElementById('btn-novo-adicional').style.display = 'block';
}

async function toggleGrupo(id, statusAtivo) {
    try {
        await fetch(`${API_URL}/grupos/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: statusAtivo })
        });
        await carregarTudo();
    } catch(e) { alert("Erro ao mudar status"); }
}

function renderizarAdicionais() {
    const div = document.getElementById('lista-adicionais');
    const grupo = listaGrupos.find(g => g.id === grupoSelecionadoId);
    if (!grupo || !grupo.itens || grupo.itens.length === 0) {
        div.innerHTML = '<p class="carregando">Nenhum adicional neste grupo.</p>';
        return;
    }
    div.innerHTML = '';
    grupo.itens.forEach((item, index) => {
        const isAtivo = item.ativo !== false;
        const classeInativo = isAtivo ? '' : 'item-inativo';
        div.innerHTML += `
            <div class="item-linha">
                <div class="item-info ${classeInativo}">
                    <span class="item-nome">${item.nome}</span>
                    <span class="item-detalhe">+ R$ ${Number(item.preco).toFixed(2)}</span>
                </div>
                <div class="item-acoes">
                    <label class="switch">
                        <input type="checkbox" onchange="toggleAdicional(${index}, this.checked)" ${isAtivo ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button class="btn-icone" onclick="excluirAdicional(${index})">🗑️</button>
                </div>
            </div>
        `;
    });
}

async function toggleAdicional(indexItem, statusAtivo) {
    const grupo = listaGrupos.find(g => g.id === grupoSelecionadoId);
    grupo.itens[indexItem].ativo = statusAtivo;
    try {
        await fetch(`${API_URL}/grupos/${grupo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(grupo)
        });
        await carregarTudo();
    } catch(e) { alert("Erro ao salvar."); }
}

async function excluirAdicional(indexItem) {
    if(!confirm("Excluir este adicional?")) return;
    const grupo = listaGrupos.find(g => g.id === grupoSelecionadoId);
    grupo.itens.splice(indexItem, 1);
    try {
        await fetch(`${API_URL}/grupos/${grupo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(grupo)
        });
        await carregarTudo();
    } catch(e) { alert("Erro ao salvar."); }
}

function abrirModalAdicional() {
    const nome = prompt("Nome do Adicional:");
    if (!nome) return;
    const preco = prompt("Preço (0 para grátis):");
    const grupo = listaGrupos.find(g => g.id === grupoSelecionadoId);
    const novoItem = { nome: nome, preco: parseFloat(preco) || 0, ativo: true };
    grupo.itens = grupo.itens || [];
    grupo.itens.push(novoItem);
    fetch(`${API_URL}/grupos/${grupo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(grupo)
    }).then(() => carregarTudo());
}

function fecharModalProduto() { document.getElementById('modal-produto').style.display = 'none'; }
function fecharModalGrupo() { document.getElementById('modal-grupo').style.display = 'none'; }

let gruposSelecionadosTemporarios = [];

function abrirModalProduto(id = null) {
    const modal = document.getElementById('modal-produto');
    const idInput = document.getElementById('prod-id');
    const titulo = document.getElementById('titulo-modal-produto');
    gruposSelecionadosTemporarios = [];
    
    if (id) {
        const p = listaProdutos.find(x => x.id === id);
        titulo.innerText = "Editar Produto";
        idInput.value = p.id;
        document.getElementById('prod-nome').value = p.nome;
        document.getElementById('prod-preco').value = p.preco;
        document.getElementById('prod-emoji').value = p.emoji;
        gruposSelecionadosTemporarios = p.grupos_ids ? [...p.grupos_ids] : [];
    } else {
        titulo.innerText = "Novo Produto";
        idInput.value = '';
        document.getElementById('prod-nome').value = '';
        document.getElementById('prod-preco').value = '';
        document.getElementById('prod-emoji').value = '🍨';
    }
    renderizarSelecaoGrupos();
    modal.style.display = 'flex';
}

function renderizarSelecaoGrupos() {
    const container = document.getElementById('container-checkbox-grupos');
    container.innerHTML = '<p style="font-size:0.8rem; color:#666; margin-bottom:10px;">Marque os grupos e use as setas para ordenar o passo a passo do cliente:</p>';

    // 1. A MÁGICA: Organiza a fila visual antes de desenhar
    let gruposParaExibir = [];

    // Primeiro, coloca os grupos marcados na exata ordem que você definiu nas setinhas
    gruposSelecionadosTemporarios.forEach(id => {
        const g = listaGrupos.find(x => x.id === id);
        if (g) gruposParaExibir.push(g);
    });

    // Depois, coloca todos os grupos que estão desmarcados lá pro final da lista
    listaGrupos.forEach(g => {
        if (!gruposSelecionadosTemporarios.includes(g.id)) {
            gruposParaExibir.push(g);
        }
    });

    // 2. Agora sim, desenha a tela usando a nova fila organizada
    gruposParaExibir.forEach(g => {
        const isChecked = gruposSelecionadosTemporarios.includes(g.id);
        const index = gruposSelecionadosTemporarios.indexOf(g.id);
        
        container.innerHTML += `
            <div style="display:flex; align-items:center; justify-content:space-between; background:#f9f9f9; padding:8px; border-radius:8px; margin-bottom:5px; border: 1px solid ${isChecked ? '#00bcd4' : '#eee'}">
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px; flex:1;">
                    <input type="checkbox" value="${g.id}" ${isChecked ? 'checked' : ''} onchange="toggleGrupoNoProduto(${g.id})">
                    ${g.nome}
                </label>
                ${isChecked ? `
                    <div style="display:flex; gap:5px;">
                        <button type="button" onclick="moverGrupo(${index}, -1)" style="border:none; background:#eee; border-radius:4px; cursor:pointer; padding:2px 10px; font-weight:bold; font-size:1.1rem;">↑</button>
                        <button type="button" onclick="moverGrupo(${index}, 1)" style="border:none; background:#eee; border-radius:4px; cursor:pointer; padding:2px 10px; font-weight:bold; font-size:1.1rem;">↓</button>
                    </div>
                ` : ''}
            </div>
        `;
    });
}

function toggleGrupoNoProduto(id) {
    const index = gruposSelecionadosTemporarios.indexOf(id);
    if (index > -1) {
        gruposSelecionadosTemporarios.splice(index, 1);
    } else {
        gruposSelecionadosTemporarios.push(id);
    }
    renderizarSelecaoGrupos();
}

function moverGrupo(index, direcao) {
    const novaPos = index + direcao;
    if (novaPos < 0 || novaPos >= gruposSelecionadosTemporarios.length) return;
    const item = gruposSelecionadosTemporarios.splice(index, 1)[0];
    gruposSelecionadosTemporarios.splice(novaPos, 0, item);
    renderizarSelecaoGrupos();
}

function abrirEdicaoProduto(id) {
    abrirModalProduto(id);
}

async function salvarProduto() {
    const id = document.getElementById('prod-id').value;
    const nome = document.getElementById('prod-nome').value;
    const preco = document.getElementById('prod-preco').value;
    const emoji = document.getElementById('prod-emoji').value;
    const grupos_ids = gruposSelecionadosTemporarios;
    
    if (!nome || !preco) return alert("⚠️ Preencha o nome e o preço!");
    const dados = { nome, preco: parseFloat(preco), emoji, grupos_ids, ativo: true };
    
    try {
        if (id) {
            await fetch(`${API_URL}/produtos/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados) });
        } else {
            await fetch(`${API_URL}/produtos`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados) });
        }
        fecharModalProduto();
        await carregarTudo();
    } catch (e) {
        alert("❌ Erro ao salvar produto.");
    }
}

async function excluirProduto(id) {
    if(!confirm("⚠️ Tem certeza que deseja excluir este produto definitivamente?")) return;
    try {
        await fetch(`${API_URL}/produtos/${id}`, { method: 'DELETE' });
        await carregarTudo();
    } catch (e) {
        alert("❌ Erro ao excluir.");
    }
}

function abrirModalGrupo(id = null) {
    const modal = document.getElementById('modal-grupo');
    const titulo = document.getElementById('titulo-modal-grupo');
    const idInput = document.getElementById('grupo-id');
    const nomeInput = document.getElementById('grupo-nome');
    const limiteInput = document.getElementById('grupo-limite');
    
    if (id) {
        const g = listaGrupos.find(x => x.id === id);
        titulo.innerText = "Editar Grupo";
        idInput.value = g.id;
        nomeInput.value = g.nome;
        limiteInput.value = g.limite;
    } else {
        titulo.innerText = "Novo Grupo";
        idInput.value = '';
        nomeInput.value = '';
        limiteInput.value = '';
    }
    modal.style.display = 'flex';
}

function abrirEdicaoGrupo(id) {
    abrirModalGrupo(id);
}

async function salvarGrupo() {
    const id = document.getElementById('grupo-id').value;
    const nome = document.getElementById('grupo-nome').value;
    const limite = document.getElementById('grupo-limite').value;
    
    if (!nome || !limite) return alert("⚠️ Preencha o nome e o limite!");
    
    let itens = [];
    if (id) {
        const gExistente = listaGrupos.find(x => x.id === Number(id));
        if (gExistente && gExistente.itens) itens = gExistente.itens;
    }
    const dados = { nome, limite: parseInt(limite), itens, ativo: true };
    
    try {
        if (id) {
            await fetch(`${API_URL}/grupos/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados) });
        } else {
            await fetch(`${API_URL}/grupos`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados) });
        }
        fecharModalGrupo();
        await carregarTudo();
    } catch (e) {
        alert("❌ Erro ao salvar grupo.");
    }
}
