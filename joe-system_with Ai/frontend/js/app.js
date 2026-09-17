// app.js — Dashboard page bootstrap.
// Loads the shared layout (sidebar/header/AI widget) plus the dashboard's
// own components and data, and wires up the voice widget.
//
// NOTE: fetch() of local components/*.html requires the frontend to be
// served over http (e.g. `python -m http.server 5500` from /frontend)
// rather than opened as a file://.
import { loadLayout, loadComponent } from "./layout.js";
import { initDashboardData } from "./charts.js";
import { initAiWidget } from "./ai_voice.js";

async function bootstrap() {
  const authed = await loadLayout();
  if (!authed) return; // loadLayout() is already redirecting to login.html

  await loadComponent("opportunities-slot", "components/crm_table.html");

  await initDashboardData();
  initAiWidget();
}

document.addEventListener("DOMContentLoaded", bootstrap);
