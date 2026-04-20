const API_URL = 'https://icesoft-api.onrender.com/api';

window.onload = () => {
    carregarVendas();
};

async function carregarVendas() {
    const inicio = document.getElementById('filtro-inicio').value;
    const fim = document.getElementById('filtro-fim').value;
    
    let url = `${API_URL}/vendas`;
    // 1. Atualiza o texto do Cabeçalho (Estilo Pílula)
    if (inicioInput && fimInput) {
        textoPeriodo.innerText = `${formatarDataBR(inicioInput)} ATÉ ${formatarDataBR(fimInput)}`;
    } else {
        textoPeriodo.innerText = `TODO O HISTÓRICO`;
    }

    try {
        const resposta = await fetch(url);
        const vendas = await resposta.json();
        
        let faturamento = 0;
        let contagemProdutos = {};
        let contagemAdicionais = {};

        vendas.forEach(v => {
            // 1. Soma o dinheiro
            faturamento += parseFloat(v.total);

            // 2. Limpa o nome (tira o "Balcão: ")
            let textoVenda = v.produto_nome.replace('Balcão: ', '').trim();
            
            // 3. Separa o Produto Base dos Adicionais
            // Ex: "Açaí (Banana, Morango)" -> Base: "Açaí", Adicionais: "Banana, Morango"
            let nomeBase = textoVenda.split('(')[0].trim();
            contagemProdutos[nomeBase] = (contagemProdutos[nomeBase] || 0) + 1;

            // 4. Extrai os adicionais dentro dos parênteses (se houver)
            let match = textoVenda.match(/\(([^)]+)\)/);
            if(match) {
                let itensAdicionais = match[1].split(','); // Divide por vírgula
                itensAdicionais.forEach(item => {
                    let adcLimpo = item.trim();
                    contagemAdicionais[adcLimpo] = (contagemAdicionais[adcLimpo] || 0) + 1;
                });
            }
        });

        const totalPedidos = vendas.length;
        const ticketMedio = totalPedidos > 0 ? (faturamento / totalPedidos) : 0;

        // Atualiza a Linha 1 (Métricas)
        document.getElementById('dash-faturamento').innerText = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-ticket').innerText = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-pedidos').innerText = totalPedidos;

        // Atualiza a Linha 2 (Listas Ordenadas)
        renderizarLista(contagemProdutos, 'lista-produtos-top', "Nenhum produto vendido.");
        renderizarLista(contagemAdicionais, 'lista-adicionais-top', "Nenhum adicional vendido.");

    } catch (e) {
        console.error("Erro ao carregar dashboard:", e);
    }
}

// Função auxiliar para desenhar as listas formatadas
function renderizarLista(objetoContagem, idElemento, msgVazio) {
    const container = document.getElementById(idElemento);
    // Transforma o objeto em Array e ordena do maior pro menor
    const ordenado = Object.entries(objetoContagem).sort((a, b) => b[1] - a[1]);

    if (ordenado.length === 0) {
        container.innerHTML = `<p style="text-align:center; font-weight:normal; margin-top:20px;">${msgVazio}</p>`;
        return;
    }

    container.innerHTML = '';
    ordenado.forEach(([nome, quantidade]) => {
        container.innerHTML += `
            <div class="item-lista">
                <span>${nome}</span>
                <span class="qtd">${quantidade}x</span>
            </div>
        `;
    });
}