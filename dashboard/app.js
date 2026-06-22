const API_URL = 'https://icesoft-sistema-icesoft-api-v2.tm3i9u.easypanel.host/api';

// Variáveis para guardar as instâncias dos gráficos
let chartEvolucao, chartPagamentos, chartOrigem, chartProdutos, chartDias, chartHorarios, chartTicketMedio;

window.onload = () => { carregarDashboard(); };

async function carregarDashboard() {
    let inicioInput = document.getElementById('filtro-inicio').value;
    let fimInput = document.getElementById('filtro-fim').value;

    // 1. Preenche as datas automaticamente se for a primeira vez
    if (!inicioInput || !fimInput) {
        const hoje = new Date();
        const trintaDias = new Date();
        trintaDias.setDate(hoje.getDate() - 30);
        
        // 👇 NOVO: Força o fuso brasileiro para não adiantar 1 dia por causa do UTC
        const formatarYMD = (data) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);
        
        inicioInput = formatarYMD(trintaDias);
        fimInput = formatarYMD(hoje);
        
        document.getElementById('filtro-inicio').value = inicioInput;
        document.getElementById('filtro-fim').value = fimInput;
    }

    try {
        // 2. Busca as vendas com a fechadura de segurança
        const cracha = localStorage.getItem('icesoft_token');
        const resposta = await fetch(`${API_URL}/vendas?inicio=${inicioInput}&fim=${fimInput}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cracha}`
            }
        });

        // Se o servidor expulsar (token inválido), manda pro login
        if (resposta.status === 401 || resposta.status === 403) {
             fazerLogout();
             return;
        }

        let vendas = await resposta.json();
        
        // 3. Remove os cancelamentos para não mascarar o lucro (Trata tanto 'Cancelada' quanto 'Cancelado')
        const vendasValidas = vendas.filter(v => v.status !== 'Cancelada' && v.status !== 'Cancelado');

        // --- COMEÇO DO CÓDIGO DE HORÁRIOS E TICKET MÉDIO ---
        let contagemHorarios = new Array(24).fill(0);
        let valorHorarios = new Array(24).fill(0); // Guarda o dinheiro ganho em cada hora

        vendasValidas.forEach(v => {
            if (v.data_hora) {
                let dataDoPedido = new Date(v.data_hora);
                let horaQueSaiu = dataDoPedido.getHours();
                
                contagemHorarios[horaQueSaiu]++; // Conta 1 pedido
                valorHorarios[horaQueSaiu] += parseFloat(v.valor_total || 0); // Soma o dinheiro
            }
        });

        // Calcula a média dividindo o dinheiro ganho pelos pedidos feitos na hora
        let ticketMedioHorarios = new Array(24).fill(0);
        for(let i = 0; i < 24; i++) {
            if (contagemHorarios[i] > 0) {
                // Arredonda para 2 casas decimais (ex: 45.50)
                ticketMedioHorarios[i] = (valorHorarios[i] / contagemHorarios[i]).toFixed(2);
            }
        }

        desenharGraficoHorarios(contagemHorarios);
        desenharGraficoTicketMedio(ticketMedioHorarios);
        // --- FIM DO CÓDIGO DE HORÁRIOS E TICKET MÉDIO ---

        processarMetricasEGraficos(vendasValidas);

    } catch (erro) {
        console.error("Erro ao carregar Dashboard:", erro);
        alert("Falha ao puxar os dados. Verifique sua conexão com o servidor Icesoft.");
    }
}

function processarMetricasEGraficos(vendas) {
    let faturamentoTotal = 0;
    let pedidosValidos = vendas.length;

    let contagemPagamentos = {};
    let contagemOrigem = {};
    let contagemProdutos = {};
    let faturamentoPorDiaDaSemana = [0, 0, 0, 0, 0, 0, 0]; 
    let faturamentoPorData = {}; 

    vendas.forEach(v => {
        let valor = parseFloat(v.valor_total || v.total || 0);
        faturamentoTotal += valor;

        // --- FORMA DE PAGAMENTO ---
        let pag = v.forma_pagamento ? String(v.forma_pagamento).split('(')[0].trim() : 'Não Informado';
        if(pag.toLowerCase().includes('pix')) pag = 'Pix';
        contagemPagamentos[pag] = (contagemPagamentos[pag] || 0) + valor;

        // --- ORIGEM (CANAIS) ---
        let origem = v.origem || 'Balcão';
        contagemOrigem[origem] = (contagemOrigem[origem] || 0) + 1;

        // --- DATAS E DIAS DA SEMANA (Blindado contra fuso horário) ---
        if (v.data_hora) {
            // Cria um objeto de data considerando a string bruta do banco
            let dataGeral = new Date(v.data_hora);
            
            // Força a extração da data no fuso de São Paulo (YYYY-MM-DD)
            let dataFormatadaLocal = new Intl.DateTimeFormat('fr-CA', { 
                timeZone: 'America/Sao_Paulo', 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            }).format(dataGeral);
            
            // Extrai a data e converte para "Day" para o gráfico semanal, 
            // setando horas para o meio-dia para evitar "turnos" fantasmas.
            const [anoV, mesV, diaV] = dataFormatadaLocal.split('-');
            let dataObjeto = new Date(anoV, mesV - 1, diaV, 12, 0, 0); 

            faturamentoPorDiaDaSemana[dataObjeto.getDay()] += valor;
            faturamentoPorData[dataFormatadaLocal] = (faturamentoPorData[dataFormatadaLocal] || 0) + valor;
        }

        // --- PRODUTOS (Leitura indestrutível do JSON do Banco) ---
        let itensLidos = v.itens;
        if (typeof itensLidos === 'string') {
            if (itensLidos.includes("[object")) return; // Ignora lixo do banco
            if (itensLidos.trim().startsWith('[')) {
                try { itensLidos = JSON.parse(itensLidos); } catch(e) {}
            }
        }

        // Se for uma matriz (vendas mais recentes)
        if (Array.isArray(itensLidos)) {
            itensLidos.forEach(item => {
                let nome = typeof item === 'string' ? item : (item.nome || item.produto_nome || item.nomeBase || "");
                if (nome) {
                    let nomeLimpo = nome.replace('Delivery: ', '').split('(')[0].trim();
                    if (nomeLimpo) contagemProdutos[nomeLimpo] = (contagemProdutos[nomeLimpo] || 0) + 1;
                }
            });
        // Se for string corrida (vendas antigas)
        } else if (typeof itensLidos === 'string') {
            let textoLimpo = itensLidos.replace(/(Balcão:|Delivery:|Mesa\s\d+\s?-)\s*/gi, '');
            let nomeBase = textoLimpo.split('(')[0].trim();
            if (nomeBase) contagemProdutos[nomeBase] = (contagemProdutos[nomeBase] || 0) + 1;
        }
    });

    // --- ATUALIZAR OS KPIs VISUAIS ---
    document.getElementById('kpi-faturamento').innerText = `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`;
    document.getElementById('kpi-pedidos').innerText = pedidosValidos;
    document.getElementById('kpi-ticket').innerText = `R$ ${pedidosValidos > 0 ? (faturamentoTotal / pedidosValidos).toFixed(2).replace('.', ',') : '0,00'}`;

    // --- DESENHAR OS GRÁFICOS ---
    desenharGraficoEvolucao(faturamentoPorData);
    desenharGraficoDonut('graficoPagamentos', contagemPagamentos, chartPagamentos, (c) => chartPagamentos = c);
    desenharGraficoDonut('graficoOrigem', contagemOrigem, chartOrigem, (c) => chartOrigem = c, ['#00bcd4', '#e91e63', '#ff9800', '#4CAF50', '#9C27B0']);
    desenharGraficoTopProdutos(contagemProdutos);
    desenharGraficoDiasSemana(faturamentoPorDiaDaSemana);
}

// ==========================================
// FUNÇÕES DE DESENHO (CHART.JS)
// ==========================================

function desenharGraficoEvolucao(dadosPorData) {
    const ctx = document.getElementById('graficoEvolucao').getContext('2d');
    if (chartEvolucao) chartEvolucao.destroy();

    // Ordena as datas cronologicamente (YYYY-MM-DD)
    const datasOrdenadas = Object.keys(dadosPorData).sort();
    const valores = datasOrdenadas.map(data => dadosPorData[data]);
    
    // Formata a data para Dia/Mês apenas para a exibição na tela
    const labelsFormatadas = datasOrdenadas.map(d => d.split('-').reverse().slice(0, 2).join('/'));

    chartEvolucao = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelsFormatadas,
            datasets: [{
                label: 'Faturamento (R$)',
                data: valores,
                borderColor: '#00bcd4',
                backgroundColor: 'rgba(0, 188, 212, 0.2)',
                borderWidth: 3,
                pointBackgroundColor: '#e91e63',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function desenharGraficoDonut(idCanvas, dadosObjeto, chartAtual, setChartRef, coresCustomizadas) {
    const ctx = document.getElementById(idCanvas).getContext('2d');
    if (chartAtual) chartAtual.destroy();

    const labels = Object.keys(dadosObjeto);
    const valores = Object.values(dadosObjeto);
    const cores = coresCustomizadas || ['#25D366', '#e91e63', '#00bcd4', '#FFC107', '#9C27B0'];

    const novoChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: valores, backgroundColor: cores, borderWidth: 2, borderColor: '#fff' }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { family: 'Poppins' } } }
            }
        }
    });
    setChartRef(novoChart);
}

function desenharGraficoTopProdutos(contagemProdutos) {
    const ctx = document.getElementById('graficoTopProdutos').getContext('2d');
    if (chartProdutos) chartProdutos.destroy();

    // Pega o top 10 que mais vendeu
    const ordenado = Object.entries(contagemProdutos).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    chartProdutos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ordenado.map(i => i[0]),
            datasets: [{
                label: 'Unidades Vendidas',
                data: ordenado.map(i => i[1]),
                backgroundColor: '#e91e63',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', // Barra horizontal
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } }
        }
    });
}

function desenharGraficoDiasSemana(dadosDaSemana) {
    const ctx = document.getElementById('graficoDiasSemana').getContext('2d');
    if (chartDias) chartDias.destroy();

    chartDias = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
            datasets: [{
                label: 'Faturamento Total (R$)',
                data: dadosDaSemana,
                backgroundColor: '#FF9800',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function desenharGraficoHorarios(dadosHorarios) {
    const ctx = document.getElementById('graficoHorarios').getContext('2d');
    if (chartHorarios) chartHorarios.destroy();

    const labelsHoras = [
        '00h', '01h', '02h', '03h', '04h', '05h', '06h', '07h', 
        '08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', 
        '16h', '17h', '18h', '19h', '20h', '21h', '22h', '23h'
    ];

    chartHorarios = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labelsHoras,
            datasets: [{
                label: 'Qtd. de Pedidos',
                data: dadosHorarios,
                backgroundColor: '#9C27B0', // Cor roxa para destacar!
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function desenharGraficoTicketMedio(dadosTicket) {
    const ctx = document.getElementById('graficoTicketMedio').getContext('2d');
    if (chartTicketMedio) chartTicketMedio.destroy();

    const labelsHoras = [
        '00h', '01h', '02h', '03h', '04h', '05h', '06h', '07h', 
        '08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', 
        '16h', '17h', '18h', '19h', '20h', '21h', '22h', '23h'
    ];

    chartTicketMedio = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelsHoras,
            datasets: [{
                label: 'Ticket Médio (R$)',
                data: dadosTicket,
                borderColor: '#4CAF50', // Verde dinheiro!
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                borderWidth: 3,
                pointBackgroundColor: '#4CAF50',
                pointRadius: 4,
                fill: true,
                tension: 0.4 // Deixa a linha suave e curvada
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: { callback: function(value) { return 'R$ ' + value; } }
                },
                x: { grid: { display: false } }
            }
        }
    });
}