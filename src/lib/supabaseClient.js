import { createClient } from '@supabase/supabase-js';

// Usamos import.meta.env para acceder a las variables de entorno en Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificación de seguridad durante el desarrollo
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan las variables de entorno de Supabase. Verifica tu archivo .env');
}

// Creamos y exportamos la instancia del cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);