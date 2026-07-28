<script lang="ts">
  import Viewer from "$lib/components/viewer.svelte";

  const media = window.matchMedia("(prefers-color-scheme: dark)");

  document.documentElement.dataset.theme = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches
    ? "dark"
    : "light";
  media.addEventListener("change", (e) => {
    document.documentElement.dataset.theme = e.matches ? "dark" : "light";
  });
</script>

<div style="height: 100%;">
  <Viewer />
</div>

<style lang="scss">
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
</style>
