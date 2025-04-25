# Deploy do Frontend no Vercel

Este guia explica como fazer o deploy do frontend RunCash no Vercel.

## Pré-requisitos

- Uma conta no [Vercel](https://vercel.com/)
- Um repositório Git com o código do frontend (GitHub, GitLab ou Bitbucket)
- A API backend do RunCash em execução e acessível publicamente

## Passo 1: Configurar as Variáveis de Ambiente

Antes de fazer o deploy, é necessário garantir que o arquivo `.env.production` esteja configurado corretamente com as URLs da sua API.

Edite o arquivo `.env.production` e atualize as seguintes variáveis:

```
# Substitua pelo URL público da sua API
VITE_SSE_SERVER_URL=https://seu-dominio-api.com/api/events
VITE_SOCKET_URL=https://seu-dominio-api.com
```

Se você estiver executando a API localmente, considere usar um serviço como [ngrok](https://ngrok.com/) ou [localtunnel](https://localtunnel.github.io/www/) para expor sua API localmente para a Internet.

## Passo 2: Preparar o Repositório

Certifique-se de que o código esteja pronto para deploy:

1. Teste a aplicação localmente: `npm run dev`
2. Verifique se o build está funcionando: `npm run build`
3. Commit e push das alterações finais para o repositório:

```bash
git add .
git commit -m "Preparação para deploy no Vercel"
git push
```

## Passo 3: Deploy no Vercel

### Opção 1: Deploy via Interface Web do Vercel

1. Faça login no [Vercel](https://vercel.com/)
2. Clique em "Add New..." > "Project"
3. Importe o repositório Git com o código do frontend
4. Configure o projeto:
   - Framework Preset: Selecione "Vite"
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. Expanda a seção "Environment Variables" e adicione as mesmas variáveis do arquivo `.env.production`
6. Clique em "Deploy"

### Opção 2: Deploy via Vercel CLI

1. Instale a Vercel CLI: `npm i -g vercel`
2. No diretório do projeto, execute: `vercel login`
3. Para fazer o deploy, execute: `vercel`
4. Siga as instruções e configure:
   - Set up and deploy: Yes
   - Link to existing project: Yes (se já tiver criado o projeto no Vercel)
   - Environment variables: Adicione as mesmas do `.env.production`

## Passo 4: Verificar o Deploy

1. Após o deploy, o Vercel fornecerá uma URL para acessar o site (ex: `https://seu-projeto.vercel.app`)
2. Acesse a URL e verifique se o frontend está funcionando corretamente
3. Verifique se a conexão com a API está funcionando:
   - Os dados das roletas são exibidos
   - A conexão em tempo real está funcionando

## Passo 5: Configuração de Domínio Personalizado (Opcional)

1. No dashboard do Vercel, vá para o seu projeto
2. Clique em "Settings" > "Domains"
3. Adicione seu domínio personalizado e siga as instruções

## Solução de Problemas

### Erro de CORS

Se encontrar erros de CORS, verifique:

1. A configuração de CORS no backend está permitindo o domínio do Vercel
2. As URLs da API no frontend estão corretas
3. A API está acessível publicamente

### Erro de Conexão com a API

Se o frontend não conseguir se conectar à API:

1. Verifique se a API está em execução
2. Confirme se as URLs da API estão corretas no arquivo `.env.production`
3. Verifique se o domínio da API está configurado corretamente no backend

## Atualização do Deploy

Quando fizer alterações no código, basta fazer push para o repositório Git, e o Vercel fará automaticamente o redeploy.

Para forçar uma nova compilação, vá ao dashboard do Vercel, selecione seu projeto e clique em "Redeploy".

# Instruções de Implantação para Otimizações da API

Este documento explica as otimizações implementadas para melhorar o desempenho dos endpoints de API e fornece instruções para implantação.

## Otimizações Implementadas

### 1. Novos Endpoints Otimizados

- **`/api/ROULETTES/basic`**: Retorna apenas dados básicos das roletas, sem números (mais leve e rápido)
- **`/api/ROULETTES-numbers/[id]`**: Endpoint otimizado para buscar números de uma roleta específica com paginação
- **`/api/ROULETTES`**: Atualizado para suportar paginação e diferentes modos de busca

### 2. Melhorias no Sistema de Proxy

- Adicionado suporte para failover automático entre múltiplos backends
- Implementado sistema de retry para requisições falhas
- Melhorado logging para diagnóstico de problemas
- Adicionado controle de timeout para evitar requisições pendentes

### 3. Ferramentas de Diagnóstico

- Novo endpoint `/api/api-status` para verificar a saúde dos backends
- Logs detalhados para identificar problemas de conectividade

## Arquivos Atualizados

1. `frontend/api/ROULETTES.js` - Endpoint principal com paginação
2. `frontend/api/ROULETTES-basic.js` - Novo endpoint para dados básicos
3. `frontend/api/ROULETTES-numbers/[id].js` - Endpoint para números por roleta
4. `frontend/api/proxy.js` - Sistema de proxy melhorado
5. `frontend/api/api-status.js` - Endpoint de diagnóstico

## Instruções para Implantação na Vercel

1. Certifique-se de que todos os arquivos estejam no repositório Git
2. Execute implantação na Vercel usando o comando:
   ```bash
   vercel --prod
   ```
3. Após a implantação, verifique o status dos novos endpoints:
   ```
   https://YOUR-DOMAIN.vercel.app/api/api-status
   ```

## Arquitetura do Sistema de Proxy

O sistema de proxy foi redesenhado para lidar com múltiplos backends:

1. Quando uma requisição chega, tentamos primeiro o backend principal
2. Se o backend principal falha, tentamos automaticamente os backends de backup
3. Mantemos estatísticas de falhas para cada backend e selecionamos o mais confiável
4. Implementamos timeouts e tratamento adequado de erros

## Compatibilidade

Os novos endpoints são totalmente compatíveis com o código frontend existente. O serviço `RouletteApi` foi atualizado para usar os novos endpoints, mas continuará funcionando mesmo que precise fazer fallback para os endpoints antigos.

## Troubleshooting

Se você encontrar problemas após a implantação:

1. Verifique `/api/api-status` para diagnóstico detalhado
2. Certifique-se de que todas as dependências estão instaladas
3. Verifique os logs de build da Vercel para erros
4. Se necessário, faça rollback para a versão anterior 