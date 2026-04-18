document.getElementById('form-login').addEventListener('submit', async function(evento) {
    // Evita que a página recarregue ao apertar Enter
    evento.preventDefault();

    const usernameDigitado = document.getElementById('username').value;
    const senhaDigitada = document.getElementById('senha').value;
    const mensagemErro = document.getElementById('mensagem-erro');

    try {
        // Envia os dados para a nuvem validar (Não esqueça de manter o seu link do Render aqui!)
        const resposta = await fetch('https://icesoft-api.onrender.com/api/login', {
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

        if (resultado.sucesso) {
            // LOGIN APROVADO! Guarda o "crachá" na memória do navegador
            localStorage.setItem('icesoft_token', resultado.token);
            localStorage.setItem('icesoft_usuario', usernameDigitado);
            
            // Esconde o erro e avisa que deu certo
            mensagemErro.className = 'erro-oculto';
            alert(`Bem-vindo(a), ${usernameDigitado}! Acesso liberado.`);
            
            // Redireciona direto para o caixa da loja
		window.location.href = '/pdv/';
        } else {
            // LOGIN NEGADO! Mostra a mensagem vermelha
            mensagemErro.className = 'erro-visivel';
        }
    } catch (erro) {
        console.error("Erro ao tentar fazer login:", erro);
        alert("Erro de conexão com o servidor. Tente novamente.");
    }
});