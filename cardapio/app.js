// A "sacola" de compras do cliente
let carrinho = [];

// 1. Busca os produtos na sua Nuvem (Render)
async function carregarProdutos() {
    try {
        const resposta = await fetch('https://icesoft-api.onrender.com/api/produtos');
        const produtosDaNuvem = await resposta.json();
        renderizarCardapio(produtosDaNuvem);
    } catch (erro) {
        console.error("Erro ao carregar cardápio:", erro);
        document.getElementById('lista-produtos').innerHTML = '<p style="color:red; text-align:center;">Erro ao carregar o cardápio. Tente novamente.</p>';
    }
}

// 2. Desenha os produtos na tela
function renderizarCardapio(listaProdutos) {
    const container = document.getElementById('lista-produtos');
    container.innerHTML = ''; 

    listaProdutos.forEach(produto => {
        container.innerHTML += `
            <div class="produto-card">
                <div class="produto-emoji">${produto.emoji}</div>
                <h3 class="produto-nome">${produto.nome}</h3>
                <p class="produto-descricao">${produto.descricao}</p>
                <div class="produto-preco">R$ ${produto.preco.toFixed(2).replace('.', ',')}</div>
                <button class="btn-add" onclick="adicionarAoCarrinho('${produto.nome}', ${produto.preco})">
                    + Adicionar
                </button>
            </div>
        `;
    });
}

// 3. Adiciona na sacola
function adicionarAoCarrinho(nomeProduto, precoProduto) {
    carrinho.push({ nome: nomeProduto, preco: precoProduto });
    atualizarBarraCarrinho();
}

// 4. Atualiza a barra flutuante
function atualizarBarraCarrinho() {
    const barra = document.getElementById('carrinho-flutuante');
    const txtQtd = document.getElementById('carrinho-qtd');
    const txtTotal = document.getElementById('carrinho-total');

    if (carrinho.length > 0) {
        barra.classList.remove('carrinho-oculto');
        barra.classList.add('carrinho-visivel');
        
        let total = carrinho.reduce((soma, item) => soma + item.preco, 0);
        
        txtQtd.innerText = `${carrinho.length} item(ns)`;
        txtTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    } else {
        barra.classList.remove('carrinho-visivel');
        barra.classList.add('carrinho-oculto');
    }
}

// 5. Abre a Janela de Checkout
function finalizarPedidoWhatsApp() {
    document.getElementById('modal-checkout').classList.remove('modal-oculto');
    document.getElementById('modal-checkout').classList.add('modal-visivel');
}

// 6. Fecha a Janela de Checkout
function fecharModal() {
    document.getElementById('modal-checkout').classList.remove('modal-visivel');
    document.getElementById('modal-checkout').classList.add('modal-oculto');
}

// 7. Envia para o WhatsApp Oficialmente
function enviarPedidoFinal() {
    const nome = document.getElementById('cliente-nome').value;
    const endereco = document.getElementById('cliente-endereco').value;
    const pagamento = document.getElementById('cliente-pagamento').value;

    if (!nome || !endereco || !pagamento) {
        alert("Por favor, preencha todos os campos da entrega para enviarmos seu sorvete!");
        return;
    }

    // ⚠️ ATENÇÃO: COLOQUE SEU NÚMERO AQUI (DDI + DDD + Número)
    const telefoneDono = "5524992308585"; 
    
    let total = 0;
    let textoPedido = "🍦 *NOVO PEDIDO - ICESOFT (Delivery)* 🍦\n\n";
    
    textoPedido += `👤 *Cliente:* ${nome}\n`;
    textoPedido += `📍 *Endereço:* ${endereco}\n`;
    textoPedido += `💳 *Pagamento:* ${pagamento}\n\n`;
    textoPedido += "📦 *Itens do Pedido:*\n";

    carrinho.forEach(item => {
        textoPedido += `▪️ 1x ${item.nome} - R$ ${item.preco.toFixed(2).replace('.', ',')}\n`;
        total += item.preco;
    });

    textoPedido += `\n💰 *Total a Pagar: R$ ${total.toFixed(2).replace('.', ',')}*\n\n`;
    textoPedido += "Aguardando confirmação de saída!";

    fecharModal();
    carrinho = [];
    atualizarBarraCarrinho();

    const textoCodificado = encodeURIComponent(textoPedido);
    const linkWhatsApp = `https://wa.me/${telefoneDono}?text=${textoCodificado}`;
    window.open(linkWhatsApp, '_blank');
}

// Liga o motor assim que a página abre
window.onload = carregarProdutos;
