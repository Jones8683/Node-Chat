import { createRouter, createWebHistory } from "vue-router";
import { user, waitForAuth } from "../store/auth";

const routes = [
  {
    path: "/login",
    component: () => import("../views/LoginView.vue"),
    meta: { guestOnly: true },
  },
  {
    path: "/signup",
    component: () => import("../views/SignupView.vue"),
    meta: { guestOnly: true },
  },
  {
    path: "/setup",
    component: () => import("../views/SetupView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/",
    component: () => import("../views/ChatView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  await waitForAuth();

  const isAuthenticated = !!user.value;
  const hasDisplayName = !!(user.value?.displayName?.trim());

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  if (
    to.meta.requiresAuth &&
    isAuthenticated &&
    !hasDisplayName &&
    to.path !== "/setup"
  ) {
    return "/setup";
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return hasDisplayName ? "/" : "/setup";
  }
});

export default router;
