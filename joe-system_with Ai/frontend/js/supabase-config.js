// supabase-config.js — public Supabase project settings.
// Loaded as a plain <script> BEFORE auth.js on every page.
//
// SUPABASE_URL: same value as SUPABASE_URL in backend/.env
// SUPABASE_ANON_KEY: the "anon" / "public" key from
//   Supabase Dashboard -> Project Settings -> API
//   (⚠️ NOT the service_role key — that one must never appear in the browser)
//
// The anon key is DESIGNED to be public — Row Level Security on the actual
// data tables is what keeps it safe (see sql/auth_rls_lockdown.sql, which
// restricts every CRM/ERP table to the service_role only). The anon key
// here is only ever used to talk to Supabase's Auth endpoints.

window.SUPABASE_CONFIG = {
  SUPABASE_URL: "https://wylzabiosodxakkxeqida.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bHphYmlvc29keGFreGVxaWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MjYwMDEsImV4cCI6MjEwNTAwMjAwMX0.vGII_ibB8SjbVHtaNUsgoqrvz8yp4vnMGWcf1BpVbQo",
};
