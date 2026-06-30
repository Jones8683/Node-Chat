import { ref } from "vue";

const toastMessage = ref("");
const toastVisible = ref(false);
let toastTimer = null;

export function showToast(message, duration = 2000) {
  toastMessage.value = message;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
    toastTimer = null;
  }, duration);
}

export { toastMessage, toastVisible };
