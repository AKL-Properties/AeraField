import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'

const user = ref(null)
const loading = ref(true)

export function useAuth() {
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      user.value = null
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      
      user.value = data.user
      return { success: true }
    } catch (error) {
      console.error('Error signing in:', error)
      return { success: false, error: error.message }
    }
  }

  const signUp = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      })
      
      if (error) throw error
      
      return { success: true, needsConfirmation: !data.user?.email_confirmed_at }
    } catch (error) {
      console.error('Error signing up:', error)
      return { success: false, error: error.message }
    }
  }

  onMounted(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      user.value = session?.user ?? null
      loading.value = false
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      user.value = session?.user ?? null
      loading.value = false
    })

    return () => subscription.unsubscribe()
  })

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut
  }
}