/* =========================================
   1. NOSSO BANCO DE DADOS TEMPORÁRIO
   (Vitrine para testes enquanto o Backend não chega)
   ========================================= */
// Agora a variável começa vazia. O celular não sabe quais são os produtos ainda!
let produtosIcesoft = [];

let carrinho = [];

/* =========================================
   2. A FUNÇÃO QUE "MONTA" A PRATELEIRA (Atualizada)
   ========================================= */
// Agora a função aceita receber uma lista filtrada. Se não receber nada, usa a original.
function carregarProdutos(produtosParaMostrar = produtosIcesoft) {
    const areaProdutos = document.getElementById('lista-produtos');
    areaProdutos.innerHTML = '<h2>Cardápio</h2>';

    if (produtosParaMostrar.length === 0) {
        areaProdutos.innerHTML += '<p style="text-align: center; margin-top: 20px;">Nenhum produto encontrado...</p>';
        return;
    }

    produtosParaMostrar.forEach(produto => {
        const cartaoProduto = `
            <div style="border: 1px solid #eee; border-radius: 15px; padding: 15px; margin-bottom: 15px; display: flex; align-items: center; background: #fff;">
                <div style="font-size: 45px; margin-right: 15px;">${produto.emoji}</div>
                <div style="flex: 1;">
                    <h3 style="font-size: 16px; color: #ff477e;">${produto.nome}</h3>
                    <p style="font-size: 12px; color: #777;">${produto.descricao}</p>
                    <strong>R$ ${produto.preco.toFixed(2).replace('.', ',')}</strong>
                </div>
                <button onclick="adicionarAoCarrinho(${produto.id})" style="background: #ff477e; color: white; border: none; width: 35px; height: 35px; border-radius: 50%; font-size: 20px; cursor: pointer;">+</button>
            </div>
        `;
        areaProdutos.innerHTML += cartaoProduto;
    });
}

// NOVA FUNÇÃO: ADICIONAR AO CARRINHO
function adicionarAoCarrinho(idProduto) {
    const produto = produtosIcesoft.find(p => p.id === idProduto);
    carrinho.push(produto);
    
    atualizarInterfaceCarrinho();
}

// NOVA FUNÇÃO: ATUALIZAR A BARRA PRETA DO CARRINHO
function atualizarInterfaceCarrinho() {
    const rodape = document.getElementById('rodape-carrinho');
    const labelQtd = document.getElementById('qtd-itens');
    const labelTotal = document.getElementById('total-carrinho');

    if (carrinho.length > 0) {
        rodape.style.display = 'flex'; // Mostra o carrinho
        
        const total = carrinho.reduce((soma, item) => soma + item.preco, 0);
        
        labelQtd.innerText = `${carrinho.length} ${carrinho.length === 1 ? 'item' : 'itens'}`;
        labelTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
}

function configurarBuscaEFiltros() {
    const inputBusca = document.getElementById('busca-produtos');
    const botoesStory = document.querySelectorAll('.story-item');

    inputBusca.addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        const filtrados = produtosIcesoft.filter(p => p.nome.toLowerCase().includes(termo) || p.descricao.toLowerCase().includes(termo));
        carregarProdutos(filtrados);
    });

    botoesStory.forEach(btn => {
        btn.addEventListener('click', function() {
            const categoria = this.innerText.toLowerCase();
            const filtrados = produtosIcesoft.filter(p => categoria.includes(p.categoria.toLowerCase()));
            carregarProdutos(filtrados);
        });
    });
}

window.onload = () => {
    carregarProdutos();
    configurarBuscaEFiltros();
};

/* =========================================
   3. MOTOR DE BUSCA E FILTROS (Novo)
   ========================================= */
function configurarBuscaEFiltros() {
    const inputBusca = document.getElementById('busca-produtos');
    const botoesStory = document.querySelectorAll('.story-item');

    // 3.1 Filtro de digitação em Tempo Real
    inputBusca.addEventListener('input', function(evento) {
        const termoDigitado = evento.target.value.toLowerCase(); // Tudo minúsculo para não ter erro
        
        // Filtra buscando no nome OU na descrição do produto
        const produtosFiltrados = produtosIcesoft.filter(produto => {
            return produto.nome.toLowerCase().includes(termoDigitado) || 
                   produto.descricao.toLowerCase().includes(termoDigitado);
        });
        
        carregarProdutos(produtosFiltrados);
    });

    // 3.2 Filtro pelo clique nas categorias (Stories)
    botoesStory.forEach(botao => {
        botao.addEventListener('click', function() {
            const textoBotao = this.innerText.toLowerCase(); // Ex: "🍨 massas"
            
            const produtosFiltrados = produtosIcesoft.filter(produto => {
                // Checa se a categoria do produto está contida no texto do botão clicado
                return textoBotao.includes(produto.categoria.toLowerCase());
            });
            
            carregarProdutos(produtosFiltrados);
        });
    });
}

/* =========================================
   7. COMUNICAÇÃO COM O SERVIDOR (API FETCH)
   ========================================= */
async function buscarProdutosDoServidor() {
    try {
        // O celular "bate na porta" do servidor pedindo os produtos
        const resposta = await fetch('https://icesoft-api.onrender.com/api/produtos');
        
        // Converte a resposta recebida para o formato de lista
        produtosIcesoft = await resposta.json();
        
        // Agora que tem os produtos, desenha na tela e liga os filtros
        carregarProdutos();
        configurarBuscaEFiltros();
        
    } catch (erro) {
        console.error("Falha ao buscar produtos:", erro);
        document.getElementById('lista-produtos').innerHTML = '<p style="text-align: center; color: red;">Servidor offline. Não foi possível carregar o cardápio.</p>';
    }
}

// Quando a tela carregar, a primeira coisa que faz é chamar o servidor
window.onload = () => {
    buscarProdutosDoServidor();
};

/* =========================================
   5. CONTROLE DO CHECKOUT (Abrir/Fechar/Remover)
   ========================================= */

// Pega os botões e a tela do modal
const btnVerSacola = document.querySelector('.btn-ver-carrinho');
const btnFecharModal = document.getElementById('btn-fechar-modal');
const modalCheckout = document.getElementById('modal-checkout');

// Abrir a tela de Checkout
btnVerSacola.addEventListener('click', () => {
    abrirCheckout();
});

// Fechar a tela de Checkout
btnFecharModal.addEventListener('click', () => {
    modalCheckout.style.display = 'none';
});

function abrirCheckout() {
    const listaItensHtml = document.getElementById('lista-itens-carrinho');
    const labelTotalCheckout = document.getElementById('total-checkout');
    
    listaItensHtml.innerHTML = ''; // Limpa a lista antes de gerar
    
    if (carrinho.length === 0) {
        modalCheckout.style.display = 'none';
        return; // Proteção para não abrir carrinho vazio
    }

    let total = 0;

    // Gera a listagem de itens dentro do modal
    carrinho.forEach((item, index) => {
        total += item.preco;
        
        listaItensHtml.innerHTML += `
            <div class="item-no-carrinho">
                <div>
                    <strong>${item.nome}</strong><br>
                    <small>R$ ${item.preco.toFixed(2).replace('.', ',')}</small>
                </div>
                <button onclick="removerDoCarrinho(${index})">Remover</button>
            </div>
        `;
    });

    labelTotalCheckout.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    modalCheckout.style.display = 'flex'; // Exibe o modal na tela
}

function removerDoCarrinho(indexNoArray) {
    // Remove 1 item específico da nossa lista (Array)
    carrinho.splice(indexNoArray, 1); 
    
    // Atualiza a barra de baixo
    atualizarInterfaceCarrinho();
    
    // Se esvaziou o carrinho, fecha a tela; se não, apenas redesenha os itens
    if (carrinho.length === 0) {
        modalCheckout.style.display = 'none';
        document.getElementById('rodape-carrinho').style.display = 'none';
    } else {
        abrirCheckout();
    }
}

/* =========================================
   6. FINALIZAÇÃO DO PEDIDO (Integração WhatsApp)
   ========================================= */
const btnEnviarPedido = document.getElementById('btn-enviar-pedido');

btnEnviarPedido.addEventListener('click', () => {
    // 1. Pegar os dados do formulário que o cliente digitou
    const nome = document.getElementById('cli-nome').value.trim();
    const telefone = document.getElementById('cli-telefone').value.trim();
    const endereco = document.getElementById('cli-endereco').value.trim();

    // 2. Trava de Segurança (Validação)
    // Se o cliente esquecer de preencher algo, o sistema avisa e não deixa enviar
    if (!nome || !telefone || !endereco) {
        alert("Por favor, preencha todos os dados de entrega (Nome, Celular e Endereço) para continuarmos!");
        return; 
    }

    // 3. Montar o "Recibo" em texto formatado com negrito (*) para o WhatsApp
    let textoPedido = `*NOVO PEDIDO - ICESOFT* 🍦\n\n`;
    textoPedido += `*Cliente:* ${nome}\n`;
    textoPedido += `*Telefone:* ${telefone}\n`;
    textoPedido += `*Endereço:* ${endereco}\n\n`;
    textoPedido += `*RESUMO DO PEDIDO:*\n`;

    let total = 0;
    carrinho.forEach(item => {
        textoPedido += `- 1x ${item.nome} (R$ ${item.preco.toFixed(2).replace('.', ',')})\n`;
        total += item.preco;
    });

    textoPedido += `\n*TOTAL A PAGAR: R$ ${total.toFixed(2).replace('.', ',')}*\n\n`;
    textoPedido += `Aguardo a confirmação do pedido e o tempo de entrega!`;

    // 4. Converter o texto para um formato seguro de link de internet
    const textoCodificado = encodeURIComponent(textoPedido);

    // 5. Número do WhatsApp da Sorveteria (Substitua pelo número real da Icesoft depois)
    const numeroWhatsapp = "5524992308585"; 

    // 6. Abrir o aplicativo do WhatsApp direto na conversa da loja
    const url = `https://wa.me/${numeroWhatsapp}?text=${textoCodificado}`;
    window.open(url, '_blank'); // Abre em uma nova aba
});
