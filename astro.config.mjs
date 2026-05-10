import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://startups.techritual.com',
  build: {
    inlineStylesheets: 'auto'
  },
  compressHTML: true
});
