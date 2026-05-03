const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';
let produtosGlobais = []; 
let cuponsSalvos = []; 

window.onload = async () => {
    await carregarProdutos(); 
    await carregarConfiguracoes(); 
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

// === FUNÇÕES DO CARD 2 ===
function renderizarListaDestaques(destaquesSalvos) {
    const container = document.getElementById('lista-produtos-destaque');
    container.innerHTML = '';
    if (produtosGlobais.length === 0) return container.innerHTML = '<p style="color:#888; text-align:center;">Nenhum produto cadastrado.</p>';

    produtosGlobais.forEach(p => {
        const isChecked = destaquesSalvos.includes(Number(p.id)) ? 'checked' : '';
        container.innerHTML += `
            <label style="display:flex; align-items:center; gap:10px; padding:10px; background:white; border-radius:5px; border:1px solid #ddd; cursor:pointer;">
                <input type="checkbox" class="chk-destaque" value="${p.id}" ${isChecked} style="width:20px; height:20px; accent-color:#FF9800; cursor: pointer;">
                <span style="font-weight:600; color:#333;">${p.nome}</span>
                <span style="margin-left:auto; color:#25D366; font-weight:bold;">R$ ${Number(p.preco).toFixed(2).replace('.', ',')}</span>
            </label>
        `;
    });
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
        document.getElementById('cupom-minimo').value = c.minimo || 0; // Puxando o mínimo
        document.getElementById('cupom-validade').value = c.validade || '';
        document.getElementById('cupom-limite').value = c.limite || 0;
        document.getElementById('cupom-publico').value = c.publico || 'todos';
    } else {
        document.getElementById('titulo-modal-cupom').innerText = `Criar Novo Cupom`;
        document.getElementById('cupom-index').value = '';
        document.getElementById('cupom-codigo').value = '';
        document.getElementById('cupom-tipo').value = 'porcentagem';
        document.getElementById('cupom-valor').value = '';
        document.getElementById('cupom-minimo').value = 0; // Zerando o mínimo
        document.getElementById('cupom-validade').value = '';
        document.getElementById('cupom-limite').value = 0;
        document.getElementById('cupom-publico').value = 'todos';
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
    const minimo = parseFloat(document.getElementById('cupom-minimo').value) || 0; // Salvando o mínimo
    const validade = document.getElementById('cupom-validade').value;
    const limite = parseInt(document.getElementById('cupom-limite').value) || 0;
    const publico = document.getElementById('cupom-publico').value;

    if (!codigo || isNaN(valor) || valor <= 0) return alert("⚠️ Preencha o código e um valor de desconto válido!");
    
    const indexExistente = cuponsSalvos.findIndex(c => c.codigo === codigo);
    if (indexExistente !== -1 && indexExistente !== Number(index) && index === "") {
        return alert("⚠️ Este código já está em uso!");
    }

    const cupomData = {
        codigo, tipo, valor, minimo, validade, limite, publico, // Mínimo injetado aqui
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

        let descPublico = cupom.publico === 'novos' ? 'Só Clientes Novos' : cupom.publico === 'recorrentes' ? 'Só Recorrentes' : 'Todos os Clientes';
        infoExtra += `👤 ${descPublico}`;

        container.innerHTML += `
            <div style="background:#fdfdfd; border:1px solid #e1bee7; border-radius:10px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
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
            <label style="display:flex; align-items:center; gap:10px; padding:10px; background:white; border-radius:5px; border:1px solid #ddd; cursor:pointer;">
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
