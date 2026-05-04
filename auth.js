// auth.js - O Fiscal de Segurança da Icesoft

function verificarAcesso() {
    // 1. Procura o "crachá" (token) no bolso do navegador
    const cracha = localStorage.getItem('icesoft_token');
    
    // 2. Se o crachá não existir, joga o invasor para fora (tela de login)
    if (!cracha) {
        window.location.href = '../login/index.html'; // Ajuste o caminho se necessário
        return false;
    }
    
    // 3. Se tiver crachá, deixa a tela carregar normalmente
    return true;
}

// 4. Cria o botão de sair (destrói o crachá e expulsa da tela)
function fazerLogout() {
    localStorage.removeItem('icesoft_token');
    localStorage.removeItem('icesoft_usuario');
    window.location.href = '../login/index.html';
}

// Executa a verificação no exato milissegundo que a tela abre
verificarAcesso();