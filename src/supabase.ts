import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wbguwmbwutvhqsirtjps.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiZ3V3bWJ3dXR2aHFzaXJ0anBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5Nzg1OTYsImV4cCI6MjA4MzU1NDU5Nn0.tiqGxp4BxqoI7P_jasfZORWjIyvqCbIcwvk9Elmzoa8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
