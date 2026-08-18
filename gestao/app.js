const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let listaProdutos = [];
let listaGrupos = [];
let gruposAbertos = [];
let produtoEditandoId = null; 

window.onload = async () => {
    await carregarTudo();
    atualizarBadgeMesasGlobal();
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

        // 📸 O NOVO FILTRO BLINDADO DAS FOTOS DOS ADICIONAIS NA GESTÃO
        let gruposBrutos = await resGrupos.json();
        listaGrupos = gruposBrutos.map(g => {
            if (g.itens) {
                g.itens = g.itens.map(item => {
                    if (item.imagem_url && !item.imagem_url.includes('http')) {
                        const nomeArquivo = item.imagem_url.split('/').pop();
                        item.imagem_url = `https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/uploads/${nomeArquivo}`;
                    }
                    return item;
                });
            }
            return g;
        });
        listaCategorias = await resCat.json(); 
        
        // 🚀 CORREÇÃO: Mantém o texto das pesquisas ativo ao recarregar a tela após salvar!
        const termoAtualProdutos = document.getElementById('filtro-produtos-gestao') ? document.getElementById('filtro-produtos-gestao').value : '';
        const termoAtualGrupos = document.getElementById('filtro-grupos-gestao') ? document.getElementById('filtro-grupos-gestao').value : '';
        
        renderizarProdutos(termoAtualProdutos);
        renderizarGrupos(termoAtualGrupos);
        preencherSelectCategorias();
        
        function filtrarGruposGestao() {
            const termo = document.getElementById('filtro-grupos-gestao').value;
            renderizarGrupos(termo);
        }
        
        // As antigas linhas do grupoSelecionadoId foram removidas daqui!
        
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
                
                // 👇 NOVO: Verifica as categorias adicionais antes de desenhar o HTML
                let catsAdic = [];
                try { catsAdic = typeof p.categorias_adicionais === 'string' ? JSON.parse(p.categorias_adicionais) : (p.categorias_adicionais || []); } catch(e){}
                let badgeAdicional = catsAdic.length > 0 ? `<span style="font-size: 0.7rem; background: #e0f7fa; color: #00838f; padding: 2px 8px; border-radius: 12px; margin-left: 10px;">Também em: ${catsAdic.join(', ')}</span>` : '';

                div.innerHTML += `
                    <div class="item-linha" draggable="true" ondragstart="dragStartProduto(${p.id})" ondragover="dragOverProduto(event)" ondrop="dropProduto(${p.id})" style="display: flex; align-items: center;">
                        <span style="color: #ccc; font-size: 1.2rem; margin-right: 15px; cursor: grab; padding: 5px;" title="Arraste para reordenar">☰</span>
                        
                        <div class="item-info ${classeInativo}" onclick="abrirModalProduto(${p.id})" style="cursor: pointer; flex: 1; padding: 5px 0;">
                            <span class="item-nome">${p.emoji || ''} ${p.nome} ${badgeAdicional}</span>
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
            
            // 👇 NOVO: Verifica as categorias adicionais antes de desenhar o HTML
            let catsAdic = [];
            try { catsAdic = typeof p.categorias_adicionais === 'string' ? JSON.parse(p.categorias_adicionais) : (p.categorias_adicionais || []); } catch(e){}
            let badgeAdicional = catsAdic.length > 0 ? `<span style="font-size: 0.7rem; background: #e0f7fa; color: #00838f; padding: 2px 8px; border-radius: 12px; margin-left: 10px;">Também em: ${catsAdic.join(', ')}</span>` : '';

            div.innerHTML += `
                <div class="item-linha" draggable="true" ondragstart="dragStartProduto(${p.id})" ondragover="dragOverProduto(event)" ondrop="dropProduto(${p.id})" style="display: flex; align-items: center;">
                    <span style="color: #ccc; font-size: 1.2rem; margin-right: 15px; cursor: grab; padding: 5px;" title="Arraste para reordenar">☰</span>
                    
                    <div class="item-info ${classeInativo}" onclick="abrirModalProduto(${p.id})" style="cursor: pointer; flex: 1; padding: 5px 0;">
                        <span class="item-nome">${p.emoji || ''} ${p.nome} ${badgeAdicional}</span>
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
        categorias_adicionais: p.categorias_adicionais || [],
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
// ABA DE COMPLEMENTOS (GRUPOS E ADICIONAIS ANINHADOS)
// ==========================================

// Função simples para alternar as Abas
function abrirAba(idAba, botaoClicado) {
    document.querySelectorAll('.tab-content').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(idAba).classList.add('active');
    botaoClicado.classList.add('active');
}

// Abre e fecha a Sanfona (Accordion) mantendo o estado salvo
function toggleGrupo(elementoHeader, idGrupo) {
    elementoHeader.classList.toggle('aberto');
    if (elementoHeader.classList.contains('aberto')) {
        if (!gruposAbertos.includes(idGrupo)) gruposAbertos.push(idGrupo);
    } else {
        gruposAbertos = gruposAbertos.filter(id => id !== idGrupo);
    }
}

// O NOVO RENDERIZADOR: Constrói Grupos, Adicionais e Filtra tudo!
// Função que escuta a barra de pesquisa de grupos e aciona o filtro
function filtrarGruposGestao() {
    const termo = document.getElementById('filtro-grupos-gestao') ? document.getElementById('filtro-grupos-gestao').value : '';
    renderizarGrupos(termo);
}

function renderizarGrupos(filtro = '') {
    const div = document.getElementById('lista-grupos');
    div.innerHTML = '';
    
    // Limpa a busca para ignorar acentos e letras maiúsculas
    const termo = filtro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Filtra: Mostra o grupo se o NOME do grupo bater OU se o NOME de algum item bater
    const gruposFiltrados = listaGrupos.filter(g => {
        if (termo === '') return true; // Se não tem filtro, mostra tudo
        
        const nomeGrupo = g.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (nomeGrupo.includes(termo)) return true; // Achou no nome do grupo

        if (g.itens && g.itens.length > 0) {
            return g.itens.some(item => {
                const nomeItem = item.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return nomeItem.includes(termo); // Achou no nome do adicional
            });
        }
        return false;
    });

    if (gruposFiltrados.length === 0) {
        div.innerHTML = '<p class="carregando" style="margin-top: 20px;">Nenhum grupo ou adicional encontrado com este nome.</p>';
        return;
    }

    gruposFiltrados.forEach(g => {
        const isAtivo = g.ativo !== false;
        const classeInativoGrupo = isAtivo ? '' : 'item-inativo';
        
        // MÁGICA 1: Se tem uma pesquisa ativa, abre a sanfona automaticamente!
        const estaAberto = (gruposAbertos.includes(g.id) || termo !== '') ? 'aberto' : '';
        const badgeObrigatorio = g.obrigatorio ? '<span style="font-size:0.7rem; background:#ffeb3b; color:#f57f17; padding:2px 6px; border-radius:10px; margin-left:8px;">Obrigatório</span>' : '';

        // Monta os itens (adicionais) de dentro do grupo primeiro
        let itensHtml = '';
        if (g.itens && g.itens.length > 0) {
            g.itens.forEach((item, index) => {
                const isItemAtivo = item.ativo !== false; 
                const classeInativoItem = isItemAtivo ? '' : 'item-inativo';

                // Marca de amarelo se pesquisado
                const nomeItemParaBusca = item.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const highlight = (termo !== '' && nomeItemParaBusca.includes(termo)) ? 'background: #fff9c4; border: 1px solid #ffeb3b;' : '';

                // A miniatura da foto na Gestão
                const imgThumb = item.imagem_url 
                    ? `<img src="${item.imagem_url}" style="width: 45px; height: 45px; border-radius: 8px; object-fit: cover; border: 1px solid #ddd; flex-shrink: 0;">`
                    : `<div style="width: 45px; height: 45px; border-radius: 8px; border: 1px dashed #ccc; background: #fafafa; flex-shrink: 0; display: flex; justify-content: center; align-items: center; color: #ccc; font-size: 0.7rem;">sem foto</div>`;

                // Ajuste inteligente para mostrar se os preços de PDV e Delivery são diferentes
                let textoPreco = item.preco > 0 ? '+ R$ ' + Number(item.preco).toFixed(2).replace('.', ',') : 'Grátis';
                if (item.preco_pdv !== undefined && item.preco_pdv !== item.preco) {
                    let textoPrecoPdv = item.preco_pdv > 0 ? 'R$ ' + Number(item.preco_pdv).toFixed(2).replace('.', ',') : 'Grátis';
                    textoPreco = `Delivery: ${textoPreco} | PDV: <span style="color: #00bcd4;">${textoPrecoPdv}</span>`;
                }

                // Forçando o layout horizontal limpo
                itensHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid #eee; background: white; border-radius: 8px; margin-bottom: 5px; ${highlight}">
                        <div class="${classeInativoItem}" style="display: flex; align-items: center; gap: 15px; flex: 1;">
                            ${imgThumb}
                            <div style="display: flex; flex-direction: column; text-align: left;">
                                <span style="font-weight: 600; color: #333; font-size: 1rem;">${item.nome}</span>
                                <span style="color: #25D366; font-size: 0.85rem; font-weight: bold;">${textoPreco}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <label class="switch" style="margin: 0;">
                                <input type="checkbox" onchange="toggleAdicional(${g.id}, ${index}, this.checked)" ${isItemAtivo ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                            <button style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #00bcd4;" onclick="abrirModalAdicional(${g.id}, ${index})" title="Editar">✏️</button>
                            <button style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #f44336;" onclick="excluirAdicional(${g.id}, ${index})" title="Excluir">🗑️</button>
                        </div>
                    </div>
                `;
            });
        } else {
            itensHtml = '<p style="color:#999; font-size:0.9rem; padding:10px; text-align:center;">Nenhum adicional cadastrado.</p>';
        }

        // Agora monta a "casca" do Acordeão e injeta os itens dentro
        div.innerHTML += `
            <div class="grupo-accordion">
                <div class="grupo-header ${estaAberto} ${classeInativoGrupo}" onclick="toggleGrupo(this, ${g.id})">
                    <div class="grupo-titulo-area">
                        <span class="grupo-nome">${g.nome} ${badgeObrigatorio}</span>
                        <span class="grupo-detalhes">Limite: ${g.limite} | ${(g.itens||[]).length} itens</span>
                    </div>
                    <div class="grupo-acoes" onclick="event.stopPropagation()">
                        <button class="btn-icone" title="Editar Grupo" onclick="abrirModalGrupo(${g.id})">✏️</button>
                        <button class="btn-icone" title="Duplicar Grupo" onclick="duplicarGrupo(${g.id})">📄</button>
                        <label class="switch">
                            <input type="checkbox" onchange="toggleGrupoStatus(${g.id}, this.checked)" ${isAtivo ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <span class="seta">▼</span>
                    </div>
                </div>
                
                <div class="grupo-body">
                    ${itensHtml}
                    <button class="btn-novo-add" onclick="abrirModalAdicional(${g.id})">+ Adicionar novo item em: ${g.nome}</button>
                </div>
            </div>
        `;
    });
}

// Funções de manutenção adaptadas para trabalhar direto com o ID do Grupo
async function toggleGrupoStatus(id, statusAtivo) {
    try {
        await fetch(`${API_URL}/grupos/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: statusAtivo })
        });
        await carregarTudo();
    } catch(e) { alert("Erro ao mudar status do grupo."); }
}

async function duplicarGrupo(id) {
    const g = listaGrupos.find(x => x.id === id);
    if (!g) return;
    const dadosDuplicados = { nome: g.nome + " (Cópia)", limite: parseInt(g.limite), itens: g.itens || [], ativo: true, obrigatorio: g.obrigatorio };
    try {
        await fetch(`${API_URL}/grupos`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dadosDuplicados) });
        await carregarTudo();
    } catch (e) { alert("❌ Erro ao duplicar grupo."); }
}

function abrirModalAdicional(idGrupo, indexItem = null) {
    const modal = document.getElementById('modal-adicional');
    const titulo = document.getElementById('titulo-modal-adicional');
    const grupo = listaGrupos.find(g => g.id === idGrupo);
    
    document.getElementById('adic-grupo-id').value = idGrupo;
    document.getElementById('adic-arquivo-foto').value = '';

    if (indexItem !== null) {
        const item = grupo.itens[indexItem];
        titulo.innerText = "Editar Adicional";
        document.getElementById('adic-index').value = indexItem;
        document.getElementById('adic-nome').value = item.nome;
        document.getElementById('adic-preco').value = item.preco;
        // Se o preço do PDV não existir no banco antigo, ele copia o preço normal para não dar erro
        document.getElementById('adic-preco-pdv').value = item.preco_pdv !== undefined ? item.preco_pdv : item.preco;
        document.getElementById('adic-imagem-url').value = item.imagem_url || '';
        
        const insJsonAdic = typeof item.insumos_json === 'string' ? item.insumos_json : JSON.stringify(item.insumos_json || []);
        document.getElementById('adic-insumos-json').value = insJsonAdic;
        if(typeof atualizarResumoInsumos === 'function') atualizarResumoInsumos('adic-resumo-insumos', insJsonAdic);
    } else {
        titulo.innerText = "Novo Adicional";
        document.getElementById('adic-index').value = '';
        document.getElementById('adic-nome').value = '';
        document.getElementById('adic-preco').value = '';
        document.getElementById('adic-preco-pdv').value = '';
        document.getElementById('adic-imagem-url').value = '';
        
        document.getElementById('adic-insumos-json').value = '[]';
        if(typeof atualizarResumoInsumos === 'function') atualizarResumoInsumos('adic-resumo-insumos', '[]');
    }
    
    if (!gruposAbertos.includes(idGrupo)) gruposAbertos.push(idGrupo);
    modal.style.display = 'flex';
}

function fecharModalAdicional() {
    document.getElementById('modal-adicional').style.display = 'none';
}

async function salvarAdicional() {
    const idGrupo = Number(document.getElementById('adic-grupo-id').value);
    const indexItem = document.getElementById('adic-index').value;
    const nome = document.getElementById('adic-nome').value.trim();
    const preco = parseFloat(document.getElementById('adic-preco').value.replace(',', '.')) || 0;
    const precoPdv = parseFloat(document.getElementById('adic-preco-pdv').value.replace(',', '.')) || 0;
    let imagemUrl = document.getElementById('adic-imagem-url').value;

    if (!nome) return alert("⚠️ Preencha o nome do adicional!");

    const btn = document.getElementById('btn-salvar-adicional');
    const textoOriginal = btn.innerText;
    btn.innerText = '⏳ Salvando...';
    btn.disabled = true;

    // 📸 UPLOAD DA FOTO PARA A NUVEM 
    const inputArquivo = document.getElementById('adic-arquivo-foto');
    if (inputArquivo && inputArquivo.files.length > 0) {
        const formData = new FormData();
        formData.append('imagem', inputArquivo.files[0]);
        try {
            const resUpload = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
            const dadosUpload = await resUpload.json();
            if (dadosUpload.sucesso) {
                imagemUrl = dadosUpload.url;
            } else {
                alert("⚠️ Erro no upload da foto.");
                btn.innerText = textoOriginal; btn.disabled = false; return;
            }
        } catch (e) {
            alert("🔌 Erro de conexão ao enviar foto.");
            btn.innerText = textoOriginal; btn.disabled = false; return;
        }
    }

    const grupo = listaGrupos.find(g => g.id === idGrupo);
    grupo.itens = grupo.itens || [];

    const insumos_json = document.getElementById('adic-insumos-json').value || '[]';

    if (indexItem !== '') {
        // Editando existente
        grupo.itens[indexItem].nome = nome;
        grupo.itens[indexItem].preco = preco;
        grupo.itens[indexItem].preco_pdv = precoPdv; // Atualiza o preço da loja
        grupo.itens[indexItem].imagem_url = imagemUrl;
        grupo.itens[indexItem].insumos_json = insumos_json;
    } else {
        // Criando novo
        grupo.itens.push({ nome, preco, preco_pdv: precoPdv, imagem_url: imagemUrl, ativo: true, insumos_json: insumos_json });
    }

    try {
        await fetch(`${API_URL}/grupos/${idGrupo}`, { 
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(grupo) 
        });
        fecharModalAdicional();
        await carregarTudo();
    } catch (e) {
        alert("Erro ao salvar adicional.");
    } finally {
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
}

async function toggleAdicional(idGrupo, indexItem, statusAtivo) {
    const grupo = listaGrupos.find(g => g.id === idGrupo);
    grupo.itens[indexItem].ativo = statusAtivo;
    try {
        await fetch(`${API_URL}/grupos/${grupo.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(grupo) });
        await carregarTudo();
    } catch(e) { alert("Erro ao salvar adicional."); }
}

async function excluirAdicional(idGrupo, indexItem) {
    if(!confirm("Excluir este adicional definitivamente?")) return;
    const grupo = listaGrupos.find(g => g.id === idGrupo);
    grupo.itens.splice(indexItem, 1);
    try {
        await fetch(`${API_URL}/grupos/${grupo.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(grupo) });
        await carregarTudo();
    } catch(e) { alert("Erro ao excluir adicional."); }
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
        let catAdic = [];
        if (p.categorias_adicionais) {
            try { catAdic = typeof p.categorias_adicionais === 'string' ? JSON.parse(p.categorias_adicionais) : p.categorias_adicionais; } catch(e){}
        }
        atualizarCategoriasAdicionais(catAdic);
        preencherSeguro('produto-tag', p.tag || '');
        preencherSeguro('produto-imagem', p.imagem_url || '');
        preencherSeguro('prod-descricao', (p.descricao && p.descricao !== 'null') ? p.descricao : '');
        
        checarSeguro('prod-venda-peso', p.venda_por_peso === true);
        checarSeguro('produto-promo-pdv', p.promo_pdv === true);
        checarSeguro('prod-controlar-estoque', p.controlar_estoque === true); // NOVO
        checarSeguro('prod-mostrar-estoque', p.mostrar_estoque === true); // NOVO
        
        // 👇 NOVO: Carrega a Ficha Técnica
        preencherSeguro('prod-custo', p.custo || 0);
        const insJsonProd = typeof p.insumos_json === 'string' ? p.insumos_json : JSON.stringify(p.insumos_json || []);
        preencherSeguro('prod-insumos-json', insJsonProd);
        if(typeof atualizarResumoInsumos === 'function') atualizarResumoInsumos('prod-resumo-insumos', insJsonProd);

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
        atualizarCategoriasAdicionais([]); 
        preencherSeguro('produto-tag', '');
        preencherSeguro('produto-imagem', '');
        preencherSeguro('prod-descricao', '');
        
        checarSeguro('prod-venda-peso', false);
        checarSeguro('produto-promo-pdv', false);
        checarSeguro('prod-controlar-estoque', false); // NOVO
        checarSeguro('prod-mostrar-estoque', false); // NOVO
        
        // 👇 NOVO: Limpa Ficha Técnica
        preencherSeguro('prod-custo', 0);
        preencherSeguro('prod-insumos-json', '[]');
        if(typeof atualizarResumoInsumos === 'function') atualizarResumoInsumos('prod-resumo-insumos', '[]');

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

    // ==========================================
    // 📸 MÁGICA DO UPLOAD DE IMAGEM ANTES DE SALVAR
    // ==========================================
    let imagemFinalUrl = lerSeguro('produto-imagem').trim();
    const inputArquivo = document.getElementById('produto-arquivo-foto');
    
    // Se o usuário escolheu um arquivo do PC/Celular, envia pro servidor primeiro!
    if (inputArquivo && inputArquivo.files.length > 0) {
        const formData = new FormData();
        formData.append('imagem', inputArquivo.files[0]);
        
        try {
            const resUpload = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
            const dadosUpload = await resUpload.json();
            
            if (dadosUpload.sucesso) {
                imagemFinalUrl = dadosUpload.url; // Pega o link blindado que o servidor gerou
            } else {
                alert("⚠️ Erro no upload da foto: " + dadosUpload.erro);
                if (btn) { btn.innerText = textoOriginal; btn.disabled = false; }
                return; // Interrompe o salvamento se a foto falhar
            }
        } catch (e) {
            alert("🔌 Erro de conexão ao enviar a foto para a nuvem.");
            if (btn) { btn.innerText = textoOriginal; btn.disabled = false; }
            return;
        }
    }

    const diasSelecionados = Array.from(document.querySelectorAll('.btn-dia.ativo')).map(b => b.getAttribute('data-dia')).join(',');

    let tipoPromocao = 'nenhuma';
    const radioAtivo = document.querySelector('input[name="tipo_promocao"]:checked');
    if (radioAtivo) tipoPromocao = radioAtivo.value;

    const gruposSelecionados = gruposSelecionadosTemporarios;
    const categoriasExtras = Array.from(document.querySelectorAll('.check-cat-adicional:checked')).map(cb => cb.value);

    const dados = {
        nome: nome,
        descricao: lerSeguro('prod-descricao').trim(),
        preco: preco,
        emoji: lerSeguro('prod-emoji').trim(),
        categoria: lerSeguro('prod-categoria', 'Outros'),
        imagem_url: imagemFinalUrl, // <-- AGORA ELE USA O LINK CERTO (Nuvem ou Antigo)
        venda_por_peso: lerCheckSeguro('prod-venda-peso'),
        controlar_estoque: lerCheckSeguro('prod-controlar-estoque'), // NOVO
        mostrar_estoque: lerCheckSeguro('prod-mostrar-estoque'), // NOVO
        tag: lerSeguro('produto-tag'),
        tipo_promocao: tipoPromocao,
        valor_promocao: parseFloat(lerSeguro('prod-valor-promocao')) || 0,
        promo_dias: diasSelecionados,
        promo_inicio: lerSeguro('produto-promo-inicio'),
        promo_fim: lerSeguro('produto-promo-fim'),
        promo_pdv: lerCheckSeguro('produto-promo-pdv'),
        grupos_ids: gruposSelecionados,
        categorias_adicionais: categoriasExtras,
        custo: parseFloat(lerSeguro('prod-custo')) || 0,
        insumos_json: lerSeguro('prod-insumos-json', '[]')
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
    atualizarCategoriasAdicionais();
}

function atualizarCategoriasAdicionais(catsSalvas = null) {
    const container = document.getElementById('container-categorias-adicionais');
    if (!container) return;
    
    const catPrincipal = document.getElementById('prod-categoria').value;
    
    let selecionadas = catsSalvas;
    if (selecionadas === null) {
        selecionadas = Array.from(document.querySelectorAll('.check-cat-adicional:checked')).map(cb => cb.value);
    }

    container.innerHTML = '';
    
    listaCategorias.forEach(cat => {
        if(cat.nome === catPrincipal) return; 
        
        const isChecked = selecionadas.includes(cat.nome) ? 'checked' : '';
        container.innerHTML += `
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; background: white; padding: 6px 12px; border-radius: 20px; border: 1px solid #ddd; font-size: 0.85rem; transition: 0.2s;" onmouseover="this.style.borderColor='#00bcd4'" onmouseout="this.style.borderColor='#ddd'">
                <input type="checkbox" class="check-cat-adicional" value="${cat.nome}" ${isChecked} style="accent-color: #00bcd4; width:16px; height:16px;">
                ${cat.nome}
            </label>
        `;
    });

    if(container.innerHTML === '') {
        container.innerHTML = '<p style="color:#999; font-size:0.8rem; margin:0;">Nenhuma outra categoria disponível.</p>';
    }
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

        // NOVO: Exibição visual indicando se há um agendamento ativo
        let agendamentoHtml = '';
        if (cat.hora_inicio || cat.hora_fim || cat.dias_semana) {
            agendamentoHtml = `<span style="color: #ff4081; font-size: 0.75rem; font-weight: bold; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;"><span class="material-symbols-outlined" style="font-size: 0.9rem;">schedule</span> Agendada</span>`;
        }

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
                        <div style="margin-top: 4px;">${seloHtml} ${agendamentoHtml}</div>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <label class="switch" title="Mostrar no App?">
                        <input type="checkbox" onchange="toggleCategoriaApp(${cat.id}, this.checked)" ${isVisivel ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button onclick="abrirModalEdicaoCategoria(${cat.id})" style="background:none; border:none; color:#00bcd4; cursor:pointer; font-size:1.2rem;" title="Editar Categoria">✏️</button>
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
// EDIÇÃO AVANÇADA DE CATEGORIAS (AGENDAMENTO)
// ==========================================
function abrirModalEdicaoCategoria(id) {
    const cat = listaCategorias.find(c => c.id === id);
    if (!cat) return;

    document.getElementById('categoria-id-edit').value = cat.id;
    document.getElementById('categoria-nome-edit').value = cat.nome;
    document.getElementById('categoria-mostrar-edit').checked = cat.mostrar_cardapio !== false;

    // Reseta botões de dia do calendário da categoria
    document.querySelectorAll('button[data-dia-cat]').forEach(b => b.classList.remove('ativo'));

    // Preenche os dias se a categoria já tiver regras
    if (cat.dias_semana) {
        const diasSalvos = cat.dias_semana.split(',');
        diasSalvos.forEach(diaNum => {
            const btn = document.querySelector(`button[data-dia-cat="${diaNum}"]`);
            if(btn) btn.classList.add('ativo');
        });
    }

    document.getElementById('categoria-hora-inicio').value = cat.hora_inicio || '';
    document.getElementById('categoria-hora-fim').value = cat.hora_fim || '';

    // Esconde o painel principal de categorias e mostra o de edição por cima
    document.getElementById('modal-categorias').style.display = 'none';
    document.getElementById('modal-edicao-categoria').style.display = 'flex';
}

function fecharModalEdicaoCategoria() {
    document.getElementById('modal-edicao-categoria').style.display = 'none';
    // Devolve o usuário para a lista de categorias original
    document.getElementById('modal-categorias').style.display = 'flex';
}

async function salvarEdicaoCategoria() {
    const id = document.getElementById('categoria-id-edit').value;
    const nome = document.getElementById('categoria-nome-edit').value.trim();
    const mostrarApp = document.getElementById('categoria-mostrar-edit').checked;

    const diasSelecionados = Array.from(document.querySelectorAll('button[data-dia-cat].ativo'))
                                  .map(b => b.getAttribute('data-dia-cat')).join(',');
    const horaInicio = document.getElementById('categoria-hora-inicio').value;
    const horaFim = document.getElementById('categoria-hora-fim').value;

    if (!nome) return alert("⚠️ O nome da categoria não pode ficar vazio!");

    const btn = document.getElementById('btn-salvar-categoria-edit');
    btn.innerText = '⏳ Salvando...';
    btn.disabled = true;

    const payload = {
        nome: nome,
        mostrar_cardapio: mostrarApp,
        dias_semana: diasSelecionados, // Ex: "1,2,3"
        hora_inicio: horaInicio,       // Ex: "18:00"
        hora_fim: horaFim              // Ex: "23:59"
    };

    try {
        const res = await fetch(`${API_URL}/categorias/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            fecharModalEdicaoCategoria();
            await carregarTudo();
            renderizarListaCategoriasAdmin();
        } else {
            alert("❌ Erro ao atualizar as regras da categoria no banco de dados.");
        }
    } catch (e) {
        alert("🔌 Erro de conexão ao tentar salvar.");
    } finally {
        btn.innerText = 'Salvar Alterações';
        btn.disabled = false;
    }
}

// 🪄 Mágica para fazer os novos botões de dias funcionarem ao clicar
document.addEventListener('DOMContentLoaded', () => {
    // Escuta cliques dinâmicos em qualquer botão de dia de categoria
    document.body.addEventListener('click', function(e) {
        if(e.target && e.target.hasAttribute('data-dia-cat')) {
            e.target.classList.toggle('ativo');
        }
    });
});

// ==========================================
// 🗺️ SISTEMA UNIFICADO DE ÁREAS DE ENTREGA (CIDADES E BAIRROS)
// ==========================================
let listaCidadesLocais = [];
let listaBairrosLocais = [];

async function abrirGerenciadorLocais() {
    document.getElementById('modal-locais-entrega').style.display = 'flex';
    await carregarLocaisAdmin();
}

function fecharGerenciadorLocais() {
    document.getElementById('modal-locais-entrega').style.display = 'none';
}

async function carregarLocaisAdmin() {
    try {
        const [resCid, resBairros] = await Promise.all([
            fetch(`${API_URL}/cidades`),
            fetch(`${API_URL}/bairros`)
        ]);
        
        listaCidadesLocais = resCid.ok ? await resCid.json() : [];
        listaBairrosLocais = resBairros.ok ? await resBairros.json() : [];
        
        // Atualiza a caixinha de seleção de cidades na hora de cadastrar um bairro
        const select = document.getElementById('novo-bairro-cidade');
        if (select) {
            select.innerHTML = '<option value="" disabled selected>Escolha a Cidade...</option>';
            listaCidadesLocais.forEach(c => {
                select.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
            });
        }
        
        renderizarLocaisAdmin();
    } catch (e) { console.error("Erro ao carregar os locais de entrega", e); }
}

function renderizarLocaisAdmin() {
    const container = document.getElementById('lista-locais-gerenciador');
    if(!container) return;
    container.innerHTML = '';

    if (listaCidadesLocais.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; margin-top: 10px;">Nenhuma cidade cadastrada ainda.</p>';
        return;
    }

    listaCidadesLocais.forEach(cidade => {
        const bairrosDaCidade = listaBairrosLocais.filter(b => b.cidade === cidade.nome);
        
        let htmlBairros = '';
        if (bairrosDaCidade.length > 0) {
            bairrosDaCidade.forEach(b => {
                htmlBairros += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 15px; border-bottom: 1px dashed #ddd; background: #fff; transition: 0.2s;" onmouseover="this.style.background='#f0fcfd'" onmouseout="this.style.background='#fff'">
                        <strong style="color:#555; font-size: 0.95rem;">${b.nome}</strong>
                        
                        <div style="display:flex; align-items:center; gap: 12px;">
                            <div style="background: #e0f7fa; padding: 6px 10px; border-radius: 8px; border: 1px solid #b2ebf2; display: flex; align-items: center; gap: 5px;">
                                <span style="color: #00838f; font-weight: bold; font-size: 0.85rem;">R$</span>
                                <input type="number" id="taxa-bairro-${b.id}" value="${Number(b.taxa).toFixed(2)}" step="0.01" style="width: 70px; border: none; background: transparent; color: #00838f; font-weight: bold; outline: none; font-family: inherit; text-align: center;">
                                <button onclick="salvarEdicaoTaxa(${b.id})" style="background: none; border: none; cursor: pointer; color: #00bcd4; font-size: 1.3rem; padding: 0;" title="Salvar Nova Taxa">💾</button>
                            </div>
                            <button onclick="excluirBairro(${b.id})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size:1.3rem;" title="Excluir Bairro">🗑️</button>
                        </div>
                    </div>
                `;
            });
        } else {
            htmlBairros = '<p style="color:#999; font-size:0.85rem; padding: 12px 15px; margin: 0; background: #fff;">Nenhum bairro cadastrado nesta cidade.</p>';
        }

        container.innerHTML += `
            <div style="background:#f9f9f9; border-radius:8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <div style="background: #f1f5f9; padding: 12px 15px; border-bottom: 2px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color:#334155; font-size:1.1rem; display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 1.3rem; color: #9C27B0;">location_city</span> ${cidade.nome}</strong>
                    <button onclick="excluirCidade(${cidade.id})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem;" title="Excluir Cidade Inteira">🗑️</button>
                </div>
                <div style="display: flex; flex-direction: column;">
                    ${htmlBairros}
                </div>
            </div>
        `;
    });
}

// 👉 A Mágica de Salvar a Edição da Taxa inline
async function salvarEdicaoTaxa(idBairro) {
    const input = document.getElementById(`taxa-bairro-${idBairro}`);
    const novaTaxa = parseFloat(input.value.replace(',', '.'));
    
    if (isNaN(novaTaxa) || novaTaxa < 0) return alert("⚠️ Digite um valor válido e positivo para a taxa.");

    try {
        const res = await fetch(`${API_URL}/bairros/${idBairro}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taxa: novaTaxa })
        });

        if (res.ok) {
            alert("✅ Taxa de entrega atualizada com sucesso!");
            await carregarLocaisAdmin(); // Recarrega os dados do banco para garantir que a tela ficou exata
        } else {
            alert("❌ Erro ao atualizar a taxa no banco de dados.");
        }
    } catch (e) {
        alert("🔌 Falha de rede. Verifique sua conexão.");
    }
}

async function salvarNovaCidade() {
    const nome = document.getElementById('nova-cidade-nome').value.trim();
    if (!nome) return alert("Preencha o nome da cidade!");

    try {
        await fetch(`${API_URL}/cidades`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ nome }) });
        document.getElementById('nova-cidade-nome').value = '';
        await carregarLocaisAdmin(); 
    } catch (e) { alert("Erro ao salvar cidade."); }
}

async function excluirCidade(id) {
    if(!confirm("⚠️ CUIDADO! Tem certeza que deseja excluir esta cidade? Todos os bairros ligados a ela podem ficar sem referência no delivery.")) return;
    try {
        await fetch(`${API_URL}/cidades/${id}`, { method: 'DELETE' });
        await carregarLocaisAdmin();
    } catch (e) { alert("Erro ao excluir cidade."); }
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
            method: 'POST', headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ nome, taxa: parseFloat(taxa) || 0, cidade }) 
        });
        document.getElementById('novo-bairro-nome').value = '';
        document.getElementById('novo-bairro-taxa').value = '';
        await carregarLocaisAdmin(); 
    } catch (e) { alert("Erro ao salvar bairro."); }
}

async function excluirBairro(id) {
    if(!confirm("Tem certeza que deseja excluir este bairro definitivamente?")) return;
    try {
        await fetch(`${API_URL}/bairros/${id}`, { method: 'DELETE' });
        await carregarLocaisAdmin();
    } catch (e) { alert("Erro ao excluir bairro."); }
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

// Função para buscar mesas ativas e atualizar o ícone no menu lateral
async function atualizarBadgeMesasGlobal() {
    try {
        // Usa a sua API da Icesoft para verificar
        const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
        const resposta = await fetch(`${API_URL}/mesas`);
        const mesasAbertas = await resposta.json();
        
        const badge = document.getElementById('mesas-notification-badge');
        if (badge) {
            if (mesasAbertas.length > 0) {
                badge.textContent = mesasAbertas.length;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) {
        console.log("Aviso: Não foi possível checar as mesas abertas para o menu.", e);
    }
}

// ==========================================
// 🥣 MÓDULO DE MATÉRIAS-PRIMAS E FICHA TÉCNICA
// ==========================================
let listaInsumos = [];
let fichaTecnicaTemp = [];

// Carrega os insumos em segundo plano quando abrir a tela
document.addEventListener("DOMContentLoaded", () => {
    carregarInsumos();
});

async function carregarInsumos() {
    try {
        const res = await fetch(`${API_URL}/insumos`);
        listaInsumos = await res.json();
    } catch(e) { console.error("Erro Insumos"); }
}

// ==========================================
// MÁGICA DA TELA DE ESTOQUE (ABAS INTERNAS)
// ==========================================
function alternarAbaInsumos(aba) {
    const btnCad = document.getElementById('btn-aba-insumos-cadastro');
    const btnConf = document.getElementById('btn-aba-insumos-conferencia');
    const divCad = document.getElementById('conteudo-insumos-cadastro');
    const divConf = document.getElementById('conteudo-insumos-conferencia');

    if (aba === 'cadastro') {
        btnCad.style.color = '#ff9800'; btnCad.style.borderBottomColor = '#ff9800';
        btnConf.style.color = '#888'; btnConf.style.borderBottomColor = 'transparent';
        divCad.style.display = 'block'; divConf.style.display = 'none';
        renderizarInsumosAdmin();
    } else {
        btnConf.style.color = '#ff9800'; btnConf.style.borderBottomColor = '#ff9800';
        btnCad.style.color = '#888'; btnCad.style.borderBottomColor = 'transparent';
        divCad.style.display = 'none'; divConf.style.display = 'block';
        renderizarConferenciaEstoque();
    }
}

let perdasEmReais = {};

// 👇 NOVO: Função que puxa o texto digitado e manda renderizar a conferência
function filtrarConferenciaEstoque() {
    const termo = document.getElementById('filtro-conferencia-gestao').value;
    renderizarConferenciaEstoque(termo);
}

function renderizarConferenciaEstoque(filtro = '') {
    const tbody = document.getElementById('tabela-conferencia-estoque');
    tbody.innerHTML = '';
    perdasEmReais = {}; // Zera o cálculo da tela atual
    
    if(listaInsumos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #999;">Nenhuma matéria-prima cadastrada.</td></tr>';
        document.getElementById('total-perda-conferencia').innerText = 'R$ 0,00';
        return;
    }

    // Limpa o texto da busca (ignora maiúsculas e acentos)
    const termo = filtro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Ordena alfabeticamente e filtra pelo nome
    let insumosFiltrados = [...listaInsumos]
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .filter(ins => {
            const nome = ins.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return nome.includes(termo);
        });

    // Aplica a "tesoura" (limite) de itens na tela
    const selectLimite = document.getElementById('limite-conferencia-gestao');
    if (selectLimite && selectLimite.value !== 'todos') {
        const quantidade = parseInt(selectLimite.value);
        insumosFiltrados = insumosFiltrados.slice(0, quantidade);
    }

    if(insumosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #999;">Nenhum item encontrado na busca.</td></tr>';
        document.getElementById('total-perda-conferencia').innerText = 'R$ 0,00';
        return;
    }

    insumosFiltrados.forEach(ins => {
        const estoqueSistema = Number(ins.estoque || 0);
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee; transition: background 0.2s;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='transparent'">
                <td style="padding: 15px; color: #444; font-weight: 600; font-size: 1.05rem;">${ins.nome}</td>
                <td style="padding: 15px; text-align: center; color: #00bcd4; font-weight: bold; font-size: 1.1rem;">${estoqueSistema.toFixed(2)} <span style="font-size: 0.8rem; color:#888;">${ins.unidade}</span></td>
                <td style="padding: 15px; text-align: center;">
                    <input type="number" id="conf-input-${ins.id}" class="input-padrao" placeholder="Ex: 500" step="0.01" style="width: 120px; text-align: center; padding: 10px; border-radius: 6px; font-weight: bold; border: 2px solid #ddd; outline: none;" oninput="calcularDiferencaConferencia(${ins.id}, ${estoqueSistema}, ${ins.custo}, '${ins.unidade}')">
                </td>
                <td id="conf-diff-${ins.id}" style="padding: 15px; text-align: center; font-weight: bold; color: #bbb; font-size: 1.05rem;">-</td>
                <td id="conf-perda-${ins.id}" style="padding: 15px; text-align: right; font-weight: bold; color: #bbb; font-size: 1.05rem;">R$ 0,00</td>
            </tr>
        `;
    });
    calcularTotalPerdaConferencia();
}

function calcularDiferencaConferencia(id, estoqueSistema, custoUnitario, unidade) {
    const inputVal = document.getElementById(`conf-input-${id}`).value;
    const tdDiff = document.getElementById(`conf-diff-${id}`);
    const tdPerda = document.getElementById(`conf-perda-${id}`);
    
    if (inputVal === '') {
        tdDiff.innerText = '-'; tdDiff.style.color = '#bbb';
        tdPerda.innerText = 'R$ 0,00'; tdPerda.style.color = '#bbb';
        perdasEmReais[id] = 0;
        calcularTotalPerdaConferencia();
        return;
    }

    const conferido = parseFloat(inputVal.replace(',', '.')) || 0;
    const diferencaFisica = conferido - estoqueSistema;
    
    let corDiff = '#888';
    if (diferencaFisica < 0) corDiff = '#f44336'; // Menos do que devia (Ladrão invisível)
    else if (diferencaFisica > 0) corDiff = '#4CAF50'; // Mais do que devia (Sobrou)
    
    tdDiff.innerText = `${diferencaFisica > 0 ? '+' : ''}${diferencaFisica.toFixed(2)} ${unidade}`;
    tdDiff.style.color = corDiff;

    const custoFinanceiro = diferencaFisica * custoUnitario;
    
    if (custoFinanceiro < 0) {
        tdPerda.innerText = `- R$ ${Math.abs(custoFinanceiro).toFixed(2).replace('.', ',')}`;
        tdPerda.style.color = '#f44336';
        perdasEmReais[id] = Math.abs(custoFinanceiro); // Soma ao prejuízo
    } else if (custoFinanceiro > 0) {
        tdPerda.innerText = `+ R$ ${custoFinanceiro.toFixed(2).replace('.', ',')}`;
        tdPerda.style.color = '#4CAF50';
        perdasEmReais[id] = -custoFinanceiro; // Abate do prejuízo
    } else {
        tdPerda.innerText = 'R$ 0,00'; tdPerda.style.color = '#bbb';
        perdasEmReais[id] = 0;
    }
    
    calcularTotalPerdaConferencia();
}

function calcularTotalPerdaConferencia() {
    let total = 0;
    for (let id in perdasEmReais) { total += perdasEmReais[id]; }
    
    const elTotal = document.getElementById('total-perda-conferencia');
    if (total > 0) {
        elTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')} (Prejuízo)`;
        elTotal.style.color = '#f44336';
    } else if (total < 0) {
        elTotal.innerText = `R$ ${Math.abs(total).toFixed(2).replace('.', ',')} (Sobra Lucrativa)`;
        elTotal.style.color = '#4CAF50';
    } else {
        elTotal.innerText = `R$ 0,00 (Estoque Perfeito)`;
        elTotal.style.color = '#333';
    }
}

async function salvarConferenciaEstoque() {
    const promessas = [];
    
    listaInsumos.forEach(ins => {
        const input = document.getElementById(`conf-input-${ins.id}`);
        if (input && input.value !== '') {
            const novoEstoque = parseFloat(input.value.replace(',', '.')) || 0;
            if (novoEstoque !== Number(ins.estoque)) {
                // Envia a ordem cirúrgica de alteração para o banco
                promessas.push(
                    fetch(`${API_URL}/insumos/${ins.id}/sincronizar`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estoque: novoEstoque })
                    })
                );
            }
        }
    });

    if (promessas.length === 0) return alert("Nenhuma quantidade conferida foi preenchida ou alterada.");

    const btn = document.querySelector('button[onclick="salvarConferenciaEstoque()"]');
    const textoOriginal = btn.innerText;
    btn.innerText = '⏳ Sincronizando e zerando diferenças...';
    btn.disabled = true;

    try {
        await Promise.all(promessas);
        alert("✅ Estoque físico sincronizado com sucesso! Seu sistema agora reflete a realidade da geladeira.");
        await carregarInsumos();
        renderizarConferenciaEstoque(); // Zera e redesenha a tela atualizada
    } catch (e) {
        alert("❌ Falha de rede ao tentar sincronizar o estoque com o servidor.");
    } finally {
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
}

// 👇 NOVO: Função que puxa o texto digitado e manda renderizar
function filtrarInsumosCadastro() {
    const termo = document.getElementById('filtro-insumos-gestao').value;
    renderizarInsumosAdmin(termo);
}

function renderizarInsumosAdmin(filtro = '') {
    const container = document.getElementById('lista-insumos-gerenciador');
    container.innerHTML = '';
    
    // Limpa o texto da busca (ignora maiúsculas e acentos)
    const termo = filtro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Filtra a lista original pelo nome digitado
    let insumosFiltrados = listaInsumos.filter(ins => {
        const nome = ins.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nome.includes(termo);
    });

    // 👇 NOVO: Aplica a "tesoura" (limite) de itens na tela para manter a performance
    const selectLimite = document.getElementById('limite-insumos-gestao');
    if (selectLimite && selectLimite.value !== 'todos') {
        const quantidade = parseInt(selectLimite.value);
        insumosFiltrados = insumosFiltrados.slice(0, quantidade);
    }

    if(insumosFiltrados.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; padding: 15px;">Nenhuma matéria-prima encontrada com esse nome.</p>';
        return;
    }
    
    insumosFiltrados.forEach(ins => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:12px 10px; border-bottom:1px solid #eee; align-items: center;">
                <div style="flex: 1;">
                    <strong style="color: #333; font-size: 1.05rem;">${ins.nome}</strong>
                    <div style="font-size: 0.85rem; color: #666; margin-top: 4px;">
                        Em Estoque: <strong style="color: #00bcd4; font-size: 0.95rem;">${Number(ins.estoque || 0).toFixed(1)} ${ins.unidade}</strong><br>
                        Custo: R$ ${Number(ins.custo).toFixed(4)} por ${ins.unidade}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap: 10px;">
                    <button onclick="excluirInsumo(${ins.id})" style="border:none; background:none; color:#f44336; cursor:pointer; font-size: 1.3rem; padding: 5px;" title="Excluir">🗑️</button>
                </div>
            </div>
        `;
    });
}

async function salvarNovoInsumo() {
    const nome = document.getElementById('novo-insumo-nome').value.trim();
    const unidade = document.getElementById('novo-insumo-unidade').value;
    const qtd = parseFloat(document.getElementById('novo-insumo-qtd').value.replace(',', '.'));
    const valorTotal = parseFloat(document.getElementById('novo-insumo-valor').value.replace(',', '.'));
    
    if(!nome) return alert("⚠️ Preencha o nome do ingrediente!");
    if(isNaN(qtd) || qtd <= 0) return alert("⚠️ Preencha a quantidade que vem no pacote/embalagem!");
    if(isNaN(valorTotal) || valorTotal < 0) return alert("⚠️ Preencha o valor pago no pacote!");

    // 🧠 MÁGICA FINANCEIRA: Calcula o custo exato por grama/ml/unidade
    const custoUnitario = valorTotal / qtd;

    try {
        // Envia para o banco o custo unitário já calculado e a quantidade inicial para o estoque!
        await fetch(`${API_URL}/insumos`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ nome: nome, unidade: unidade, custo: custoUnitario, estoque: qtd })
        });
        
        document.getElementById('novo-insumo-nome').value = '';
        document.getElementById('novo-insumo-qtd').value = '';
        document.getElementById('novo-insumo-valor').value = '';
        
        await carregarInsumos();
        renderizarInsumosAdmin();
    } catch(e) { alert("Erro ao salvar insumo."); }
}

async function excluirInsumo(id) {
    if(!confirm("Tem certeza que deseja excluir esta matéria-prima?")) return;
    try {
        await fetch(`${API_URL}/insumos/${id}`, { method: 'DELETE' });
        await carregarInsumos();
        renderizarInsumosAdmin();
    } catch(e) { alert("Erro ao excluir insumo."); }
}

// ==========================================
// 🛒 MOTOR DO MODAL DE COMPRAS DE ESTOQUE
// ==========================================
function abrirModalLancamentoCompra() {
    const select = document.getElementById('compra-insumo-select');
    select.innerHTML = '<option value="" disabled selected>Escolha um item...</option>';
    
    // Lista os itens em ordem alfabética na caixinha de seleção
    const insumosOrdenados = [...listaInsumos].sort((a, b) => a.nome.localeCompare(b.nome));
    insumosOrdenados.forEach(ins => {
        select.innerHTML += `<option value="${ins.id}" data-unidade="${ins.unidade}">${ins.nome}</option>`;
    });

    // Limpa os campos da última vez que foi aberto
    document.getElementById('compra-qtd').value = '';
    document.getElementById('compra-valor').value = '';
    document.getElementById('compra-unidade-label').innerText = '';
    
    document.getElementById('modal-lancamento-compra').style.display = 'flex';
}

function fecharModalLancamentoCompra() {
    document.getElementById('modal-lancamento-compra').style.display = 'none';
}

// Mágica de UX: Atualiza o texto (g), (ml) ou (un) conforme a pessoa seleciona
function atualizarUnidadeCompra() {
    const select = document.getElementById('compra-insumo-select');
    const opcaoSelecionada = select.options[select.selectedIndex];
    const unidade = opcaoSelecionada.getAttribute('data-unidade');
    
    if (unidade) {
        document.getElementById('compra-unidade-label').innerText = `(em ${unidade})`;
    }
}

async function confirmarLancamentoCompra() {
    const select = document.getElementById('compra-insumo-select');
    const idInsumo = select.value;
    const qtdStr = document.getElementById('compra-qtd').value;
    const valorStr = document.getElementById('compra-valor').value;

    if (!idInsumo) return alert("⚠️ Selecione qual ingrediente você está comprando.");
    
    const qtd = parseFloat(qtdStr.replace(',', '.'));
    if (isNaN(qtd) || qtd <= 0) return alert("⚠️ Preencha uma quantidade válida maior que zero.");

    const valorTotal = parseFloat(valorStr.replace(',', '.'));
    if (isNaN(valorTotal) || valorTotal < 0) return alert("⚠️ Preencha o valor total pago na nota fiscal.");

    const btn = document.querySelector('#modal-lancamento-compra .btn-salvar');
    const txtOriginal = btn.innerText;
    btn.innerText = '⏳ Lançando...';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/insumos/${idInsumo}/abastecer`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ quantidade: qtd, valor_total: valorTotal })
        });
        
        if (res.ok) {
            alert(`✅ Nota Lançada! Estoque e custo atualizados na base de dados.`);
            fecharModalLancamentoCompra();
            await carregarTudo(); // 👇 NOVO: Puxa o cardápio novamente para a tela atualizar os custos
            await carregarInsumos();
            
            // Atualiza a tela de trás respeitando os filtros ativos
            const termo = document.getElementById('filtro-insumos-gestao') ? document.getElementById('filtro-insumos-gestao').value : '';
            renderizarInsumosAdmin(termo);
        } else {
            alert("❌ Erro ao atualizar o estoque no servidor.");
        }
    } catch(e) {
        alert("🔌 Erro de conexão com o banco de dados.");
    } finally {
        btn.innerText = txtOriginal;
        btn.disabled = false;
    }
}

// ----------------------------------------------------
// LÓGICA DE MONTAGEM DA FICHA TÉCNICA DINÂMICA
// ----------------------------------------------------
function abrirFichaTecnicaProduto() {
    abrirModalFichaGeral('produto', 'prod-insumos-json');
}

function abrirFichaTecnicaAdicional() {
    abrirModalFichaGeral('adicional', 'adic-insumos-json');
}

function abrirModalFichaGeral(origem, idInputJson) {
    document.getElementById('ficha-origem').value = origem;
    const jsonStr = document.getElementById(idInputJson).value || '[]';
    try { fichaTecnicaTemp = JSON.parse(jsonStr); } catch(e) { fichaTecnicaTemp = []; }
    
    const select = document.getElementById('ficha-select-insumo');
    select.innerHTML = '<option value="" disabled selected>Escolha o ingrediente...</option>';
    listaInsumos.forEach(ins => {
        select.innerHTML += `<option value="${ins.id}" data-custo="${ins.custo}" data-unid="${ins.unidade}">${ins.nome} (R$ ${Number(ins.custo).toFixed(4)} / ${ins.unidade})</option>`;
    });
    
    document.getElementById('modal-ficha-tecnica').style.display = 'flex';
    renderizarFichaTecnica();
}

function fecharFichaTecnica() {
    document.getElementById('modal-ficha-tecnica').style.display = 'none';
}

function adicionarInsumoNaFicha() {
    const select = document.getElementById('ficha-select-insumo');
    const qtdInput = document.getElementById('ficha-qtd-insumo');
    
    if(!select.value || !qtdInput.value) return alert("Selecione o insumo e digite a quantidade!");
    
    const idInsumo = parseInt(select.value);
    const qtd = parseFloat(qtdInput.value.replace(',', '.'));
    const nome = select.options[select.selectedIndex].text.split(' (')[0];
    const custoUn = parseFloat(select.options[select.selectedIndex].getAttribute('data-custo'));
    const unid = select.options[select.selectedIndex].getAttribute('data-unid');
    
    fichaTecnicaTemp.push({ id_insumo: idInsumo, nome, qtd, custo_unitario: custoUn, unidade: unid });
    qtdInput.value = '';
    renderizarFichaTecnica();
}

function removerInsumoFicha(index) {
    fichaTecnicaTemp.splice(index, 1);
    renderizarFichaTecnica();
}

function renderizarFichaTecnica() {
    const container = document.getElementById('lista-ficha-tecnica');
    container.innerHTML = '';
    let custoTotal = 0;
    
    if(fichaTecnicaTemp.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; font-size: 0.9rem; margin-top: 15px;">Receita vazia. Adicione os itens necessários acima.</p>';
    } else {
        fichaTecnicaTemp.forEach((item, index) => {
            const custoLinha = item.qtd * item.custo_unitario;
            custoTotal += custoLinha;
            container.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #ddd; background:#fff; margin-bottom:5px; border-radius:5px;">
                    <div style="font-size:0.95rem; color:#333;"><strong>${item.qtd}${item.unidade}</strong> de ${item.nome}</div>
                    <div style="color:#ab47bc; font-size:0.95rem; font-weight:bold;">R$ ${custoLinha.toFixed(2)} 
                        <button onclick="removerInsumoFicha(${index})" style="border:none; background:none; cursor:pointer; font-size:1rem; margin-left:10px;">❌</button>
                    </div>
                </div>
            `;
        });
    }
    document.getElementById('ficha-custo-total').innerText = custoTotal.toFixed(2).replace('.', ',');
}

function salvarFichaTecnica() {
    const origem = document.getElementById('ficha-origem').value;
    const jsonStr = JSON.stringify(fichaTecnicaTemp);
    
    let custoTotal = 0;
    fichaTecnicaTemp.forEach(i => custoTotal += (i.qtd * i.custo_unitario));
    
    if (origem === 'produto') {
        document.getElementById('prod-insumos-json').value = jsonStr;
        document.getElementById('prod-custo').value = custoTotal.toFixed(2);
        atualizarResumoInsumos('prod-resumo-insumos', jsonStr);
    } else {
        document.getElementById('adic-insumos-json').value = jsonStr;
        atualizarResumoInsumos('adic-resumo-insumos', jsonStr);
    }
    
    fecharFichaTecnica();
}

function atualizarResumoInsumos(idContainer, jsonStr) {
    const container = document.getElementById(idContainer);
    if(!container) return;
    try {
        const itens = JSON.parse(jsonStr);
        if(itens.length === 0) {
            container.innerHTML = 'Nenhum insumo atrelado.';
        } else {
            const nomes = itens.map(i => `${i.qtd}${i.unidade} ${i.nome}`).join(', ');
            container.innerHTML = `<strong style="color:#333;">Insumos:</strong> ${nomes}`;
        }
    } catch(e) {
        container.innerHTML = 'Nenhum insumo atrelado.';
    }
}