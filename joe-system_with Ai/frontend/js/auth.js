// auth.js — thin wrapper around Supabase's Auth REST API (plain fetch,
// no supabase-js dependency needed) plus local session storage.
//
// The session (access_token, refresh_token, user) is kept in localStorage
// so it survives page reloads. This is a real deployed project (not a
// Claude.ai artifact preview), so localStorage is the right tool here —
// it's the standard place browser apps keep auth tokens.

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.SUPABASE_CONFIG || {};
const SESSION_KEY = "nexus_session";

function authHeaders() {
  return { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY };
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Sign up failed.");
  // If email confirmation is disabled in the Supabase dashboard, signup
  // already returns a usable session — save it so the person is logged in.
  if (data.access_token) saveSession(data);
  return data;
}

export async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Invalid email or password.");
  saveSession(data);
  return data;
}

export async function refreshSession() {
  const session = getSession();
  if (!session?.refresh_token) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  const data = await res.json();
  saveSession(data);
  return data;
}

export function signOut() {
  clearSession();
  window.location.href = "login.html";
}

/** Call at the top of every protected page. Redirects to login.html (and
 * returns null) if there's no session; otherwise returns it. */
export function requireAuth() {
  const session = getSession();
  if (!session?.access_token) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

/** Call at the top of login.html/register.html — skips straight to the
 * dashboard if the person is already signed in. */
export function redirectIfAuthenticated() {
  if (getSession()?.access_token) {
    window.location.href = "index.html";
  }
}
