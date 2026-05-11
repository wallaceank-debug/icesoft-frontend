const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let listaProdutos = [];
let listaGrupos = [];
let grupoSelecionadoId = null;
let produtoEditandoId = null; // Memória para saber se está editando ou criando

window.onload = async () => {
    await carregarTudo();
};

async function carregarTudo() {
    try {
        const [resProd, resGrupos, resCat] = await Promise.all([
            fetch(`${API_URL}/produtos`),
            fetch(`${API_URL}/grupos`),
            fetch(`${API_URL}/categorias`) 
        ]);
        
        let produtosBrutos = await resProd.json();
        
        // 📸 O NOVO FILTRO BLINDADO 
        listaProdutos = produtosBrutos.map(p => {
            if (p.imagem_url && !p.imagem_url.includes('ibb.co')) {
                const nomeArquivo = p.imagem_url.split('/').pop(); 
                p.imagem_url = `https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/uploads/${nomeArquivo}`;
            }
            return p;
        });

        listaGrupos = await resGrupos.json();
        listaCategorias = await resCat.json(); 
        
        renderizarProdutos();
        renderizarGrupos();
        preencherSelectCategorias(); 
        
        if (grupoSelecionadoId) selecionarGrupo(grupoSelecionadoId);
    } catch (e) { 
        console.error("Erro", e); 
    }
}

// ==========================================
// COLUNA 1: PRODUTOS (COM FILTRO E AGRUPADOS)
// ==========================================
function renderizarProdutos(filtro = '') {
    const div = document.getElementById('lista-produtos');
    div.innerHTML = '';
    
    const termo = filtro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const produtosFiltrados = listaProdutos.filter(p => {
        const nome = p.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nome.includes(termo);
    });

    if (produtosFiltrados.length === 0) {
        div.innerHTML = '<p class="carregando" style="margin-top: 20px;">Nenhum produto encontrado.</p>';
        return;
    }

    let categoriasParaExibir = listaCategorias;
    
    if (typeof categoriaSelecionadaId !== 'undefined' && categoriaSelecionadaId) {
        categoriasParaExibir = listaCategorias.filter(c => c.id === categoriaSelecionadaId);
    }

    categoriasParaExibir.forEach(cat => {
        const produtosDaCategoria = produtosFiltrados.filter(p => p.categoria === cat.nome);

        if (produtosDaCategoria.length > 0) {
            div.innerHTML += `<div class="categoria-separador">${cat.nome}</div>`;

            produtosDaCategoria.forEach(p => {
                const isAtivo = p.ativo !== false;
                const classeInativo = isAtivo ? '' : 'item-inativo';
                
                div.innerHTML += `
                    <div class="item-linha" draggable="true" ondragstart="dragStartProduto(${p.id})" ondragover="dragOverProduto(event)" ondrop="dropProduto(${p.id})" style="display: flex; align-items: center;">
                        <span style="color: #ccc; font-size: 1.2rem; margin-right: 15px; cursor: grab; padding: 5px;" title="Arraste para reordenar">☰</span>
                        
                        <div class="item-info ${classeInativo}" onclick="abrirModalProduto(${p.id})" style="cursor: pointer; flex: 1; padding: 5px 0;">
                            <span class="item-nome">${p.emoji || ''} ${p.nome}</span>
                            <span class="item-detalhe">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</span>
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
    });

    const nomesDasCategoriasAtuais = categoriasParaExibir.map(c => c.nome);
    const produtosSemCategoria = produtosFiltrados.filter(p => !p.categoria || !nomesDasCategoriasAtuais.includes(p.categoria));
    
    if (produtosSemCategoria.length > 0) {
        div.innerHTML += `<div class="categoria-separador" style="background-color: #f5f5f5; color: #666; border-color: #ddd;">Outros</div>`;
        produtosSemCategoria.forEach(p => {
            const isAtivo = p.ativo !== false;
            const classeInativo = isAtivo ? '' : 'item-inativo';
            
            div.innerHTML += `
                <div class="item-linha" draggable="true" ondragstart="dragStartProduto(${p.id})" ondragover="dragOverProduto(event)" ondrop="dropProduto(${p.id})" style="display: flex; align-items: center;">
                    <span style="color: #ccc; font-size: 1.2rem; margin-right: 15px; cursor: grab; padding: 5px;" title="Arraste para reordenar">☰</span>
                    
                    <div class="item-info ${classeInativo}" onclick="abrirModalProduto(${p.id})" style="cursor: pointer; flex: 1; padding: 5px 0;">
                        <span class="item-nome">${p.emoji || ''} ${p.nome}</span>
                        <span class="item-detalhe">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</span>
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

async function excluirProduto(id) {
    if(!confirm("Tem certeza que deseja excluir o produto?")) return;
    try {
        await fetch(`${API_URL}/produtos/${id}`, { method: 'DELETE' });
        await carregarTudo();
    } catch(e) { alert("Erro ao excluir."); }
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
                    <button class="btn-icone" title="Editar Grupo" onclick="abrirModalGrupo(${g.id})">✏️</button>
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
// FUNÇÕES DE MODAL E CADASTRO
// ==========================================
function fecharModalProduto() { document.getElementById('modal-produto').style.display = 'none'; }
function fecharModalGrupo() { document.getElementById('modal-grupo').style.display = 'none'; }

let gruposSelecionadosTemporarios = []; 

function toggleAreaPromocao() {
    const tipoSelecionadoElement = document.querySelector('input[name="tipo_promocao"]:checked');
    if (!tipoSelecionadoElement) return;

    const tipoSelecionado = tipoSelecionadoElement.value;
    const areaValor = document.getElementById('area-valor-promocao');
    const labelTipo = document.getElementById('label-tipo-promocao');
    const inputValor = document.getElementById('prod-valor-promocao');
    const areaAgendamento = document.getElementById('area-agendamento-promo'); 
    
    if (tipoSelecionado === 'nenhuma') {
        if(areaValor) areaValor.style.display = 'none';
        if(inputValor) inputValor.value = ''; 
        if(areaAgendamento) areaAgendamento.style.display = 'none'; 
    } else {
        if(areaValor) areaValor.style.display = 'flex';
        if(labelTipo) labelTipo.innerText = tipoSelecionado === 'porcentagem' ? '%' : 'R$';
        if(inputValor) inputValor.placeholder = tipoSelecionado === 'porcentagem' ? 'Ex: 10 (10% off)' : 'Ex: 5.00 (5 reais off)';
        if(areaAgendamento) areaAgendamento.style.display = 'block'; 
    }
}

// 🚀 FUNÇÃO BLINDADA COM OS IDs CORRETOS
function abrirModalProduto(id = null) {
    const modal = document.getElementById('modal-produto');
    const titulo = document.getElementById('titulo-modal-produto') || document.getElementById('modal-titulo');

    const preencherSeguro = (idCampo, valor) => {
        const campo = document.getElementById(idCampo);
        if (campo) campo.value = valor;
    };
    const checarSeguro = (idCampo, isChecked) => {
        const campo = document.getElementById(idCampo);
        if (campo) campo.checked = isChecked;
    };

    gruposSelecionadosTemporarios = []; 

    if (id) { 
        const p = listaProdutos.find(x => x.id === id);
        if(!p) return;
        produtoEditandoId = id;

        if(titulo) titulo.innerText = "Editar Produto";
        
        preencherSeguro('prod-id', p.id);
        preencherSeguro('prod-nome', p.nome || '');
        preencherSeguro('prod-preco', p.preco || '');
        preencherSeguro('prod-emoji', p.emoji || '');
        preencherSeguro('prod-categoria', p.categoria || 'Outros');
        preencherSeguro('produto-tag', p.tag || '');
        preencherSeguro('produto-imagem', p.imagem_url || '');
        preencherSeguro('prod-descricao', (p.descricao && p.descricao !== 'null') ? p.descricao : '');
        
        checarSeguro('prod-venda-peso', p.venda_por_peso === true);
        checarSeguro('produto-promo-pdv', p.promo_pdv === true);
        
        gruposSelecionadosTemporarios = p.grupos_ids ? [...p.grupos_ids] : [];

        // Promoções
        const tipoPromo = p.tipo_promocao || 'nenhuma';
        const radioTarget = document.querySelector(`input[name="tipo_promocao"][value="${tipoPromo}"]`);
        if(radioTarget) radioTarget.checked = true;
        
        preencherSeguro('prod-valor-promocao', p.valor_promocao || '');
        preencherSeguro('produto-promo-inicio', p.promo_inicio || '');
        preencherSeguro('produto-promo-fim', p.promo_fim || '');
        
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
        produtoEditandoId = null;
        if(titulo) titulo.innerText = "Novo Produto";
        
        preencherSeguro('prod-id', '');
        preencherSeguro('prod-nome', '');
        preencherSeguro('prod-preco', '');
        preencherSeguro('prod-emoji', '🍨');
        preencherSeguro('prod-categoria', 'Outros'); 
        preencherSeguro('produto-tag', '');
        preencherSeguro('produto-imagem', '');
        preencherSeguro('prod-descricao', '');
        
        checarSeguro('prod-venda-peso', false);
        checarSeguro('produto-promo-pdv', false);

        const radioNenhuma = document.querySelector('input[name="tipo_promocao"][value="nenhuma"]');
        if(radioNenhuma) radioNenhuma.checked = true;
        
        preencherSeguro('prod-valor-promocao', '');
        preencherSeguro('produto-promo-inicio', '');
        preencherSeguro('produto-promo-fim', '');
        
        document.querySelectorAll('.btn-dia').forEach(b => b.classList.remove('ativo'));

        toggleAreaPromocao(); 
    }

    const inputArquivo = document.getElementById('produto-arquivo-foto');
    if(inputArquivo) inputArquivo.value = '';

    renderizarSelecaoGrupos();
    if(modal) modal.style.display = 'flex';
}

let grupoArrastadoIndex = null;

function renderizarSelecaoGrupos() {
    const container = document.getElementById('container-checkbox-grupos');
    if(!container) return;

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

// 🚀 FUNÇÃO BLINDADA COM OS IDs CORRETOS
async function salvarProduto() {
    const lerSeguro = (idCampo, valorPadrao = '') => {
        const campo = document.getElementById(idCampo);
        return campo ? campo.value : valorPadrao;
    };
    const lerCheckSeguro = (idCampo, valorPadrao = false) => {
        const campo = document.getElementById(idCampo);
        return campo ? campo.checked : valorPadrao;
    };

    const nome = lerSeguro('prod-nome').trim();
    const precoBruto = lerSeguro('prod-preco').replace(',', '.');
    const preco = parseFloat(precoBruto);
    
    if (!nome || isNaN(preco)) return alert("⚠️ O nome e o preço são obrigatórios!");

    const btn = document.getElementById('btn-salvar-produto') || document.querySelector('#modal-produto button.btn-salvar') || document.querySelector('.btn-salvar');
    let textoOriginal = "Salvar";
    if (btn) {
        textoOriginal = btn.innerText;
        btn.innerText = 'Salvando...';
        btn.disabled = true;
    }

    const diasSelecionados = Array.from(document.querySelectorAll('.btn-dia.ativo')).map(b => b.getAttribute('data-dia')).join(',');

    let tipoPromocao = 'nenhuma';
    const radioAtivo = document.querySelector('input[name="tipo_promocao"]:checked');
    if (radioAtivo) tipoPromocao = radioAtivo.value;

    const gruposSelecionados = gruposSelecionadosTemporarios;

    const dados = {
        nome: nome,
        descricao: lerSeguro('prod-descricao').trim(),
        preco: preco,
        emoji: lerSeguro('prod-emoji').trim(),
        categoria: lerSeguro('prod-categoria', 'Outros'),
        imagem_url: lerSeguro('produto-imagem').trim(),
        venda_por_peso: lerCheckSeguro('prod-venda-peso'),
        tag: lerSeguro('produto-tag'),
        tipo_promocao: tipoPromocao,
        valor_promocao: parseFloat(lerSeguro('prod-valor-promocao')) || 0,
        promo_dias: diasSelecionados,
        promo_inicio: lerSeguro('produto-promo-inicio'),
        promo_fim: lerSeguro('produto-promo-fim'),
        promo_pdv: lerCheckSeguro('produto-promo-pdv'),
        grupos_ids: gruposSelecionados
    };

    try {
        const url = produtoEditandoId ? `${API_URL}/produtos/${produtoEditandoId}` : `${API_URL}/produtos`;
        const method = produtoEditandoId ? 'PUT' : 'POST';

        const resposta = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (resposta.ok) {
            fecharModalProduto();
            await carregarTudo(); 
        } else {
            alert("❌ Erro ao salvar produto no banco de dados.");
        }
    } catch (e) {
        alert("🔌 Erro de conexão. Verifique sua internet.");
    } finally {
        if (btn) {
            btn.innerText = textoOriginal;
            btn.disabled = false;
        }
    }
}

// Restante das rotinas mantidas com segurança
function abrirModalGrupo(id = null) {
    const modal = document.getElementById('modal-grupo');
    const titulo = document.getElementById('titulo-modal-grupo') || document.getElementById('modal-titulo-grupo');

    if (id) {
        const g = listaGrupos.find(x => x.id === id);
        if(titulo) titulo.innerText = "Editar Grupo";
        document.getElementById('grupo-id').value = g.id;
        document.getElementById('grupo-nome').value = g.nome;
        document.getElementById('grupo-limite').value = g.limite;
        document.getElementById('grupo-obrigatorio').checked = g.obrigatorio === true; 
        document.getElementById('btn-excluir-grupo').style.display = 'block';
    } else {
        if(titulo) titulo.innerText = "Novo Grupo";
        document.getElementById('grupo-id').value = '';
        document.getElementById('grupo-nome').value = '';
        document.getElementById('grupo-limite').value = '';
        document.getElementById('grupo-obrigatorio').checked = false;
        document.getElementById('btn-excluir-grupo').style.display = 'none';
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
    if(!container) return;
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
    if(!container) return;
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
        listaCidades = []; 
    }
    renderizarListaCidadesAdmin();
}

function renderizarListaCidadesAdmin() {
    const container = document.getElementById('lista-cidades-gerenciador');
    if(!container) return;
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
        console.error("Erro ao carregar token", e);
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
        
        alert("✅ Chave do Mercado Pago blindada e salva com sucesso!");
        fecharConfigPagamentos();
    } catch (e) {
        alert("❌ Erro de conexão ao tentar salvar a chave.");
    } finally {
        btn.innerText = '💾 Salvar Chave';
        btn.disabled = false;
    }
}

// ==========================================
// 🧠 INTELIGÊNCIA DOS BOTÕES DE AGENDAMENTO E ESTOQUE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn-dia').forEach(btn => {
        btn.addEventListener('click', function() {
            this.classList.toggle('ativo');
        });
    });
});

function abrirModalEstoque() {
  document.getElementById('modalEstoque').style.display = 'block';
  carregarListaEstoque();
}

function fecharModalEstoque() {
  document.getElementById('modalEstoque').style.display = 'none';
}

async function carregarListaEstoque() {
  const divLista = document.getElementById('listaEstoqueProdutos');
  divLista.innerHTML = '<h3>Buscando itens na geladeira... 🥶</h3>';
  
  try {
    const res = await fetch(`${API_URL}/produtos`);
    const produtos = await res.json();
    divLista.innerHTML = '';
    
    produtos.forEach(p => {
      let estoqueAtual = Number(p.estoque) || 0; 
      let corEstoque = estoqueAtual > 0 ? '#2ed573' : '#ff4757';
      
      divLista.innerHTML += `
        <div class="item-estoque" data-nome="${p.nome.toLowerCase()}" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; background: #f1f2f6; padding: 15px; border-radius: 8px; border-left: 5px solid ${corEstoque};">
          <div style="flex: 1; min-width: 150px;">
            <strong style="font-size: 1.1em; color: #2f3542;">${p.nome}</strong>
            <p style="margin: 0; font-size: 0.8em; color: #747d8c;">Status Atual: ${p.ativo ? '🟢 Visível' : '🔴 Bloqueado'}</p>
          </div>
          
          <div style="display: flex; align-items: center; gap: 15px; margin-top: 10px;">
            <button onclick="alterarEstoque(${p.id}, ${estoqueAtual - 1})" style="background: #dfe4ea; border: none; padding: 10px 20px; font-size: 1.5em; border-radius: 5px; cursor: pointer; color: #333;">-</button>
            <input type="number" value="${estoqueAtual}" onchange="alterarEstoque(${p.id}, Number(this.value))" style="font-size: 1.5em; font-weight: bold; width: 70px; text-align: center; color: #2f3542; border: 2px solid #dfe4ea; border-radius: 5px; padding: 5px; background: #ffffff;" />
            <button onclick="alterarEstoque(${p.id}, ${estoqueAtual + 1})" style="background: #dfe4ea; border: none; padding: 10px 20px; font-size: 1.5em; border-radius: 5px; cursor: pointer; color: #333;">+</button>
          </div>
        </div>
      `;
    });
  } catch (erro) {
    divLista.innerHTML = '<p>Erro técnico ao carregar os produtos.</p>';
  }
}

function filtrarEstoqueVisual() {
  let termo = document.getElementById('filtroEstoque').value.toLowerCase();
  let itens = document.querySelectorAll('.item-estoque');
  
  itens.forEach(item => {
    let nomeProduto = item.getAttribute('data-nome');
    if (nomeProduto.includes(termo)) {
      item.style.display = 'flex'; 
    } else {
      item.style.display = 'none'; 
    }
  });
}

async function alterarEstoque(idProduto, novoValor) {
  if (novoValor < 0) novoValor = 0; 
  
  try {
    await fetch(`${API_URL}/produtos/${idProduto}/estoque`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estoque: novoValor })
    });
    carregarListaEstoque();
  } catch (erro) {
    alert("Falha de comunicação com o sistema! Verifique a internet.");
  }
}

// ==========================================
// INTELIGÊNCIA DE REORDENAÇÃO DE PRODUTOS
// ==========================================
let produtoArrastadoId = null;

function dragStartProduto(id) {
    produtoArrastadoId = id;
}

function dragOverProduto(event) {
    event.preventDefault(); 
}

async function dropProduto(idDestino) {
    if (produtoArrastadoId === null || produtoArrastadoId === idDestino) return;

    const indexOrigem = listaProdutos.findIndex(p => p.id === produtoArrastadoId);
    const indexDestino = listaProdutos.findIndex(p => p.id === idDestino);

    const itemArrastado = listaProdutos.splice(indexOrigem, 1)[0];
    listaProdutos.splice(indexDestino, 0, itemArrastado);

    const termoFiltro = document.getElementById('filtro-produtos-gestao') ? document.getElementById('filtro-produtos-gestao').value : '';
    renderizarProdutos(termoFiltro);

    const novaOrdem = listaProdutos.map((p, index) => ({ id: p.id, ordem: index + 1 }));

    try {
        await fetch(`${API_URL}/produtos/ordem`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaOrdem)
        });
    } catch (e) {
        console.error("Erro ao salvar ordem no servidor:", e);
    } finally {
        produtoArrastadoId = null;
    }
}