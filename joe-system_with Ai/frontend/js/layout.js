// layout.js — shared shell logic used by every page (dashboard, CRM, ...).
// Loads the sidebar, header, and AI widget HTML fragments into their slots.
import { getSession, requireAuth, signOut } from "./auth.js";

export async function loadComponent(targetId, path) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const res = await fetch(path);
  target.innerHTML = await res.text();
}

export async function loadLayout() {
  // Every protected page calls loadLayout() first thing — bail out to
  // login.html immediately if there's no valid session.
  const session = requireAuth();
  if (!session) return false;

  await Promise.all([
    loadComponent("sidebar-slot", "components/sidebar.html"),
    loadComponent("header-slot", "components/header.html"),
    loadComponent("ai-widget-slot", "components/ai_widget.html"),
  ]);
  highlightActiveNavLink();
  wireAuthUI();
  return true;
}

function wireAuthUI() {
  const session = getSession();
  const emailEl = document.getElementById("topbar-user-email");
  if (emailEl && session?.user?.email) {
    emailEl.textContent = session.user.email;
  }
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", signOut);
  }
}

// Highlights the sidebar link matching the current page so the person can
// see where they are (dashboard vs. crm.html#leads, etc.).
function highlightActiveNavLink() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  const hash = window.location.hash.replace("#", "");
  document.querySelectorAll(".sidebar__link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const matches =
      (page === "index.html" && href.includes("dashboard")) ||
      (hash && href.includes(hash));
    link.classList.toggle("is-active", matches);
  });
}
