# Scraper WebSocket Unibet

Este projeto contém scripts para capturar dados de jogos de roleta do Unibet via WebSocket.

## Requisitos

- Python 3.8+
- Bibliotecas Python (instaláveis via pip)

## Instalação

1. Instale as dependências:

```bash
pip install -r requirements.txt
```

2. Para o método com Playwright, você também precisará instalar os navegadores:

```bash
python -m playwright install chromium
```

## Métodos de Captura

Existem dois scripts disponíveis para capturar os dados:

### 1. Conexão Direta WebSocket (unibet_websocket_scraper.py)

Este método tenta se conectar diretamente ao WebSocket do Unibet e capturar os dados:

```bash
python unibet_websocket_scraper.py
```

**Vantagens:**
- Simples e leve
- Baixo consumo de recursos

**Desvantagens:**
- Pode ser bloqueado mais facilmente
- Não lida com autenticação automaticamente

### 2. Captura via Proxy com Playwright (unibet_proxy_scraper.py)

Este método usa um navegador headless para se conectar ao site e capturar o tráfego WebSocket:

```bash
python unibet_proxy_scraper.py
```

**Vantagens:**
- Mais robusto contra bloqueios
- Captura todo o tráfego WebSocket
- Funciona mesmo com sites que requerem JavaScript

**Desvantagens:**
- Maior consumo de recursos
- Mais complexo

## Dados Capturados

Os dados são salvos em arquivos JSON nas pastas:
- `dados_unibet/` (para conexão direta)
- `dados_unibet_proxy/` (para método de proxy)

Cada evento é salvo como uma linha JSON com a seguinte estrutura:

```json
{
  "timestamp": "2023-04-13T15:30:45.123456",
  "mesa": "roulette_TABLE",
  "dados": {
    "messageType": "RouletteNumbersUpdated",
    "uniqueGameId": "roulette_TABLE-SpeedAutoRo00001@evolution",
    "tableUpdate": {
      "results": ["4", "14", "20", "0", "30", "25", "23", "22", "19", "1"]
    }
  }
}
```

## Logs

Os logs são gravados em:
- `unibet_scraper.log` (para conexão direta)
- `unibet_proxy.log` (para método de proxy)

## Solução de Problemas

### Erro de Conexão WebSocket

Se você receber erros de conexão com o WebSocket direto, tente:
1. Verificar se a URL do WebSocket está atualizada
2. Usar o método de proxy como alternativa

### Captcha ou Bloqueio

Se o site estiver bloqueando a conexão:
1. Tente diminuir a frequência de requisições
2. Use o método de proxy que simula um navegador real

## Limitações

- Os scripts podem parar de funcionar se o Unibet alterar sua API ou estrutura WebSocket
- Algumas mensagens podem exigir autenticação para serem recebidas
- O uso destes scripts deve respeitar os Termos de Serviço do Unibet 