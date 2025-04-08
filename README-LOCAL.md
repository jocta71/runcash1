# Executando o RunCash Localmente

Este documento fornece instruções detalhadas para executar o projeto RunCash em ambiente de desenvolvimento local.

## Pré-requisitos

1. **Node.js** (versão 16.x ou superior)
   - Baixe em: https://nodejs.org/en/download/
   - Verifique a instalação com: `node -v` e `npm -v`

2. **Git** (para clonar o repositório)
   - Baixe em: https://git-scm.com/downloads

## Passos para Executar

### 1. Clone o Repositório (se ainda não tiver feito)

```bash
git clone https://github.com/jocta71/runcash1.git
cd runcash1
```

### 2. Instalação Automática (Windows)

Execute o script de configuração automática no PowerShell:

```powershell
powershell -File setup-run-local.ps1
```

Este script irá:
- Verificar se o Node.js está instalado
- Instalar as dependências necessárias
- Iniciar o servidor de desenvolvimento

### 3. Instalação Manual

Se preferir instalar manualmente ou estiver usando Linux/macOS:

```bash
# Navegar para o diretório frontend
cd frontend

# Instalar dependências principais
npm install

# Instalar dependências da nova arquitetura de roletas
npm install axios socket.io-client events --save
npm install @types/node @types/react @types/react-dom @types/jest ts-jest @testing-library/react @testing-library/jest-dom --save-dev

# Iniciar o servidor de desenvolvimento
npm run dev
```

### 4. Acessando a Aplicação

Após iniciar o servidor de desenvolvimento, a aplicação estará disponível em:

**URL:** http://localhost:5173/

## Estrutura do Projeto

A nova arquitetura de roletas está organizada da seguinte forma:

```
frontend/src/
├── services/
│   ├── api/               # Clientes de API REST
│   ├── socket/            # Cliente de WebSocket
│   ├── data/              # Repositório de dados
│   ├── config/            # Configurações
│   └── ui/components/     # Componentes de UI 
├── hooks/                 # Hooks personalizados React
└── pages/                 # Páginas da aplicação
```

## Resolução de Problemas

### Erro: "npm não é reconhecido como um comando"

Isso indica que o Node.js não está corretamente instalado ou não está no PATH do sistema.
- Verifique se o Node.js foi instalado corretamente
- Reinicie o terminal após a instalação
- Em alguns casos, pode ser necessário reiniciar o computador

### Erro ao iniciar o servidor de desenvolvimento

Se o servidor não iniciar corretamente:
1. Verifique se todas as dependências foram instaladas: `npm install`
2. Limpe o cache do npm: `npm cache clean --force`
3. Exclua a pasta node_modules e reinstale: `rm -rf node_modules && npm install`

### Problemas de CORS ao acessar a API

Se encontrar erros de CORS durante o desenvolvimento:
1. Verifique se está acessando a API correta (desenvolvimento vs. produção)
2. Certifique-se de que as URLs nos arquivos de configuração estão corretas

## Desenvolvimento

Para desenvolver usando a nova arquitetura de roletas:

1. **Componentes UI**: Adicione novos componentes em `services/ui/components/`
2. **Acesso a dados**: Use os hooks personalizados em `hooks/useRoulette.ts`
3. **Novas páginas**: Crie em `pages/` e adicione à rota em `App.tsx`

Consulte `CONTRIBUTING.md` para mais detalhes sobre os padrões de desenvolvimento. 