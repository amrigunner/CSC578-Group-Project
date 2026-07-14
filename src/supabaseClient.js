import { createClient } from '@supabase/supabase-js';

// Your live project URL built from your project ID
const supabaseUrl = 'https://hktrwdqmdkgnkngjstrg.supabase.co';

// Paste the long 'sb_publishable...' key you copied from the API Keys page here
const supabaseAnonKey = 'sb_publishable_zdNMNNxuSAlqKragpsYQ7w_w7Q2f8vO';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);