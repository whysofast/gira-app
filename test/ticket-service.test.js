import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTicketMetrics,
  changeTicketStatus,
  createTicket,
  getAvailableStatusTransitions,
  listTickets,
  updateTicket
} from "../src/features/tickets/ticket-service.js";

function createSampleTicketCollection() {
  return {
    nextId: 3,
    tickets: [
      {
        id: "1",
        title: "Corrigir validação do formulário",
        description: "Campos obrigatórios não estão claros no frontend.",
        type: "bug",
        status: "todo",
        priority: "high",
        owner: "Aline",
        requester: "QA",
        tags: ["frontend", "validation"],
        createdAt: "2026-04-28T09:00:00.000Z",
        updatedAt: "2026-04-28T09:00:00.000Z"
      },
      {
        id: "2",
        title: "Documentar fluxo do workshop",
        description: "Conteúdo do README e AGENTS.md.",
        type: "task",
        status: "done",
        priority: "low",
        owner: "Beatriz",
        requester: "Enablement",
        tags: ["docs"],
        createdAt: "2026-04-27T09:00:00.000Z",
        updatedAt: "2026-04-28T12:00:00.000Z"
      }
    ]
  };
}

test("createTicket cria ticket novo com campos normalizados", () => {
  const ticketCollection = createSampleTicketCollection();
  const now = new Date("2026-04-28T13:30:00.000Z");

  const result = createTicket(
    ticketCollection,
    {
      title: "  Adicionar filtro por owner  ",
      description: "  Facilitar a daily do time.  ",
      type: "feature",
      priority: "medium",
      owner: "  Camila  ",
      requester: "  Produto  ",
      tags: "frontend, search, filters"
    },
    now
  );

  assert.equal(result.ticket.id, "3");
  assert.equal(result.ticket.status, "todo");
  assert.deepEqual(result.ticket.tags, ["frontend", "search", "filters"]);
  assert.equal(result.collection.nextId, 4);
});

test("listTickets filtra por busca textual e status", () => {
  const ticketCollection = createSampleTicketCollection();

  const filteredTickets = listTickets(ticketCollection, {
    status: "todo",
    query: "validation"
  });

  assert.equal(filteredTickets.length, 1);
  assert.equal(filteredTickets[0].id, "1");
});

test("listTickets filtra por tipo", () => {
  const ticketCollection = createSampleTicketCollection();

  const filteredTickets = listTickets(ticketCollection, {
    type: "bug"
  });

  assert.equal(filteredTickets.length, 1);
  assert.equal(filteredTickets[0].id, "1");
});

test("changeTicketStatus impede transição inválida a partir de done", () => {
  const ticketCollection = createSampleTicketCollection();

  assert.throws(
    () => changeTicketStatus(ticketCollection, "2", "todo", new Date("2026-04-28T14:00:00.000Z")),
    /Não é permitido mover um ticket de 'done' para 'todo'./
  );
});

test("updateTicket altera apenas os campos informados e normaliza tags", () => {
  const ticketCollection = createSampleTicketCollection();
  const now = new Date("2026-04-28T14:30:00.000Z");

  const result = updateTicket(
    ticketCollection,
    "1",
    {
      title: "  Corrigir validação e mensagem do formulário  ",
      priority: "critical",
      tags: [" Frontend ", "Urgente "]
    },
    now
  );

  assert.equal(result.ticket.id, "1");
  assert.equal(result.ticket.title, "Corrigir validação e mensagem do formulário");
  assert.equal(result.ticket.priority, "critical");
  assert.deepEqual(result.ticket.tags, ["frontend", "urgente"]);
  assert.equal(result.ticket.updatedAt, now.toISOString());
  assert.equal(result.ticket.status, "todo");
  assert.equal(result.collection.tickets[0].updatedAt, now.toISOString());
});

test("updateTicket exige ao menos um campo atualizável", () => {
  const ticketCollection = createSampleTicketCollection();

  assert.throws(
    () => updateTicket(ticketCollection, "1", {}, new Date("2026-04-28T14:30:00.000Z")),
    /Informe ao menos um campo para atualizar o ticket./
  );
});

test("calculateTicketMetrics contabiliza tickets abertos e críticos", () => {
  const ticketCollection = createSampleTicketCollection();
  const metrics = calculateTicketMetrics(ticketCollection.tickets);

  assert.deepEqual(metrics, {
    totalTickets: 2,
    openTickets: 1,
    inProgressTickets: 0,
    blockedTickets: 0,
    doneTickets: 1,
    highPriorityOpenTickets: 1
  });
});

test("getAvailableStatusTransitions expõe apenas próximos estados válidos", () => {
  assert.deepEqual(getAvailableStatusTransitions("blocked"), ["in_progress", "done"]);
  assert.deepEqual(getAvailableStatusTransitions("done"), []);
});
