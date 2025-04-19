# Atualização da Integração com API Gemini

## Resumo das Alterações
Este documento descreve as alterações realizadas para atualizar a integração com a API do Google Gemini:

1. **Atualização da URL da API**: 
   - Alterado de `v1beta` para `v1` para usar a versão estável da API

2. **Atualização do Modelo**:
   - Alterado de `gemini-pro` para `gemini-2.0-flash`
   - O modelo mais recente oferece melhor desempenho e resposta mais rápida

3. **Correção no Formato da Mensagem**:
   - Removido o uso do role "system" (não suportado pela API atual)
   - Instruções do sistema incorporadas na mensagem do usuário

## Arquivos Modificados
- `.env` - Atualizado modelo padrão para `gemini-2.0-flash`
- `api/ai/query.js` - Atualizada URL da API e formato de mensagem
- `test-gemini.js` - Atualizado formato de mensagem para compatibilidade

## Instruções para Futuras Atualizações

### Atualização de Modelos
Para atualizar o modelo utilizado, modifique a variável `GEMINI_MODEL` no arquivo `.env`. Opções atuais:
- `gemini-2.0-flash` (recomendado)
- `gemini-2.0-flash-001` (versão específica estável)
- `gemini-2.0-flash-lite` (para menor custo/latência)
- `gemini-pro` (modelo anterior)

### Formato da Mensagem
A API Gemini atual não suporta o role "system". Portanto, todas as instruções para o modelo devem ser incluídas no role "user". Use o seguinte formato:

```javascript
{
  contents: [
    {
      role: "user",
      parts: [
        { 
          text: `Instruções do sistema:
          [Instruções aqui]
          
          Dados: [Dados aqui]
          
          Consulta: [Consulta aqui]`
        }
      ]
    }
  ]
}
```

### Teste de Integração
Use o script `test-gemini.js` para testar a integração com a API antes de fazer deploy das alterações:

```
node test-gemini.js
```

## Referências
- [Documentação da API Gemini](https://ai.google.dev/gemini-api/docs)
- [Modelos Gemini disponíveis](https://ai.google.dev/gemini-api/docs/models)
- [Parâmetros de Geração](https://ai.google.dev/gemini-api/docs/models/gemini) 