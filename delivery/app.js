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
        
        // 🖼️ Puxa as Imagens Salvas para mostrar no Preview
        if (configs.banner_loja) document.getElementById('preview-img-banner').src = configs.banner_loja;
        if (configs.logo_loja) document.getElementById('preview-img-logo').src = configs.logo_loja;

        // Card 2
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

    enviarParaNuvem({ carrossel_destaques: JSON.stringify(idsSelecionados) }, btn, textoOriginal, "#FF9800");
}

// === FUNÇÕES DO CARD 3 ===
function renderizarListaCupons() {
    const container = document.getElementById('lista-cupons');
    container.innerHTML = '';
    if (cuponsSalvos.length === 0) return container.innerHTML = '<p style="color:#888; text-align:center; font-size: 0.9rem;">Nenhum cupom ativo.</p>';

    cuponsSalvos.forEach((cupom, index) => {
        const valorExibicao = cupom.tipo === 'porcentagem' ? `${cupom.valor}%` : `R$ ${Number(cupom.valor).toFixed(2).replace('.', ',')}`;
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background:#f3e5f5; border:1px dashed #ab47bc; border-radius:8px;">
                <div><strong style="color:#8e24aa;">${cupom.codigo}</strong> <span style="background: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; color: #9C27B0;">- ${valorExibicao}</span></div>
                <button onclick="removerCupom(${index})" style="background:none; border:none; color:#f44336; cursor:pointer; font-size: 1.2rem;">🗑️</button>
            </div>
        `;
    });
}
function adicionarCupom() {
    const codigoInput = document.getElementById('novo-cupom-codigo');
    const tipo = document.getElementById('novo-cupom-tipo').value;
    const valorInput = document.getElementById('novo-cupom-valor');
    const codigo = codigoInput.value.trim().toUpperCase();
    const valor = parseFloat(valorInput.value);

    if (!codigo || isNaN(valor) || valor <= 0) return alert("⚠️ Preencha válido!");
    if (cuponsSalvos.find(c => c.codigo === codigo)) return alert("⚠️ Este código já existe!");

    cuponsSalvos.push({ codigo, tipo, valor });
    codigoInput.value = ''; valorInput.value = '';
    salvarCuponsNuvem();
}
function removerCupom(index) {
    if(confirm("Excluir este cupom?")) { cuponsSalvos.splice(index, 1); salvarCuponsNuvem(); }
}
async function salvarCuponsNuvem() {
    renderizarListaCupons();
    fetch(`${API_URL}/configuracoes`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cupons_delivery: JSON.stringify(cuponsSalvos) }) });
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
        pagamentos_loja: document.getElementById('config-pagamentos').value
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