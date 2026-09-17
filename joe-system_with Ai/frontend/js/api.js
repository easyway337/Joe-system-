// api.js — thin wrapper around the FastAPI backend.
// Every other JS module talks to the backend only through these functions.
//
// The base URL is resolved once in config.js (loaded before this module)
// so this file works unmodified on localhost, Google IDX, Codespaces, or
// a real domain. See config.js to override it manually if auto-detection
// ever guesses wrong for your environment.
import { clearSession, getSession, refreshSession } from "./auth.js";

const API_BASE = window.APP_CONFIG?.API_BASE_URL || "http://127.0.0.1:8000/api";

async function request(path, options = {}, isRetry = false) {
  const session = getSession();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && !isRetry) {
    // Access token likely expired — try refreshing it once before giving up.
    const refreshed = await refreshSession();
    if (refreshed) return request(path, options, true);
    clearSession();
    window.location.href = "login.html";
    return; // navigation is in flight; nothing further to return
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status} on ${path}`);
  }
  return res.json();
}

export const api = {
  // Analytics
  getKpis: () => request("/analytics/kpis"),
  getMonthlySales: () => request("/analytics/sales-monthly"),
  getInventoryTurnover: () => request("/analytics/inventory-turnover"),
  getOpportunities: (limit = 10) => request(`/analytics/opportunities?limit=${limit}`),

  // CRM — Leads
  getLeads: (status) => request(`/crm/leads${status ? `?status=${status}` : ""}`),
  createLead: (lead) =>
    request("/crm/leads", { method: "POST", body: JSON.stringify(lead) }),
  updateLeadStatus: (id, status) =>
    request(`/crm/leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  getTopLeads: (limit = 5) => request(`/crm/leads/top?limit=${limit}`),

  // CRM — Accounts
  getAccounts: () => request("/crm/accounts"),
  createAccount: (account) =>
    request("/crm/accounts", { method: "POST", body: JSON.stringify(account) }),

  // CRM — Pipeline / Deals
  getDeals: () => request("/crm/deals"),
  createDeal: (deal) =>
    request("/crm/deals", { method: "POST", body: JSON.stringify(deal) }),
  updateDealStage: (id, deal_stage) =>
    request(`/crm/deals/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ deal_stage }),
    }),

  // CRM — Search (used by the AI widget and the global search box)
  searchCrm: (q) => request(`/crm/search?q=${encodeURIComponent(q)}`),

  // ERP — Inventory
  getInventory: (lowStockOnly = false) =>
    request(`/erp/inventory${lowStockOnly ? "?low_stock_only=true" : ""}`),
  searchInventory: (name) =>
    request(`/erp/inventory/search?name=${encodeURIComponent(name)}`),
  createInventoryItem: (item) =>
    request("/erp/inventory", { method: "POST", body: JSON.stringify(item) }),
  updateInventoryItem: (id, fields) =>
    request(`/erp/inventory/${id}`, { method: "PATCH", body: JSON.stringify(fields) }),

  // ERP — Orders
  getOrders: (status) => request(`/erp/orders${status ? `?status=${status}` : ""}`),
  createOrder: (order) =>
    request("/erp/orders", { method: "POST", body: JSON.stringify(order) }),
  updateOrderStatus: (id, status) =>
    request(`/erp/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // ERP — Procurement
  getPurchaseOrders: (status) => request(`/erp/procurement${status ? `?status=${status}` : ""}`),
  createPurchaseOrder: (po) =>
    request("/erp/procurement", { method: "POST", body: JSON.stringify(po) }),
  updatePurchaseOrderStatus: (id, status) =>
    request(`/erp/procurement/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // ERP — Reports
  getStockValuation: () => request("/erp/reports/stock-valuation"),
  getLowStockReport: () => request("/erp/reports/low-stock"),

  // AI Assistant
  sendVoiceCommand: (transcript) =>
    request("/ai/voice-command", {
      method: "POST",
      body: JSON.stringify({ transcript }),
    }),
};
