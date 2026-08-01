<script lang="ts">
  import Login from "$lib/components/+login.svelte";
  import Viewer from "$lib/components/viewer.svelte";
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

  let showLogin = $state(false);

  onMount(() => {
    setTimeout(() => {
      showLogin = true;
    }, 1500);
  });
</script>

<div style="height: 100%;">
  <Viewer />
</div>

{#if showLogin}
  <div transition:fade>
    <Login />
  </div>
{/if}

<style lang="scss">
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
</style>
