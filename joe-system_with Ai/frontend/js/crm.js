// crm.js — Leads / Accounts / Pipeline page.
import { loadLayout } from "./layout.js";
import { initAiWidget } from "./ai_voice.js";
import { api } from "./api.js";

const STAGES = ["Qualified", "Proposal", "Negotiation", "Won", "Lost"];

const TOOLBAR_ACTIONS = {
  leads: { label: "+ Add lead", modal: "lead-modal-overlay" },
  accounts: { label: "+ Add account", modal: "account-modal-overlay" },
  pipeline: { label: "+ Add deal", modal: "deal-modal-overlay" },
};

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("en-US")}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------------- Tabs ----------------

function switchTab(tab) {
  document.querySelectorAll(".crm-tab").forEach((btn) =>
    btn.classList.toggle("is-active", btn.dataset.tab === tab)
  );
  document.querySelectorAll(".crm-panel").forEach((panel) =>
    panel.classList.toggle("is-active", panel.dataset.panel === tab)
  );

  const actions = document.getElementById("crm-toolbar-actions");
  const config = TOOLBAR_ACTIONS[tab];
  actions.innerHTML = config
    ? `<button class="btn-primary" id="crm-add-btn">${config.label}</button>`
    : "";
  if (config) {
    document.getElementById("crm-add-btn").addEventListener("click", () => openModal(config.modal));
  }

  window.location.hash = tab;
}

function initTabs() {
  document.querySelectorAll(".crm-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  const initialTab = window.location.hash.replace("#", "");
  switchTab(initialTab in TOOLBAR_ACTIONS ? initialTab : "leads");
}

// ---------------- Modals ----------------

function openModal(id) {
  document.getElementById(id).classList.add("is-open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("is-open");
}

function initModals() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("is-open");
    });
  });
}

// ---------------- Leads ----------------

async function renderLeads() {
  const tbody = document.getElementById("leads-tbody");
  try {
    const leads = await api.getLeads();
    if (!leads.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No leads yet — add one to get started.</td></tr>`;
      return;
    }
    tbody.innerHTML = leads
      .map(
        (l) => `
        <tr>
          <td>${escapeHtml(l.name)}</td>
          <td>${escapeHtml(l.company)}</td>
          <td>${escapeHtml(l.email)}</td>
          <td>${escapeHtml(l.source)}</td>
          <td>
            <select data-lead-id="${l.id}" class="lead-status-select">
              ${["new", "contacted", "qualified", "converted", "lost"]
                .map((s) => `<option value="${s}" ${s === l.status ? "selected" : ""}>${s}</option>`)
                .join("")}
            </select>
          </td>
          <td>${formatDate(l.created_at)}</td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll(".lead-status-select").forEach((select) => {
      select.addEventListener("change", async () => {
        await api.updateLeadStatus(select.dataset.leadId, select.value);
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Couldn't load leads. Is the backend + Supabase configured? (${err.message})</td></tr>`;
  }
}

// ---------------- Accounts ----------------

async function renderAccounts() {
  const tbody = document.getElementById("accounts-tbody");
  try {
    const accounts = await api.getAccounts();
    if (!accounts.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No accounts yet — add one to get started.</td></tr>`;
      return;
    }
    tbody.innerHTML = accounts
      .map(
        (a) => `
        <tr>
          <td>${escapeHtml(a.name)}</td>
          <td>${escapeHtml(a.industry)}</td>
          <td>${escapeHtml(a.owner)}</td>
          <td>${escapeHtml(a.website)}</td>
          <td>${formatDate(a.created_at)}</td>
        </tr>`
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Couldn't load accounts. (${err.message})</td></tr>`;
  }
}

// ---------------- Pipeline ----------------

async function renderPipeline() {
  const board = document.getElementById("pipeline-board");
  try {
    const deals = await api.getDeals();
    board.innerHTML = STAGES.map((stage) => {
      const stageDeals = deals.filter((d) => d.deal_stage === stage);
      return `
        <div class="pipeline-column">
          <div class="pipeline-column__title"><span>${stage}</span><span>${stageDeals.length}</span></div>
          ${stageDeals
            .map(
              (d) => `
            <div class="pipeline-card">
              <div class="pipeline-card__client">${escapeHtml(d.client_name)}</div>
              <div class="pipeline-card__value">${formatMoney(d.value)} · ${d.probability}%</div>
              <select data-deal-id="${d.id}" class="deal-stage-select">
                ${STAGES.map((s) => `<option value="${s}" ${s === stage ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </div>`
            )
            .join("")}
        </div>`;
    }).join("");

    board.querySelectorAll(".deal-stage-select").forEach((select) => {
      select.addEventListener("change", async () => {
        await api.updateDealStage(select.dataset.dealId, select.value);
        renderPipeline();
      });
    });
  } catch (err) {
    board.innerHTML = `<div class="empty-state">Couldn't load the pipeline. (${err.message})</div>`;
  }
}

// ---------------- Forms ----------------

function initForms() {
  document.getElementById("lead-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await api.createLead(Object.fromEntries(form));
    e.target.reset();
    closeModal("lead-modal-overlay");
    renderLeads();
  });

  document.getElementById("account-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await api.createAccount(Object.fromEntries(form));
    e.target.reset();
    closeModal("account-modal-overlay");
    renderAccounts();
  });

  document.getElementById("deal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    form.value = Number(form.value) || 0;
    form.probability = Number(form.probability) || 0;
    await api.createDeal(form);
    e.target.reset();
    closeModal("deal-modal-overlay");
    renderPipeline();
  });
}

// ---------------- Bootstrap ----------------

async function bootstrap() {
  const authed = await loadLayout();
  if (!authed) return; // loadLayout() is already redirecting to login.html

  initTabs();
  initModals();
  initForms();
  initAiWidget();

  await Promise.all([renderLeads(), renderAccounts(), renderPipeline()]);
}

document.addEventListener("DOMContentLoaded", bootstrap);
