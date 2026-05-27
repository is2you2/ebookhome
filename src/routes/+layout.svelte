<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { onMount } from "svelte";
  import "../app.css";
  import { indexed } from "$lib/services/indexed";
  import { initLanguage } from "$lib/services/language";

  let { children } = $props();

  onMount(() => {
    indexed.initialize();
    initLanguage();
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
