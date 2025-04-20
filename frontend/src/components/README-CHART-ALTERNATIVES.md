# Alternativas de Gráficos para o SidePanelStats

Este documento descreve as alternativas disponíveis para substituir os gráficos bugados no componente SidePanelStats.

## Problema Original

Os gráficos no componente original `RouletteSidePanelStats.tsx` apresentam problemas de renderização, com proporções incorretas e bugs visuais. Por isso, foram implementadas quatro alternativas utilizando bibliotecas modernas de visualização de dados.

## Alternativas Disponíveis

### 1. Recharts (Implementação Aprimorada)

**Arquivo:** `SidePanelStats.tsx`

**Vantagens:**
- Sintaxe declarativa baseada em componentes React
- Boa performance para datasets pequenos a médios
- Design responsivo
- Fácil personalização através de props
- Tamanho moderado de bundle

**Uso recomendado para:**
- Necessidades básicas de visualização
- Quando o design limpo é prioridade
- Usuários com conexões mais lentas (bundle menor)

### 2. Victory

**Arquivo:** `VictoryChartStats.tsx`

**Vantagens:**
- API consistente e flexível
- Animações suaves e fluidas
- Boa experiência do desenvolvedor
- Suporte para interatividade avançada
- Funciona em React Native com a mesma API

**Uso recomendado para:**
- Visualizações que precisam de animações elegantes
- Projetos que podem expandir para aplicativos móveis (React Native)
- Quando a interatividade é importante

### 3. ApexCharts

**Arquivo:** `ApexChartStats.tsx`

**Vantagens:**
- Recursos visuais avançados e modernos
- Diversas opções de personalização
- Excelente aparência "pronta para uso"
- Forte suporte para visualizações responsivas
- Ótimas tooltips e legendas interativas

**Uso recomendado para:**
- Dashboards profissionais
- Quando a interatividade rica é necessária
- Visualizações com elementos dinâmicos

### 4. Nivo Charts (Nova Implementação)

**Arquivo:** `NivoChartStats.tsx`

**Vantagens:**
- Construído sobre D3.js com otimização para React
- API declarativa e composable
- Temas personalizados avançados
- Excelente responsividade nativa
- Suporte completo a TypeScript
- Animações suaves e transições elegantes

**Uso recomendado para:**
- Visualizações de dados avançadas e personalizáveis
- Quando é necessário equilíbrio entre facilidade e flexibilidade
- Projetos que valorizam tipagem e segurança de tipos

Para mais detalhes sobre a implementação Nivo, consulte o arquivo `README-NIVO-CHARTS.md`.

## Como Usar o Seletor de Gráficos

O componente `ChartSelector.tsx` permite ao usuário alternar facilmente entre as diferentes implementações:

```jsx
import ChartSelector from './components/ChartSelector';

// Em seu componente
<ChartSelector 
  roletaNome="Roleta Exemplo"
  data={seusDados}
  wins={10}
  losses={5}
  onClose={() => handleClose()}
/>
```

### Propriedades aceitas:

- `roletaNome` (string): Nome da roleta a ser exibido
- `data` (object): Objeto com os dados para os gráficos
  - `colorDistribution`: Distribuição por cores
  - `frequencyData`: Dados de frequência
- `wins` (number): Número de vitórias
- `losses` (number): Número de derrotas
- `onClose` (function): Função para fechar o painel

## Instalação de Dependências

Para utilizar todas as alternativas, instale as seguintes dependências:

```bash
npm install recharts victory react-apexcharts apexcharts @nivo/core @nivo/pie @nivo/bar
# ou
yarn add recharts victory react-apexcharts apexcharts @nivo/core @nivo/pie @nivo/bar
```

## Formatos de Dados

Para compatibilidade com todas as implementações, use o seguinte formato de dados:

```javascript
const data = {
  colorDistribution: [
    { name: "Vermelhos", value: 50, color: "#ef4444" },
    { name: "Pretos", value: 45, color: "#111827" },
    { name: "Zero", value: 5, color: "#059669" }
  ],
  frequencyData: [
    { number: "0", frequency: 5 },
    { number: "1-9", frequency: 15 },
    { number: "10-18", frequency: 20 },
    { number: "19-27", frequency: 18 },
    { number: "28-36", frequency: 12 }
  ]
};
```

## Considerações de Performance

- **Recharts**: Melhor para uso geral e datasets pequenos a médios.
- **Victory**: Bom equilíbrio entre funcionalidade e performance.
- **ApexCharts**: Mais pesado, mas oferece os recursos mais avançados.
- **Nivo**: Equilibra bem a performance com recursos avançados.

## Problemas Conhecidos

Ao utilizar em dispositivos móveis, considere as seguintes limitações:

1. Alguns gráficos podem não se redimensionar corretamente em telas muito pequenas.
2. Interações de toque podem não funcionar perfeitamente em todas as implementações.

## Exemplos

Veja exemplos práticos de implementação na pasta `examples/` (se disponível).

---

Para mais informações sobre cada biblioteca:
- [Recharts](https://recharts.org/)
- [Victory](https://formidable.com/open-source/victory/)
- [ApexCharts](https://apexcharts.com/) 
- [Nivo](https://nivo.rocks/) 