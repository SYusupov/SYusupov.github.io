import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { pricesSchema, siteSchema } from './lib/schemas';

// Tests point CONTENT_ROOT at tests/fixtures/content; the real site reads src/content.
const root = process.env.CONTENT_ROOT ?? 'src/content';

export const collections = {
  prices: defineCollection({
    loader: glob({ pattern: 'prices.json', base: `${root}/settings` }),
    schema: pricesSchema,
  }),
  site: defineCollection({
    loader: glob({ pattern: 'site.json', base: `${root}/settings` }),
    schema: siteSchema,
  }),
};
