/**
 * The admin panel (Sveltia CMS) configuration, built from the same vocabulary as the site and
 * its content schema, and served as /admin/config.json. Labels are Russian: the admin's language.
 */
import { ru } from '../i18n/ru';
import { PRICE_MAX, PRICE_MIN, SIZES, TARIFFS } from '../lib/domain';

export interface CmsField {
  name: string;
  label: string;
  widget: string;
  required?: boolean;
  hint?: string;
  fields?: CmsField[];
  options?: Array<string | { label: string; value: string }>;
  min?: number;
  max?: number;
  multiple?: boolean;
  [option: string]: unknown;
}

export interface CmsForm {
  name: string;
  label: string;
  fields: CmsField[];
  [option: string]: unknown;
}

export interface CmsOptions {
  /** 'test' keeps everything in the browser: for checks without GitHub. */
  backend?: 'github' | 'test';
  /** Branch the admin publishes to; `main` on the live site. */
  branch?: string;
}

export const REPOSITORY = 'SYusupov/SYusupov.github.io';
const SETTINGS = 'src/content/settings';

function pricesForm(): CmsForm {
  return {
    name: 'prices',
    label: 'Цены',
    file: `${SETTINGS}/prices.json`,
    format: 'json',
    icon: 'payments',
    fields: SIZES.map((size) => ({
      name: size,
      label: `${ru.sizes[size].name} фонтан — ${ru.sizes[size].guests}`,
      widget: 'object',
      collapsed: false,
      fields: TARIFFS.map((tariff) => ({
        name: tariff,
        label: `${ru.tariffs[tariff].name}, сум`,
        widget: 'number',
        value_type: 'int',
        min: PRICE_MIN,
        max: PRICE_MAX,
        step: 100_000,
      })),
    })),
  };
}

export function buildCmsConfig(options: CmsOptions = {}) {
  return {
    backend:
      options.backend === 'test'
        ? { name: 'test-repo' }
        : { name: 'github', repo: REPOSITORY, branch: options.branch ?? 'main', auth_methods: ['token'] },
    media_folder: 'src/assets/uploads',
    public_folder: '/src/assets/uploads',
    output: { omit_empty_optional_fields: true },
    media_libraries: {
      default: {
        config: {
          slugify_filename: true,
          transformations: {
            raster_image: { format: 'webp', quality: 80, width: 1600, height: 1600 },
          },
        },
      },
    },
    collections: [] as CmsForm[],
    singletons: [pricesForm()],
  };
}
