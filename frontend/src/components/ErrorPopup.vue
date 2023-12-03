<template>
  <div class="popup" v-show="!isBackendConnected">
    <img class="errorImage" src="@/assets/error.jpg" alt="Бэк упал" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const isBackendConnected = ref(true)

async function pingBackend() {
  try {
    const response = await fetch('http://localhost/ping')

    if (response.ok) isBackendConnected.value = true
    else isBackendConnected.value = false
  } catch {
    isBackendConnected.value = false
  }
}

onMounted(() => {
  setInterval(pingBackend, 1000)
})
</script>

<style scoped>
.popup {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  inset: 0;
  z-index: 1;
  background: #33333333;
}

.errorImage {
  max-width: 70%;
  max-height: 70%;
}
</style>
