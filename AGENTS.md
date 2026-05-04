# AGENTS.md

## Objetivo do projeto

Gerenciar cards de uma pipeline de implantação de software


## Guidelines principais

- Faça mudanças pequenas e verificáveis.
- Prefira corrigir ou evoluir um comportamento por vez.
- Não introduza dependências novas sem necessidade clara.

## Como rodar

```bash
npm install
npm start
```

App web: `http://localhost:3000`

## Como testar

```bash
npm test
```

## Arquitetura rápida

- `src/server.js`: API HTTP e entrega dos arquivos estáticos.
- `src/features/tickets/ticket-service.js`: regras de negócio de tickets.
- `data/tickets.json`: base simples persistida em JSON.
- `public/`: frontend estático consumindo a API.

## Regras de implementação

- Coloque regras de negócio em `ticket-service.js` quando possível.
- Mantenha mensagens de erro claras
- Ao alterar regra de status, atualize os testes.
- Preserve o domínio simples: ticket, prioridade, tipo, status e filtros.
