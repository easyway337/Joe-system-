// config.js — resolves the FastAPI backend base URL for whatever environment
// this is running in (your machine, Google IDX / Cloud Workstations, GitHub
// Codespaces, a custom domain behind a reverse proxy, ...).
//
// Loaded as a plain <script> BEFORE any module script, so api.js can read
// window.APP_CONFIG.API_BASE_URL synchronously.
//
// Easiest override: set it explicitly and skip all the guessing below.
//   window.APP_CONFIG = { API_BASE_URL: "https://8000-your-idx-preview-url/api" };

(function () {
  const BACKEND_PORT = 8000; // change if you run uvicorn on a different port

  function resolveApiBase() {
    const { protocol, hostname, port } = window.location;

    // 1) Cloud IDE preview domains that put the port at the START of the
    //    hostname — the pattern Google IDX / Cloud Workstations use:
    //    "5500-firebase-abc123.cluster-xyz.cloudworkstations.dev"
    //    Every port (frontend, backend, ...) gets its own full preview
    //    domain that only differs by this leading "<port>-" prefix, so we
    //    swap the frontend's port for the backend's and keep the rest of
    //    the hostname untouched.
    const leadingPort = hostname.match(/^\d+-(.+)$/);
    if (leadingPort) {
      return `${protocol}//${BACKEND_PORT}-${leadingPort[1]}/api`;
    }

    // 2) Cloud IDE domains that put the port at the END of the first label —
    //    the pattern GitHub Codespaces uses: "myapp-5500.app.github.dev"
    const trailingPort = hostname.match(/^(.+)-(\d+)(\.[a-z0-9.-]+)$/i);
    if (trailingPort) {
      return `${protocol}//${trailingPort[1]}-${BACKEND_PORT}${trailingPort[3]}/api`;
    }

    // 3) No port in the URL at all (typical HTTPS deployment behind a
    //    reverse proxy that forwards /api/* to the backend) -> use a
    //    same-origin relative path, nothing to guess.
    if (!port) {
      return "/api";
    }

    // 4) Plain local development: frontend on some port, backend on
    //    BACKEND_PORT, same hostname (e.g. 127.0.0.1 or localhost).
    return `${protocol}//${hostname}:${BACKEND_PORT}/api`;
  }

  // Belt-and-braces: strip any trailing slash(es) so callers can always do
  // `${API_BASE_URL}/some/path` without risking a double slash.
  function stripTrailingSlashes(url) {
    return url.replace(/\/+$/, "");
  }

  window.APP_CONFIG = window.APP_CONFIG || {};
  window.APP_CONFIG.API_BASE_URL = stripTrailingSlashes(
    window.APP_CONFIG.API_BASE_URL || resolveApiBase()
  );

  // eslint-disable-next-line no-console
  console.info("[Nexus] API base URL resolved to:", window.APP_CONFIG.API_BASE_URL);
})();
