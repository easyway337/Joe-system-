// erp.js — Inventory / Orders / Procurement / Reports page.
import { loadLayout } from "./layout.js";
import { initAiWidget } from "./ai_voice.js";
import { api } from "./api.js";

const TOOLBAR_ACTIONS = {
  inventory: { label: "+ Add item", modal: "item-modal-overlay" },
  orders: { label: "+ Create order", modal: "order-modal-overlay" },
  procurement: { label: "+ Create PO", modal: "po-modal-overlay" },
  reports: null,
};

let inventoryCache = [];

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const actions = document.getElementById("erp-toolbar-actions");
  const config = TOOLBAR_ACTIONS[tab];
  actions.innerHTML = config
    ? `<button class="btn-primary" id="erp-add-btn">${config.label}</button>`
    : "";
  if (config) {
    document.getElementById("erp-add-btn").addEventListener("click", () => openModal(config.modal));
  }

  window.location.hash = tab;
}

function initTabs() {
  document.querySelectorAll(".crm-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  const initialTab = window.location.hash.replace("#", "");
  switchTab(initialTab in TOOLBAR_ACTIONS ? initialTab : "inventory");
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

// ---------------- Inventory ----------------

async function renderInventory() {
  const tbody = document.getElementById("inventory-tbody");
  try {
    inventoryCache = await api.getInventory();
    if (!inventoryCache.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No inventory items yet — add one to get started.</td></tr>`;
      return;
    }
    tbody.innerHTML = inventoryCache
      .map((item) => {
        const low = item.quantity <= item.reorder_level;
        return `
        <tr>
          <td>${escapeHtml(item.sku)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td>${item.quantity}</td>
          <td>${item.reorder_level}</td>
          <td>${formatMoney(item.unit_price)}</td>
          <td>${escapeHtml(item.warehouse)}</td>
          <td><span class="stock-badge ${low ? "stock-badge--low" : "stock-badge--ok"}">${low ? "Low stock" : "In stock"}</span></td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Couldn't load inventory. (${err.message})</td></tr>`;
  }
}

// ---------------- Orders ----------------

const ORDER_STATUSES = ["pending", "processing", "shipped", "completed", "cancelled"];

async function renderOrders() {
  const tbody = document.getElementById("orders-tbody");
  try {
    const orders = await api.getOrders();
    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No orders yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = orders
      .map((o) => {
        const itemCount = (o.order_items || []).reduce((sum, li) => sum + li.quantity, 0);
        return `
        <tr>
          <td>${escapeHtml(o.order_number)}</td>
          <td>${escapeHtml(o.customer_name)}</td>
          <td>${itemCount} unit(s)</td>
          <td>${formatMoney(o.total_value)}</td>
          <td>
            <select class="status-select order-status-select" data-order-id="${o.id}">
              ${ORDER_STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </td>
          <td>${formatDate(o.created_at)}</td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".order-status-select").forEach((select) => {
      select.addEventListener("change", async () => {
        await api.updateOrderStatus(select.dataset.orderId, select.value);
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Couldn't load orders. (${err.message})</td></tr>`;
  }
}

// ---------------- Procurement ----------------

const PO_STATUSES = ["draft", "sent", "received", "cancelled"];

async function renderProcurement() {
  const tbody = document.getElementById("procurement-tbody");
  try {
    const pos = await api.getPurchaseOrders();
    if (!pos.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No purchase orders yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = pos
      .map((po) => {
        const itemCount = (po.purchase_order_items || []).reduce((sum, li) => sum + li.quantity, 0);
        return `
        <tr>
          <td>${escapeHtml(po.po_number)}</td>
          <td>${escapeHtml(po.supplier_name)}</td>
          <td>${itemCount} unit(s)</td>
          <td>${formatMoney(po.total_value)}</td>
          <td>${po.expected_date ? formatDate(po.expected_date) : "—"}</td>
          <td>
            <select class="status-select po-status-select" data-po-id="${po.id}">
              ${PO_STATUSES.map((s) => `<option value="${s}" ${s === po.status ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </td>
          <td>${formatDate(po.created_at)}</td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".po-status-select").forEach((select) => {
      select.addEventListener("change", async () => {
        await api.updatePurchaseOrderStatus(select.dataset.poId, select.value);
        // Marking "received" restocks inventory server-side — refresh both views.
        await Promise.all([renderProcurement(), renderInventory()]);
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Couldn't load purchase orders. (${err.message})</td></tr>`;
  }
}

// ---------------- Reports ----------------

async function renderReports() {
  try {
    const [valuation, lowStock] = await Promise.all([
      api.getStockValuation(),
      api.getLowStockReport(),
    ]);

    document.getElementById("report-stock-value").textContent = formatMoney(valuation.total_stock_value);
    document.getElementById("report-item-count").textContent = valuation.items.length;
    document.getElementById("report-low-stock-count").textContent = lowStock.length;

    const tbody = document.getElementById("low-stock-tbody");
    tbody.innerHTML = lowStock.length
      ? lowStock
          .map(
            (i) => `
        <tr>
          <td>${escapeHtml(i.sku)}</td>
          <td>${escapeHtml(i.name)}</td>
          <td>${i.quantity}</td>
          <td>${i.reorder_level}</td>
          <td>${escapeHtml(i.warehouse)}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="5" class="empty-state">Nothing is low on stock right now 🎉</td></tr>`;
  } catch (err) {
    document.getElementById("low-stock-tbody").innerHTML =
      `<tr><td colspan="5" class="empty-state">Couldn't load reports. (${err.message})</td></tr>`;
  }
}

// ---------------- Dynamic line-item rows (Order / PO forms) ----------------

function inventoryOptionsHtml(selectedId) {
  return inventoryCache
    .map((i) => `<option value="${i.id}" ${i.id === selectedId ? "selected" : ""}>${escapeHtml(i.name)} (${i.sku})</option>`)
    .join("");
}

function addLineItemRow(containerId, priceLabel) {
  const container = document.getElementById(containerId);
  const row = document.createElement("div");
  row.className = "line-item-row";
  const defaultItem = inventoryCache[0];
  row.innerHTML = `
    <select class="line-item-select">${inventoryOptionsHtml(defaultItem?.id)}</select>
    <input type="number" class="line-item-qty" min="1" value="1" />
    <input type="number" class="line-item-price" min="0" step="0.01" value="${defaultItem ? defaultItem.unit_price : 0}" title="${priceLabel}" />
    <button type="button" class="line-item-remove" aria-label="Remove item">✕</button>
  `;
  row.querySelector(".line-item-remove").addEventListener("click", () => row.remove());
  row.querySelector(".line-item-select").addEventListener("change", (e) => {
    const item = inventoryCache.find((i) => i.id === e.target.value);
    if (item) row.querySelector(".line-item-price").value = item.unit_price;
  });
  container.appendChild(row);
}

function collectLineItems(containerId, priceField) {
  const rows = document.querySelectorAll(`#${containerId} .line-item-row`);
  return Array.from(rows).map((row) => {
    const itemId = row.querySelector(".line-item-select").value;
    const item = inventoryCache.find((i) => i.id === itemId);
    return {
      inventory_item_id: itemId,
      item_name: item ? item.name : "Unknown item",
      quantity: Number(row.querySelector(".line-item-qty").value) || 1,
      [priceField]: Number(row.querySelector(".line-item-price").value) || 0,
    };
  });
}

// ---------------- Forms ----------------

function initForms() {
  document.getElementById("item-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    form.quantity = Number(form.quantity) || 0;
    form.reorder_level = Number(form.reorder_level) || 0;
    form.unit_price = Number(form.unit_price) || 0;
    await api.createInventoryItem(form);
    e.target.reset();
    closeModal("item-modal-overlay");
    renderInventory();
  });

  document.getElementById("order-add-line").addEventListener("click", () => addLineItemRow("order-line-items", "Unit price"));
  document.getElementById("po-add-line").addEventListener("click", () => addLineItemRow("po-line-items", "Unit cost"));

  document.getElementById("order-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const customer_name = document.getElementById("order-customer").value;
    const items = collectLineItems("order-line-items", "unit_price");
    if (!items.length) return;
    await api.createOrder({ customer_name, items });
    e.target.reset();
    document.getElementById("order-line-items").innerHTML = "";
    closeModal("order-modal-overlay");
    await Promise.all([renderOrders(), renderInventory()]);
  });

  document.getElementById("po-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const supplier_name = document.getElementById("po-supplier").value;
    const expected_date = document.getElementById("po-expected").value || null;
    const items = collectLineItems("po-line-items", "unit_cost");
    if (!items.length) return;
    await api.createPurchaseOrder({ supplier_name, expected_date, items });
    e.target.reset();
    document.getElementById("po-line-items").innerHTML = "";
    closeModal("po-modal-overlay");
    renderProcurement();
  });

  // Pre-populate one line item row the first time each modal opens.
  document.getElementById("erp-toolbar-actions").addEventListener("click", (e) => {
    if (e.target.id !== "erp-add-btn") return;
    const activeTab = document.querySelector(".crm-tab.is-active")?.dataset.tab;
    if (activeTab === "orders" && !document.querySelector("#order-line-items .line-item-row")) {
      addLineItemRow("order-line-items", "Unit price");
    }
    if (activeTab === "procurement" && !document.querySelector("#po-line-items .line-item-row")) {
      addLineItemRow("po-line-items", "Unit cost");
    }
  });
}

// ---------------- Bootstrap ----------------

async function bootstrap() {
  const authed = await loadLayout();
  if (!authed) return; // loadLayout() is already redirecting to login.html

  await renderInventory(); // load inventory first so line-item dropdowns have data
  initTabs();
  initModals();
  initForms();
  initAiWidget();

  await Promise.all([renderOrders(), renderProcurement(), renderReports()]);
}

document.addEventListener("DOMContentLoaded", bootstrap);
