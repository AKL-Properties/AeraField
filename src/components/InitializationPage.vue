<template>
  <div class="initialization-screen">
    <div class="animation-container">
      <DotLottieVue
        src="/animations/AeraField.json"
        :autoplay="true"
        :loop="true"
        :speed="1"
        class="lottie-animation"
      />
    </div>
  </div>
</template>

<script>
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'

export default {
  name: 'InitializationPage',
  components: {
    DotLottieVue
  }
}
</script>

<style scoped>
.initialization-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #1394b9;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.animation-container {
  width: 500px;
  height: 500px;
  max-width: 100vw;
  max-height: 100vh;
}

.lottie-animation {
  width: 100%;
  height: 100%;
}
</style>