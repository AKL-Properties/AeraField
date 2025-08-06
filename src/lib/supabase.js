import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yckvroohruvkhltaqrwk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja3Zyb29ocnV2a2hsdGFxcndrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NzI2ODUsImV4cCI6MjA2OTQ0ODY4NX0.28GdDsdyHw6C86P-GXRh3BhPVdr1D0cvEuG-azgyhVM'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})