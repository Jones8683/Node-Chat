<template>
  <AuthForm mode="signup" />
</template>

<script setup>
import { useAuthRedirect } from "../composables/useAuthRedirect";
import AuthForm from "../components/AuthForm.vue";

useAuthRedirect();
</script>
