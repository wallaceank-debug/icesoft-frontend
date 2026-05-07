const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let listaProdutos = [];
let listaGrupos = [];
let grupoSelecionadoId = null;

window.onload = async () => {
    await carregarTudo();
};

async function carregarTudo() {
    try {
        const [resProd, resGrupos, resCat] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/grupos`),
            fetch(`${API_URL}/categorias`) // Puxa do novo servidor!
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
        });

        listaGrupos = await resGrupos.json();
        listaCategorias = await resCat.json(); // Salva na memória
        
        renderizarProdutos();
        renderizarGrupos();
        preencherSelectCategorias(); // Atualiza as opções na hora de criar o produto
        
        // Se um grupo já estava selecionado, recarrega a 3ª coluna
        if (grupoSelecionadoId) selecionarGrupo(grupoSelecionadoId);
    } catch (e) { 
        console.error("Erro", e); 
    }
}

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
        await carregarTudo();
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
        await carregarTudo(); 
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

// ==========================================
// FUNÇÕES DE MODAL E CADASTRO (PRODUTOS E GRUPOS)
// ==========================================

function fecharModalProduto() { document.getElementById('modal-produto').style.display = 'none'; }
function fecharModalGrupo() { document.getElementById('modal-grupo').style.display = 'none'; }

let gruposSelecionadosTemporarios = []; 

// Função para exibir/ocultar a caixa de valor da promoção
function toggleAreaPromocao() {
    const tipoSelecionadoElement = document.querySelector('input[name="tipo_promocao"]:checked');
    if (!tipoSelecionadoElement) return; // Segurança caso a tela carregue vazia

    const tipoSelecionado = tipoSelecionadoElement.value;
    const areaValor = document.getElementById('area-valor-promocao');
    const labelTipo = document.getElementById('label-tipo-promocao');
    const inputValor = document.getElementById('prod-valor-promocao');
    const areaAgendamento = document.getElementById('area-agendamento-promo'); // 🚀 NOVO!
    
    if (tipoSelecionado === 'nenhuma') {
        if(areaValor) areaValor.style.display = 'none';
        if(inputValor) inputValor.value = ''; 
        if(areaAgendamento) areaAgendamento.style.display = 'none'; // 🚀 Esconde o relógio biológico
    } else {
        if(areaValor) areaValor.style.display = 'flex';
        if(labelTipo) labelTipo.innerText = tipoSelecionado === 'porcentagem' ? '%' : 'R$';
        if(inputValor) inputValor.placeholder = tipoSelecionado === 'porcentagem' ? 'Ex: 10 (10% off)' : 'Ex: 5.00 (5 reais off)';
        if(areaAgendamento) areaAgendamento.style.display = 'block'; // 🚀 Mostra o relógio biológico
    }
}

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
        
        if (document.getElementById('produto-tag')) {
            document.getElementById('produto-tag').value = p.tag || '';
        }
        
        const campoImagem = document.getElementById('produto-imagem');
        if(campoImagem) campoImagem.value = p.imagem_url || '';
        
        const campoDescricao = document.getElementById('prod-descricao');
        if(campoDescricao) campoDescricao.value = (p.descricao && p.descricao !== 'null') ? p.descricao : '';
        
        if (document.getElementById('prod-venda-peso')) document.getElementById('prod-venda-peso').checked = p.venda_por_peso === true;
        
        gruposSelecionadosTemporarios = p.grupos_ids ? [...p.grupos_ids] : [];

        // Carrega os dados da promoção
        const tipoPromo = p.tipo_promocao || 'nenhuma';
        const radioTarget = document.querySelector(`input[name="tipo_promocao"][value="${tipoPromo}"]`);
        if(radioTarget) radioTarget.checked = true;
        
        if(document.getElementById('prod-valor-promocao')) document.getElementById('prod-valor-promocao').value = p.valor_promocao || '';
        
        // 🚀 NOVO: CARREGA O RELÓGIO BIOLÓGICO
        if(document.getElementById('produto-promo-inicio')) document.getElementById('produto-promo-inicio').value = p.promo_inicio || '';
        if(document.getElementById('produto-promo-fim')) document.getElementById('produto-promo-fim').value = p.promo_fim || '';
        
        // Desmarca todos primeiro e marca só os do banco
        document.querySelectorAll('.btn-dia').forEach(b => b.classList.remove('ativo'));
        if (p.promo_dias) {
            const diasSalvos = p.promo_dias.split(',');
            diasSalvos.forEach(diaNum => {
                const btn = document.querySelector(`.btn-dia[data-dia="${diaNum}"]`);
                if(btn) btn.classList.add('ativo');
            });
        }

        toggleAreaPromocao(); 

    } else { 
        titulo.innerText = "Novo Produto";
        idInput.value = '';
        document.getElementById('prod-nome').value = '';
        document.getElementById('prod-preco').value = '';
        document.getElementById('prod-emoji').value = '🍨';
        document.getElementById('prod-categoria').value = '';
        
        if (document.getElementById('produto-tag')) {
            document.getElementById('produto-tag').value = '';
        }
        
        const campoImagem = document.getElementById('produto-imagem');
        if(campoImagem) campoImagem.value = '';
        
        const campoDescricao = document.getElementById('prod-descricao');
        if(campoDescricao) campoDescricao.value = '';

        if (document.getElementById('prod-venda-peso')) document.getElementById('prod-venda-peso').checked = false;

        // Zera os dados da promoção
        const radioNenhuma = document.querySelector('input[name="tipo_promocao"][value="nenhuma"]');
        if(radioNenhuma) radioNenhuma.checked = true;
        if(document.getElementById('prod-valor-promocao')) document.getElementById('prod-valor-promocao').value = '';
        
        // 🚀 NOVO: ZERA O RELÓGIO BIOLÓGICO
        if(document.getElementById('produto-promo-inicio')) document.getElementById('produto-promo-inicio').value = '';
        if(document.getElementById('produto-promo-fim')) document.getElementById('produto-promo-fim').value = '';
        document.querySelectorAll('.btn-dia').forEach(b => b.classList.remove('ativo'));

        toggleAreaPromocao(); 
    }

    const inputArquivo = document.getElementById('produto-arquivo-foto');
    if(inputArquivo) inputArquivo.value = '';

    renderizarSelecaoGrupos();
    modal.style.display = 'flex';
}

let grupoArrastadoIndex = null;

function renderizarSelecaoGrupos() {
    const container = document.getElementById('container-checkbox-grupos');
    container.innerHTML = '<p style="font-size:0.8rem; color:#666; margin-bottom:10px;">Marque os grupos e arraste (☰) para montar o roteiro do cliente:</p>';

    const gruposMarcados = gruposSelecionadosTemporarios.map(id => listaGrupos.find(g => g.id === id)).filter(g => g);
    const gruposDesmarcados = listaGrupos.filter(g => !gruposSelecionadosTemporarios.includes(g.id));

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

    if (gruposMarcados.length > 0 && gruposDesmarcados.length > 0) {
        container.innerHTML += '<hr style="border: 0; border-top: 1px dashed #ccc; margin: 10px 0;">';
    }

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
        gruposSelecionadosTemporarios.splice(index, 1);
    } else {
        gruposSelecionadosTemporarios.push(id); 
    }
    renderizarSelecaoGrupos();
}

function dragStartGrupo(index) {
    grupoArrastadoIndex = index;
}

function dragOverGrupo(event) {
    event.preventDefault(); 
}

function dropGrupo(indexDestino) {
    if (grupoArrastadoIndex === null || grupoArrastadoIndex === indexDestino) return;

    const idArrastado = gruposSelecionadosTemporarios.splice(grupoArrastadoIndex, 1)[0];
    gruposSelecionadosTemporarios.splice(indexDestino, 0, idArrastado);

    renderizarSelecaoGrupos();
    grupoArrastadoIndex = null;
}

function abrirEdicaoProduto(id) {
    abrirModalProduto(id); 
}

async function salvarProduto() {
    const id = document.getElementById('prod-id').value;
    const nome = document.getElementById('prod-nome').value;
    const preco = document.getElementById('prod-preco').value;
    const emoji = document.getElementById('prod-emoji').value;
    
    const tag = document.getElementById('produto-tag') ? document.getElementById('produto-tag').value : '';
    const categoria = document.getElementById('prod-categoria').value.trim() || 'Outros';
    
    const campoImagem = document.getElementById('produto-imagem');
    let imagem_url = campoImagem ? campoImagem.value.trim() : '';

    const campoDescricao = document.getElementById('prod-descricao');
    const descricao = campoDescricao ? campoDescricao.value.trim() : '';

    const grupos_ids = gruposSelecionadosTemporarios;

    if (!nome || !preco) return alert("⚠️ Preencha o nome e o preço!");

    const inputArquivo = document.getElementById('produto-arquivo-foto');
    if (inputArquivo && inputArquivo.files.length > 0) {
        const formData = new FormData();
        formData.append('imagem', inputArquivo.files[0]);
        
        try {
            if(typeof mostrarAvisoFlutuante === 'function') mostrarAvisoFlutuante("⏳ Salvando foto no servidor...", "#FF9800");
            
            const resUpload = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
            const dataUpload = await resUpload.json();
            
            if (dataUpload.sucesso) {
                const baseUrl = API_URL.replace('/api', '');
                imagem_url = baseUrl + dataUpload.url; 
            } else {
                return alert("❌ Erro ao salvar a imagem: " + dataUpload.erro);
            }
        } catch (e) {
            return alert("🔌 Erro de conexão na hora de enviar a foto.");
        }
    }

    const venda_por_peso = document.getElementById('prod-venda-peso') ? document.getElementById('prod-venda-peso').checked : false;

    const tipo_promocao_elemento = document.querySelector('input[name="tipo_promocao"]:checked');
    const tipo_promocao = tipo_promocao_elemento ? tipo_promocao_elemento.value : 'nenhuma';
    
    let valor_promocao = document.getElementById('prod-valor-promocao') ? document.getElementById('prod-valor-promocao').value : '';
    
    if (tipo_promocao === 'nenhuma' || !valor_promocao) {
        valor_promocao = 0;
    } else {
        valor_promocao = parseFloat(valor_promocao);
    }

    // 🚀 NOVO: Captura os dados do Relógio Biológico da tela
    const botoesAtivos = document.querySelectorAll('.btn-dia.ativo');
    const promo_dias = Array.from(botoesAtivos).map(btn => btn.getAttribute('data-dia')).join(',');
    const promo_inicio = document.getElementById('produto-promo-inicio') ? document.getElementById('produto-promo-inicio').value : '';
    const promo_fim = document.getElementById('produto-promo-fim') ? document.getElementById('produto-promo-fim').value : '';

    const dados = { 
        nome, 
        descricao, 
        preco: parseFloat(preco), 
        emoji, 
        categoria, 
        grupos_ids, 
        ativo: true, 
        imagem_url, 
        venda_por_peso, 
        tag,
        tipo_promocao, 
        valor_promocao,
        promo_dias,     // 👈 NOVA
        promo_inicio,   // 👈 NOVA
        promo_fim       // 👈 NOVA
    };

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
    const btnExcluir = document.getElementById('btn-excluir-grupo');

    if (id) { 
        const g = listaGrupos.find(x => x.id === id);
        titulo.innerText = "Editar Grupo";
        idInput.value = g.id;
        nomeInput.value = g.nome;
        limiteInput.value = g.limite;
        obrigatorioInput.checked = (g.obrigatorio == 1 || g.obrigatorio == true || g.obrigatorio === 'true');
        
        if(btnExcluir) btnExcluir.style.display = 'block'; 
    } else { 
        titulo.innerText = "Novo Grupo";
        idInput.value = '';
        nomeInput.value = '';
        limiteInput.value = '';
        obrigatorioInput.checked = false;
        
        if(btnExcluir) btnExcluir.style.display = 'none'; 
    }
    modal.style.display = 'flex';
}

async function excluirGrupoModal() {
    const id = document.getElementById('grupo-id').value;
    if (!id) return;
    
    if(!confirm("⚠️ Tem certeza que deseja EXCLUIR este grupo e todos os complementos dentro dele?\nEles sumirão do cardápio digital de todos os produtos vinculados.")) return;

    try {
        const res = await fetch(`${API_URL}/grupos/${id}`, { method: 'DELETE' });
        if (res.ok) {
            fecharModalGrupo();
            
            if (grupoSelecionadoId === Number(id)) {
                grupoSelecionadoId = null;
                document.getElementById('lista-adicionais').innerHTML = '<p class="carregando" style="opacity: 0.6;">Selecione um Grupo na coluna ao lado para ver os adicionais.</p>';
                document.getElementById('btn-novo-adicional').style.display = 'none';
            }
            
            await carregarTudo(); 
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
    const obrigatorio = document.getElementById('grupo-obrigatorio').checked; 

    if (!nome || !limite) return alert("⚠️ Preencha o nome e o limite!");

    let itens = [];
    if (id) {
        const gExistente = listaGrupos.find(x => x.id === Number(id));
        if (gExistente && gExistente.itens) itens = gExistente.itens;
    }

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
        const isVisivel = cat.mostrar_cardapio !== false; 
        
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

function dragStartCategoria(index) {
    categoriaArrastadaIndex = index;
}

function dragOverCategoria(event) {
    event.preventDefault(); 
}

async function dropCategoria(indexDestino) {
    if (categoriaArrastadaIndex === null || categoriaArrastadaIndex === indexDestino) return;

    const itemArrastado = listaCategorias.splice(categoriaArrastadaIndex, 1)[0];
    listaCategorias.splice(indexDestino, 0, itemArrastado);

    renderizarListaCategoriasAdmin();

    const novaOrdemPayload = listaCategorias.map((cat, idx) => {
        return { id: cat.id, ordem: idx + 1 };
    });

    try {
        await fetch(`${API_URL}/categorias/ordem`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaOrdemPayload)
        });
        await carregarTudo(); 
    } catch (e) {
        alert("Erro de conexão ao salvar a nova ordem no servidor.");
    } finally {
        categoriaArrastadaIndex = null;
    }
}

async function salvarNovaCategoria() {
    const nome = document.getElementById('nova-cat-nome').value.trim();
    const mostrarNoApp = document.getElementById('categoria-mostrar-cardapio') ? document.getElementById('categoria-mostrar-cardapio').checked : true;
    const ordem = listaCategorias.length + 1; 

    if (!nome) return alert("Preencha o nome da categoria!");

    try {
        await fetch(`${API_URL}/categorias`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ nome, ordem: ordem, mostrar_cardapio: mostrarNoApp }) 
        });
        
        document.getElementById('nova-cat-nome').value = '';
        if(document.getElementById('categoria-mostrar-cardapio')) document.getElementById('categoria-mostrar-cardapio').checked = true;
        
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

async function abrirGerenciadorBairros() {
    document.getElementById('modal-bairros').style.display = 'flex';
    
    try {
        const resCid = await fetch(`${API_URL}/cidades`);
        if (resCid.ok) {
            const cidades = await resCid.json();
            const select = document.getElementById('novo-bairro-cidade');
            if (select) {
                select.innerHTML = '<option value="" disabled selected>Selecione a Cidade primeiro...</option>';
                cidades.forEach(c => {
                    select.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
                });
            }
        }
    } catch(e) {}

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
        const nomeCidade = b.cidade || 'Quatis'; 
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:8px; border: 1px solid #eee;">
                <div>
                    <strong style="color:#333;">${b.nome} <span style="font-size:0.75rem; color:#999; font-weight:normal;">(${nomeCidade})</span></strong> 
                    <span style="display:block; font-size:0.85rem; color:#00bcd4; font-weight:bold;">Taxa: R$ ${Number(b.taxa).toFixed(2).replace('.', ',')}</span>
                </div>
                <button onclick="excluirBairro(${b.id})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.2rem;">🗑️</button>
            </div>
        `;
    });
}

async function salvarNovoBairro() {
    const cidadeSelect = document.getElementById('novo-bairro-cidade');
    const cidade = cidadeSelect && cidadeSelect.value ? cidadeSelect.value : '';
    const nome = document.getElementById('novo-bairro-nome').value.trim();
    const taxa = document.getElementById('novo-bairro-taxa').value.trim();

    if (!cidade) return alert("⚠️ Selecione a Cidade antes de salvar o Bairro!");
    if (!nome) return alert("⚠️ Preencha o nome do bairro!");

    try {
        await fetch(`${API_URL}/bairros`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ nome, taxa: parseFloat(taxa) || 0, cidade }) 
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
// 🏙️ SISTEMA DE CIDADES 
// ==========================================
let listaCidades = [];

function abrirGerenciadorCidades() {
    document.getElementById('modal-cidades').style.display = 'flex';
    carregarCidadesAdmin();
}

function fecharGerenciadorCidades() {
    document.getElementById('modal-cidades').style.display = 'none';
}

async function carregarCidadesAdmin() {
    try {
        const res = await fetch(`${API_URL}/cidades`);
        if (!res.ok) throw new Error("Rota ausente");
        listaCidades = await res.json();
    } catch (e) { 
        console.log("Banco de dados se adaptando. Retornando vazio.");
        listaCidades = []; 
    }
    renderizarListaCidadesAdmin();
}

function renderizarListaCidadesAdmin() {
    const container = document.getElementById('lista-cidades-gerenciador');
    container.innerHTML = '';

    if (listaCidades.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999;">Nenhuma cidade cadastrada.</p>';
        return;
    }

    listaCidades.forEach(c => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:8px; border: 1px solid #eee;">
                <strong style="color:#333; font-size:1.1rem;">${c.nome}</strong> 
                <button onclick="excluirCidade(${c.id})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.2rem;" title="Excluir">🗑️</button>
            </div>
        `;
    });
}

async function salvarNovaCidade() {
    const nome = document.getElementById('nova-cidade-nome').value.trim();
    if (!nome) return alert("Preencha o nome da cidade!");

    try {
        await fetch(`${API_URL}/cidades`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ nome }) 
        });
        document.getElementById('nova-cidade-nome').value = '';
        await carregarCidadesAdmin(); 
    } catch (e) {
        alert("Erro ao salvar cidade.");
    }
}

async function excluirCidade(id) {
    if(!confirm("⚠️ Tem certeza que deseja excluir esta cidade? Todos os bairros ligados a ela podem ficar sem referência.")) return;
    try {
        await fetch(`${API_URL}/cidades/${id}`, { method: 'DELETE' });
        await carregarCidadesAdmin();
    } catch (e) {
        alert("Erro ao excluir cidade.");
    }
}

// ==========================================
// 💳 CONFIGURAÇÕES DE PAGAMENTO (PIX)
// ==========================================
async function abrirConfigPagamentos() {
    document.getElementById('modal-pagamentos').style.display = 'flex';
    document.getElementById('mp-token-input').value = '';
    document.getElementById('mp-token-input').placeholder = 'Buscando chave no cofre...';

    try {
        const res = await fetch(`${API_URL}/configuracoes`);
        const configs = await res.json();
        
        if (configs.mp_access_token) {
            document.getElementById('mp-token-input').value = configs.mp_access_token;
        } else {
            document.getElementById('mp-token-input').placeholder = 'APP_USR-... (Cole sua chave aqui)';
        }
    } catch (e) {
        console.error("Erro ao carregar token do Mercado Pago", e);
        document.getElementById('mp-token-input').placeholder = 'APP_USR-...';
    }
}

function fecharConfigPagamentos() {
    document.getElementById('modal-pagamentos').style.display = 'none';
}

async function salvarConfigPagamentos() {
    const token = document.getElementById('mp-token-input').value.trim();

    if (!token) return alert("⚠️ O campo do Access Token não pode ficar vazio!");

    const btn = document.getElementById('btn-salvar-pagamentos');
    btn.innerText = '⏳ Salvando no Cofre...';
    btn.disabled = true;

    try {
        await fetch(`${API_URL}/configuracoes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mp_access_token: token })
        });
        
        alert("✅ Chave do Mercado Pago blindada e salva com sucesso! O Motor do Pix já está pronto para operar.");
        fecharConfigPagamentos();
    } catch (e) {
        alert("❌ Erro de conexão ao tentar salvar a chave.");
    } finally {
        btn.innerText = '💾 Salvar Chave';
        btn.disabled = false;
    }
}

// ==========================================
// 🧠 INTELIGÊNCIA DOS BOTÕES DE AGENDAMENTO (NOVO)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Escutador global para os botões da semana, já que eles carregam com a tela
    document.querySelectorAll('.btn-dia').forEach(btn => {
        btn.addEventListener('click', function() {
            this.classList.toggle('ativo');
        });
    });
});