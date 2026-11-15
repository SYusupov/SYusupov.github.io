// @ts-check
import { defineConfig } from 'astro/config';

// Tests build the site from tests/fixtures/content (CONTENT_ROOT) into their own folders,
// so the real content published by the admin never decides whether tests pass.
const fixtureBuild = Boolean(process.env.CONTENT_ROOT);

export default defineConfig({
  site: 'https://chocoparty.uz',
  trailingSlash: 'always',
  outDir: fixtureBuild ? './dist-test' : './dist',
  cacheDir: fixtureBuild ? './.astro-cache-test' : './.astro-cache',
  i18n: {
    locales: ['ru', 'uz', 'en'],
    defaultLocale: 'ru',
    routing: { prefixDefaultLocale: false },
  },
});
