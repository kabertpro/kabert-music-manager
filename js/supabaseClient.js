// ============================================================
// KABERT MUSIC MANAGER — Conexión con Supabase
// Kabert Studio · LMKE
// ============================================================
// 1. Crea un proyecto en https://supabase.com
// 2. Ejecuta el archivo supabase/schema.sql en el SQL Editor
// 3. Reemplaza los valores de abajo con los de tu proyecto
//    (Project Settings → API)
// ============================================================

const SUPABASE_URL = "https://vzjkpjxlhsbjggwzwvaz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6amtwanhsaHNiamdnd3p3dmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MjY0NDQsImV4cCI6MjA5ODUwMjQ0NH0.c701GDXFZmxUes1xfZdGKbNMc-SDPJXb7L3a-F6a3Uo";

if (SUPABASE_URL.includes("TU-PROYECTO")) {
  console.warn(
    "[Kabert Music Manager] Configura tus credenciales de Supabase en js/supabaseClient.js"
  );
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
