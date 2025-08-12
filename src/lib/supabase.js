import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xravncpxynlzzewsqawh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYXZuY3B4eW5senpld3NxYXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NDk5MTEsImV4cCI6MjA2ODQyNTkxMX0.2IE-dzQDVvq8b9u7C0oqy35FwVVMu96OGHBOYQEMSZw'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})