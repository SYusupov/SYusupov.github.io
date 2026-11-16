/**
 * Content check before every build. Prints warnings and errors in Russian; on GitHub it also
 * writes them to the run summary. Exits with 1 when the publication must stop.
 * Usage: tsx scripts/check-content.ts   (CONTENT_ROOT overrides src/content)
 */
import { appendFileSync } from 'node:fs';
import { checkContentRoot } from '../src/lib/content-check';

const root = process.env.CONTENT_ROOT ?? 'src/content';
const { errors, warnings } = checkContentRoot(root);

for (const warning of warnings) console.log(`Предупреждение: ${warning}`);
for (const error of errors) console.error(`Ошибка: ${error}`);

const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  const lines = ['## Проверка содержимого', ''];
  if (!errors.length && !warnings.length) lines.push('Всё в порядке.');
  if (errors.length) lines.push('**Ошибки — публикация остановлена:**', '', ...errors.map((error) => `- ${error}`), '');
  if (warnings.length) lines.push('**Исправлено автоматически:**', '', ...warnings.map((warning) => `- ${warning}`));
  appendFileSync(summaryFile, `${lines.join('\n')}\n`);
}

if (errors.length) {
  console.error(`\nПубликация остановлена, ошибок: ${errors.length}. На сайте осталась прежняя версия.`);
  process.exit(1);
}
console.log(`Содержимое в порядке${warnings.length ? `, исправлено автоматически: ${warnings.length}` : ''}.`);
