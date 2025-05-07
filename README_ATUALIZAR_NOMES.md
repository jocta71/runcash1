# Atualização de Nomes de Roletas

Este pacote contém scripts para atualizar os nomes das roletas no banco de dados MongoDB (`roletas_db`), substituindo os nomes genéricos como "Roleta 2010011" por nomes descritivos como "Deutsches Roulette".

## Arquivos Incluídos

1. `atualizar_nomes_roletas.py` - Script Python principal
2. `atualizar_nomes_roletas.sh` - Script Shell para Linux/Mac
3. `atualizar_nomes_roletas.ps1` - Script PowerShell para Windows
4. `atualizar_nomes_roletas.bat` - Script Batch para Windows (mais simples)

## Requisitos

- Python 3.6 ou superior
- Pacotes Python: `pymongo`, `python-dotenv`
- Conexão com o banco de dados MongoDB

## Como Usar

### No Windows

#### Opção 1: Batch Script (Mais Fácil)
1. Clique duas vezes no arquivo `atualizar_nomes_roletas.bat`
2. O script verificará os requisitos e executará a atualização automaticamente

#### Opção 2: PowerShell (Mais Detalhado)
1. Clique com o botão direito no arquivo `atualizar_nomes_roletas.ps1`
2. Selecione "Executar com PowerShell"
3. Se necessário, execute `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` antes

### No Linux/Mac

1. Abra o terminal
2. Navegue até o diretório dos scripts
3. Execute: `chmod +x atualizar_nomes_roletas.sh`
4. Execute: `./atualizar_nomes_roletas.sh`

### Manual (Qualquer Sistema)

1. Instale as dependências: `pip install pymongo python-dotenv`
2. Execute: `python atualizar_nomes_roletas.py`

## Personalização

O arquivo `atualizar_nomes_roletas.py` contém um dicionário `MAPEAMENTO_NOMES` que mapeia os IDs das roletas para seus nomes descritivos. Se precisar adicionar ou modificar nomes, edite este dicionário.

## O Que o Script Faz

1. Conecta ao banco de dados MongoDB Atlas
2. Para cada roleta no mapeamento:
   - Busca o documento atual
   - Verifica se o nome precisa ser atualizado
   - Atualiza o campo `roleta_nome` com o nome descritivo
3. Verifica roletas sem mapeamento
4. Gera um relatório de atualizações

## Após a Atualização

As mudanças serão aplicadas imediatamente no banco de dados. Para ver as mudanças no frontend:

1. Reinicie o servidor da aplicação, ou
2. Aguarde o próximo ciclo de atualização de dados (se houver cache)

## Solução de Problemas

- **Erro de Conexão**: Verifique suas credenciais no arquivo `.env`
- **Roletas Não Encontradas**: Verifique se o ID está correto e se a roleta existe no banco
- **Pacotes Python Faltando**: Execute `pip install pymongo python-dotenv` 