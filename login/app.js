document.getElementById('form-login').addEventListener('submit', async function(evento) {
    // 1. Impede a página de recarregar
    evento.preventDefault();

    // 2. Pega os valores que o usuário digitou
    const usernameDigitado = document.getElementById('username').value.trim();
    const senhaDigitada = document.getElementById('senha').value.trim();
    
    const mensagemErro = document.getElementById('mensagem-erro');
    const botaoEntrar = document.getElementById('btn-submit');

    // 3. Validação Básica
    if (!usernameDigitado || !senhaDigitada) {
        mostrarErro("Preencha o usuário e a senha.");
        return;
    }

    // Muda o botão para mostrar que está carregando
    botaoEntrar.disabled = true;
    botaoEntrar.innerText = 'Verificando...';
    mensagemErro.className = 'erro-oculto';

    try {
        // 4. Bate na porta da sua NOVA API (Easypanel)
        const resposta = await fetch('https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: usernameDigitado,
                senha: senhaDigitada
            })
        });

        const resultado = await resposta.json();

        // 5. Verifica se o servidor deixou entrar
        if (resultado.sucesso) {
            
            // Sucesso! Guarda o crachá no navegador
            localStorage.setItem('icesoft_token', resultado.token);
            localStorage.setItem('icesoft_usuario', usernameDigitado);
            
            // Joga o usuário direto para o Kanban ou Dashboard
            window.location.href = '../dashboard/index.html'; 
            
        } else {
            // Acesso negado
            mostrarErro("Usuário ou senha incorretos.");
            botaoEntrar.disabled = false;
            botaoEntrar.innerText = 'Acessar Sistema';
        }

    } catch (erro) {
        console.error("Falha ao contatar servidor de login:", erro);
        mostrarErro("Sem conexão com o servidor. Tente novamente.");
        botaoEntrar.disabled = false;
        botaoEntrar.innerText = 'Acessar Sistema';
    }
});

function mostrarErro(mensagem) {
    const boxErro = document.getElementById('mensagem-erro');
    boxErro.innerText = `⚠️ ${mensagem}`;
    boxErro.className = 'erro-visivel';
}