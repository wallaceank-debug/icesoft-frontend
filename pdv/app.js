/* =========================================
   1. BANCO DE DADOS CENTRAL (Vindo do Servidor)
   ========================================= */
let produtosIcesoft = []; 
let carrinhoPdv = [];

/* =========================================
   2. CARREGAR OS PRODUTOS NA TELA (Esquerda)
   ========================================= */
function carregarProdutos() {
    const gridProdutos = document.getElementById('grid-produtos');
    gridProdutos.innerHTML = ''; 

    produtosIcesoft.forEach(produto => {
        const cardHtml = `
            <div onclick="adicionarAoCaixa(${produto.id})" style="background: white; border: 1px solid #ddd; border-radius: 10px; padding: 20px; text-align: center; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: 0.2s;" onmouseover="this.style.borderColor='#ff477e'" onmouseout="this.style.borderColor='#ddd'">
                <div style="font-size: 40px; margin-bottom: 10px;">${produto.emoji}</div>
                <h3 style="font-size: 14px; color: #333; margin-bottom: 5px;">${produto.nome}</h3>
                <strong style="color: #ff477e; font-size: 14px;">R$ ${produto.preco.toFixed(2).replace('.', ',')}</strong>
            </div>
        `;
        gridProdutos.innerHTML += cardHtml;
    });
}

/* =========================================
   3. REGRAS DO CAIXA (Direita)
   ========================================= */
function adicionarAoCaixa(idProduto) {
    const produto = produtosIcesoft.find(p => p.id === idProduto);
    carrinhoPdv.push(produto);
    atualizarFitaDoCaixa();
}

function atualizarFitaDoCaixa() {
    const listaItens = document.getElementById('pdv-lista-itens');
    const labelSubtotal = document.getElementById('pdv-subtotal');
    const labelTotal = document.getElementById('pdv-total');
    
    listaItens.innerHTML = '';
    let total = 0;

    carrinhoPdv.forEach((item, index) => {
        total += item.preco;
        listaItens.innerHTML += `
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #eee;">
                <span style="font-size: 14px; color: #333;">${index + 1}. ${item.nome}</span>
                <div style="display: flex; gap: 10px;">
                    <strong style="font-size: 14px;">R$ ${item.preco.toFixed(2).replace('.', ',')}</strong>
                    <button onclick="removerDoCaixa(${index})" style="background: none; border: none; color: #e74c3c; cursor: pointer; font-weight: bold;">X</button>
                </div>
            </div>
        `;
    });

    labelSubtotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    labelTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function removerDoCaixa(index) {
    carrinhoPdv.splice(index, 1);
    atualizarFitaDoCaixa();
}

function cancelarVenda() {
    if(carrinhoPdv.length === 0) return; 
    
    if(confirm("Tem certeza que deseja cancelar esta venda e limpar o caixa?")) {
        carrinhoPdv = [];
        atualizarFitaDoCaixa();
    }
}

// Função oficial que abre e prepara a tela de pagamentos
function abrirTelaDePagamento() {
    if(carrinhoPdv.length === 0) {
        alert("Caixa vazio! Adicione produtos.");
        return;
    }
    
    valorTotalAtual = carrinhoPdv.reduce((soma, item) => soma + item.preco, 0);
    valorDesconto = 0; 
    inputDesconto.value = "0.00";
    formaPagamentoSelecionada = "";
    
    botoesFormaPgto.forEach(b => b.classList.remove('selecionada'));
    areaTroco.style.display = 'none';
    inputRecebido.value = "0.00";
    lblTroco.innerText = "R$ 0,00";

    atualizarValoresModal();
    modalPagamento.style.display = 'flex';
}

function cobrarVenda() {
    abrirTelaDePagamento(); 
}

/* =========================================
   4. BOTÕES E ATALHOS DE TECLADO (Agilidade)
   ========================================= */
document.getElementById('btn-cancelar-venda').addEventListener('click', cancelarVenda);
document.getElementById('btn-cobrar').addEventListener('click', cobrarVenda);

document.addEventListener('keydown', function(evento) {
    if(evento.key === 'F4') {
        evento.preventDefault(); 
        cancelarVenda();
    }
    if(evento.key === 'F12') {
        evento.preventDefault(); 
        cobrarVenda();
    }
});

/* =========================================
   6. MOTOR DE PAGAMENTO E DESCONTOS
   ========================================= */
let valorTotalAtual = 0;
let valorDesconto = 0;
let formaPagamentoSelecionada = "";

const modalPagamento = document.getElementById('modal-pagamento');
const btnFecharPagamento = document.getElementById('btn-fechar-pagamento');
const lblPagSubtotal = document.getElementById('pag-subtotal');
const lblPagTotal = document.getElementById('pag-total');
const inputDesconto = document.getElementById('input-desconto');
const btnAplicarDesconto = document.getElementById('btn-aplicar-desconto');
const botoesFormaPgto = document.querySelectorAll('.btn-forma-pag');
const areaTroco = document.getElementById('area-troco');
const inputRecebido = document.getElementById('input-recebido');
const lblTroco = document.getElementById('valor-troco');
const btnConfirmarVenda = document.getElementById('btn-confirmar-venda');

btnFecharPagamento.addEventListener('click', () => { modalPagamento.style.display = 'none'; });

btnAplicarDesconto.addEventListener('click', () => {
    let descontoDigitado = parseFloat(inputDesconto.value);
    if(isNaN(descontoDigitado) || descontoDigitado < 0) descontoDigitado = 0;
    
    if(descontoDigitado > valorTotalAtual) {
        alert("O desconto não pode ser maior que o valor da venda!");
        inputDesconto.value = valorTotalAtual.toFixed(2);
        valorDesconto = valorTotalAtual;
    } else {
        valorDesconto = descontoDigitado;
    }
    
    atualizarValoresModal();
});

function atualizarValoresModal() {
    const totalComDesconto = valorTotalAtual - valorDesconto;
    
    lblPagSubtotal.innerText = `R$ ${valorTotalAtual.toFixed(2).replace('.', ',')}`;
    lblPagTotal.innerText = `R$ ${totalComDesconto.toFixed(2).replace('.', ',')}`;
    
    document.getElementById('pdv-desconto').innerText = `R$ ${valorDesconto.toFixed(2).replace('.', ',')}`;
    document.getElementById('pdv-total').innerText = `R$ ${totalComDesconto.toFixed(2).replace('.', ',')}`;
    
    calcularTroco();
}

botoesFormaPgto.forEach(botao => {
    botao.addEventListener('click', function() {
        botoesFormaPgto.forEach(b => b.classList.remove('selecionada'));
        this.classList.add('selecionada');
        formaPagamentoSelecionada = this.getAttribute('data-tipo');
        
        if(formaPagamentoSelecionada === "Dinheiro") {
            areaTroco.style.display = 'block';
            inputRecebido.focus();
        } else {
            areaTroco.style.display = 'none';
        }
    });
});

inputRecebido.addEventListener('input', calcularTroco);

function calcularTroco() {
    if(formaPagamentoSelecionada !== "Dinheiro") return;
    
    const recebido = parseFloat(inputRecebido.value) || 0;
    const totalComDesconto = valorTotalAtual - valorDesconto;
    let troco = recebido - totalComDesconto;
    
    if(troco < 0) troco = 0;
    lblTroco.innerText = `R$ ${troco.toFixed(2).replace('.', ',')}`;
}

btnConfirmarVenda.addEventListener('click', finalizarPagamento);

// A função agora é 'async' porque vai conversar com a internet
async function finalizarPagamento() {
    if(formaPagamentoSelecionada === "") {
        alert("Por favor, selecione uma forma de pagamento!");
        return;
    }
    
    const totalComDesconto = valorTotalAtual - valorDesconto;

    // 1. Monta o "Malote de Dinheiro" (Pacote de Dados)
    const pacoteVenda = {
        origem: "💻 Balcão",
        itens: carrinhoPdv,
        subtotal: valorTotalAtual,
        desconto: valorDesconto,
        valor: totalComDesconto, // Chamamos de 'valor' para bater com o que o Dashboard espera ler
        formaPagamento: formaPagamentoSelecionada
    };

    try {
        // 2. O carteiro envia o pacote para o Servidor Central (Método POST)
        const resposta = await fetch('https://icesoft-api.onrender.com/api/vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pacoteVenda)
        });

        if (resposta.ok) {
            // 3. Só limpa a tela se o Servidor disser "Recebi o dinheiro!"
            carrinhoPdv = [];
            atualizarFitaDoCaixa();
            document.getElementById('pdv-desconto').innerText = `R$ 0,00`;
            modalPagamento.style.display = 'none';
            alert("✅ Venda registrada com sucesso no Servidor Central!");
        } else {
            alert("❌ Ocorreu um erro no servidor ao registrar a venda.");
        }
    } catch (erro) {
        console.error("Falha ao enviar venda:", erro);
        alert("⚠️ ATENÇÃO: O Servidor Central está offline. A venda NÃO foi registrada.");
    }
}

document.addEventListener('keydown', function(evento) {
    if(evento.key === 'Enter' && modalPagamento.style.display === 'flex') {
        finalizarPagamento();
    }
});

/* =========================================
   7. COMUNICAÇÃO COM O SERVIDOR CENTRAL (API)
   ========================================= */
async function ligarMotorPDV() {
    try {
        const resposta = await fetch('https://icesoft-api.onrender.com/api/produtos');
        produtosIcesoft = await resposta.json();
        
        carregarProdutos();
        atualizarFitaDoCaixa();
    } catch (erro) {
        console.error("Erro ao conectar com o servidor central:", erro);
        document.getElementById('grid-produtos').innerHTML = '<p style="color: red; padding: 20px; font-weight: bold;">⚠️ Falha de conexão com o Servidor Central. O caixa está inoperante. Verifique o servidor.</p>';
    }
}

/* =========================================
   8. INICIALIZAÇÃO
   ========================================= */
window.onload = () => {
    ligarMotorPDV();
};