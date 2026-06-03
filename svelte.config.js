import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      fallback: 'index.html' // SPA fallback 필요하면
    }),
    paths: {
      base: '/ebook_sample' // GitHub Pages에 배포할 때 필요
    }
  }
};