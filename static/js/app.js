document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const timestamp = document.getElementById('timestamp');
    const filtroEvolution = document.getElementById('filtro-evolution');
    const filtroPragmatic = document.getElementById('filtro-pragmatic');
    const buscaMesa = document.getElementById('busca-mesa');
    const listaEvolution = document.getElementById('lista-evolution');
    const listaPragmatic = document.getElementById('lista-pragmatic');
    const listaOutro = document.getElementById('lista-outro');
    const mesasEvolution = document.getElementById('mesas-evolution');
    const mesasPragmatic = document.getElementById('mesas-pragmatic');
    const mesasOutro = document.getElementById('mesas-outro');
    
    // Estado da aplicação
    let mesasData = [];
    
    // Configurar eventos de filtro
    filtroEvolution.addEventListener('change', atualizarVisibilidade);
    filtroPragmatic.addEventListener('change', atualizarVisibilidade);
    buscaMesa.addEventListener('input', atualizarVisibilidade);
    
    // Função para buscar dados das mesas
    function buscarDados() {
        fetch('/api/mesas')
            .then(response => response.json())
            .then(data => {
                mesasData = data.mesas;
                timestamp.textContent = 'Atualizado em: ' + data.timestamp;
                renderizarMesas();
                atualizarVisibilidade();
            })
            .catch(error => console.error('Erro ao buscar dados:', error));
    }
    
    // Função para renderizar as mesas na interface
    function renderizarMesas() {
        // Limpar listas existentes
        listaEvolution.innerHTML = '';
        listaPragmatic.innerHTML = '';
        listaOutro.innerHTML = '';
        
        // Renderizar cada mesa
        mesasData.forEach(mesa => {
            const mesaElement = criarElementoMesa(mesa);
            
            // Adicionar à lista apropriada
            if (mesa.fornecedor === 'Evolution') {
                listaEvolution.appendChild(mesaElement);
            } else if (mesa.fornecedor === 'Pragmatic') {
                listaPragmatic.appendChild(mesaElement);
            } else {
                listaOutro.appendChild(mesaElement);
            }
        });
    }
    
    // Função para criar elemento HTML para uma mesa
    function criarElementoMesa(mesa) {
        const mesaCard = document.createElement('div');
        mesaCard.className = 'mesa-card';
        mesaCard.dataset.fornecedor = mesa.fornecedor.toLowerCase();
        mesaCard.dataset.nome = mesa.nome.toLowerCase();
        
        // Cabeçalho da mesa
        const mesaHeader = document.createElement('div');
        mesaHeader.className = 'mesa-header';
        
        const mesaNome = document.createElement('div');
        mesaNome.className = 'mesa-nome';
        mesaNome.textContent = mesa.nome;
        
        mesaHeader.appendChild(mesaNome);
        mesaCard.appendChild(mesaHeader);
        
        // Informações adicionais
        const mesaInfo = document.createElement('div');
        mesaInfo.className = 'mesa-info';
        
        const dealer = document.createElement('span');
        dealer.textContent = 'Dealer: ' + mesa.dealer;
        
        const jogadores = document.createElement('span');
        jogadores.textContent = 'Jogadores: ' + mesa.jogadores;
        
        mesaInfo.appendChild(dealer);
        mesaInfo.appendChild(jogadores);
        mesaCard.appendChild(mesaInfo);
        
        // Container para números
        const numerosContainer = document.createElement('div');
        numerosContainer.className = 'numeros-container';
        
        // Último número
        const ultimoNumeroContainer = document.createElement('div');
        ultimoNumeroContainer.className = 'ultimo-numero';
        
        const ultimoLabel = document.createElement('div');
        ultimoLabel.className = 'numero-label';
        ultimoLabel.textContent = 'Último:';
        
        const ultimoNumero = document.createElement('div');
        ultimoNumero.className = `numero grande ${mesa.ultimo.cor}`;
        ultimoNumero.textContent = mesa.ultimo.numero;
        
        ultimoNumeroContainer.appendChild(ultimoLabel);
        ultimoNumeroContainer.appendChild(ultimoNumero);
        numerosContainer.appendChild(ultimoNumeroContainer);
        
        // Histórico
        const historicoLabel = document.createElement('div');
        historicoLabel.className = 'numero-label';
        historicoLabel.textContent = 'Histórico:';
        
        const historicoContainer = document.createElement('div');
        historicoContainer.className = 'historico-container';
        
        // Adicionar números do histórico
        mesa.historico.forEach(item => {
            const numeroElement = document.createElement('div');
            numeroElement.className = `numero ${item.cor}`;
            numeroElement.textContent = item.numero;
            historicoContainer.appendChild(numeroElement);
        });
        
        numerosContainer.appendChild(historicoLabel);
        numerosContainer.appendChild(historicoContainer);
        mesaCard.appendChild(numerosContainer);
        
        // Última atualização
        const ultimaAtualizacao = document.createElement('div');
        ultimaAtualizacao.className = 'ultima-atualizacao';
        ultimaAtualizacao.textContent = 'Atualizado: ' + mesa.ultima_atualizacao;
        mesaCard.appendChild(ultimaAtualizacao);
        
        return mesaCard;
    }
    
    // Função para atualizar visibilidade com base nos filtros
    function atualizarVisibilidade() {
        const mostrarEvolution = filtroEvolution.checked;
        const mostrarPragmatic = filtroPragmatic.checked;
        const textoBusca = buscaMesa.value.toLowerCase().trim();
        
        // Atualizar visibilidade das seções
        mesasEvolution.style.display = mostrarEvolution ? 'block' : 'none';
        mesasPragmatic.style.display = mostrarPragmatic ? 'block' : 'none';
        
        // Filtrar cards individuais pela busca
        document.querySelectorAll('.mesa-card').forEach(card => {
            const nome = card.dataset.nome;
            const fornecedor = card.dataset.fornecedor;
            
            // Verificar se o nome contém o texto de busca
            const correspondeABusca = !textoBusca || nome.includes(textoBusca);
            
            // Verificar se o fornecedor está habilitado
            const fornecedorHabilitado = 
                (fornecedor === 'evolution' && mostrarEvolution) ||
                (fornecedor === 'pragmatic' && mostrarPragmatic) ||
                (fornecedor !== 'evolution' && fornecedor !== 'pragmatic');
            
            // Atualizar visibilidade
            card.style.display = (correspondeABusca && fornecedorHabilitado) ? 'block' : 'none';
        });
    }
    
    // Buscar dados iniciais
    buscarDados();
    
    // Configurar atualização periódica
    setInterval(buscarDados, 5000); // Atualizar a cada 5 segundos
});