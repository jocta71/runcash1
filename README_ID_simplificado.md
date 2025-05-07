# Sistema de Banco de Dados de Roletas - Formato ID Simplificado

Esta documentação descreve a nova estrutura de banco de dados para roletas que utiliza apenas o ID numérico como nome das coleções, em vez do formato anterior `roleta_ID`.

## Visão Geral

A estrutura implementada utiliza um banco de dados dedicado chamado `roletas_db` que armazena cada roleta em sua própria coleção, agora com nomes simplificados:

- Formato anterior: `roleta_2010048`
- Novo formato: `2010048`

## Benefícios

Esta simplificação traz vários benefícios:

1. **Nomes mais curtos e limpos**: Facilita referências e consultas
2. **Compatibilidade direta com ID da roleta**: O nome da coleção é exatamente o ID da roleta
3. **Menos redundância**: Elimina a repetição do prefixo "roleta_" em cada coleção
4. **Padronização**: Todos os IDs agora seguem o mesmo formato numérico (7 dígitos)

## Estrutura do Banco de Dados

O banco de dados `roletas_db` contém as seguintes coleções:

- `metadados`: Informações sobre cada roleta (ID, nome, etc.)
- `{ID}`: Uma coleção para cada roleta, onde {ID} é o identificador numérico (ex: 2010048)
- `numeros_view`: View unificada que agrega todas as coleções de roletas
- `estatisticas`: Estatísticas calculadas para cada roleta (opcional)

## Scripts de Migração

Foram desenvolvidos vários scripts para facilitar a migração e manutenção deste novo formato:

1. **padronizar_ids_roletas.py**: Remove coleções antigas e UUIDs, mantendo apenas IDs numéricos
2. **reconstruir_view.py**: Reconstrói a view unificada com todas as coleções numéricas
3. **adaptar_scraper_roletas_db.py**: Adaptador para o scraper usar o novo formato
4. **criar_banco_roletas_novo.py**: Script para criar o banco de dados já no novo formato

## Como Usar

Para trabalhar com a nova estrutura, utilize as seguintes práticas:

### Consultar uma Roleta Específica

```python
# Acesso direto usando o ID da roleta
db_roletas["2010048"].find({...})  # Consulta para roleta Dansk Roulette

# Ou usando metadados para obter a coleção
meta = db_roletas.metadados.find_one({"roleta_nome": "Dansk Roulette"})
colecao_nome = meta["colecao"]
db_roletas[colecao_nome].find({...})
```

### Consultar Todas as Roletas de Uma Vez

```python
# Usar a view unificada
db_roletas.numeros_view.find({...})
```

### Inserir Números

```python
# Inserir diretamente na coleção correspondente
db_roletas["2010048"].insert_one({
    "numero": 17,
    "cor": "vermelho",
    "timestamp": datetime.now()
})
```

## Manutenção

### Verificação de Integridade

É recomendável verificar periodicamente a integridade das coleções e metadados:

1. Garantir que todos os IDs nos metadados correspondam a coleções existentes
2. Verificar que todas as coleções numéricas estão incluídas na view

### Backup

Antes de qualquer alteração no banco de dados, realize um backup completo utilizando:

```bash
mongodump --uri="seu_uri_mongodb" --db=roletas_db --out=/caminho/para/backup
```

## Solução de Problemas

### Coleção não encontrada

Se uma coleção não for encontrada para uma roleta específica:

1. Verifique se o ID está correto
2. Consulte a coleção `metadados` para confirmar o mapeamento:
   ```python
   db_roletas.metadados.find_one({"roleta_id": "2010048"})
   ```

### Erro na View Unificada

Se a view unificada não estiver funcionando corretamente:

1. Execute o script `reconstruir_view.py` para recriar a view
2. Se persistir, use consultas individuais nas coleções específicas

## Próximos Passos

Para evoluir ainda mais esta estrutura, considere:

1. Implementar particionamento por data para coleções muito grandes
2. Configurar políticas de retenção de dados antigos
3. Otimizar índices para consultas frequentes

---

**IMPORTANTE**: Mantenha os scripts de migração e a documentação atualizados sempre que houver mudanças na estrutura do banco de dados. 