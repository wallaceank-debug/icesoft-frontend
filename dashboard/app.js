const API_URL = 'https://icesoft-api.onrender.com/api';
let listaGruposGlobais = [];
let itensGrupoEmEdicao = [];

// =====================================
// INICIALIZAÇÃO
// =====================================
window.onload = () => {
    carregarVendas();
    carregarGrupos();
    carregarProdutos();
};

// =====================================
// VENDAS
// =====================================
async function carregarVendas() {
    const inicio = document.getElementById('filtro-inicio').value;
    const fim = document.getElementById('filtro-fim').value;
    let url = `${API_URL}/vendas`;
    if (inicio && fim) url += `?inicio=${inicio}&fim=${fim}`;

    try {
        const res = await fetch(url);
        const vendas = await res.json();
        let total = 0;
        let contagem = {};
        
        vendas.forEach(v => {
            total += parseFloat(v.total);
            contagem[v.produto_nome] = (contagem[v.produto_nome] || 0) + 1;
        });

        document.getElementById('dash-total-vendas').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
        const ordenado = Object.entries(contagem).sort((a,b) => b[1] - a[1]);
        document.getElementById('dash-produto-topo').innerText = ordenado.length > 0 ? ordenado[0][0] : "---";
    } catch (e) { console.error(e); }
}

// =====================================
// GESTÃO DE GRUPOS (MODIFICADORES)
// =====================================
async function carregarGrupos() {
    try {
        const res = await fetch(`${API_URL}/grupos`);
        listaGruposGlobais = await res.json();
        const tabela = document.getElementById('tabela-grupos');
        tabela.innerHTML = '';

        listaGruposGlobais.forEach(g => {
            const itens = g.itens || [];
            tabela.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;"><strong>${g.nome}</strong><br><small style="color:#777;">Até ${g.limite} opções (${itens.length} itens)</small></td>
                    <td style="text-align: right;">
                        <button onclick='prepararEdicaoGrupo(${JSON.stringify(g)})' style="background:#2196F3; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️</button>
                        <button onclick='excluirGrupo(${g.id})' style="background:#f44336; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
                    </td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

function abrirModalGrupo() {
    document.getElementById('modal-grupo-titulo').innerText = "Novo Grupo";
    document.getElementById('grupo-id').value = "";
    document.getElementById('grupo-nome').value = "";
    document.getElementById('grupo-limite').value = "";
    itensGrupoEmEdicao = [];
    renderizarItensGrupo();
    document.getElementById('modal-grupo').style.display = 'flex';
}

function prepararEdicaoGrupo(grupo) {
    document.getElementById('modal-grupo-titulo').innerText = "Editar Grupo";
    document.getElementById('grupo-id').value = grupo.id;
    document.getElementById('grupo-nome').value = grupo.nome;
    document.getElementById('grupo-limite').value = grupo.limite;
    itensGrupoEmEdicao = grupo.itens || [];
    renderizarItensGrupo();
    document.getElementById('modal-grupo').style.display = 'flex';
}

function fecharModalGrupo() { document.getElementById('modal-grupo').style.display = 'none'; }

function adicionarItemGrupo() {
    const nome = prompt("Nome do Item (ex: Morango):");
    if (!nome) return;
    const preco = prompt("Preço Adicional (Digite 0 se for grátis):");
    itensGrupoEmEdicao.push({ nome: nome, preco: parseFloat(preco) || 0 });
    renderizarItensGrupo();
}

function removerItemGrupo(index) {
    itensGrupoEmEdicao.splice(index, 1);
    renderizarItensGrupo();
}

function renderizarItensGrupo() {
    const div = document.getElementById('lista-itens-grupo');
    div.innerHTML = itensGrupoEmEdicao.length === 0 ? '<p style="color:#999; font-size:0.8rem;">Sem itens.</p>' : '';
    itensGrupoEmEdicao.forEach((item, i) => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.85rem;">
                <span>• ${item.nome} (R$ ${item.preco.toFixed(2)})</span>
                <button onclick="removerItemGrupo(${i})" style="color:red; background:none; border:none; cursor:pointer;">✖</button>
            </div>
        `;
    });
}

async function salvarGrupo() {
    const id = document.getElementById('grupo-id').value;
    const dados = {
        nome: document.getElementById('grupo-nome').value,
        limite: parseInt(document.getElementById('grupo-limite').value) || 1,
        itens: itensGrupoEmEdicao
    };

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/grupos/${id}` : `${API_URL}/grupos`;

    await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    fecharModalGrupo();
    carregarGrupos();
}

async function excluirGrupo(id) {
    if(confirm("Excluir este grupo? Isso afetará os produtos vinculados.")) {
        await fetch(`${API_URL}/grupos/${id}`, { method: 'DELETE' });
        carregarGrupos();
    }
}

// =====================================
// GESTÃO DE PRODUTOS
// =====================================
async function carregarProdutos() {
    try {
        const res = await fetch(`${API_URL}/produtos`);
        const produtos = await res.json();
        const tabela = document.getElementById('tabela-produtos-gestao');
        tabela.innerHTML = '';

        produtos.forEach(p => {
            const qtdGrupos = (p.grupos_ids || []).length;
            const badge = qtdGrupos > 0 ? `<br><small style="color:#4CAF50;">${qtdGrupos} Grupo(s) vinculado(s)</small>` : '';

            tabela.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; font-size: 1.5rem;">${p.emoji}</td>
                    <td><strong>${p.nome}</strong>${badge}</td>
                    <td>R$ ${p.preco.toFixed(2)}</td>
                    <td style="text-align: right;">
                        <button onclick='prepararEdicaoProduto(${JSON.stringify(p)})' style="background:#25D366; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️</button>
                        <button onclick='excluirProduto(${p.id})' style="background:#f44336; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
                    </td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

function renderizarCheckboxesGrupos(gruposVinculados = []) {
    const container = document.getElementById('container-checkbox-grupos');
    container.innerHTML = listaGruposGlobais.length === 0 ? '<span style="color:#999; font-size:0.8rem;">Crie grupos primeiro.</span>' : '';
    
    listaGruposGlobais.forEach(g => {
        const checked = gruposVinculados.includes(g.id) ? 'checked' : '';
        container.innerHTML += `
            <label style="font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" class="chk-grupo" value="${g.id}" ${checked}>
                ${g.nome} <span style="color:#777; font-size:0.75rem;">(Até ${g.limite})</span>
            </label>
        `;
    });
}

function abrirModalProduto() {
    document.getElementById('modal-produto-titulo').innerText = "Novo Produto";
    document.getElementById('prod-id').value = "";
    document.getElementById('prod-nome').value = "";
    document.getElementById('prod-desc').value = "";
    document.getElementById('prod-preco').value = "";
    document.getElementById('prod-emoji').value = "";
    renderizarCheckboxesGrupos([]);
    document.getElementById('modal-produto').style.display = 'flex';
}

function prepararEdicaoProduto(produto) {
    document.getElementById('modal-produto-titulo').innerText = "Editar Produto";
    document.getElementById('prod-id').value = produto.id;
    document.getElementById('prod-nome').value = produto.nome;
    document.getElementById('prod-desc').value = produto.descricao;
    document.getElementById('prod-preco').value = produto.preco;
    document.getElementById('prod-emoji').value = produto.emoji;
    renderizarCheckboxesGrupos(produto.grupos_ids || []);
    document.getElementById('modal-produto').style.display = 'flex';
}

function fecharModalProduto() { document.getElementById('modal-produto').style.display = 'none'; }

async function salvarProduto() {
    const id = document.getElementById('prod-id').value;
    
    // Coleta todos os checkboxes que o usuário marcou
    const checkboxes = document.querySelectorAll('.chk-grupo:checked');
    const gruposSelecionados = Array.from(checkboxes).map(cb => parseInt(cb.value));

    const dados = {
        nome: document.getElementById('prod-nome').value,
        descricao: document.getElementById('prod-desc').value,
        preco: parseFloat(document.getElementById('prod-preco').value),
        emoji: document.getElementById('prod-emoji').value,
        grupos_ids: gruposSelecionados // Envia a lista de IDs!
    };

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/produtos/${id}` : `${API_URL}/produtos`;

    await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    fecharModalProduto();
    carregarProdutos();
}

async function excluirProduto(id) {
    if(confirm("Excluir produto?")) {
        await fetch(`${API_URL}/produtos/${id}`, { method: 'DELETE' });
        carregarProdutos();
    }
}