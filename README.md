# Gira do Workshop

Aplicação fullstack simples para usar nas demonstrações do workshop de codificação agêntica.

## O que a aplicação faz

Uma central de tickets operacionais com:

- dashboard com métricas;
- listagem com filtros e busca;
- criação de tickets;
- mudança de status com regra de transição;
- persistência simples em JSON.

## Stack

- Backend: Node.js + Express
- Frontend: HTML, CSS e JavaScript servidos pelo backend
- Testes: `node:test`

## Como rodar

```bash
cd gira-app
npm install
npm start
```

Abra `http://localhost:3000`.

## Como testar

```bash
npm test
```

## Como expor cards via MCP

```bash
npm run mcp
```

Esse comando inicia um servidor MCP local por stdio. Ele expoe ferramentas para listar cards da Gira e buscar um card especifico por ID.

Ferramentas disponiveis:

- `list_flow_cards`: filtra por `status`, `type`, `priority`, `query` e `limit`;
- `get_flow_card`: busca um card por `id`.
- `create_flow_card`: cria um novo card com titulo, descricao, tipo, prioridade, responsavel, solicitante e tags;
- `update_flow_card`: atualiza os campos editaveis de um card existente sem mudar o status;
- `move_flow_card`: move um card existente para outro status valido.

Exemplo de configuracao em um cliente MCP:

```json
{
  "mcpServers": {
    "gira": {
      "command": "node",
      "args": ["/caminho/para/workshop-codificacao-agentica-docs/gira-app/src/mcp-server.js"]
    }
  }
}
```

## Endpoints

- `GET /api/health`
- `GET /api/tickets`
- `GET /api/metrics`
- `POST /api/tickets`
- `PATCH /api/tickets/:ticketId/status`

## Ideias de uso no workshop

### Modo agêntico

- pedir um plano antes de editar;
- escrever teste antes de alterar regra de negócio;
- implementar um novo filtro com diff pequeno;
- revisar o diff buscando regressões.

### Skills

- skill para triagem de tickets críticos;
- skill para transformar bug report em caso de teste;
- skill para padronizar criação de tickets com contexto mínimo.

### MCPs

- consultar documentação atualizada antes de mexer em `fetch` ou Express;
- buscar uma issue no GitHub e transformá-la em mudança local;
- usar Jira, GitHub ou observabilidade como fonte externa para enriquecer um ticket.
- buscar cards da própria Gira e aplicar a mudança na `stock-inventory-app/`.

## Prompts de exemplo

```text
Entre em modo de planejamento. Analise o gira-app sem editar nada ainda.
Quero entender como rodar, onde está a regra de transição de status,
quais testes existem e qual seria o menor plano para adicionar um filtro por responsável.
```

```text
Implemente a mudança em TDD.
Primeiro escreva um teste que falha para impedir mover um ticket concluído de volta para "todo".
Depois faça o mínimo para passar e rode apenas os testes relevantes.
```

```text
Revise meu diff como code reviewer sênior.
Priorize bugs, regressões, estados inválidos e testes faltantes.
```
