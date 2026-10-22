<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { onMount } from "svelte";
  import "../app.css";
  import { initLanguage } from "$lib/services/language.svelte";

  let { children } = $props();

  onMount(() => {
    initLanguage();
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
