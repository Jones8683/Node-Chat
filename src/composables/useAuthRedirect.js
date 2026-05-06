import { watch } from "vue";
import { useRouter } from "vue-router";
import { user } from "../store/auth";

export function useAuthRedirect() {
  const router = useRouter();

  watch(user, (u) => {
    if (!u) return;
    if (u.displayName?.trim()) {
      router.push("/");
    } else {
      router.push("/setup");
    }
  });
}
