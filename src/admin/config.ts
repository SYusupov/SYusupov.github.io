/**
 * The admin panel (Sveltia CMS) configuration, built from the same vocabulary as the site and
 * its content schema, and served as /admin/config.json. Labels are Russian: the admin's language.
 */
import { ru } from '../i18n/ru';
import {
  EVENT_TYPES,
  FOUNTAINS,
  GALLERY_MAX,
  PRICE_MAX,
  PRICE_MIN,
  SIZES,
  TARIFFS,
  VIDEO_MAX_BYTES,
  VIDEOS_MAX,
  type EventType,
  type Fountain,
} from '../lib/domain';

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
const CONTENT = 'src/content';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  ...ru.eventTypes,
  other: 'Другое (впишите свой заголовок)',
};

const FOUNTAIN_LABELS: Record<Fountain, string> = {
  small: `${ru.sizes.small.name} (${ru.sizes.small.details})`,
  medium: `${ru.sizes.medium.name} (${ru.sizes.medium.details})`,
  large: `${ru.sizes.large.name} (${ru.sizes.large.details})`,
  several: 'Несколько фонтанов',
};

/** One optional text per language; the site shows whichever languages are filled in. */
function perLanguage(widget: 'string' | 'text'): CmsField[] {
  return [
    { name: 'ru', label: 'По-русски', widget, required: false },
    { name: 'uz', label: "O'zbekcha", widget, required: false },
    { name: 'en', label: 'English', widget, required: false },
  ];
}

function eventsForm(): CmsForm {
  return {
    name: 'events',
    label: 'Мероприятия',
    label_singular: 'Мероприятие',
    icon: 'celebration',
    folder: `${CONTENT}/events`,
    path: '{{slug}}/index',
    media_folder: '',
    public_folder: '',
    format: 'json',
    create: true,
    delete: true,
    slug: '{{year}}-{{month}}-{{day}}-{{type}}',
    summary: "{{date | date('DD.MM.YYYY')}} · {{client}}",
    thumbnail: 'cover',
    sortable_fields: { fields: ['date'], default: { field: 'date', direction: 'descending' } },
    fields: [
      { name: 'date', label: 'Дата', widget: 'datetime', type: 'date' },
      {
        name: 'type',
        label: 'Тип мероприятия',
        widget: 'select',
        options: EVENT_TYPES.map((type) => ({ label: EVENT_TYPE_LABELS[type], value: type })),
      },
      {
        name: 'client',
        label: 'Компания-клиент',
        widget: 'string',
        required: false,
        hint: 'Только для мероприятий компаний. Частные праздники — без имён.',
      },
      {
        name: 'title',
        label: 'Свой заголовок',
        widget: 'object',
        required: false,
        collapsed: false,
        hint: 'Только для типа «Другое», например «Выпускной». Для остальных типов заголовок собирается сам.',
        fields: perLanguage('string'),
      },
      {
        name: 'venue',
        label: 'Площадка',
        widget: 'string',
        required: false,
        hint: 'Зал или ресторан, если хочется указать.',
      },
      {
        name: 'fountain',
        label: 'Фонтан',
        widget: 'select',
        required: false,
        options: FOUNTAINS.map((fountain) => ({ label: FOUNTAIN_LABELS[fountain], value: fountain })),
      },
      {
        name: 'cover',
        label: 'Обложка',
        widget: 'image',
        choose_url: false,
        hint: 'Лучшее горизонтальное фото: фонтан и праздник сразу видны.',
      },
      {
        name: 'gallery',
        label: 'Фото',
        widget: 'image',
        multiple: true,
        max: GALLERY_MAX,
        choose_url: false,
        hint: '6–15 лучших фото.',
      },
      {
        name: 'videos',
        label: 'Видео',
        widget: 'file',
        multiple: true,
        max: VIDEOS_MAX,
        required: false,
        choose_url: false,
        accept: 'video/*',
        hint: 'До 2 коротких роликов, до 20 МБ каждый. На сайте они крутятся без звука.',
        media_libraries: { default: { config: { max_file_size: VIDEO_MAX_BYTES } } },
      },
      {
        name: 'description',
        label: 'Описание',
        widget: 'object',
        required: false,
        collapsed: false,
        hint: 'Можно на одном языке: на остальных страница будет без описания.',
        fields: perLanguage('text'),
      },
    ],
  };
}

function pricesForm(): CmsForm {
  return {
    name: 'prices',
    label: 'Цены',
    file: `${CONTENT}/settings/prices.json`,
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
    collections: [eventsForm()],
    singletons: [pricesForm()],
  };
}
