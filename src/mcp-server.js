import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  changeTicketStatus,
  createTicket,
  listTickets,
  updateTicket,
  validTicketPriorities,
  validTicketStatuses,
  validTicketTypes
} from "./features/tickets/ticket-service.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const projectRootDirectory = path.resolve(currentDirectory, "..");
const defaultDataFilePath = path.join(projectRootDirectory, "data", "tickets.json");

async function readTicketCollectionFromDisk(dataFilePath) {
  const fileContents = await readFile(dataFilePath, "utf-8");
  return JSON.parse(fileContents);
}

async function writeTicketCollectionToDisk(dataFilePath, ticketCollection) {
  await writeFile(dataFilePath, `${JSON.stringify(ticketCollection, null, 2)}\n`, "utf-8");
}

function buildFlowCard(ticket) {
  return {
    id: ticket.id,
    title: ticket.title,
    type: ticket.type,
    status: ticket.status,
    priority: ticket.priority,
    owner: ticket.owner,
    requester: ticket.requester,
    tags: ticket.tags,
    description: ticket.description,
    updatedAt: ticket.updatedAt,
    prompt: [
      `Pegue o card ${ticket.id} da Gira como contexto.`,
      "Antes de editar, localize a regra ou tela relacionada.",
      "Implemente a menor mudanca verificavel e rode os testes relevantes."
    ].join(" ")
  };
}

function buildJsonToolResponse(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function buildToolErrorPayload(error) {
  const knownErrorCode = error.statusCode === 404 ? "card_not_found" : "validation_error";

  return {
    error: knownErrorCode,
    message: error?.message ?? "Erro interno do servidor MCP."
  };
}

async function persistTicketMutation(dataFilePath, applyTicketMutation) {
  const ticketCollection = await readTicketCollectionFromDisk(dataFilePath);
  const { collection, ticket } = applyTicketMutation(ticketCollection);

  await writeTicketCollectionToDisk(dataFilePath, collection);

  return ticket;
}

async function runTicketMutationTool(dataFilePath, applyTicketMutation) {
  try {
    const updatedTicket = await persistTicketMutation(dataFilePath, applyTicketMutation);
    return buildJsonToolResponse(buildFlowCard(updatedTicket));
  } catch (error) {
    return buildJsonToolResponse(buildToolErrorPayload(error));
  }
}

function buildMutableCardInputSchema() {
  return {
    title: z.string().trim().min(5).optional(),
    description: z.string().trim().max(280).optional(),
    type: z.enum(validTicketTypes).optional(),
    priority: z.enum(validTicketPriorities).optional(),
    owner: z.string().trim().min(1).optional(),
    requester: z.string().trim().min(1).optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional()
  };
}

export function createFlowBoardMcpServer({ dataFilePath = defaultDataFilePath } = {}) {
  const server = new McpServer({
    name: "workshop-gira",
    version: "1.0.0"
  });

  server.registerTool(
    "list_flow_cards",
    {
      title: "List Gira cards",
      description: "Lista cards da Gira com filtros opcionais por status, tipo, prioridade e busca textual.",
      inputSchema: {
        status: z.enum(validTicketStatuses).optional(),
        type: z.enum(validTicketTypes).optional(),
        priority: z.enum(validTicketPriorities).optional(),
        query: z.string().trim().optional(),
        limit: z.number().int().min(1).max(25).default(10)
      }
    },
    async ({ status, type, priority, query, limit }) => {
      const ticketCollection = await readTicketCollectionFromDisk(dataFilePath);
      const cards = listTickets(ticketCollection, { status, type, priority, query })
        .slice(0, limit)
        .map(buildFlowCard);

      return buildJsonToolResponse({
        total: cards.length,
        cards
      });
    }
  );

  server.registerTool(
    "get_flow_card",
    {
      title: "Get Gira card",
      description: "Busca um card especifico da Gira pelo ID.",
      inputSchema: {
        id: z.string().trim().min(1)
      }
    },
    async ({ id }) => {
      const ticketCollection = await readTicketCollectionFromDisk(dataFilePath);
      const ticket = ticketCollection.tickets.find((candidate) => candidate.id === id);

      if (!ticket) {
        return buildJsonToolResponse({
          error: "card_not_found",
          message: `Card ${id} nao encontrado.`
        });
      }

      return buildJsonToolResponse(buildFlowCard(ticket));
    }
  );

  server.registerTool(
    "create_flow_card",
    {
      title: "Create Gira card",
      description: "Cria um novo card na Gira com os campos principais do ticket.",
      inputSchema: {
        title: z.string().trim().min(5),
        description: z.string().trim().max(280),
        type: z.enum(validTicketTypes),
        priority: z.enum(validTicketPriorities),
        owner: z.string().trim().min(1),
        requester: z.string().trim().min(1),
        tags: z.union([z.string(), z.array(z.string())]).optional()
      }
    },
    async (input) =>
      runTicketMutationTool(dataFilePath, (ticketCollection) => createTicket(ticketCollection, input))
  );

  server.registerTool(
    "update_flow_card",
    {
      title: "Update Gira card",
      description: "Atualiza os campos editáveis de um card existente sem alterar o status.",
      inputSchema: {
        id: z.string().trim().min(1),
        ...buildMutableCardInputSchema()
      }
    },
    async ({ id, ...input }) =>
      runTicketMutationTool(dataFilePath, (ticketCollection) => updateTicket(ticketCollection, id, input))
  );

  server.registerTool(
    "move_flow_card",
    {
      title: "Move Gira card",
      description: "Move um card existente para outro status válido do fluxo.",
      inputSchema: {
        id: z.string().trim().min(1),
        status: z.enum(validTicketStatuses)
      }
    },
    async ({ id, status }) =>
      runTicketMutationTool(dataFilePath, (ticketCollection) =>
        changeTicketStatus(ticketCollection, id, status)
      )
  );

  return server;
}

async function main() {
  const server = createFlowBoardMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

if (process.argv[1] && currentFilePath === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
