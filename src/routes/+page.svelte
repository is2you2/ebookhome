<script lang="ts">
  import Main from "$lib/components/+main.svelte";
  import Toast from "$lib/components/+toast.svelte";
  import Viewer from "$lib/components/viewer.svelte";
  import { status } from "$lib/services/global.svelte";
  import { initAuth, recordVisit } from "$lib/services/server.svelte";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  const media = window.matchMedia("(prefers-color-scheme: dark)");

  document.documentElement.dataset.theme = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches
    ? "dark"
    : "light";
  media.addEventListener("change", (e) => {
    document.documentElement.dataset.theme = e.matches ? "dark" : "light";
  });

  onMount(() => {
    // 🌟 저장된 JWT 토큰 검증 및 유저 상태 복원
    initAuth();
    recordVisit("http://localhost:3000");
    status.value = "main";
  });
</script>

<div style="height: 100%;">
  <Viewer />
</div>

{#if status.value === "main"}
  <div transition:fade>
    <Main />
  </div>
{/if}

<Toast />

<style lang="scss">
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
</style>