const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host';
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
        
        let produtosBrutos = await resProd.json();
        
        // 📸 O NOVO FILTRO BLINDADO (Feito sob medida para o Painel de Gestão)
        listaProdutos = produtosBrutos.map(p => {
            // Verifica se o produto tem foto e NÃO é uma foto antiga do ImgBB
            if (p.imagem_url && !p.imagem_url.includes('ibb.co')) {
                // Pega APENAS o nome do arquivo no final e ignora a sujeira do banco
                const nomeArquivo = p.imagem_url.split('/').pop(); 
                
                // Constrói a URL absoluta, perfeita e limpa direto pro seu servidor
                p.imagem_url = `https://api.108.174.146.77.nip.io/uploads/${nomeArquivo}`;
            }
            return p;
        }); // 🛑 Note que paramos por aqui! Sem o .filter!

        listaGrupos = await resGrupos.json();
        
        renderizarProdutos();
        renderizarGrupos();
        
        // Se um grupo já estava selecionado, recarrega a 3ª coluna
        if (grupoSelecionadoId) selecionarGrupo(grupoSelecionadoId);
    } catch (e) { 
        console.error("Erro", e); 
    }
}
// ==========================================
// COLUNA 1: PRODUTOS
// ==========================================
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
                    <button class="btn-icone" title="Duplicar Produto" onclick="duplicarProduto(${p.id})">📄</button>
                    <button class="btn-icone" title="Excluir Produto" onclick="excluirProduto(${p.id})">🗑️</button>
                </div>
            </div>
        `;
    });
}

async function duplicarProduto(id) {
    const p = listaProdutos.find(x => x.id === id);
    if (!p) return;

    // Cria um pacote idêntico, mas com " (Cópia)" no nome
    const dadosDuplicados = {
        nome: p.nome + " (Cópia)",
        preco: parseFloat(p.preco),
        emoji: p.emoji,
        categoria: p.categoria || "Outros",
        grupos_ids: p.grupos_ids || [],
        ativo: true
    };

    try {
        await fetch(`${API_URL}/produtos`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(dadosDuplicados) 
        });
        await carregarTudo(); // Recarrega a tela para a cópia aparecer
    } catch (e) {
        alert("❌ Erro ao duplicar produto.");
    }
}

async function toggleProduto(id, statusAtivo) {
    try {
        await fetch(`${API_URL}/produtos/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: statusAtivo })
        });
        await carregarTudo(); // Recarrega para atualizar a interface (linha riscada)
    } catch(e) { alert("Erro ao mudar status"); }
}

// ==========================================
// COLUNA 2: GRUPOS DE ADICIONAIS
// ==========================================
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
                    <button class="btn-icone" title="Editar Grupo" onclick="abrirEdicaoGrupo(${g.id})">✏️</button>
                    <button class="btn-icone" title="Duplicar Grupo" onclick="duplicarGrupo(${g.id})">📄</button>
                    <label class="switch">
                        <input type="checkbox" onchange="toggleGrupo(${g.id}, this.checked)" ${isAtivo ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;
    });
}

async function duplicarGrupo(id) {
    const g = listaGrupos.find(x => x.id === id);
    if (!g) return;

    // Cria a cópia exata, preservando todos os itens/adicionais já criados dentro dele!
    const dadosDuplicados = {
        nome: g.nome + " (Cópia)",
        limite: parseInt(g.limite),
        itens: g.itens || [],
        ativo: true
    };

    try {
        await fetch(`${API_URL}/grupos`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(dadosDuplicados) 
        });
        await carregarTudo();
    } catch (e) {
        alert("❌ Erro ao duplicar grupo.");
    }
}

function selecionarGrupo(id) {
    grupoSelecionadoId = id;
    renderizarGrupos(); // Repinta para marcar de ciano o selecionado
    renderizarAdicionais(); // Mostra a coluna 3
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

// ==========================================
// COLUNA 3: ADICIONAIS (DENTRO DO GRUPO)
// ==========================================
function renderizarAdicionais() {
    const div = document.getElementById('lista-adicionais');
    const grupo = listaGrupos.find(g => g.id === grupoSelecionadoId);
    
    if (!grupo || !grupo.itens || grupo.itens.length === 0) {
        div.innerHTML = '<p class="carregando">Nenhum adicional neste grupo.</p>';
        return;
    }

    div.innerHTML = '';
    grupo.itens.forEach((item, index) => {
        // Para itens em JSON, se não existir 'ativo', é true.
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
    
    // Atualiza o grupo inteiro na API
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

// ==========================================
// FUNÇÕES DE MODAL E CADASTRO (PRODUTOS E GRUPOS)
// ==========================================

function fecharModalProduto() { document.getElementById('modal-produto').style.display = 'none'; }
function fecharModalGrupo() { document.getElementById('modal-grupo').style.display = 'none'; }

// --- MOTOR DE PRODUTOS ---

let gruposSelecionadosTemporarios = []; // Array para controlar a ordem no modal

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
        document.getElementById('prod-categoria').value = p.categoria || '';
        
        const campoImagem = document.getElementById('produto-imagem');
        if(campoImagem) campoImagem.value = p.imagem_url || '';
        
        const campoDescricao = document.getElementById('prod-descricao');
        if(campoDescricao) campoDescricao.value = (p.descricao && p.descricao !== 'null') ? p.descricao : '';
        
        gruposSelecionadosTemporarios = p.grupos_ids ? [...p.grupos_ids] : [];
    } else { 
        titulo.innerText = "Novo Produto";
        idInput.value = '';
        document.getElementById('prod-nome').value = '';
        document.getElementById('prod-preco').value = '';
        document.getElementById('prod-emoji').value = '🍨';
        document.getElementById('prod-categoria').value = '';
        
        const campoImagem = document.getElementById('produto-imagem');
        if(campoImagem) campoImagem.value = '';
        
        const campoDescricao = document.getElementById('prod-descricao');
        if(campoDescricao) campoDescricao.value = '';
    }

    // 🧹 Limpa o campo de upload do PC toda vez que abrir a janela
    const inputArquivo = document.getElementById('produto-arquivo-foto');
    if(inputArquivo) inputArquivo.value = '';

    renderizarSelecaoGrupos();
    modal.style.display = 'flex';
}

// Nova função para desenhar a lista de grupos com botões de ordem
function renderizarSelecaoGrupos() {
    const container = document.getElementById('container-checkbox-grupos');
    container.innerHTML = '<p style="font-size:0.8rem; color:#666; margin-bottom:10px;">Marque os grupos e use as setas para ordenar o passo a passo:</p>';

    listaGrupos.forEach(g => {
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
                        <button onclick="moverGrupo(${index}, -1)" style="border:none; background:#eee; border-radius:4px; cursor:pointer; padding:2px 5px;">↑</button>
                        <button onclick="moverGrupo(${index}, 1)" style="border:none; background:#eee; border-radius:4px; cursor:pointer; padding:2px 5px;">↓</button>
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
        gruposSelecionadosTemporarios.push(id); // Adiciona ao final da fila
    }
    renderizarSelecaoGrupos();
}

function moverGrupo(index, direcao) {
    const novaPos = index + direcao;
    if (novaPos < 0 || novaPos >= gruposSelecionadosTemporarios.length) return;
    
    // Troca de posição no array
    const item = gruposSelecionadosTemporarios.splice(index, 1)[0];
    gruposSelecionadosTemporarios.splice(novaPos, 0, item);
    renderizarSelecaoGrupos();
}

// Na sua função salvarProduto(), mude a linha que pega os IDs:
// Substitua a lógica de querySelectorAll por:
// const grupos_ids = gruposSelecionadosTemporarios;

function abrirEdicaoProduto(id) {
    abrirModalProduto(id); // Usa a mesma janela, mas passando o ID para editar
}

async function salvarProduto() {
    const id = document.getElementById('prod-id').value;
    const nome = document.getElementById('prod-nome').value;
    const preco = document.getElementById('prod-preco').value;
    const emoji = document.getElementById('prod-emoji').value;
    const categoria = document.getElementById('prod-categoria').value.trim() || 'Outros';
    
    const campoImagem = document.getElementById('produto-imagem');
    let imagem_url = campoImagem ? campoImagem.value.trim() : '';

    const campoDescricao = document.getElementById('prod-descricao');
    const descricao = campoDescricao ? campoDescricao.value.trim() : '';

    const grupos_ids = gruposSelecionadosTemporarios;

    if (!nome || !preco) return alert("⚠️ Preencha o nome e o preço!");

    // 🚀 O NOVO MOTOR DE UPLOAD DIRETO PARA O SERVIDOR
    const inputArquivo = document.getElementById('produto-arquivo-foto');
    if (inputArquivo && inputArquivo.files.length > 0) {
        const formData = new FormData();
        formData.append('imagem', inputArquivo.files[0]);
        
        try {
            if(typeof mostrarAvisoFlutuante === 'function') mostrarAvisoFlutuante("⏳ Salvando foto no servidor...", "#FF9800");
            
            const resUpload = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
            const dataUpload = await resUpload.json();
            
            if (dataUpload.sucesso) {
                // Pega o seu IP (ex: http://108...:3000) e junta com a foto
                const baseUrl = API_URL.replace('/api', '');
                imagem_url = baseUrl + dataUpload.url; 
            } else {
                return alert("❌ Erro ao salvar a imagem: " + dataUpload.erro);
            }
        } catch (e) {
            return alert("🔌 Erro de conexão na hora de enviar a foto.");
        }
    }

    const dados = { nome, descricao, preco: parseFloat(preco), emoji, categoria, grupos_ids, ativo: true, imagem_url };

    try {
        if (id) {
            await fetch(`${API_URL}/produtos/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados) });
        } else {
            await fetch(`${API_URL}/produtos`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados) });
        }
        fecharModalProduto();
        await carregarTudo(); 
        if(typeof mostrarAvisoFlutuante === 'function') mostrarAvisoFlutuante("✅ Produto salvo com sucesso!", "#4CAF50");
    } catch (e) {
        alert("❌ Erro ao salvar produto no banco de dados.");
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

// --- MOTOR DE GRUPOS ---

function abrirModalGrupo(id = null) {
    const modal = document.getElementById('modal-grupo');
    const titulo = document.getElementById('titulo-modal-grupo');
    const idInput = document.getElementById('grupo-id');
    const nomeInput = document.getElementById('grupo-nome');
    const limiteInput = document.getElementById('grupo-limite');

    if (id) { // MODO EDIÇÃO
        const g = listaGrupos.find(x => x.id === id);
        titulo.innerText = "Editar Grupo";
        idInput.value = g.id;
        nomeInput.value = g.nome;
        limiteInput.value = g.limite;
    } else { // MODO NOVO
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

    // Se for edição, precisamos preservar os itens (adicionais) que já estavam lá dentro
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

// ==========================================
// SISTEMA DE CATEGORIAS (CRUD)
// ==========================================
let listaCategorias = [];

// Substitui a função carregarTudo antiga para puxar as categorias também
async function carregarTudo() {
    try {
        const [resProd, resGrupos, resCat] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/grupos`),
            fetch(`${API_URL}/categorias`) // Puxa do novo servidor!
        ]);
        listaProdutos = await resProd.json();
        listaGrupos = await resGrupos.json();
        listaCategorias = await resCat.json(); // Salva na memória

        renderizarProdutos();
        renderizarGrupos();
        preencherSelectCategorias(); // Atualiza as opções na hora de criar o produto

        if (grupoSelecionadoId) selecionarGrupo(grupoSelecionadoId);
    } catch (e) { console.error("Erro", e); }
}

function preencherSelectCategorias() {
    const select = document.getElementById('prod-categoria');
    if (!select) return;
    
    select.innerHTML = '<option value="Outros">Outros</option>';
    listaCategorias.forEach(cat => {
        select.innerHTML += `<option value="${cat.nome}">${cat.nome}</option>`;
    });
}

function abrirGerenciadorCategorias() {
    document.getElementById('modal-categorias').style.display = 'flex';
    renderizarListaCategoriasAdmin();
}

function fecharGerenciadorCategorias() {
    document.getElementById('modal-categorias').style.display = 'none';
}

function renderizarListaCategoriasAdmin() {
    const container = document.getElementById('lista-categorias-gerenciador');
    container.innerHTML = '';

    if (listaCategorias.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999;">Nenhuma categoria criada.</p>';
        return;
    }

    listaCategorias.forEach(cat => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:8px;">
                <div>
                    <strong>${cat.nome}</strong> 
                    <span style="font-size:0.8rem; color:#888; margin-left:10px;">Ordem: ${cat.ordem}</span>
                </div>
                <button onclick="excluirCategoria(${cat.id})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.2rem;">🗑️</button>
            </div>
        `;
    });
}

async function salvarNovaCategoria() {
    const nome = document.getElementById('nova-cat-nome').value;
    const ordem = document.getElementById('nova-cat-ordem').value;

    if (!nome) return alert("Preencha o nome da categoria!");

    try {
        await fetch(`${API_URL}/categorias`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ nome, ordem: parseInt(ordem) || 0 }) 
        });
        
        document.getElementById('nova-cat-nome').value = '';
        document.getElementById('nova-cat-ordem').value = '';
        await carregarTudo();
        renderizarListaCategoriasAdmin(); // Atualiza a janelinha
    } catch (e) {
        alert("Erro ao salvar categoria.");
    }
}

async function excluirCategoria(id) {
    if(!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    try {
        await fetch(`${API_URL}/categorias/${id}`, { method: 'DELETE' });
        await carregarTudo();
        renderizarListaCategoriasAdmin();
    } catch (e) {
        alert("Erro ao excluir categoria.");
    }
}

// ==========================================
// 🗺️ SISTEMA DE BAIRROS E TAXAS DE ENTREGA
// ==========================================
let listaBairros = [];

function abrirGerenciadorBairros() {
    document.getElementById('modal-bairros').style.display = 'flex';
    carregarBairrosAdmin();
}

function fecharGerenciadorBairros() {
    document.getElementById('modal-bairros').style.display = 'none';
}

async function carregarBairrosAdmin() {
    try {
        const res = await fetch(`${API_URL}/bairros`);
        listaBairros = await res.json();
        renderizarListaBairrosAdmin();
    } catch (e) { console.error("Erro ao carregar bairros"); }
}

function renderizarListaBairrosAdmin() {
    const container = document.getElementById('lista-bairros-gerenciador');
    container.innerHTML = '';

    if (listaBairros.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999;">Nenhum bairro cadastrado.</p>';
        return;
    }

    listaBairros.forEach(b => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:8px; border: 1px solid #eee;">
                <div>
                    <strong style="color:#333;">${b.nome}</strong> 
                    <span style="display:block; font-size:0.85rem; color:#00bcd4; font-weight:bold;">Taxa: R$ ${Number(b.taxa).toFixed(2).replace('.', ',')}</span>
                </div>
                <button onclick="excluirBairro(${b.id})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.2rem;">🗑️</button>
            </div>
        `;
    });
}

async function salvarNovoBairro() {
    const nome = document.getElementById('novo-bairro-nome').value.trim();
    const taxa = document.getElementById('novo-bairro-taxa').value.trim();

    if (!nome) return alert("Preencha o nome do bairro!");

    try {
        await fetch(`${API_URL}/bairros`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ nome, taxa: parseFloat(taxa) || 0 }) 
        });
        
        document.getElementById('novo-bairro-nome').value = '';
        document.getElementById('novo-bairro-taxa').value = '';
        await carregarBairrosAdmin(); 
    } catch (e) {
        alert("Erro ao salvar bairro.");
    }
}

async function excluirBairro(id) {
    if(!confirm("Tem certeza que deseja excluir este bairro?")) return;
    try {
        await fetch(`${API_URL}/bairros/${id}`, { method: 'DELETE' });
        await carregarBairrosAdmin();
    } catch (e) {
        alert("Erro ao excluir bairro.");
    }
}
