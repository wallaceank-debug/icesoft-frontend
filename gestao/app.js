const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
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
                p.imagem_url = `https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/uploads/${nomeArquivo}`;
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
// ==========================================
// COLUNA 1: PRODUTOS (COM FILTRO EM TEMPO REAL)
// ==========================================
function renderizarProdutos(filtro = '') {
    const div = document.getElementById('lista-produtos');
    div.innerHTML = '';
    
    // Tratamento para a busca ignorar letras maiúsculas e acentos
    const termo = filtro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const produtosFiltrados = listaProdutos.filter(p => {
        const nome = p.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nome.includes(termo);
    });

    if (produtosFiltrados.length === 0) {
        div.innerHTML = '<p class="carregando" style="margin-top: 20px;">Nenhum produto encontrado.</p>';
        return;
    }

    produtosFiltrados.forEach(p => {
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

function filtrarProdutosGestao() {
    const termo = document.getElementById('filtro-produtos-gestao').value;
    renderizarProdutos(termo);
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
        
        // 👇 Carrega a caixinha de venda por peso
        if (document.getElementById('prod-venda-peso')) document.getElementById('prod-venda-peso').checked = p.venda_por_peso === true;
        
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

        // 👇 Zera a caixinha de venda por peso no produto novo
        if (document.getElementById('prod-venda-peso')) document.getElementById('prod-venda-peso').checked = false;
    }

    // 🧹 Limpa o campo de upload do PC toda vez que abrir a janela
    const inputArquivo = document.getElementById('produto-arquivo-foto');
    if(inputArquivo) inputArquivo.value = '';

    renderizarSelecaoGrupos();
    modal.style.display = 'flex';
}

let grupoArrastadoIndex = null;

// Nova função Inteligente (Separa marcados e desmarcados)
function renderizarSelecaoGrupos() {
    const container = document.getElementById('container-checkbox-grupos');
    container.innerHTML = '<p style="font-size:0.8rem; color:#666; margin-bottom:10px;">Marque os grupos e arraste (☰) para montar o roteiro do cliente:</p>';

    // 1. Filtra os grupos já marcados (respeitando a ordem do array)
    const gruposMarcados = gruposSelecionadosTemporarios.map(id => listaGrupos.find(g => g.id === id)).filter(g => g);
    
    // 2. Filtra os grupos que não estão marcados (para ficarem no fim da lista)
    const gruposDesmarcados = listaGrupos.filter(g => !gruposSelecionadosTemporarios.includes(g.id));

    // Desenha os marcados no topo (COM Drag and Drop)
    gruposMarcados.forEach((g, index) => {
        container.innerHTML += `
            <div draggable="true"
                 ondragstart="dragStartGrupo(${index})"
                 ondragover="dragOverGrupo(event)"
                 ondrop="dropGrupo(${index})"
                 style="display:flex; align-items:center; justify-content:space-between; background:#e0f7fa; padding:10px; border-radius:8px; margin-bottom:5px; border: 1px solid #00bcd4; cursor: grab; transition: 0.2s;">
                <label style="cursor:pointer; display:flex; align-items:center; gap:10px; flex:1; margin: 0;">
                    <span style="color: #00bcd4; font-size: 1.2rem; cursor: grab;">☰</span>
                    <input type="checkbox" value="${g.id}" checked onchange="toggleGrupoNoProduto(${g.id})" style="width: 18px; height: 18px; accent-color: #00bcd4;">
                    <strong style="color: #00838f;">${g.nome}</strong>
                </label>
            </div>
        `;
    });

    // Coloca uma linha divisória elegante se houver itens nas duas listas
    if (gruposMarcados.length > 0 && gruposDesmarcados.length > 0) {
        container.innerHTML += '<hr style="border: 0; border-top: 1px dashed #ccc; margin: 10px 0;">';
    }

    // Desenha os desmarcados no fundo (SEM drag and drop)
    gruposDesmarcados.forEach(g => {
        container.innerHTML += `
            <div style="display:flex; align-items:center; justify-content:space-between; background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:5px; border: 1px solid #eee;">
                <label style="cursor:pointer; display:flex; align-items:center; gap:10px; flex:1; margin: 0;">
                    <input type="checkbox" value="${g.id}" onchange="toggleGrupoNoProduto(${g.id})" style="width: 18px; height: 18px; accent-color: #00bcd4;">
                    <span style="color: #555;">${g.nome}</span>
                </label>
            </div>
        `;
    });
}

function toggleGrupoNoProduto(id) {
    const index = gruposSelecionadosTemporarios.indexOf(id);
    if (index > -1) {
        // Se desmarcou, tira da fila
        gruposSelecionadosTemporarios.splice(index, 1);
    } else {
        // Se marcou, joga lá pro final da fila dos selecionados
        gruposSelecionadosTemporarios.push(id); 
    }
    renderizarSelecaoGrupos();
}

// === MÁGICA DO DRAG AND DROP PARA GRUPOS ===
function dragStartGrupo(index) {
    grupoArrastadoIndex = index;
}

function dragOverGrupo(event) {
    event.preventDefault(); // Permite que a área receba a soltura
}

function dropGrupo(indexDestino) {
    if (grupoArrastadoIndex === null || grupoArrastadoIndex === indexDestino) return;

    // 1. Tira o ID do grupo da posição antiga e insere na nova
    const idArrastado = gruposSelecionadosTemporarios.splice(grupoArrastadoIndex, 1)[0];
    gruposSelecionadosTemporarios.splice(indexDestino, 0, idArrastado);

    // 2. Repinta a tela com a nova ordem instantaneamente
    renderizarSelecaoGrupos();
    grupoArrastadoIndex = null;
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
    const obrigatorioInput = document.getElementById('grupo-obrigatorio');
    const btnExcluir = document.getElementById('btn-excluir-grupo'); // 🛠️ O novo botão!

    if (id) { // MODO EDIÇÃO
        const g = listaGrupos.find(x => x.id === id);
        titulo.innerText = "Editar Grupo";
        idInput.value = g.id;
        nomeInput.value = g.nome;
        limiteInput.value = g.limite;
        obrigatorioInput.checked = (g.obrigatorio == 1 || g.obrigatorio == true || g.obrigatorio === 'true');
        
        // Se estamos editando algo que já existe, mostra a lixeira!
        if(btnExcluir) btnExcluir.style.display = 'block'; 
    } else { // MODO NOVO
        titulo.innerText = "Novo Grupo";
        idInput.value = '';
        nomeInput.value = '';
        limiteInput.value = '';
        obrigatorioInput.checked = false;
        
        // Se estamos criando do zero, esconde a lixeira!
        if(btnExcluir) btnExcluir.style.display = 'none'; 
    }
    modal.style.display = 'flex';
}

// Função ninja de exclusão segura
async function excluirGrupoModal() {
    const id = document.getElementById('grupo-id').value;
    if (!id) return;
    
    // Trava de segurança dupla
    if(!confirm("⚠️ Tem certeza que deseja EXCLUIR este grupo e todos os complementos dentro dele?\nEles sumirão do cardápio digital de todos os produtos vinculados.")) return;

    try {
        const res = await fetch(`${API_URL}/grupos/${id}`, { method: 'DELETE' });
        if (res.ok) {
            fecharModalGrupo();
            
            // Se o grupo excluído era exatamente o que estava aberto na 3ª coluna, a gente limpa a tela!
            if (grupoSelecionadoId === Number(id)) {
                grupoSelecionadoId = null;
                document.getElementById('lista-adicionais').innerHTML = '<p class="carregando" style="opacity: 0.6;">Selecione um Grupo na coluna ao lado para ver os adicionais.</p>';
                document.getElementById('btn-novo-adicional').style.display = 'none';
            }
            
            await carregarTudo(); // Sincroniza tudo com o banco de dados
        } else {
            alert("❌ Erro ao excluir o grupo no servidor.");
        }
    } catch (e) {
        alert("🔌 Erro de conexão ao tentar excluir o grupo.");
    }
}

function abrirEdicaoGrupo(id) {
    abrirModalGrupo(id);
}

async function salvarGrupo() {
    const id = document.getElementById('grupo-id').value;
    const nome = document.getElementById('grupo-nome').value;
    const limite = document.getElementById('grupo-limite').value;
    const obrigatorio = document.getElementById('grupo-obrigatorio').checked; // Lemos se está marcado

    if (!nome || !limite) return alert("⚠️ Preencha o nome e o limite!");

    let itens = [];
    if (id) {
        const gExistente = listaGrupos.find(x => x.id === Number(id));
        if (gExistente && gExistente.itens) itens = gExistente.itens;
    }

    // Agora incluímos o campo "obrigatorio" nos dados que vão para o servidor
    const dados = { 
        nome, 
        limite: parseInt(limite), 
        itens, 
        ativo: true, 
        obrigatorio: obrigatorio 
    };

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
let categoriaArrastadaIndex = null;

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

    listaCategorias.forEach((cat, index) => {
        // Se a regra não existir, assumimos que aparece no app (true)
        const isVisivel = cat.mostrar_cardapio !== false; 
        
        // As etiquetas visuais para você saber de bater o olho
        const seloHtml = isVisivel 
            ? `<span style="background: #e0f7fa; color: #00bcd4; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold;">📱 App + PDV</span>`
            : `<span style="background: #ffebee; color: #f44336; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold;">🖥️ Só PDV</span>`;

        container.innerHTML += `
            <div draggable="true"
                 ondragstart="dragStartCategoria(${index})"
                 ondragover="dragOverCategoria(event)"
                 ondrop="dropCategoria(${index})"
                 style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px 15px; border-radius:8px; margin-bottom:8px; cursor:grab; border: 1px solid #eee; transition: 0.2s;">
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="color: #ccc; cursor: grab; font-size: 1.2rem;">☰</span>
                    <div style="display: flex; flex-direction: column; text-align: left;">
                        <strong style="color: #333;">${cat.nome}</strong> 
                        <div style="margin-top: 4px;">${seloHtml}</div>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <label class="switch" title="Mostrar no App?">
                        <input type="checkbox" onchange="toggleCategoriaApp(${cat.id}, this.checked)" ${isVisivel ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button onclick="excluirCategoria(${cat.id})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.2rem;" title="Excluir">🗑️</button>
                </div>
            </div>
        `;
    });
}

// 🎚️ NOVA FUNÇÃO: Liga/Desliga a categoria do aplicativo instantaneamente
async function toggleCategoriaApp(id, statusVisivel) {
    try {
        await fetch(`${API_URL}/categorias/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mostrar_cardapio: statusVisivel })
        });
        await carregarTudo();
        renderizarListaCategoriasAdmin();
    } catch(e) { alert("Erro ao mudar visibilidade da categoria."); }
}

// === LÓGICA DE ARRASTAR E SOLTAR ===
function dragStartCategoria(index) {
    categoriaArrastadaIndex = index;
}

function dragOverCategoria(event) {
    event.preventDefault(); // Necessário para permitir que o item caia aqui
}

async function dropCategoria(indexDestino) {
    if (categoriaArrastadaIndex === null || categoriaArrastadaIndex === indexDestino) return;

    // 1. Tira o item da posição antiga e joga na posição nova na memória
    const itemArrastado = listaCategorias.splice(categoriaArrastadaIndex, 1)[0];
    listaCategorias.splice(indexDestino, 0, itemArrastado);

    // 2. Atualiza a tela imediatamente para o operador ver que funcionou
    renderizarListaCategoriasAdmin();

    // 3. Monta o pacote dizendo "Categoria X agora é a número 1, Categoria Y é a número 2..."
    const novaOrdemPayload = listaCategorias.map((cat, idx) => {
        return { id: cat.id, ordem: idx + 1 };
    });

    try {
        await fetch(`${API_URL}/categorias/ordem`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaOrdemPayload)
        });
        await carregarTudo(); // Sincroniza com o banco de dados
    } catch (e) {
        alert("Erro de conexão ao salvar a nova ordem no servidor.");
    } finally {
        categoriaArrastadaIndex = null;
    }
}

// === CRIAÇÃO DE NOVA CATEGORIA (Automática) ===
async function salvarNovaCategoria() {
    const nome = document.getElementById('nova-cat-nome').value.trim();
    // Puxa a informação do checkbox (se não achar o checkbox, o padrão é true)
    const mostrarNoApp = document.getElementById('nova-cat-mostrar-app') ? document.getElementById('nova-cat-mostrar-app').checked : true;
    const ordem = listaCategorias.length + 1; 

    if (!nome) return alert("Preencha o nome da categoria!");

    try {
        await fetch(`${API_URL}/categorias`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ nome, ordem: ordem, mostrar_cardapio: mostrarNoApp }) 
        });
        
        document.getElementById('nova-cat-nome').value = '';
        if(document.getElementById('nova-cat-mostrar-app')) document.getElementById('nova-cat-mostrar-app').checked = true;
        
        await carregarTudo();
        renderizarListaCategoriasAdmin(); 
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

// ==========================================
// 📡 RADAR GLOBAL DE DELIVERY (Invisível)
// ==========================================
let qtdPendentesGlobalAnterior = -1;
// Link direto para a campainha, garantindo que o áudio funcione em qualquer pasta
const audioAlertaGlobal = new Audio('https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3');

async function checarNovosPedidosGlobal() {
    try {
        // Faz uma busca super rápida e leve na API
        const API_URL_RADAR = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
        const res = await fetch(`${API_URL_RADAR}/vendas`);
        const vendas = await res.json();
        
        // Conta quantos pedidos estão exatamente com o status de recém-chegados
        const pendentesAgora = vendas.filter(v => v.status && v.status.trim() === 'Pendente Delivery').length;

        // Se o número de pendentes for MAIOR que o da checagem anterior, chegou pedido novo!
        if (qtdPendentesGlobalAnterior !== -1 && pendentesAgora > qtdPendentesGlobalAnterior) {
            
            // 1. Toca a campainha
            audioAlertaGlobal.volume = 1.0;
            audioAlertaGlobal.play().catch(e => console.log("O navegador bloqueou o áudio. Clique em qualquer lugar da tela."));
            
            // 2. Mostra a bolha visual piscante
            mostrarAlertaVisualDelivery();
        }
        
        // Atualiza a memória para a próxima checagem
        qtdPendentesGlobalAnterior = pendentesAgora;
    } catch (e) {
        // Falha silenciosa para não poluir ou travar sua tela de PDV
    }
}

function mostrarAlertaVisualDelivery() {
    let bolha = document.getElementById('alerta-bolha-delivery');
    if (!bolha) {
        // Cria a animação de piscar (Efeito Sirene)
        const style = document.createElement('style');
        style.innerHTML = `@keyframes piscarAlerta { 0% { background: #e91e63; transform: scale(1); } 100% { background: #ff4081; transform: scale(1.05); } }`;
        document.head.appendChild(style);

        // Cria o botão flutuante na tela
        bolha = document.createElement('div');
        bolha.id = 'alerta-bolha-delivery';
        bolha.innerHTML = `🚨 <strong>NOVO DELIVERY!</strong><br><span style="font-size:0.85rem">Clique aqui para abrir o Kanban</span>`;
        bolha.style.cssText = "position:fixed; bottom:30px; right:30px; background:#e91e63; color:white; padding:15px 20px; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.4); z-index:99999; cursor:pointer; font-family:sans-serif; text-align:center; animation: piscarAlerta 0.6s infinite alternate;";
        
        // Quando você clica na bolha, ele te joga direto para a tela do Kanban!
        bolha.onclick = () => window.location.href = '../kanban/';
        
        document.body.appendChild(bolha);
    }
}

// Inicializa o radar 3 segundos após você abrir o PDV/Mesas
setTimeout(checarNovosPedidosGlobal, 3000);
// Fica vasculhando a API em busca de pedidos a cada 15 segundos
setInterval(checarNovosPedidosGlobal, 15000);
