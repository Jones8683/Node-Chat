<template>
  <SetDisplayName @done="onDone" />
</template>

<script setup>
import { useRouter } from "vue-router";
import SetDisplayName from "../components/SetDisplayName.vue";

const router = useRouter();

function onDone() {
  router.push("/");
}
</script>
