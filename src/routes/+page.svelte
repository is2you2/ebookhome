<script lang="ts">
  import Login from "$lib/components/+login.svelte";
  import Main from "$lib/components/+main.svelte";
  import Toast from "$lib/components/+toast.svelte";
  import Viewer from "$lib/components/viewer.svelte";
  import { status } from "$lib/services/global";
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
    setTimeout(() => {
      status.set("login");
    }, 1500);
  });
</script>

<div style="height: 100%;">
  <Viewer />
</div>

{#if $status == "login"}
  <div transition:fade>
    <Login />
  </div>
{:else if $status == "main"}
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
