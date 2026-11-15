/**
 * The content check that runs before every build: the same rules as the Astro build, but with
 * messages naming the file and the field as the admin sees it in the form.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { buildCmsConfig, type CmsField } from '../admin/config';
import { eventWarnings, makeSchemas } from './schemas';

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

  const eventsDir = join(root, 'events');
  const eventFields = formFields('events');
  const folders = existsSync(eventsDir) ? readdirSync(eventsDir).sort() : [];
  for (const folder of folders) {
    const dir = join(eventsDir, folder);
    if (!statSync(dir).isDirectory()) continue;
    const file = `events/${folder}/index.json`;
    const raw = readJson(root, file, report);
    if (raw === undefined) continue;
    for (const warning of eventWarnings(raw)) {
      report.warnings.push(`${file}: «${labelFor(eventFields, warning.path)}» — ${warning.message}`);
    }
    const event = validate(schemas.event, raw, file, eventFields, report);
    if (!event) continue;
    const expectFile = (name: string, key: string) => {
      if (!existsSync(join(dir, name))) {
        report.errors.push(`${file}: «${labelFor(eventFields, [key])}» — нет файла ${name} в папке мероприятия`);
      }
    };
    expectFile(event.cover, 'cover');
    for (const name of event.gallery) expectFile(name, 'gallery');
    for (const name of event.videos) expectFile(name, 'videos');
  }

  return report;
}
