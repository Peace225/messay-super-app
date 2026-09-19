import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// REMPLACE par tes clés (Supabase > Settings > API)
const supabaseUrl = 'https://awxwsvnzeyrpbotpzrgo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3eHdzdm56ZXlycGJvdHB6cmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NjY2NDYsImV4cCI6MjA5MTE0MjY0Nn0.0GnZcx1oeQxo1z6kU1MQNsNTJNTRxi5zGDhWa9HbyEw';
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ===== FONCTIONS POUR TON APP =====

// Récupérer les compagnies
export const getCompanies = async () => {
  const { data, error } = await supabase
   .from('companies')
   .select('*')
   .order('name');

  if (error) throw error;
  return data;
};

// Récupérer les trajets
export const getTrajets = async (depart: string, arrivee: string) => {
  const { data, error } = await supabase
   .from('Trajet')
   .select('*')
   .ilike('depart', `%${depart}%`)
   .ilike('arrivee', `%${arrivee}%`)
   .order('heure_depart');

  if (error) throw error;
  return data;
};

// Créer un ticket
export const createTicket = async (ticketData: any) => {
  const { data, error } = await supabase
   .from('Ticket')
   .insert([ticketData])
   .select()
   .single();

  if (error) throw error;
  return data;
};

// Récupérer les tickets d'un user
export const getUserTickets = async (userId: string) => {
  const { data, error } = await supabase
   .from('Ticket')
   .select('*, Trajet(*)')
   .eq('user_id', userId)
   .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};