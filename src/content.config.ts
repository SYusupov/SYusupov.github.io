import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { makeSchemas, pricesSchema, siteSchema } from './lib/schemas';

// Tests point CONTENT_ROOT at tests/fixtures/content; the real site reads src/content.
const root = process.env.CONTENT_ROOT ?? 'src/content';

/** One folder per entry: index.json with its photos next to it; the folder name is the id. */
const folders = (name: string) =>
  glob({ pattern: '*/index.json', base: `${root}/${name}`, generateId: ({ entry }) => entry.split('/')[0] });

export const collections = {
  events: defineCollection({
    loader: folders('events'),
    schema: ({ image }) => makeSchemas(image()).event,
  }),
  companies: defineCollection({
    loader: folders('companies'),
    schema: ({ image }) => makeSchemas(image()).company,
  }),
  reviews: defineCollection({
    loader: folders('reviews'),
    schema: ({ image }) => makeSchemas(image()).review,
  }),
  promotions: defineCollection({
    loader: folders('promotions'),
    schema: ({ image }) => makeSchemas(image()).promotion,
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
