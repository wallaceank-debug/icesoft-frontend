const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let listaCategorias = [];
let arrastadoIndex = null;

window.onload = carregarCategorias;

async function carregarCategorias() {
    try {
        const res = await fetch(`${API_URL}/categorias`);
        listaCategorias = await res.json();
        renderizarCategorias();
    } catch (e) {
        document.getElementById('lista-categorias').innerHTML = '<p style="color:red; text-align:center;">Erro ao carregar do servidor.</p>';
    }
}

function renderizarCategorias() {
    const container = document.getElementById('lista-categorias');
    container.innerHTML = '';

    if (listaCategorias.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999;">Nenhuma categoria criada.</p>';
        return;
    }

    listaCategorias.forEach((cat, index) => {
        const isVisivel = cat.mostrar_cardapio !== false; 
        const seloApp = isVisivel 
            ? `<span style="background:#e0f7fa; color:#00838f; padding:3px 8px; border-radius:12px; font-size:0.7rem; font-weight:bold;">📱 App + PDV</span>`
            : `<span style="background:#ffebee; color:#c62828; padding:3px 8px; border-radius:12px; font-size:0.7rem; font-weight:bold;">🖥️ Só PDV</span>`;

        let seloAgenda = '';
        if (cat.hora_inicio || cat.hora_fim || cat.dias_semana) {
            seloAgenda = `<span style="color:#ff4081; font-size:0.75rem; font-weight:bold; display:inline-flex; align-items:center; gap:4px; margin-left:10px;"><span class="material-symbols-outlined" style="font-size:1rem;">schedule</span> Agendada</span>`;
        }

        container.innerHTML += `
            <div class="cat-card" draggable="true" ondragstart="dragStart(${index})" ondragover="dragOver(event)" ondrop="drop(${index})">
                <div style="display:flex; align-items:center; gap:12px; flex:1;">
                    <span class="material-symbols-outlined" style="color:#ccc; cursor:grab; font-size:1.8rem;" title="Arraste para reordenar">drag_indicator</span>
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <button type="button" onclick="moverCategoria(${index}, -1)" ${index === 0 ? 'disabled' : ''} style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; padding:0 6px; font-size:0.7rem; color:#334155; opacity:${index === 0 ? '0.35' : '1'};" title="Subir">▲</button>
                        <button type="button" onclick="moverCategoria(${index}, 1)" ${index === listaCategorias.length - 1 ? 'disabled' : ''} style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; padding:0 6px; font-size:0.7rem; color:#334155; opacity:${index === listaCategorias.length - 1 ? '0.35' : '1'};" title="Descer">▼</button>
                    </div>
                    <div>
                        <strong style="color:#333; font-size:1.1rem; display:block; margin-bottom:3px;">${cat.nome}</strong>
                        <div>${seloApp} ${seloAgenda}</div>
                    </div>
                </div>
                
                <div style="display:flex; align-items:center; gap:20px;">
                    <label class="switch" title="Ativar/Desativar no App">
                        <input type="checkbox" onchange="toggleVisibilidade(${cat.id}, this.checked)" ${isVisivel ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button onclick="abrirModalCategoria(${cat.id})" style="background:none; border:none; color:#00bcd4; cursor:pointer; padding:5px; transition:0.2s;" title="Editar"><span class="material-symbols-outlined">edit</span></button>
                    <button onclick="excluirCategoria(${cat.id})" style="background:none; border:none; color:#f44336; cursor:pointer; padding:5px; transition:0.2s;" title="Excluir"><span class="material-symbols-outlined">delete</span></button>
                </div>
            </div>
        `;
    });
}

// ==========================================
// MÁGICA DA EDIÇÃO E CRIAÇÃO
// ==========================================
function abrirModalCategoria(id = null) {
    document.querySelectorAll('.btn-dia').forEach(b => b.classList.remove('ativo'));

    if (id) {
        const cat = listaCategorias.find(c => c.id === id);
        document.getElementById('texto-titulo').innerText = 'Editar Categoria';
        document.getElementById('cat-id').value = cat.id;
        document.getElementById('cat-nome').value = cat.nome;
        document.getElementById('cat-mostrar').checked = cat.mostrar_cardapio !== false;
        document.getElementById('cat-hora-inicio').value = cat.hora_inicio || '';
        document.getElementById('cat-hora-fim').value = cat.hora_fim || '';

        if (cat.dias_semana) {
            cat.dias_semana.split(',').forEach(dia => {
                const btn = document.querySelector(`.btn-dia[data-dia="${dia}"]`);
                if(btn) btn.classList.add('ativo');
            });
        }
    } else {
        document.getElementById('texto-titulo').innerText = 'Nova Categoria';
        document.getElementById('cat-id').value = '';
        document.getElementById('cat-nome').value = '';
        document.getElementById('cat-mostrar').checked = true;
        document.getElementById('cat-hora-inicio').value = '';
        document.getElementById('cat-hora-fim').value = '';
    }

    document.getElementById('modal-categoria').style.display = 'flex';
}

function fecharModalCategoria() {
    document.getElementById('modal-categoria').style.display = 'none';
}

async function salvarCategoria() {
    const id = document.getElementById('cat-id').value;
    const nome = document.getElementById('cat-nome').value.trim();
    const mostrar = document.getElementById('cat-mostrar').checked;
    
    // Puxa os dias que a atendente marcou (que agora funcionam pelo onclick direto!)
    const dias = Array.from(document.querySelectorAll('.btn-dia.ativo')).map(b => b.getAttribute('data-dia')).join(',');
    const horaInicio = document.getElementById('cat-hora-inicio').value;
    const horaFim = document.getElementById('cat-hora-fim').value;

    if (!nome) return alert("O nome da categoria é obrigatório!");

    const btn = document.getElementById('btn-salvar-cat');
    btn.innerText = '⏳ Salvando...';
    btn.disabled = true;

    const payload = { 
        nome, mostrar_cardapio: mostrar, dias_semana: dias, hora_inicio: horaInicio, hora_fim: horaFim 
    };

    try {
        if (id) {
            // Edita existente
            await fetch(`${API_URL}/categorias/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
        } else {
            // Cria nova
            payload.ordem = listaCategorias.length + 1;
            await fetch(`${API_URL}/categorias`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
        }
        fecharModalCategoria();
        carregarCategorias();
    } catch (e) {
        alert("Erro de conexão ao salvar.");
    } finally {
        btn.innerText = '💾 Salvar';
        btn.disabled = false;
    }
}

async function excluirCategoria(id) {
    if(!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    try {
        await fetch(`${API_URL}/categorias/${id}`, { method: 'DELETE' });
        carregarCategorias();
    } catch (e) {
        alert("Erro ao excluir.");
    }
}

async function toggleVisibilidade(id, status) {
    try {
        await fetch(`${API_URL}/categorias/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mostrar_cardapio: status })
        });
        carregarCategorias();
    } catch (e) {
        alert("Erro ao alterar visibilidade.");
    }
}

// ==========================================
// REORDENAÇÃO (ARRASTAR E SOLTAR + SETAS ▲ ▼)
// ==========================================
function dragStart(index) { arrastadoIndex = index; }
function dragOver(e) { e.preventDefault(); }

function mostrarAvisoOrdem(texto, corFundo = '#0f172a') {
    let aviso = document.getElementById('aviso-ordem-cat');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.id = 'aviso-ordem-cat';
        aviso.style.cssText = 'position:fixed; bottom:24px; right:24px; color:#fff; padding:12px 18px; border-radius:10px; font-weight:700; font-size:0.9rem; z-index:9999; box-shadow:0 8px 20px rgba(0,0,0,0.25); transition:opacity 0.3s;';
        document.body.appendChild(aviso);
    }
    aviso.style.background = corFundo;
    aviso.style.opacity = '1';
    aviso.innerText = texto;
}

async function salvarNovaOrdemNoServidor() {
    const novaOrdem = listaCategorias.map((cat, i) => ({ id: cat.id, ordem: i + 1 }));
    mostrarAvisoOrdem('⏳ Salvando nova ordem...', '#0284c7');

    try {
        const res = await fetch(`${API_URL}/categorias/ordem`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaOrdem)
        });

        if (!res.ok) throw new Error('Falha ao gravar no banco');

        mostrarAvisoOrdem('✅ Ordem salva no cardápio!', '#16a34a');
        setTimeout(() => {
            const aviso = document.getElementById('aviso-ordem-cat');
            if (aviso) aviso.style.opacity = '0';
        }, 2200);
    } catch (e) {
        mostrarAvisoOrdem('❌ Erro ao salvar ordem!', '#dc2626');
        alert("⚠️ Não foi possível salvar a nova ordem no servidor. A lista será recarregada.");
        await carregarCategorias();
    }
}

async function moverCategoria(indexAtual, direcao) {
    const novoIndex = indexAtual + direcao;
    if (novoIndex < 0 || novoIndex >= listaCategorias.length) return;

    const item = listaCategorias.splice(indexAtual, 1)[0];
    listaCategorias.splice(novoIndex, 0, item);
    renderizarCategorias();
    await salvarNovaOrdemNoServidor();
}

async function drop(indexDestino) {
    if (arrastadoIndex === null || arrastadoIndex === indexDestino) return;

    const item = listaCategorias.splice(arrastadoIndex, 1)[0];
    listaCategorias.splice(indexDestino, 0, item);
    renderizarCategorias();
    arrastadoIndex = null;

    await salvarNovaOrdemNoServidor();
}