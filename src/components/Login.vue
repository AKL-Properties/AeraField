<template>
  <div class="login-container">
    <div class="login-card">
      <div class="header">
        <div class="logo-circle">
          <img src="/logo.png" alt="AeraField Logo" style="width:40px; height:20px;" />
        </div>
        <h1 class="title">AéraField</h1>
        <p class="subtitle">Field Navigation Map</p>
      </div>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <input
            v-model="email"
            type="email"
            placeholder="Email"
            required
            class="form-input"
            :class="{ focused: emailFocused }"
            @focus="emailFocused = true"
            @blur="emailFocused = false"
          />
        </div>

        <div class="form-group">
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            required
            class="form-input"
            :class="{ focused: passwordFocused }"
            @focus="passwordFocused = true"
            @blur="passwordFocused = false"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="submit-button"
          :class="{ loading }"
        >
          {{ loading ? 'Signing In...' : 'Sign In' }}
        </button>
      </form>

      <div class="footer">
        Secure access for Aera personnel only
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'Login',
  setup() {
    const { signIn } = useAuth()
    
    const email = ref('')
    const password = ref('')
    const loading = ref(false)
    const error = ref('')
    const emailFocused = ref(false)
    const passwordFocused = ref(false)

    const handleSubmit = async () => {
      loading.value = true
      error.value = ''

      try {
        const result = await signIn(email.value, password.value)
        if (!result.success) {
          error.value = result.error || 'An unexpected error occurred'
        }
      } catch (err) {
        error.value = 'An unexpected error occurred'
      } finally {
        loading.value = false
      }
    }

    return {
      email,
      password,
      loading,
      error,
      emailFocused,
      passwordFocused,
      handleSubmit
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background: #1294b9 !important;
  padding: 1rem;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  background: #1294b9 !important;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 20px 40px rgba(18, 148, 185, 0.3);
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.logo-circle {
  width: 60px;
  height: 60px;
  margin: 0 auto 1rem;
  background: transparent;
  border: 2px solid #fcfcfc;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  box-shadow: 0 8px 25px rgba(0, 188, 212, 0.3);
}

.title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #fcfcfc;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  color: #fcfcfc;
  font-size: 0.9rem;
  margin: 0;
  font-weight: 400;
}

.login-form {
  width: 100%;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-input {
  width: 100%;
  padding: 1rem;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(18, 148, 185, 0.3);
  border-radius: 12px;
  color: #1294b9;
  outline: none;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.form-input::placeholder {
  color: #999999;
}

.form-input.focused,
.form-input:focus {
  border-color: #00bcd4;
  box-shadow: 0 0 0 3px rgba(0, 188, 212, 0.2);
  background: rgba(255, 255, 255, 0.9);
}

.error-message {
  padding: 0.75rem;
  margin-bottom: 1rem;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 8px;
  color: #f44336;
  font-size: 0.9rem;
  text-align: center;
}

.submit-button {
  width: 100%;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 600;
  background: linear-gradient(135deg, #00bcd4, #26a69a);
  border: none;
  border-radius: 12px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 188, 212, 0.4);
  transform: translateY(0);
}

.submit-button:hover:not(.loading) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 188, 212, 0.5);
}

.submit-button:active:not(.loading) {
  transform: translateY(1px);
  box-shadow: 0 2px 10px rgba(0, 188, 212, 0.4);
}

.submit-button.loading {
  background: rgba(0, 188, 212, 0.4);
  cursor: not-allowed;
  opacity: 0.7;
}

.footer {
  text-align: center;
  margin-top: 1.5rem;
  padding: 1rem 0;
  border-top: 1px solid rgba(18, 148, 185, 0.2);
  color: #fcfcfc;
  font-size: 0.85rem;
}
</style>