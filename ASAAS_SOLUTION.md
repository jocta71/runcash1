# Solução para Problemas de Autenticação na API do Asaas

Este documento fornece instruções para resolver problemas comuns de autenticação na integração com a API do Asaas.

## Erro 401 - Não Autorizado

Se você está recebendo erros `401 Unauthorized` nas chamadas para a API do Asaas, siga estes passos:

### 1. Verifique se está usando a API Key correta

A API Key é específica para cada ambiente (sandbox ou produção).

- **Acesse o Painel do Asaas**:
  - Para sandbox: [https://sandbox.asaas.com](https://sandbox.asaas.com)
  - Para produção: [https://www.asaas.com](https://www.asaas.com)

- **Gere uma nova chave API**:
  1. Faça login na sua conta
  2. Navegue até **Integrações > API Key**
  3. Clique em **Gerar nova chave** (se necessário)
  4. Copie a chave gerada

### 2. Atualize a variável de ambiente

Após obter a chave API correta:

- **No Vercel**:
  1. Acesse [https://vercel.com](https://vercel.com)
  2. Selecione seu projeto
  3. Vá para **Settings > Environment Variables**
  4. Atualize ou adicione a variável `ASAAS_API_KEY` com a nova chave
  5. Faça um novo deploy do projeto

- **Em ambiente local**:
  1. Edite o arquivo `.env` na raiz do projeto
  2. Atualize o valor da variável `ASAAS_API_KEY`
  3. Reinicie a aplicação

### 3. Garanta que os cabeçalhos HTTP estejam corretos

A API do Asaas requer cabeçalhos específicos para autenticação:

```javascript
const headers = {
  'Content-Type': 'application/json',
  'User-Agent': 'RunCash/1.0',  // Identifique sua aplicação 
  'access_token': process.env.ASAAS_API_KEY
};
```

### 4. Verifique se a sua conexão com a API está correta

Para diagnosticar problemas, execute o script de diagnóstico:

```
node diagnose-asaas.js
```

### 5. Ambiente correto

Certifique-se de que está usando a URL base correta para o ambiente desejado:

- Sandbox: `https://sandbox.asaas.com/api/v3`
- Produção: `https://api.asaas.com/v3`

## Testando a Conexão com o Asaas

Execute o script de diagnóstico para verificar se sua conexão com a API está funcionando:

```bash
node diagnose-asaas.js
```

Este script irá:
1. Verificar se a variável de ambiente `ASAAS_API_KEY` está configurada
2. Fazer uma chamada de teste para a API do Asaas
3. Mostrar o status da resposta e qualquer erro encontrado

## Problemas no Frontend

Se a integração funciona localmente mas não no ambiente de produção:

1. Verifique se as chamadas de API estão usando URLs relativas (`/api/asaas-create-customer`) em vez de URLs absolutas
2. Confirme que os redirecionamentos no `vercel.json` estão configurados corretamente
3. Verifique se as variáveis de ambiente estão definidas no ambiente de produção

## Documentação Oficial

Para mais informações, consulte a documentação oficial do Asaas:
- [Documentação da API](https://docs.asaas.com/reference/api-asaas)
- [Integração de Pagamentos](https://docs.asaas.com/docs/pagamentos)
- [Integração de Assinaturas](https://docs.asaas.com/docs/assinaturas) 