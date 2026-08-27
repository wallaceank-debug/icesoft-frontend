const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let produtosGlobais = []; 
let cuponsSalvos = []; 
let bannersSalvos = [];

window.onload = async () => {
    await carregarProdutos(); 
    await carregarConfiguracoes(); 
    atualizarBadgeMesasGlobal();
};

async function carregarProdutos() {
    try {
        const res = await fetch(`${API_URL}/produtos`);
        const produtos = await res.json();
        produtosGlobais = produtos.filter(p => p.ativo !== false);
    } catch (e) {
        console.error("Erro ao carregar cardápio:", e);
    }
}

async function carregarConfiguracoes() {
    try {
        const res = await fetch(`${API_URL}/configuracoes`);
        const configs = await res.json();
        
        // Card 1
        if (configs.nome_loja) document.getElementById('config-nome').value = configs.nome_loja;
        if (configs.cor_primaria) document.getElementById('config-cor').value = configs.cor_primaria;
        if (configs.mensagem_boas_vindas) document.getElementById('config-mensagem').value = configs.mensagem_boas_vindas;
        if (configs.endereco_loja) document.getElementById('config-endereco').value = configs.endereco_loja;
        if (configs.horarios_loja) document.getElementById('config-horarios').value = configs.horarios_loja;
        if (configs.pagamentos_loja) document.getElementById('config-pagamentos').value = configs.pagamentos_loja;
        if (configs.pedido_minimo_delivery) document.getElementById('config-pedido-minimo').value = configs.pedido_minimo_delivery;
        
        // 🖼️ Puxa as Imagens Salvas para mostrar no Preview
        if (configs.banner_loja) document.getElementById('preview-img-banner').src = configs.banner_loja;
        if (configs.logo_loja) document.getElementById('preview-img-logo').src = configs.logo_loja;

        // Card 2
        if (document.getElementById('input-titulo-destaques')) {
            document.getElementById('input-titulo-destaques').value = configs.titulo_carrossel_destaques || 'Destaques da Casa';
        }
        
        let destaquesSalvos = [];
        if (configs.carrossel_destaques) {
            try { destaquesSalvos = JSON.parse(configs.carrossel_destaques); } catch(e) {}
        }
        renderizarListaDestaques(destaquesSalvos);

        // Card 3
        if (configs.cupons_delivery) {
            try { cuponsSalvos = JSON.parse(configs.cupons_delivery); } catch(e) {}
        }
        renderizarListaCupons();

        // Card 4 (UPSELL NO CHECKOUT)
        if (configs.upsell_desconto) document.getElementById('config-upsell-desconto').value = configs.upsell_desconto;
        let upsellSalvos = [];
        if (configs.carrossel_upsell) {
            try { upsellSalvos = JSON.parse(configs.carrossel_upsell); } catch(e) {}
        }
        renderizarListaUpsell(upsellSalvos);

        // 👇 NOVO: Carrega Banners e Recompensas
        if (configs.banners_promocionais) {
            try { bannersSalvos = JSON.parse(configs.banners_promocionais); } catch(e) {}
        }
        renderizarListaBanners();

        let recompensasSalvas = [];
        if (configs.carrossel_recompensas) {
            try { recompensasSalvas = JSON.parse(configs.carrossel_recompensas); } catch(e) {}
        }
        renderizarListaRecompensas(recompensasSalvas);

        // Puxa a escala de horários salva (AGORA DENTRO DO TRY)
        if (configs.horarios_funcionamento_auto) {
            try {
                const horarios = JSON.parse(configs.horarios_funcionamento_auto);
                for (let i = 0; i <= 6; i++) {
                    if (horarios[i]) {
                        document.getElementById(`chk-dia-${i}`).checked = horarios[i].ativo;
                        document.getElementById(`abre-dia-${i}`).value = horarios[i].abre;
                        document.getElementById(`fecha-dia-${i}`).value = horarios[i].fecha;
                    }
                }
            } catch(e) {}
        }

        // Puxa o SLA de Tempo de Entrega (Card novo)
        if (configs.tempo_entrega) {
            marcarBotaoTempo(parseInt(configs.tempo_entrega));
        } else {
            marcarBotaoTempo(45); // Se não tiver nada salvo, marca 45 min
        }

    } catch (e) {
        console.error("Erro ao carregar configurações:", e);
    }
}

// === FUNÇÕES DO CARD 1 (AGORA COM UPLOAD DE IMAGEM) ===
async function salvarPersonalizacao() {
    const btn = document.getElementById('btn-salvar-aparencia');
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Fazendo Upload...";
    btn.style.backgroundColor = "#FF9800"; 
    btn.disabled = true;

    const payload = {
        nome_loja: document.getElementById('config-nome').value,
        cor_primaria: document.getElementById('config-cor').value,
        mensagem_boas_vindas: document.getElementById('config-mensagem').value
    };

    try {
        const baseUrl = API_URL.replace('/api', '');

        // 1. UPLOAD DO BANNER (Se o usuário selecionou algum arquivo)
        const inputBanner = document.getElementById('arquivo-banner');
        if (inputBanner.files && inputBanner.files.length > 0) {
            const formDataBanner = new FormData();
            formDataBanner.append('imagem', inputBanner.files[0]);
            const resBanner = await fetch(`${API_URL}/upload`, { method: 'POST', body: formDataBanner });
            const dataBanner = await resBanner.json();
            if (dataBanner.sucesso) {
                payload.banner_loja = baseUrl + dataBanner.url;
            } else {
                alert("Erro no upload do Banner.");
            }
        }

        // 2. UPLOAD DA LOGO (Se o usuário selecionou algum arquivo)
        const inputLogo = document.getElementById('arquivo-logo');
        if (inputLogo.files && inputLogo.files.length > 0) {
            const formDataLogo = new FormData();
            formDataLogo.append('imagem', inputLogo.files[0]);
            const resLogo = await fetch(`${API_URL}/upload`, { method: 'POST', body: formDataLogo });
            const dataLogo = await resLogo.json();
            if (dataLogo.sucesso) {
                payload.logo_loja = baseUrl + dataLogo.url;
            } else {
                alert("Erro no upload da Logo.");
            }
        }

        btn.innerText = "Salvando Configurações...";
        
        // 3. Envia os links e as cores pro servidor de configurações
        await enviarParaNuvem(payload, btn, textoOriginal, "#4CAF50");

        // Limpa os campos de arquivo para não fazer upload duplo se clicar de novo sem querer
        inputBanner.value = '';
        inputLogo.value = '';

    } catch(e) {
        alert("Erro de comunicação ao salvar imagens.");
        btn.innerText = textoOriginal;
        btn.style.backgroundColor = "#4CAF50";
    } finally {
        btn.disabled = false;
    }
}

// === FUNÇÕES DO CARD 2 (CARROSSEL COM ORDENAÇÃO) ===

// 1. Variável global para guardar a ordem exata na memória
let carrosselAtual = []; 

function renderizarListaDestaques(destaquesSalvos = null) {
    const container = document.getElementById('lista-produtos-destaque');
    container.innerHTML = '';
    
    if (produtosGlobais.length === 0) {
        return container.innerHTML = '<p style="color:#888; text-align:center;">Nenhum produto cadastrado.</p>';
    }

    // Se estivermos carregando do banco de dados na primeira vez
    if (destaquesSalvos !== null) {
        carrosselAtual = destaquesSalvos;
    }

    // 2. Separa os produtos: Os que estão no carrossel (na ordem salva) e os que não estão
    let selecionados = [];
    carrosselAtual.forEach(idSalvo => {
        const p = produtosGlobais.find(prod => Number(prod.id) === Number(idSalvo));
        if (p) selecionados.push(p);
    });

    let naoSelecionados = produtosGlobais.filter(p => !carrosselAtual.includes(Number(p.id)));

    // 3. Renderiza os SELECIONADOS no topo (Com fundo azul e botão de arrastar ☰)
    selecionados.forEach((p, index) => {
        container.innerHTML += `
            <label class="item-linha" draggable="true" ondragstart="dragStartDestaque(${index})" ondragover="dragOverDestaque(event)" ondrop="dropDestaque(${index})" style="display:flex; align-items:center; gap:10px; padding:10px; background:#e0f7fa; border-radius:5px; border:1px solid #00bcd4; cursor:grab; margin-bottom: 5px; transition: 0.2s;">
                <span style="color: #00bcd4; font-size: 1.2rem; cursor: grab; padding-right: 5px;" title="Arraste para reordenar">☰</span>
                <input type="checkbox" class="chk-destaque" value="${p.id}" checked onchange="toggleDestaque(${p.id}, this.checked)" style="width:20px; height:20px; accent-color:#FF9800; cursor: pointer;">
                <span style="font-weight:600; color:#00838f;">${p.nome}</span>
                <span style="margin-left:auto; color:#25D366; font-weight:bold;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</span>
            </label>
        `;
    });

    // 4. Renderiza os NÃO SELECIONADOS em baixo (Brancos e normais)
    naoSelecionados.forEach(p => {
        container.innerHTML += `
            <label style="display:flex; align-items:center; gap:10px; padding:10px; background:white; border-radius:5px; border:1px solid #ddd; cursor:pointer; margin-bottom: 5px; transition: 0.2s;">
                <span style="color: transparent; font-size: 1.2rem; width: 1.2rem; display:inline-block; padding-right: 5px;"></span>
                <input type="checkbox" class="chk-destaque" value="${p.id}" onchange="toggleDestaque(${p.id}, this.checked)" style="width:20px; height:20px; accent-color:#FF9800; cursor: pointer;">
                <span style="font-weight:600; color:#333;">${p.nome}</span>
                <span style="margin-left:auto; color:#25D366; font-weight:bold;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</span>
            </label>
        `;
    });
}

// 5. Função que joga o produto pra cima (selecionado) ou pra baixo (desmarcado) na hora do clique
function toggleDestaque(idProduto, isChecked) {
    const idNum = Number(idProduto);
    if (isChecked) {
        if (!carrosselAtual.includes(idNum)) carrosselAtual.push(idNum);
    } else {
        carrosselAtual = carrosselAtual.filter(id => id !== idNum);
    }
    renderizarListaDestaques(); // Atualiza a tela instantaneamente
}

// ==========================================
// INTELIGÊNCIA DE ARRASTAR E SOLTAR (☰)
// ==========================================
let arrastadoDestaqueIndex = null;

function dragStartDestaque(index) {
    arrastadoDestaqueIndex = index;
}

function dragOverDestaque(event) {
    event.preventDefault(); // Permite que o item "caia" aqui
}

function dropDestaque(indexDestino) {
    if (arrastadoDestaqueIndex === null || arrastadoDestaqueIndex === indexDestino) return;

    // Remove o item da posição antiga e encaixa na nova
    const itemArrastadoId = carrosselAtual.splice(arrastadoDestaqueIndex, 1)[0];
    carrosselAtual.splice(indexDestino, 0, itemArrastadoId);

    // Atualiza a tela com a nova ordem
    renderizarListaDestaques();
}

// 6. Função de salvar super otimizada
async function salvarDestaques() {
    const btn = document.getElementById('btn-salvar-destaques');
    const textoOriginal = btn.innerText;
    btn.innerText = "Salvando...";
    btn.style.backgroundColor = "#888";

    // Pega o título personalizado
    const novoTitulo = document.getElementById('input-titulo-destaques') ? document.getElementById('input-titulo-destaques').value.trim() || 'Destaques da Casa' : 'Destaques da Casa';

    // Salva a lista na exata ordem que o cliente montou (que está gravada no carrosselAtual)
    enviarParaNuvem({ 
        carrossel_destaques: JSON.stringify(carrosselAtual),
        titulo_carrossel_destaques: novoTitulo
    }, btn, textoOriginal, "#FF9800");
}

async function salvarDestaques() {
    const btn = document.getElementById('btn-salvar-destaques');
    const textoOriginal = btn.innerText;
    btn.innerText = "Salvando...";
    btn.style.backgroundColor = "#888";

    const checkboxes = document.querySelectorAll('.chk-destaque:checked');
    const idsSelecionados = Array.from(checkboxes).map(chk => Number(chk.value));

    // 1. Pega o texto que você digitou (se deixar em branco, ele salva o padrão)
    const novoTitulo = document.getElementById('input-titulo-destaques') ? document.getElementById('input-titulo-destaques').value.trim() || 'Destaques da Casa' : 'Destaques da Casa';

    // 2. Envia os dois juntos na mesma viagem para a nuvem
    enviarParaNuvem({ 
        carrossel_destaques: JSON.stringify(idsSelecionados),
        titulo_carrossel_destaques: novoTitulo
    }, btn, textoOriginal, "#FF9800");
}

// === FUNÇÕES DO CARD 3 (CUPONS AVANÇADOS) ===
function abrirModalCupom(index = null) {
    if (index !== null) {
        const c = cuponsSalvos[index];
        document.getElementById('titulo-modal-cupom').innerText = `Editar Cupom: ${c.codigo}`;
        document.getElementById('cupom-index').value = index;
        document.getElementById('cupom-codigo').value = c.codigo;
        document.getElementById('cupom-tipo').value = c.tipo;
        document.getElementById('cupom-valor').value = c.valor;
        document.getElementById('cupom-minimo').value = c.minimo || 0; 
        document.getElementById('cupom-validade').value = c.validade || '';
        document.getElementById('cupom-limite').value = c.limite || 0;
        document.getElementById('cupom-publico').value = c.publico || 'todos';
        // 👉 NOVO: Puxa se ele era destaque ou não
        document.getElementById('cupom-destaque').checked = c.destaque_rodape || false;
    } else {
        document.getElementById('titulo-modal-cupom').innerText = `Criar Novo Cupom`;
        document.getElementById('cupom-index').value = '';
        document.getElementById('cupom-codigo').value = '';
        document.getElementById('cupom-tipo').value = 'porcentagem';
        document.getElementById('cupom-valor').value = '';
        document.getElementById('cupom-minimo').value = 0; 
        document.getElementById('cupom-validade').value = '';
        document.getElementById('cupom-limite').value = 0;
        document.getElementById('cupom-publico').value = 'todos';
        // 👉 NOVO: Começa desmarcado
        document.getElementById('cupom-destaque').checked = false;
    }
    document.getElementById('modal-cupom').style.display = 'flex';
}

function fecharModalCupom() {
    document.getElementById('modal-cupom').style.display = 'none';
}

function salvarCupomModal() {
    const index = document.getElementById('cupom-index').value;
    const codigo = document.getElementById('cupom-codigo').value.trim().toUpperCase();
    const tipo = document.getElementById('cupom-tipo').value;
    const valor = parseFloat(document.getElementById('cupom-valor').value);
    const minimo = parseFloat(document.getElementById('cupom-minimo').value) || 0; 
    const validade = document.getElementById('cupom-validade').value;
    const limite = parseInt(document.getElementById('cupom-limite').value) || 0;
    const publico = document.getElementById('cupom-publico').value;
    
    // 👉 NOVO: Captura o botão de destaque
    const destaque_rodape = document.getElementById('cupom-destaque').checked;

    if (!codigo || isNaN(valor) || valor <= 0) return alert("⚠️ Preencha o código e um valor de desconto válido!");
    
    const indexExistente = cuponsSalvos.findIndex(c => c.codigo === codigo);
    if (indexExistente !== -1 && indexExistente !== Number(index) && index === "") {
        return alert("⚠️ Este código já está em uso!");
    }

    // 👉 NOVO: Se esse for o escolhido, tira a coroa dos outros para não quebrar o cardápio
    if (destaque_rodape) {
        cuponsSalvos.forEach(c => c.destaque_rodape = false);
    }

    const cupomData = {
        codigo, tipo, valor, minimo, validade, limite, publico, destaque_rodape, // 👉 Adicionado aqui
        usos_atuais: 0, 
        receita_gerada: 0
    };

    if (index !== "") {
        cupomData.usos_atuais = cuponsSalvos[index].usos_atuais || 0;
        cupomData.receita_gerada = cuponsSalvos[index].receita_gerada || 0;
        cuponsSalvos[index] = cupomData;
    } else {
        cuponsSalvos.push(cupomData);
    }

    fecharModalCupom();
    salvarCuponsNuvem();
}

function renderizarListaCupons() {
    const container = document.getElementById('lista-cupons');
    container.innerHTML = '';
    if (cuponsSalvos.length === 0) return container.innerHTML = '<p style="color:#888; text-align:center; font-size: 0.9rem;">Nenhum cupom ativo no momento.</p>';

    cuponsSalvos.forEach((cupom, index) => {
        const valorExibicao = cupom.tipo === 'porcentagem' ? `${cupom.valor}%` : `R$ ${Number(cupom.valor).toFixed(2).replace('.', ',')}`;
        
        let infoExtra = '';
        // 🛒 Mostra a nova regra na tela
        if (cupom.minimo > 0) infoExtra += `🛒 Compras a partir de: R$ ${Number(cupom.minimo).toFixed(2).replace('.', ',')} <br>`;
        
        if (cupom.validade) {
            const dataParts = cupom.validade.split('-');
            infoExtra += `⏳ Até: ${dataParts[2]}/${dataParts[1]}/${dataParts[0]} &nbsp;|&nbsp; `;
        } else {
            infoExtra += `⏳ Sem validade &nbsp;|&nbsp; `;
        }

        if (cupom.limite > 0) infoExtra += `🎯 Usos: ${cupom.usos_atuais || 0} de ${cupom.limite} &nbsp;|&nbsp; `;
        else infoExtra += `🎯 Usos: ${cupom.usos_atuais || 0} (Ilimitado) &nbsp;|&nbsp; `;

        let descPublico = cupom.publico === 'novos' ? 'Só Clientes Novos' : 
                          cupom.publico === 'recorrentes' ? 'Só Recorrentes' : 
                          cupom.publico === 'unico' ? '1 Uso por Cliente' : 
                          'Todos os Clientes (Livres)';
        infoExtra += `👤 ${descPublico}`;

        // 👉 INJETE ESTA VALIDAÇÃO AQUI
        if (cupom.destaque_rodape) {
            infoExtra += `<span style="display:inline-block; margin-top:8px; color:#d84315; font-weight:bold; background:#fff3e0; padding:2px 8px; border-radius:4px;">⭐ Destaque na Barra do Cliente</span>`;
        }

        container.innerHTML += `
            <div style="background:#fdfdfd; border:1px solid #e1bee7; border-radius:10px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 2px 5px rgba(0,0,0,0.02); flex-shrink: 0;">
                
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background: white; border-bottom: 1px dashed #e1bee7;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <strong style="color:#8e24aa; font-size: 1.2rem; letter-spacing: 1px;">${cupom.codigo}</strong> 
                        <span style="background: #9c27b0; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; color: white;">- ${valorExibicao}</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="abrirModalCupom(${index})" style="background:#e3f2fd; border:none; color:#1976d2; border-radius: 6px; padding: 8px; cursor:pointer; font-size: 1rem; transition: 0.2s;" title="Editar Regras">✏️</button>
                        <button onclick="removerCupom(${index})" style="background:#ffebee; border:none; color:#d32f2f; border-radius: 6px; padding: 8px; cursor:pointer; font-size: 1rem; transition: 0.2s;" title="Apagar Definitivamente">🗑️</button>
                    </div>
                </div>

                <div style="padding: 10px 15px; font-size: 0.8rem; color: #555; font-weight: 500; line-height: 1.4;">
                    ${infoExtra}
                </div>

                <div style="padding: 10px 15px; background: #e8f5e9; font-size: 0.9rem; color: #2e7d32; font-weight: bold; border-top: 1px solid #c8e6c9;">
                    💰 Ganhos com este cupom: R$ ${Number(cupom.receita_gerada || 0).toFixed(2).replace('.', ',')}
                </div>
            </div>
        `;
    });
}

function removerCupom(index) {
    if(confirm(`Tem certeza que deseja apagar o cupom ${cuponsSalvos[index].codigo}? Os clientes não conseguirão mais usá-lo.`)) { 
        cuponsSalvos.splice(index, 1); 
        salvarCuponsNuvem(); 
    }
}

async function salvarCuponsNuvem() {
    renderizarListaCupons();
    try {
        await fetch(`${API_URL}/configuracoes`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ cupons_delivery: JSON.stringify(cuponsSalvos) }) 
        });
    } catch (e) {
        console.error("Falha silenciosa ao salvar cupom na nuvem", e);
    }
}

// === FUNÇÕES DO CARD 4 (UPSELL) ===
function renderizarListaUpsell(upsellSalvos) {
    const container = document.getElementById('lista-produtos-upsell');
    container.innerHTML = '';
    if (produtosGlobais.length === 0) return container.innerHTML = '<p style="color:#888; text-align:center;">Nenhum produto cadastrado.</p>';

    produtosGlobais.forEach(p => {
        const isChecked = upsellSalvos.includes(Number(p.id)) ? 'checked' : '';
        container.innerHTML += `
            <label style="display:flex; align-items:center; gap:10px; padding:10px; background:white; border-radius:5px; border:1px solid #ddd; cursor:pointer; flex-shrink: 0;">
                <input type="checkbox" class="chk-upsell" value="${p.id}" ${isChecked} style="width:20px; height:20px; accent-color:#e91e63; cursor: pointer;">
                <span style="font-weight:600; color:#333;">${p.nome}</span>
                <span style="margin-left:auto; color:#25D366; font-weight:bold;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</span>
            </label>
        `;
    });
}
async function salvarUpsell() {
    const btn = document.getElementById('btn-salvar-upsell');
    const textoOriginal = btn.innerText;
    btn.innerText = "Salvando..."; btn.style.backgroundColor = "#888";
    
    const desconto = document.getElementById('config-upsell-desconto').value;
    const checkboxes = document.querySelectorAll('.chk-upsell:checked');
    const idsSelecionados = Array.from(checkboxes).map(chk => Number(chk.value));

    enviarParaNuvem({ upsell_desconto: desconto || 0, carrossel_upsell: JSON.stringify(idsSelecionados) }, btn, textoOriginal, "#e91e63");
}

// === FUNÇÃO DE ENVIO UNIVERSAL ===
async function enviarParaNuvem(payload, botao, textoOriginal, corOriginal) {
    try {
        const res = await fetch(`${API_URL}/configuracoes`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) {
            botao.style.backgroundColor = "#25D366"; botao.innerText = "✅ Salvo com sucesso!";
            setTimeout(() => { botao.style.backgroundColor = corOriginal; botao.innerText = textoOriginal; }, 3000);
        } else { alert("Erro ao salvar."); botao.innerText = textoOriginal; botao.style.backgroundColor = corOriginal; }
    } catch (e) { alert("Erro de conexão."); botao.innerText = textoOriginal; botao.style.backgroundColor = corOriginal; }
}

async function salvarInformacoesLoja() {
    const btn = document.getElementById('btn-salvar-infos');
    const textoOriginal = btn.innerText;
    btn.innerText = "Salvando...";
    btn.style.backgroundColor = "#888";

    const payload = {
        endereco_loja: document.getElementById('config-endereco').value,
        horarios_loja: document.getElementById('config-horarios').value,
        pagamentos_loja: document.getElementById('config-pagamentos').value,
        pedido_minimo_delivery: parseFloat(document.getElementById('config-pedido-minimo').value) || 0
    };

    enviarParaNuvem(payload, btn, textoOriginal, "#2196F3");
}

async function salvarHorariosLoja() {
    const btn = document.getElementById('btn-salvar-horarios');
    const textoOriginal = btn.innerText;
    btn.innerText = "Salvando...";
    
    const horarios = {};
    for (let i = 0; i <= 6; i++) {
        horarios[i] = {
            ativo: document.getElementById(`chk-dia-${i}`).checked,
            abre: document.getElementById(`abre-dia-${i}`).value,
            fecha: document.getElementById(`fecha-dia-${i}`).value
        };
    }
    
    enviarParaNuvem({ horarios_funcionamento_auto: JSON.stringify(horarios) }, btn, textoOriginal, "#FF9800");
}

// ==========================================
// ⏱️ CONTROLE DO TEMPO DE ENTREGA (SLA)
// ==========================================
function marcarBotaoTempo(tempo) {
    document.querySelectorAll('.btn-tempo').forEach(btn => {
        btn.classList.remove('ativo'); // Apaga todos
        if (parseInt(btn.getAttribute('data-tempo')) === tempo) {
            btn.classList.add('ativo'); // Acende só o escolhido
        }
    });
}

async function salvarTempoEntrega(tempo, botaoClicado) {
    // Já acende o botão na mesma hora para o usuário sentir que funcionou
    marcarBotaoTempo(tempo);
    const textoOriginal = botaoClicado.innerText;
    botaoClicado.innerText = "⏳"; // Dá um feedback visual de carregando
    
    try {
        await fetch(`${API_URL}/configuracoes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempo_entrega: tempo })
        });
        botaoClicado.innerText = "✅";
        setTimeout(() => { botaoClicado.innerText = textoOriginal; }, 2000);
    } catch (e) {
        alert("Erro ao salvar o tempo.");
        botaoClicado.innerText = textoOriginal;
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
// 🖼️ MOTOR DOS BANNERS PROMOCIONAIS
// ==========================================
function renderizarListaBanners() {
    const container = document.getElementById('lista-banners-ativos');
    if(!container) return;
    container.innerHTML = '';
    
    if(bannersSalvos.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center; font-size:0.9rem;">Nenhum banner ativo no momento.</p>';
        return;
    }
    
    bannersSalvos.forEach((url, index) => {
        container.innerHTML += `
            <div style="position:relative; border-radius:8px; overflow:hidden; border:2px solid #b2ebf2; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <img src="${url}" style="width:100%; height:110px; object-fit:cover; display:block;">
                <button onclick="removerBanner(${index})" style="position:absolute; top:8px; right:8px; background:#f44336; color:white; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; font-weight:bold; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">X</button>
            </div>
        `;
    });
}

function removerBanner(index) {
    if(confirm("Remover este banner?")) {
        bannersSalvos.splice(index, 1);
        renderizarListaBanners();
    }
}

async function adicionarBannerPromocional() {
    const inputBanner = document.getElementById('arquivo-novo-banner');
    if (!inputBanner.files || inputBanner.files.length === 0) return alert("Selecione uma imagem primeiro!");
    
    const btn = document.querySelector('button[onclick="adicionarBannerPromocional()"]');
    const textoAntigo = btn.innerText;
    btn.innerText = "⏳ Enviando Foto..."; btn.disabled = true;

    const formData = new FormData();
    formData.append('imagem', inputBanner.files[0]);

    try {
        const baseUrl = API_URL.replace('/api', '');
        const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.sucesso) {
            bannersSalvos.push(baseUrl + data.url);
            renderizarListaBanners();
            inputBanner.value = ''; // Limpa o campo
        } else {
            alert("Erro no upload do Banner.");
        }
    } catch(e) {
        alert("Erro de conexão ao enviar imagem.");
    } finally {
        btn.innerText = textoAntigo; btn.disabled = false;
    }
}

async function salvarBannersPromocionais() {
    const btn = document.getElementById('btn-salvar-banners');
    const textoOriginal = btn.innerText;
    btn.innerText = "Salvando..."; btn.style.backgroundColor = "#888";
    enviarParaNuvem({ banners_promocionais: JSON.stringify(bannersSalvos) }, btn, textoOriginal, "#00838f");
}

// ==========================================
// 🎁 MOTOR DO CARROSSEL DE RECOMPENSAS
// ==========================================
function renderizarListaRecompensas(recompensasSalvas) {
    const container = document.getElementById('lista-produtos-recompensas');
    if(!container) return;
    container.innerHTML = '';
    
    // Só mostra produtos que tenham pontos configurados para resgate!
    const produtosComPontos = produtosGlobais.filter(p => p.pontos_resgate > 0);
    
    if (produtosComPontos.length === 0) {
        return container.innerHTML = '<p style="color:#888; text-align:center; font-size: 0.9rem;">Nenhum produto configurado para resgate. Vá em "Gestão de Cardápio" e configure os pontos nos produtos primeiro.</p>';
    }

    produtosComPontos.forEach(p => {
        const isChecked = recompensasSalvas.includes(Number(p.id)) ? 'checked' : '';
        let txtExtra = p.resgate_dinheiro > 0 ? ` + R$ ${Number(p.resgate_dinheiro).toFixed(2).replace('.', ',')}` : '';
        
        container.innerHTML += `
            <label style="display:flex; align-items:center; gap:10px; padding:10px; background:white; border-radius:5px; border:1px solid #ddd; cursor:pointer; flex-shrink: 0;">
                <input type="checkbox" class="chk-recompensa" value="${p.id}" ${isChecked} style="width:20px; height:20px; accent-color:#f57f17; cursor: pointer;">
                <span style="font-weight:600; color:#333; flex: 1;">${p.nome}</span>
                <span style="color:#f57f17; font-weight:bold; font-size: 0.9rem;">${p.pontos_resgate} pts${txtExtra}</span>
            </label>
        `;
    });
}

async function salvarRecompensas() {
    const btn = document.getElementById('btn-salvar-recompensas');
    const textoOriginal = btn.innerText;
    btn.innerText = "Salvando..."; btn.style.backgroundColor = "#888";
    
    const checkboxes = document.querySelectorAll('.chk-recompensa:checked');
    const idsSelecionados = Array.from(checkboxes).map(chk => Number(chk.value));

    enviarParaNuvem({ carrossel_recompensas: JSON.stringify(idsSelecionados) }, btn, textoOriginal, "#f57f17");
}