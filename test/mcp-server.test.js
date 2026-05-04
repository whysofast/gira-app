import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createFlowBoardMcpServer } from "../src/mcp-server.js";

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

async function createMcpTestClient(t) {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "gira-mcp-test-"));
  const dataFilePath = path.join(temporaryDirectory, "tickets.json");

  await writeFile(
    dataFilePath,
    `${JSON.stringify(createSampleTicketCollection(), null, 2)}\n`,
    "utf-8"
  );

  const server = createFlowBoardMcpServer({ dataFilePath });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "mcp-server-test-client", version: "1.0.0" });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  t.after(async () => {
    await Promise.all([clientTransport.close(), serverTransport.close()]);
  });

  return {
    client,
    dataFilePath
  };
}

function parseToolPayload(toolResult) {
  return JSON.parse(toolResult.content[0].text);
}

test("MCP expõe todas as tools e persiste criação, atualização e movimento", async (t) => {
  const { client, dataFilePath } = await createMcpTestClient(t);

  const tools = await client.listTools();

  assert.deepEqual(
    tools.tools.map((tool) => tool.name),
    [
      "list_flow_cards",
      "get_flow_card",
      "create_flow_card",
      "update_flow_card",
      "move_flow_card"
    ]
  );

  const createdCard = parseToolPayload(
    await client.callTool({
      name: "create_flow_card",
      arguments: {
        title: "  Adicionar filtro por owner  ",
        description: "  Facilitar a daily do time.  ",
        type: "feature",
        priority: "medium",
        owner: "  Camila  ",
        requester: "  Produto  ",
        tags: "frontend, search, filters"
      }
    })
  );

  assert.equal(createdCard.id, "3");
  assert.equal(createdCard.status, "todo");
  assert.deepEqual(createdCard.tags, ["frontend", "search", "filters"]);

  const fetchedCreatedCard = parseToolPayload(
    await client.callTool({
      name: "get_flow_card",
      arguments: { id: "3" }
    })
  );

  assert.equal(fetchedCreatedCard.id, "3");
  assert.equal(fetchedCreatedCard.title, "Adicionar filtro por owner");

  const updatedCard = parseToolPayload(
    await client.callTool({
      name: "update_flow_card",
      arguments: {
        id: "1",
        title: "  Corrigir validação e mensagem do formulário  ",
        priority: "critical",
        tags: [" Frontend ", "Urgente "]
      }
    })
  );

  assert.equal(updatedCard.id, "1");
  assert.equal(updatedCard.title, "Corrigir validação e mensagem do formulário");
  assert.equal(updatedCard.priority, "critical");
  assert.deepEqual(updatedCard.tags, ["frontend", "urgente"]);

  const movedCard = parseToolPayload(
    await client.callTool({
      name: "move_flow_card",
      arguments: {
        id: "1",
        status: "in_progress"
      }
    })
  );

  assert.equal(movedCard.id, "1");
  assert.equal(movedCard.status, "in_progress");

  const listedCards = parseToolPayload(
    await client.callTool({
      name: "list_flow_cards",
      arguments: { limit: 25 }
    })
  );

  assert.equal(listedCards.total, 3);
  assert.deepEqual(
    listedCards.cards.map((card) => card.id).sort(),
    ["1", "2", "3"]
  );

  const persistedCollection = JSON.parse(await readFile(dataFilePath, "utf-8"));

  assert.equal(persistedCollection.nextId, 4);
  assert.equal(
    persistedCollection.tickets.find((ticket) => ticket.id === "1").status,
    "in_progress"
  );
  assert.equal(
    persistedCollection.tickets.find((ticket) => ticket.id === "3").title,
    "Adicionar filtro por owner"
  );
});

test("update_flow_card retorna erro estruturado quando nenhum campo é informado", async (t) => {
  const { client } = await createMcpTestClient(t);

  const result = parseToolPayload(
    await client.callTool({
      name: "update_flow_card",
      arguments: { id: "1" }
    })
  );

  assert.equal(result.error, "validation_error");
  assert.match(result.message, /ao menos um campo/i);
});
