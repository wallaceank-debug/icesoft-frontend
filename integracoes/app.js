const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';

window.onload = async () => {
    await carregarConfiguracoes();
};

// 1. PUXA OS DADOS SALVOS QUANDO VOCÊ ABRE A TELA
async function carregarConfiguracoes() {
    try {
        const res = await fetch(`${API_URL}/configuracoes`);
        const configs = await res.json();

        // Puxa os dados da conexão do Zap
        if (configs.zap_url) document.getElementById('api-zap-url').value = configs.zap_url;
        if (configs.zap_key) document.getElementById('api-zap-key').value = configs.zap_key;
        if (configs.zap_instancia) document.getElementById('api-zap-instancia').value = configs.zap_instancia;

        // Puxa os textos do robô
        if (configs.msg_boas_vindas) document.getElementById('msg-boas-vindas').value = configs.msg_boas_vindas;
        if (configs.msg_aceito) document.getElementById('msg-aceito').value = configs.msg_aceito;
        if (configs.msg_entrega) document.getElementById('msg-entrega').value = configs.msg_entrega;
        if (configs.msg_concluido) document.getElementById('msg-concluido').value = configs.msg_concluido;

        // Muda a etiquetinha visual se já tiver uma URL salva
        if (configs.zap_url && configs.zap_instancia) {
            const badge = document.getElementById('status-zap');
            if (badge) {
                badge.innerText = '✅ Configurado';
                badge.className = 'status-badge status-on';
            }
        }

    } catch (e) {
        console.error("Erro ao carregar configurações:", e);
    }
}

// 2. SALVA A CONEXÃO DA API NO BANCO
async function salvarConfigZap() {
    const btn = document.getElementById('btn-conectar-zap');
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Salvando...";
    btn.style.backgroundColor = "#FF9800";
    btn.disabled = true;

    const payload = {
        zap_url: document.getElementById('api-zap-url').value.trim(),
        zap_key: document.getElementById('api-zap-key').value.trim(),
        zap_instancia: document.getElementById('api-zap-instancia').value.trim()
    };

    await enviarParaNuvem(payload, btn, textoOriginal, "#25D366");
}

// 3. SALVA OS TEXTOS DO ROBÔ NO BANCO
async function salvarMensagens() {
    const btn = document.getElementById('btn-salvar-mensagens');
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Salvando...";
    btn.style.backgroundColor = "#FF9800";
    btn.disabled = true;

    const payload = {
        msg_boas_vindas: document.getElementById('msg-boas-vindas').value,
        msg_aceito: document.getElementById('msg-aceito').value,
        msg_entrega: document.getElementById('msg-entrega').value,
        msg_concluido: document.getElementById('msg-concluido').value
    };

    await enviarParaNuvem(payload, btn, textoOriginal, "#00bcd4");
}

// 4. FUNÇÃO UNIVERSAL QUE FAZ O ENVIO E MUDA A COR DO BOTÃO
async function enviarParaNuvem(payload, botao, textoOriginal, corOriginal) {
    try {
        const res = await fetch(`${API_URL}/configuracoes`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (res.ok) {
            botao.style.backgroundColor = "#4CAF50"; 
            botao.innerText = "✅ Salvo com sucesso!";
            
            // Se foi a conexão do zap, muda a badge de status
            if (payload.zap_url) {
                document.getElementById('status-zap').innerText = '✅ Configurado';
                document.getElementById('status-zap').className = 'status-badge status-on';
            }
            
            setTimeout(() => { 
                botao.style.backgroundColor = corOriginal; 
                botao.innerText = textoOriginal; 
                botao.disabled = false;
            }, 3000);
        } else { 
            alert("Erro ao salvar."); 
            botao.innerText = textoOriginal; 
            botao.style.backgroundColor = corOriginal; 
            botao.disabled = false;
        }
    } catch (e) { 
        alert("Erro de conexão."); 
        botao.innerText = textoOriginal; 
        botao.style.backgroundColor = corOriginal; 
        botao.disabled = false;
    }
}

// 5. GERA E MOSTRA O QR CODE NA TELA
async function gerarQrCode() {
    const btn = document.getElementById('btn-gerar-qr');
    const area = document.getElementById('area-qrcode');
    const img = document.getElementById('img-qrcode');

    btn.innerText = "⏳ Gerando...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/whatsapp/qrcode`);
        const data = await res.json();

        if (data.status === 'CONECTADO') {
            alert("✅ Seu WhatsApp já está conectado e pronto para uso!");
            area.style.display = 'none';
        } else if (data.status === 'QRCODE') {
            img.src = data.qrcode; // Coloca a imagem gerada pelo robô na tela
            area.style.display = 'block';
        } else if (data.erro) {
            alert("❌ Erro: " + data.erro);
        }
    } catch (e) {
        alert("❌ Erro ao tentar conectar com a API do servidor.");
    }

    btn.innerText = "📱 Gerar QR Code do WhatsApp";
    btn.disabled = false;
}