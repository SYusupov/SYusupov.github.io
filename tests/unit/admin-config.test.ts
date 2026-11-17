import { readdirSync, readFileSync } from 'node:fs';
import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';
import { buildCmsConfig, type CmsField } from '../../src/admin/config';
import { makeSchemas, pricesSchema, siteSchema } from '../../src/lib/schemas';

/**
 * Seam 7: everything an admin form can save passes the content schema, and every field the
 * schema needs is a required field in the form. Entries are generated from the field
 * definitions: the smallest fills only required fields, the largest fills every field at its limit.
 */

type Mode = 'smallest' | 'largest';

/** Fields with a pattern need a value that matches it; it cannot be generated from the regex. */
const PATTERN_SAMPLES: Record<string, string> = {
  url: 'https://www.example.com',
  telegram: 'choco_test',
  phone: '+998901112233',
  metrikaId: '12345678',
};

function sampleValue(field: CmsField, mode: Mode, path: string): unknown {
  switch (field.widget) {
    case 'object':
      return entryFrom(field.fields ?? [], mode, `${path}.`);
    case 'number':
      return mode === 'smallest' ? (field.min ?? 0) : (field.max ?? 1_000_000);
    case 'select': {
      const options = field.options ?? [];
      const option = mode === 'smallest' ? options[0] : options[options.length - 1];
      return typeof option === 'string' ? option : option?.value;
    }
    case 'datetime':
      return mode === 'smallest' ? '2015-01-01' : '2030-12-31';
    case 'image':
    case 'file': {
      const extension = field.widget === 'image' ? 'webp' : 'mp4';
      const name = (i: number) => `${String(i + 1).padStart(2, '0')}.${extension}`;
      return field.multiple
        ? Array.from({ length: mode === 'smallest' ? 1 : (field.max ?? 1) }, (_, i) => name(i))
        : name(0);
    }
    case 'string':
    case 'text':
      return PATTERN_SAMPLES[path] ?? (mode === 'smallest' ? 'А' : 'Длинный текст. '.repeat(20).trim());
    default:
      throw new Error(`No sample for widget ${field.widget} (${path})`);
  }
}

function entryFrom(fields: CmsField[], mode: Mode, prefix = ''): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const field of fields) {
    if (mode === 'smallest' && field.required === false) continue;
    entry[field.name] = sampleValue(field, mode, `${prefix}${field.name}`);
  }
  return entry;
}

/** Paths of fields that the schema cannot do without but the form lets the admin leave empty. */
function optionalInFormButRequiredInSchema(
  fields: CmsField[],
  full: Record<string, unknown>,
  parse: (entry: unknown) => boolean,
  root: Record<string, unknown> = full,
  prefix = '',
): string[] {
  const problems: string[] = [];
  for (const field of fields) {
    const without = structuredClone(root);
    const parent = prefix
      .split('.')
      .filter(Boolean)
      .reduce<any>((node, key) => node[key], without);
    delete parent[field.name];
    if (!parse(without) && field.required === false) problems.push(`${prefix}${field.name}`);
    if (field.widget === 'object' && field.fields) {
      problems.push(...optionalInFormButRequiredInSchema(field.fields, full, parse, root, `${prefix}${field.name}.`));
    }
  }
  return problems;
}

const config = buildCmsConfig();
const forms = [...config.collections, ...config.singletons];
const formNamed = (name: string) => {
  const form = forms.find((item) => item.name === name);
  if (!form) throw new Error(`No admin form named ${name}`);
  return form;
};

const {
  event: eventSchema,
  company: companySchema,
  review: reviewSchema,
  promotion: promotionSchema,
} = makeSchemas(z.string().min(1));

const cases = [
  { form: 'prices', schema: pricesSchema },
  { form: 'site', schema: siteSchema },
  { form: 'events', schema: eventSchema },
  { form: 'promotions', schema: promotionSchema },
  { form: 'companies', schema: companySchema },
  { form: 'reviews', schema: reviewSchema },
] as const;

describe('admin forms match the content schema', () => {
  for (const { form: name, schema } of cases) {
    describe(name, () => {
      const form = formNamed(name);
      const parse = (entry: unknown) => schema.safeParse(entry).success;

      it('the smallest entry the form can save passes the schema', () => {
        const result = schema.safeParse(entryFrom(form.fields, 'smallest'));
        expect(result.error?.issues ?? []).toEqual([]);
      });

      it('the largest entry the form can save passes the schema', () => {
        const result = schema.safeParse(entryFrom(form.fields, 'largest'));
        expect(result.error?.issues ?? []).toEqual([]);
      });

      it('every field the schema needs is required in the form', () => {
        const full = entryFrom(form.fields, 'largest');
        expect(optionalInFormButRequiredInSchema(form.fields, full, parse)).toEqual([]);
      });
    });
  }

  describe('event files saved by the real admin panel (tests/fixtures/cms-saved)', () => {
    const folder = 'tests/fixtures/cms-saved/events';
    for (const name of readdirSync(folder)) {
      it(`${name} passes the schema`, () => {
        const result = eventSchema.safeParse(JSON.parse(readFileSync(`${folder}/${name}`, 'utf8')));
        expect(result.error?.issues ?? []).toEqual([]);
      });
    }
  });

  it('events are saved one folder each, photos next to the file, where the site reads them', () => {
    expect(formNamed('events')).toMatchObject({
      folder: 'src/content/events',
      path: '{{slug}}/index',
      media_folder: '',
      public_folder: '',
      format: 'json',
    });
  });

  it('an event address carries no date: the type and a short unique id, so two events never clash', () => {
    const slug = formNamed('events').slug;
    expect(slug).not.toMatch(/\{\{(year|month|day|hour|minute|second|date)/);
    expect(slug).toBe('{{type}}-{{uuid_shorter}}');
  });

  it('the price form writes the price file the site reads', () => {
    expect(formNamed('prices')).toMatchObject({ file: 'src/content/settings/prices.json', format: 'json' });
  });

  it('publishes to the main branch of the site repository by default', () => {
    expect(config.backend).toMatchObject({ name: 'github', repo: 'SYusupov/SYusupov.github.io', branch: 'main' });
  });

  it('signs in with an access token only, until a login address is set up', () => {
    expect(config.backend).toMatchObject({ auth_methods: ['token'] });
    expect(config.backend).not.toHaveProperty('base_url');
  });

  it('with a login address it also offers «sign in with GitHub» (where GitHub accepts a Google account)', () => {
    const { backend } = buildCmsConfig({ authUrl: 'https://chocoparty-auth.example.workers.dev' });
    expect(backend).toMatchObject({
      name: 'github',
      base_url: 'https://chocoparty-auth.example.workers.dev',
      auth_methods: ['oauth', 'token'],
    });
  });
});
