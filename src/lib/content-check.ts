/**
 * The content check that runs before every build: the same rules as the Astro build, but with
 * messages naming the file and the field as the admin sees it in the form.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { buildCmsConfig, type CmsField } from '../admin/config';
import { companyWarnings, eventWarnings, makeSchemas, promotionWarnings, type ContentWarning } from './schemas';

export interface CheckReport {
  errors: string[];
  warnings: string[];
}

const schemas = makeSchemas(z.string({ error: 'добавьте фото' }).min(1, 'добавьте фото'));
const config = buildCmsConfig();

function formFields(name: string): CmsField[] {
  return [...config.collections, ...config.singletons].find((form) => form.name === name)?.fields ?? [];
}

/** «Малый фонтан — до 30 гостей → Optima, сум» for ['small', 'optima']. */
function labelFor(fields: CmsField[], path: PropertyKey[]): string {
  const labels: string[] = [];
  let level = fields;
  for (const key of path) {
    if (typeof key === 'number') continue;
    const field = level.find((item) => item.name === key);
    if (!field) {
      labels.push(String(key));
      break;
    }
    labels.push(field.label);
    level = field.fields ?? [];
  }
  return labels.join(' → ');
}

function readJson(root: string, file: string, report: CheckReport): unknown {
  const full = join(root, file);
  if (!existsSync(full)) {
    report.errors.push(`${file}: файла нет`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch (error) {
    report.errors.push(`${file}: файл повреждён, его нельзя прочитать (${(error as Error).message})`);
    return undefined;
  }
}

function validate<T extends z.ZodType>(
  schema: T,
  value: unknown,
  file: string,
  fields: CmsField[],
  report: CheckReport,
): z.infer<T> | undefined {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    report.errors.push(`${file}: «${labelFor(fields, issue.path)}» — ${issue.message}`);
  }
  return undefined;
}

interface FolderCollection<T extends z.ZodType> {
  folder: string;
  form: string;
  schema: T;
  /** Where the entry's files live, for messages: «в папке мероприятия». */
  place: string;
  warnings?: (raw: unknown) => ContentWarning[];
  /** File names the entry refers to, with the field each comes from. */
  files?: (entry: z.infer<T>) => { name: string; field: string }[];
}

/** Folder collections keep one entry per folder: <folder>/<name>/index.json and its files. */
function checkFolders<T extends z.ZodType>(root: string, collection: FolderCollection<T>, report: CheckReport): void {
  const base = join(root, collection.folder);
  if (!existsSync(base)) return;
  const fields = formFields(collection.form);
  for (const name of readdirSync(base).sort()) {
    const dir = join(base, name);
    if (!statSync(dir).isDirectory()) continue;
    const file = `${collection.folder}/${name}/index.json`;
    const raw = readJson(root, file, report);
    if (raw === undefined) continue;
    for (const warning of collection.warnings?.(raw) ?? []) {
      report.warnings.push(`${file}: «${labelFor(fields, warning.path)}» — ${warning.message}`);
    }
    const entry = validate(collection.schema, raw, file, fields, report);
    if (entry === undefined) continue;
    for (const { name: fileName, field } of collection.files?.(entry) ?? []) {
      if (!existsSync(join(dir, fileName))) {
        report.errors.push(`${file}: «${labelFor(fields, [field])}» — нет файла ${fileName} в ${collection.place}`);
      }
    }
  }
}

export function checkContentRoot(root: string): CheckReport {
  const report: CheckReport = { errors: [], warnings: [] };

  for (const [name, schema] of [
    ['prices', schemas.prices],
    ['site', schemas.site],
  ] as const) {
    const file = `settings/${name}.json`;
    const value = readJson(root, file, report);
    if (value !== undefined) validate(schema, value, file, formFields(name), report);
  }

  checkFolders(
    root,
    {
      folder: 'events',
      form: 'events',
      schema: schemas.event,
      place: 'папке мероприятия',
      warnings: eventWarnings,
      files: (event) => [
        { name: event.cover, field: 'cover' },
        ...event.gallery.map((name) => ({ name, field: 'gallery' })),
        ...event.videos.map((name) => ({ name, field: 'videos' })),
      ],
    },
    report,
  );
  checkFolders(
    root,
    {
      folder: 'companies',
      form: 'companies',
      schema: schemas.company,
      place: 'папке компании',
      warnings: companyWarnings,
      files: (company) => (company.logo ? [{ name: company.logo, field: 'logo' }] : []),
    },
    report,
  );
  checkFolders(root, { folder: 'reviews', form: 'reviews', schema: schemas.review, place: 'папке отзыва' }, report);
  checkFolders(
    root,
    {
      folder: 'promotions',
      form: 'promotions',
      schema: schemas.promotion,
      place: 'папке акции',
      warnings: promotionWarnings,
      files: (promotion) => (promotion.photo ? [{ name: promotion.photo, field: 'photo' }] : []),
    },
    report,
  );

  return report;
}
