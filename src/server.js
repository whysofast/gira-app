import express from "express";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateTicketMetrics,
  changeTicketStatus,
  createTicket,
  getAvailableStatusTransitions,
  listTickets
} from "./features/tickets/ticket-service.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const projectRootDirectory = path.resolve(currentDirectory, "..");
const defaultDataFilePath = path.join(projectRootDirectory, "data", "tickets.json");
const publicDirectory = path.join(projectRootDirectory, "public");

async function readTicketCollectionFromDisk(dataFilePath) {
  const fileContents = await readFile(dataFilePath, "utf-8");
  return JSON.parse(fileContents);
}

async function writeTicketCollectionToDisk(dataFilePath, ticketCollection) {
  await writeFile(dataFilePath, `${JSON.stringify(ticketCollection, null, 2)}\n`, "utf-8");
}

function decorateTicketForClient(ticket) {
  return {
    ...ticket,
    availableTransitions: getAvailableStatusTransitions(ticket.status)
  };
}

function buildClientTicketList(ticketCollection, filters) {
  return listTickets(ticketCollection, filters).map(decorateTicketForClient);
}

export function createServerApp({ dataFilePath = defaultDataFilePath } = {}) {
  const app = express();

  app.use(express.json());
  app.use(express.static(publicDirectory));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/tickets", async (request, response, next) => {
    try {
      const ticketCollection = await readTicketCollectionFromDisk(dataFilePath);
      const items = buildClientTicketList(ticketCollection, request.query);

      response.json({
        total: items.length,
        items
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/metrics", async (_request, response, next) => {
    try {
      const ticketCollection = await readTicketCollectionFromDisk(dataFilePath);
      response.json(calculateTicketMetrics(ticketCollection.tickets));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tickets", async (request, response, next) => {
    try {
      const ticketCollection = await readTicketCollectionFromDisk(dataFilePath);
      const { collection, ticket } = createTicket(ticketCollection, request.body);

      await writeTicketCollectionToDisk(dataFilePath, collection);

      response.status(201).json(decorateTicketForClient(ticket));
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/tickets/:ticketId/status", async (request, response, next) => {
    try {
      const ticketCollection = await readTicketCollectionFromDisk(dataFilePath);
      const { collection, ticket } = changeTicketStatus(
        ticketCollection,
        request.params.ticketId,
        request.body.status
      );

      await writeTicketCollectionToDisk(dataFilePath, collection);

      response.json(decorateTicketForClient(ticket));
    } catch (error) {
      next(error);
    }
  });

  app.get("*", (_request, response) => {
    response.sendFile(path.join(publicDirectory, "index.html"));
  });

  app.use((error, _request, response, _next) => {
    const statusCode = error.statusCode ?? 500;
    const message = statusCode >= 500 ? "Erro interno do servidor." : error.message;

    if (statusCode >= 500) {
      console.error(error);
    }

    response.status(statusCode).json({ message });
  });

  return app;
}

export function startWorkshopServer(port = Number(process.env.PORT ?? 3000)) {
  const app = createServerApp();

  return app.listen(port, () => {
    console.log(`Workshop Gira app running on http://localhost:${port}`);
  });
}

if (process.argv[1] && currentFilePath === process.argv[1]) {
  startWorkshopServer();
}
