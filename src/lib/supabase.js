import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bpnaqrjhxsompkdskepi.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmFxcmpoeHNvbXBrZHNrZXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTkxNDUsImV4cCI6MjA4NzU3NTE0NX0.H16WVF7Vbu6SUQ3h7s1xdARvSj7PIyNGz5dDSGhRlQg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const N8N_BASE = 'https://dorsey.app.n8n.cloud/webhook';

// Auth
export const signUp = async (email, password, fullName, role) => {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, role, app: 'sos' } },
  });
  if (error) throw error;
  fetch(`${N8N_BASE}/sos-new-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, full_name: fullName, role, user_id: data.user?.id || '', app: 'sos' }),
  }).catch(() => {});
  return data;
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => { await supabase.auth.signOut(); };

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// Bookings
export const createBooking = async (booking) => {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: booking.customer_id,
      service_id: booking.service_id || null,
      status: 'pending',
      address: booking.address,
      lat: booking.lat || null,
      lng: booking.lng || null,
      total_price: booking.total_price,
      scheduled_at: booking.scheduled_at || null,
    })
    .select()
    .single();
  if (error) throw error;

  fetch(`${N8N_BASE}/sos-service-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: data.id,
      customer_id: booking.customer_id,
      service_name: booking.service_name,
      category_name: booking.category_name || 'Roadside',
      total_price: booking.total_price,
      address: booking.address,
      status: 'pending',
      app: 'sos',
    }),
  }).catch(() => {});
  return data;
};

export const getBookings = async (customerId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};
