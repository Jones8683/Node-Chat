import { ref } from "vue";

const isTauriApp = ref(false);
let detected = false;

export function useTauri() {
  if (!detected) {
    detected = true;
    import("@tauri-apps/api/core")
      .then(({ isTauri }) => isTauri())
      .then((result) => {
        isTauriApp.value = !!result;
      })
      .catch(() => {});
  }
  return { isTauriApp };
}
