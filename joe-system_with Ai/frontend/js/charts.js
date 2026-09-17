// charts.js — renders the dashboard's charts, KPI cards, and opportunities table.
import { api } from "./api.js";

const STAGE_BADGE_CLASS = {
  Proposal: "badge--proposal",
  Qualified: "badge--qualified",
  Lost: "badge--lost",
  Negotiation: "badge--proposal",
  Won: "badge--qualified",
};

function formatMoney(value) {
  return `$${Number(value).toLocaleString("en-US")}`;
}

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const hours = Math.max(1, Math.round(diffMs / 3_600_000));
  return `${hours}h ago`;
}

export async function renderKpis() {
  const kpis = await api.getKpis();
  document.getElementById("kpi-revenue").textContent = formatMoney(kpis.total_revenue);
  document.getElementById("kpi-orders").textContent = kpis.new_orders;
  document.getElementById("kpi-stock").textContent = formatMoney(kpis.stock_value);
}

export async function renderSalesChart() {
  const monthly = await api.getMonthlySales();
  const ctx = document.getElementById("sales-chart").getContext("2d");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: monthly.map((m) => m.month),
      datasets: [
        {
          label: "Monthly Sales & Forecast",
          data: monthly.map((m) => m.value),
          backgroundColor: monthly.map((_, i) =>
            i === monthly.length - 4 ? "#A855F7" : "#3B82F6"
          ),
          borderRadius: 4,
          maxBarThickness: 22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "#EEF2F7" } },
        x: { grid: { display: false } },
      },
    },
  });
}

export async function renderInventoryTurnoverChart() {
  const { values } = await api.getInventoryTurnover();
  const ctx = document.getElementById("turnover-chart").getContext("2d");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: values.map((_, i) => i + 1),
      datasets: [
        {
          data: values,
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59,130,246,0.08)",
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: "#EEF2F7" } },
        x: { display: false },
      },
    },
  });
}

export async function renderOpportunities() {
  const rows = await api.getOpportunities(10);
  const tbody = document.getElementById("opportunities-tbody");

  tbody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.client_name}</td>
        <td><span class="badge ${STAGE_BADGE_CLASS[row.deal_stage] || "badge--proposal"}">${row.deal_stage}</span></td>
        <td>${formatMoney(row.value)}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="probability-bar"><div class="probability-bar__fill" style="width:${row.probability}%"></div></div>
            <span>${row.probability}%</span>
          </div>
        </td>
        <td>${row.owner}</td>
        <td>${timeAgo(row.last_activity)}</td>
        <td>✏️ ⋯</td>
      </tr>`
    )
    .join("");
}

export async function initDashboardData() {
  await Promise.all([
    renderKpis(),
    renderSalesChart(),
    renderInventoryTurnoverChart(),
    renderOpportunities(),
  ]);
}
