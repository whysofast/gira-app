const pipelineStages = [
  { status: "todo", label: "Entrada", hint: "Triagem", marker: "01" },
  { status: "in_progress", label: "Em produção", hint: "Execução", marker: "02" },
  { status: "blocked", label: "Bloqueio", hint: "Intervenção", marker: "03" },
  { status: "done", label: "Entrega", hint: "Concluído", marker: "04" }
];

const statusLabels = Object.fromEntries(
  pipelineStages.map((pipelineStage) => [pipelineStage.status, pipelineStage.label])
);

const priorityLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical"
};

const ticketTypePrefixes = {
  bug: "BUG",
  feature: "FEAT",
  incident: "INC",
  task: "TASK"
};

const ticketListElement = document.querySelector("#ticket-list");
const metricsGridElement = document.querySelector("#metrics-grid");
const resultsCountElement = document.querySelector("#results-count");
const feedbackMessageElement = document.querySelector("#feedback-message");
const filtersFormElement = document.querySelector("#filters-form");
const createTicketFormElement = document.querySelector("#create-ticket-form");
const clearFiltersButtonElement = document.querySelector("#clear-filters-button");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildQueryStringFromFilters(formData) {
  const searchParams = new URLSearchParams();

  for (const [fieldName, fieldValue] of formData.entries()) {
    const normalizedValue = String(fieldValue).trim();

    if (normalizedValue) {
      searchParams.set(fieldName, normalizedValue);
    }
  }

  return searchParams.toString();
}

function showFeedbackMessage(message, tone = "neutral") {
  feedbackMessageElement.textContent = message;
  feedbackMessageElement.dataset.tone = tone;
}

async function readJsonResponse(response) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message ?? "Erro ao processar a requisição.");
  }

  return payload;
}

function renderMetrics(metrics) {
  const metricCards = [
    { label: "Total no fluxo", value: metrics.totalTickets, tone: "total" },
    { label: "Abertos", value: metrics.openTickets, tone: "open" },
    { label: "Em produção", value: metrics.inProgressTickets, tone: "progress" },
    { label: "Bloqueios", value: metrics.blockedTickets, tone: "blocked" },
    { label: "Alta prioridade", value: metrics.highPriorityOpenTickets, tone: "priority" }
  ];

  metricsGridElement.innerHTML = metricCards
    .map(
      (metricCard) => `
        <article class="metric-card metric-${metricCard.tone}">
          <i aria-hidden="true"></i>
          <span>${metricCard.label}</span>
          <strong>${metricCard.value}</strong>
        </article>
      `
    )
    .join("");
}

function renderTicketActions(ticket) {
  if (!ticket.availableTransitions.length) {
    return `<span class="terminal-state">Sem próxima etapa</span>`;
  }

  return ticket.availableTransitions
    .map(
      (nextStatus) => `
        <button type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-next-status="${nextStatus}">
          Enviar para ${statusLabels[nextStatus]}
        </button>
      `
    )
    .join("");
}

function formatTicketCode(ticket) {
  return `#${ticketTypePrefixes[ticket.type] ?? "CARD"}-${ticket.id}`;
}

function renderTicketCard(ticket) {
  const updatedAt = new Date(ticket.updatedAt).toLocaleString("pt-BR");
  const tags = ticket.tags.length
    ? ticket.tags.map((tag) => `<span class="tag-chip">#${escapeHtml(tag)}</span>`).join("")
    : `<span class="tag-chip">sem-tag</span>`;

  return `
    <article class="ticket-card priority-${ticket.priority}">
      <div class="ticket-card-topline">
        <span class="ticket-code">${escapeHtml(formatTicketCode(ticket))}</span>
        <span class="ticket-priority-dot" aria-label="Prioridade ${priorityLabels[ticket.priority]}"></span>
      </div>

      <div class="ticket-card-header">
        <div>
          <div class="ticket-badges">
            <span class="badge badge-type">${escapeHtml(ticket.type)}</span>
            <span class="badge badge-priority">${priorityLabels[ticket.priority]}</span>
          </div>
          <h3>${escapeHtml(ticket.title)}</h3>
        </div>
        <p class="ticket-owner">${escapeHtml(ticket.owner)}</p>
      </div>

      <p class="ticket-description">${escapeHtml(ticket.description || "Sem descrição.")}</p>

      <div class="ticket-meta">
        <span>${escapeHtml(ticket.requester)}</span>
        <span>${updatedAt}</span>
      </div>

      <div class="tag-list">
        ${tags}
      </div>

      <div class="ticket-actions">
        ${renderTicketActions(ticket)}
      </div>
    </article>
  `;
}

function renderPipelineLane(pipelineStage, laneTickets) {
  const cards = laneTickets.length
    ? laneTickets.map(renderTicketCard).join("")
    : `
      <article class="lane-empty-state">
        <strong>Sem cards</strong>
        <span>Esta etapa está livre pelos filtros atuais.</span>
      </article>
    `;

  return `
    <section class="pipeline-lane lane-${pipelineStage.status}" aria-label="${pipelineStage.label}">
      <header class="lane-header">
        <div>
          <span class="lane-marker">${pipelineStage.marker}</span>
          <h3>${pipelineStage.label}</h3>
          <p>${pipelineStage.hint}</p>
        </div>
        <strong>${laneTickets.length}</strong>
      </header>
      <div class="lane-track">
        ${cards}
      </div>
    </section>
  `;
}

function renderTicketList(ticketResponse) {
  resultsCountElement.textContent = `${ticketResponse.total} card(s) exibido(s)`;

  const emptyState = !ticketResponse.items.length
    ? `
      <article class="empty-state">
        <h3>Nenhum card passa pelos filtros</h3>
        <p>Altere os critérios ou crie uma nova demanda para alimentar o pipeline.</p>
      </article>
    `
    : "";

  const lanes = pipelineStages
    .map((pipelineStage) => {
      const laneTickets = ticketResponse.items.filter(
        (ticket) => ticket.status === pipelineStage.status
      );

      return renderPipelineLane(pipelineStage, laneTickets);
    })
    .join("");

  ticketListElement.innerHTML = `${emptyState}${lanes}`;
}

async function loadDashboardData() {
  const activeFilters = new FormData(filtersFormElement);
  const queryString = buildQueryStringFromFilters(activeFilters);
  const ticketUrl = queryString ? `/api/tickets?${queryString}` : "/api/tickets";

  const [ticketResponse, metricsResponse] = await Promise.all([
    fetch(ticketUrl).then(readJsonResponse),
    fetch("/api/metrics").then(readJsonResponse)
  ]);

  renderTicketList(ticketResponse);
  renderMetrics(metricsResponse);
}

filtersFormElement.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await loadDashboardData();
  } catch (error) {
    showFeedbackMessage(error.message, "error");
  }
});

clearFiltersButtonElement.addEventListener("click", async () => {
  filtersFormElement.reset();

  try {
    await loadDashboardData();
  } catch (error) {
    showFeedbackMessage(error.message, "error");
  }
});

createTicketFormElement.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(createTicketFormElement);
  const payload = Object.fromEntries(formData.entries());

  try {
    await fetch("/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }).then(readJsonResponse);

    createTicketFormElement.reset();
    showFeedbackMessage("Ticket criado com sucesso.", "success");
    await loadDashboardData();
  } catch (error) {
    showFeedbackMessage(error.message, "error");
  }
});

ticketListElement.addEventListener("click", async (event) => {
  const clickedButton = event.target.closest("button[data-ticket-id]");

  if (!clickedButton) {
    return;
  }

  try {
    await fetch(`/api/tickets/${clickedButton.dataset.ticketId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: clickedButton.dataset.nextStatus })
    }).then(readJsonResponse);

    showFeedbackMessage("Status atualizado com sucesso.", "success");
    await loadDashboardData();
  } catch (error) {
    showFeedbackMessage(error.message, "error");
  }
});

loadDashboardData().catch((error) => {
  showFeedbackMessage(error.message, "error");
});
