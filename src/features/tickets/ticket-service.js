export const validTicketStatuses = ["todo", "in_progress", "blocked", "done"];
export const validTicketPriorities = ["low", "medium", "high", "critical"];
export const validTicketTypes = ["bug", "feature", "task", "incident"];

const updatableTicketFieldNames = [
  "title",
  "description",
  "type",
  "priority",
  "owner",
  "requester",
  "tags"
];

const allowedTransitionsByStatus = {
  todo: ["in_progress", "blocked"],
  in_progress: ["blocked", "done"],
  blocked: ["in_progress", "done"],
  done: []
};

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function normalizeSingleLineText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeMultiLineText(value) {
  return String(value ?? "").trim();
}

function normalizeSearchText(value) {
  return normalizeSingleLineText(value).toLowerCase();
}

function normalizeTagList(value) {
  if (Array.isArray(value)) {
    return value
      .map((tag) => normalizeSingleLineText(tag).toLowerCase())
      .filter(Boolean)
      .slice(0, 5);
  }

  return String(value ?? "")
    .split(",")
    .map((tag) => normalizeSingleLineText(tag).toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
}

function ensureValueBelongsToList(value, validValues, fieldName) {
  if (!validValues.includes(value)) {
    throw createValidationError(`Campo '${fieldName}' inválido.`);
  }
}

function ensureTitleIsValid(title) {
  if (title.length < 5) {
    throw createValidationError("O título deve ter pelo menos 5 caracteres.");
  }
}

function ensureDescriptionIsValid(description) {
  if (description.length > 280) {
    throw createValidationError("A descrição deve ter no máximo 280 caracteres.");
  }
}

function ensureResponsibleFieldsArePresent(owner, requester) {
  if (!owner) {
    throw createValidationError("Informe quem será responsável pelo ticket.");
  }

  if (!requester) {
    throw createValidationError("Informe quem solicitou o ticket.");
  }
}

function findTicketById(ticketCollection, ticketId) {
  const ticket = ticketCollection.tickets.find((candidateTicket) => candidateTicket.id === ticketId);

  if (!ticket) {
    throw createNotFoundError("Ticket não encontrado.");
  }

  return ticket;
}

function replaceTicketInCollection(ticketCollection, updatedTicket) {
  return {
    ...ticketCollection,
    tickets: ticketCollection.tickets.map((ticket) =>
      ticket.id === updatedTicket.id ? updatedTicket : ticket
    )
  };
}

function hasOwnTicketField(rawInput, fieldName) {
  return Object.prototype.hasOwnProperty.call(rawInput, fieldName);
}

function hasAnyUpdatableTicketField(rawInput) {
  return updatableTicketFieldNames.some((fieldName) => hasOwnTicketField(rawInput, fieldName));
}

function buildUpdatedTicketDraft(ticketToUpdate, rawInput) {
  return {
    title: hasOwnTicketField(rawInput, "title")
      ? normalizeSingleLineText(rawInput.title)
      : ticketToUpdate.title,
    description: hasOwnTicketField(rawInput, "description")
      ? normalizeMultiLineText(rawInput.description)
      : ticketToUpdate.description,
    type: hasOwnTicketField(rawInput, "type")
      ? normalizeSingleLineText(rawInput.type)
      : ticketToUpdate.type,
    priority: hasOwnTicketField(rawInput, "priority")
      ? normalizeSingleLineText(rawInput.priority)
      : ticketToUpdate.priority,
    owner: hasOwnTicketField(rawInput, "owner")
      ? normalizeSingleLineText(rawInput.owner)
      : ticketToUpdate.owner,
    requester: hasOwnTicketField(rawInput, "requester")
      ? normalizeSingleLineText(rawInput.requester)
      : ticketToUpdate.requester,
    tags: hasOwnTicketField(rawInput, "tags")
      ? normalizeTagList(rawInput.tags)
      : ticketToUpdate.tags
  };
}

function ensureTicketDraftIsValid(ticketDraft) {
  ensureTitleIsValid(ticketDraft.title);
  ensureDescriptionIsValid(ticketDraft.description);
  ensureResponsibleFieldsArePresent(ticketDraft.owner, ticketDraft.requester);
  ensureValueBelongsToList(ticketDraft.type, validTicketTypes, "type");
  ensureValueBelongsToList(ticketDraft.priority, validTicketPriorities, "priority");
}

function didTicketDraftChange(ticketToUpdate, ticketDraft) {
  return updatableTicketFieldNames.some((fieldName) => {
    const previousValue = ticketToUpdate[fieldName];
    const nextValue = ticketDraft[fieldName];

    return JSON.stringify(previousValue) !== JSON.stringify(nextValue);
  });
}

function matchesSelectedFilters(ticket, filters) {
  if (filters.status && ticket.status !== filters.status) {
    return false;
  }

  if (filters.priority && ticket.priority !== filters.priority) {
    return false;
  }

  if (filters.type && ticket.type !== filters.type) {
    return false;
  }

  if (!filters.query) {
    return true;
  }

  const searchableFields = [
    ticket.title,
    ticket.description,
    ticket.owner,
    ticket.requester,
    ticket.tags.join(" ")
  ];

  return searchableFields.some((field) => field.toLowerCase().includes(filters.query));
}

function sortTicketsByMostRecentlyUpdated(firstTicket, secondTicket) {
  return Date.parse(secondTicket.updatedAt) - Date.parse(firstTicket.updatedAt);
}

function buildNormalizedFilters(filters = {}) {
  const query = normalizeSearchText(filters.query ?? filters.q ?? "");

  return {
    status: filters.status ?? "",
    priority: filters.priority ?? "",
    type: filters.type ?? "",
    query
  };
}

export function getAvailableStatusTransitions(currentStatus) {
  return allowedTransitionsByStatus[currentStatus] ?? [];
}

export function listTickets(ticketCollection, filters = {}) {
  const normalizedFilters = buildNormalizedFilters(filters);

  return ticketCollection.tickets
    .filter((ticket) => matchesSelectedFilters(ticket, normalizedFilters))
    .sort(sortTicketsByMostRecentlyUpdated);
}

export function calculateTicketMetrics(tickets) {
  return {
    totalTickets: tickets.length,
    openTickets: tickets.filter((ticket) => ["todo", "in_progress"].includes(ticket.status)).length,
    inProgressTickets: tickets.filter((ticket) => ticket.status === "in_progress").length,
    blockedTickets: tickets.filter((ticket) => ticket.status === "blocked").length,
    doneTickets: tickets.filter((ticket) => ticket.status === "done").length,
    highPriorityOpenTickets: tickets.filter(
      (ticket) => ["high", "critical"].includes(ticket.priority) && ticket.status !== "done"
    ).length
  };
}

export function createTicket(ticketCollection, rawInput, now = new Date()) {
  const title = normalizeSingleLineText(rawInput.title);
  const description = normalizeMultiLineText(rawInput.description);
  const type = normalizeSingleLineText(rawInput.type);
  const priority = normalizeSingleLineText(rawInput.priority);
  const owner = normalizeSingleLineText(rawInput.owner);
  const requester = normalizeSingleLineText(rawInput.requester);
  const tags = normalizeTagList(rawInput.tags);

  ensureTitleIsValid(title);
  ensureDescriptionIsValid(description);
  ensureResponsibleFieldsArePresent(owner, requester);
  ensureValueBelongsToList(type, validTicketTypes, "type");
  ensureValueBelongsToList(priority, validTicketPriorities, "priority");

  const isoTimestamp = now.toISOString();
  const createdTicket = {
    id: String(ticketCollection.nextId),
    title,
    description,
    type,
    status: "todo",
    priority,
    owner,
    requester,
    tags,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp
  };

  return {
    collection: {
      nextId: ticketCollection.nextId + 1,
      tickets: [...ticketCollection.tickets, createdTicket]
    },
    ticket: createdTicket
  };
}

export function updateTicket(ticketCollection, ticketId, rawInput, now = new Date()) {
  if (!hasAnyUpdatableTicketField(rawInput)) {
    throw createValidationError("Informe ao menos um campo para atualizar o ticket.");
  }

  const ticketToUpdate = findTicketById(ticketCollection, ticketId);
  const ticketDraft = buildUpdatedTicketDraft(ticketToUpdate, rawInput);

  ensureTicketDraftIsValid(ticketDraft);

  if (!didTicketDraftChange(ticketToUpdate, ticketDraft)) {
    return {
      collection: ticketCollection,
      ticket: ticketToUpdate
    };
  }

  const updatedTicket = {
    ...ticketToUpdate,
    ...ticketDraft,
    updatedAt: now.toISOString()
  };

  return {
    collection: replaceTicketInCollection(ticketCollection, updatedTicket),
    ticket: updatedTicket
  };
}

export function changeTicketStatus(ticketCollection, ticketId, nextStatus, now = new Date()) {
  const normalizedStatus = normalizeSingleLineText(nextStatus);

  ensureValueBelongsToList(normalizedStatus, validTicketStatuses, "status");

  const ticketToUpdate = findTicketById(ticketCollection, ticketId);

  if (ticketToUpdate.status === normalizedStatus) {
    return {
      collection: ticketCollection,
      ticket: ticketToUpdate
    };
  }

  const allowedTransitions = getAvailableStatusTransitions(ticketToUpdate.status);

  if (!allowedTransitions.includes(normalizedStatus)) {
    throw createValidationError(
      `Não é permitido mover um ticket de '${ticketToUpdate.status}' para '${normalizedStatus}'.`
    );
  }

  const updatedTicket = {
    ...ticketToUpdate,
    status: normalizedStatus,
    updatedAt: now.toISOString()
  };

  return {
    collection: replaceTicketInCollection(ticketCollection, updatedTicket),
    ticket: updatedTicket
  };
}
