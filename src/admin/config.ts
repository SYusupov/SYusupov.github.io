/**
 * The admin panel (Sveltia CMS) configuration, built from the same vocabulary as the site and
 * its content schema, and served as /admin/config.json. Labels are Russian: the admin's language.
 */
import { ru } from '../i18n/ru';
import {
  CMS_AUTH_URL,
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
  /** Login service address; defaults to CMS_AUTH_URL (empty: access token only). */
  authUrl?: string;
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
    // No date in the address: the owner does not want event dates shown anywhere, links included.
    slug: '{{type}}-{{uuid_shorter}}',
    summary: "{{date | date('DD.MM.YYYY')}} · {{client}}",
    thumbnail: 'cover',
    sortable_fields: { fields: ['date'], default: { field: 'date', direction: 'descending' } },
    fields: [
      {
        name: 'date',
        label: 'Дата',
        widget: 'datetime',
        type: 'date',
        hint: 'Нужна только для порядка в списке: новые мероприятия идут выше. На сайте дата не показывается.',
      },
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

function companiesForm(): CmsForm {
  return {
    name: 'companies',
    label: 'Компании',
    label_singular: 'Компания',
    icon: 'apartment',
    folder: `${CONTENT}/companies`,
    path: '{{slug}}/index',
    media_folder: '',
    public_folder: '',
    format: 'json',
    create: true,
    delete: true,
    slug: '{{name}}',
    summary: '{{name}}',
    thumbnail: 'logo',
    sortable_fields: { fields: ['order', 'name'], default: { field: 'order', direction: 'ascending' } },
    fields: [
      { name: 'name', label: 'Название', widget: 'string', hint: 'Как писать на сайте, например «Coca-Cola».' },
      {
        name: 'logo',
        label: 'Логотип',
        widget: 'image',
        required: false,
        choose_url: false,
        hint: 'SVG или PNG с прозрачным фоном. Без логотипа компания на стене не показывается.',
      },
      {
        name: 'url',
        label: 'Сайт компании',
        widget: 'string',
        required: false,
        pattern: ['^https?://', 'Адрес должен начинаться с https://'],
      },
      {
        name: 'order',
        label: 'Порядок на стене',
        widget: 'number',
        value_type: 'int',
        required: false,
        min: 1,
        max: 999,
        hint: 'Меньше — ближе к началу. Пусто — после пронумерованных, по алфавиту.',
      },
    ],
  };
}

function reviewsForm(): CmsForm {
  return {
    name: 'reviews',
    label: 'Отзывы',
    label_singular: 'Отзыв',
    icon: 'reviews',
    folder: `${CONTENT}/reviews`,
    path: '{{slug}}/index',
    media_folder: '',
    public_folder: '',
    format: 'json',
    create: true,
    delete: true,
    slug: '{{year}}-{{month}}-{{day}}-{{author}}',
    summary: "{{date | date('DD.MM.YYYY')}} · {{author}}",
    sortable_fields: { fields: ['date'], default: { field: 'date', direction: 'descending' } },
    fields: [
      { name: 'author', label: 'Имя', widget: 'string', hint: 'Как подписать отзыв: имя, или имя и компания.' },
      {
        name: 'role',
        label: 'Кто это',
        widget: 'string',
        required: false,
        hint: 'Например «Свадьба, сентябрь 2025» или «HR-менеджер, Coca-Cola».',
      },
      { name: 'date', label: 'Дата', widget: 'datetime', type: 'date' },
      {
        name: 'text',
        label: 'Отзыв',
        widget: 'object',
        collapsed: false,
        hint: 'Русский текст обязателен; на узбекской и английской страницах отзыв виден, если есть перевод.',
        fields: [
          { name: 'ru', label: 'По-русски', widget: 'text' },
          { name: 'uz', label: "O'zbekcha", widget: 'text', required: false },
          { name: 'en', label: 'English', widget: 'text', required: false },
        ],
      },
    ],
  };
}

function promotionsForm(): CmsForm {
  const languages = (widget: 'string' | 'text', russianHint: string): CmsField[] => [
    { name: 'ru', label: 'По-русски', widget, hint: russianHint },
    { name: 'uz', label: "O'zbekcha", widget, required: false },
    { name: 'en', label: 'English', widget, required: false },
  ];
  return {
    name: 'promotions',
    label: 'Акции',
    label_singular: 'Акция',
    icon: 'sell',
    folder: `${CONTENT}/promotions`,
    path: '{{slug}}/index',
    media_folder: '',
    public_folder: '',
    format: 'json',
    create: true,
    delete: true,
    slug: '{{year}}-{{month}}-{{day}}-{{uuid_shorter}}',
    summary: "{{title.ru}} · {{start | date('DD.MM')}}–{{end | date('DD.MM.YYYY')}}",
    sortable_fields: { fields: ['start'], default: { field: 'start', direction: 'descending' } },
    fields: [
      {
        name: 'title',
        label: 'Заголовок',
        widget: 'object',
        collapsed: false,
        fields: languages('string', 'Например «Новогодняя акция».'),
      },
      {
        name: 'text',
        label: 'Текст',
        widget: 'object',
        collapsed: false,
        hint: 'На узбекской и английской страницах акция видна, если есть перевод.',
        fields: languages('text', 'Коротко: что получает клиент.'),
      },
      { name: 'photo', label: 'Фото', widget: 'image', required: false, choose_url: false },
      { name: 'start', label: 'Первый день', widget: 'datetime', type: 'date' },
      {
        name: 'end',
        label: 'Последний день',
        widget: 'datetime',
        type: 'date',
        hint: 'Включительно. На следующий день акция исчезнет с сайта сама.',
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

function siteForm(): CmsForm {
  return {
    name: 'site',
    label: 'Контакты и цифры',
    file: `${CONTENT}/settings/site.json`,
    format: 'json',
    icon: 'contact_phone',
    fields: [
      {
        name: 'telegram',
        label: 'Telegram для заказов',
        widget: 'string',
        pattern: ['^[A-Za-z0-9_]{5,32}$', 'Только имя пользователя: латинские буквы, цифры и _, без @'],
        hint: 'Имя пользователя без @, например chocolateuz. Сюда открывается чат кнопками заказа.',
      },
      {
        name: 'phone',
        label: 'Телефон',
        widget: 'string',
        pattern: ['^\\+998\\d{9}$', 'В виде +998XXXXXXXXX, без пробелов'],
        hint: 'Например +998778006567. На сайте он покажется с пробелами.',
      },
      {
        name: 'contactName',
        label: 'Кто отвечает',
        widget: 'object',
        collapsed: false,
        fields: perLanguage('string'),
      },
      {
        name: 'instagram',
        label: 'Instagram',
        widget: 'string',
        required: false,
        hint: 'Имя без @, например chocoparty.uz.',
      },
      {
        name: 'ordersCount',
        label: 'Число заказов',
        widget: 'number',
        value_type: 'int',
        min: 0,
        max: 100_000,
        hint: 'На сайте пишется «больше N заказов».',
      },
      {
        name: 'foundedYear',
        label: 'Год основания',
        widget: 'number',
        value_type: 'int',
        min: 1990,
        max: 2100,
      },
      {
        name: 'gaId',
        label: 'Google Analytics',
        widget: 'string',
        required: false,
        hint: 'Номер счётчика. Менять не нужно.',
      },
      {
        name: 'metrikaId',
        label: 'Яндекс Метрика',
        widget: 'string',
        required: false,
        pattern: ['^\\d*$', 'Только цифры'],
        hint: 'Номер счётчика. Пусто — Метрика не подключена.',
      },
    ],
  };
}

function githubBackend(options: CmsOptions) {
  const authUrl = options.authUrl ?? CMS_AUTH_URL;
  const base = { name: 'github', repo: REPOSITORY, branch: options.branch ?? 'main' };
  return authUrl
    ? { ...base, base_url: authUrl, auth_methods: ['oauth', 'token'] }
    : { ...base, auth_methods: ['token'] };
}

export function buildCmsConfig(options: CmsOptions = {}) {
  return {
    backend:
      options.backend === 'test'
        ? { name: 'test-repo' }
        : githubBackend(options),
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
    collections: [eventsForm(), promotionsForm(), companiesForm(), reviewsForm()],
    singletons: [pricesForm(), siteForm()],
  };
}
