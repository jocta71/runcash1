# Implementação de Gráficos com Nivo Charts

Este documento descreve a implementação de gráficos utilizando a biblioteca Nivo Charts no projeto.

## Sobre o Nivo Charts

[Nivo Charts](https://nivo.rocks/) é uma biblioteca de visualização de dados para React que oferece uma ampla variedade de componentes de gráficos com uma API declarativa e consistente. Construída sobre D3.js, a biblioteca fornece componentes reutilizáveis com alto nível de personalização e excelente desempenho.

## Vantagens do Nivo Charts

- **API Declarativa**: Sintaxe declarativa de componentes React
- **Personalização Avançada**: Temas personalizados e configurações detalhadas
- **Interatividade Rica**: Suporte para interações como hover, clique e seleção
- **Responsividade Nativa**: Adaptação automática a diferentes tamanhos de tela
- **Animações Suaves**: Transições suaves entre estados
- **Tipagem TypeScript**: Suporte completo para TypeScript
- **Renderização no Servidor**: Possibilidade de renderização no lado do servidor

## Componente NivoChartStats

O componente `NivoChartStats.tsx` implementa três tipos de gráficos para exibição de estatísticas:

1. **Gráfico de Pizza (Distribuição por Cor)**: Exibe a distribuição de cores em um formato de pizza com legenda
2. **Gráfico de Rosca (Taxa de Vitória)**: Mostra a taxa de vitórias e derrotas em formato de rosca com porcentagem central
3. **Gráfico de Barras (Frequência de Números)**: Apresenta a frequência de diferentes faixas de números em formato de barras

## Como Utilizar

Para utilizar o componente NivoChartStats, você precisa:

1. Instalar as dependências necessárias:

```bash
npm install @nivo/core @nivo/pie @nivo/bar
# ou
yarn add @nivo/core @nivo/pie @nivo/bar
```

2. Importar e utilizar o componente:

```jsx
import NivoChartStats from './components/NivoChartStats';

// Em seu componente
<NivoChartStats 
  roletaNome="Roleta Exemplo"
  data={seusDados}
  wins={10}
  losses={5}
/>
```

## Estrutura de Dados

O componente aceita os seguintes formatos de dados:

### Distribuição por Cor

```javascript
const colorDistribution = [
  { name: "Vermelhos", value: 50, color: "#ef4444" },
  { name: "Pretos", value: 45, color: "#111827" },
  { name: "Zero", value: 5, color: "#059669" }
];
```

### Dados de Frequência

```javascript
const frequencyData = [
  { number: "0", frequency: 5 },
  { number: "1-9", frequency: 15 },
  { number: "10-18", frequency: 20 },
  { number: "19-27", frequency: 18 },
  { number: "28-36", frequency: 12 }
];
```

## Comparação com Outras Bibliotecas

| Característica | Nivo | Recharts | Chart.js | D3.js |
|----------------|------|----------|----------|-------|
| Facilidade de uso | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Personalização | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Desempenho | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Tipagem TypeScript | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Responsividade | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Bundle Size | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |

## Considerações de Performance

O Nivo Charts é construído em cima do D3.js, mas otimizado para o ciclo de vida do React. Isso significa que ele oferece uma boa performance para a maioria dos casos de uso, mas para conjuntos de dados muito grandes, pode ser necessário implementar otimizações adicionais.

## Recursos Adicionais

- [Documentação oficial do Nivo](https://nivo.rocks/components)
- [Storybook com exemplos](https://nivo.rocks/storybook)
- [Repositório GitHub](https://github.com/plouc/nivo)

## Extensões Possíveis

O componente atual pode ser estendido com funcionalidades adicionais como:

- Tooltips personalizados para mostrar mais informações ao passar o mouse
- Animações mais elaboradas durante a transição de dados
- Interações de clique para filtrar ou expandir informações
- Gráficos adicionais como linha do tempo, heatmap, radar, etc.

---

Para mais informações sobre como utilizar ou estender este componente, consulte o código-fonte em `NivoChartStats.tsx`. 