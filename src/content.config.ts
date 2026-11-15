import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { makeSchemas, pricesSchema, siteSchema } from './lib/schemas';

// Tests point CONTENT_ROOT at tests/fixtures/content; the real site reads src/content.
const root = process.env.CONTENT_ROOT ?? 'src/content';

export const collections = {
  events: defineCollection({
    // One folder per event: index.json with its photos and videos next to it.
    loader: glob({
      pattern: '*/index.json',
      base: `${root}/events`,
      generateId: ({ entry }) => entry.split('/')[0],
    }),
    schema: ({ image }) => makeSchemas(image()).event,
  }),
  prices: defineCollection({
    loader: glob({ pattern: 'prices.json', base: `${root}/settings` }),
    schema: pricesSchema,
  }),
  site: defineCollection({
    loader: glob({ pattern: 'site.json', base: `${root}/settings` }),
    schema: siteSchema,
  }),
};
