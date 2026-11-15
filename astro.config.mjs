// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

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
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Playfair Display',
      cssVariable: '--font-display',
      weights: [600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext', 'cyrillic'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Manrope',
      cssVariable: '--font-body',
      weights: [400, 500, 600, 700],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext', 'cyrillic'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
});
