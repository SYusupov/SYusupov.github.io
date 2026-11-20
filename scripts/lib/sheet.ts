/**
 * The owner's workbook «ChocoParty — фото для сайта» exported to CSV (python3 -I tools/xlsx2csv.py
 * book.xlsx out_dir), and what its cells mean on the site.
 */

/** Event types as the sheet names them (type «другое: …» is `other`, see eventTypeOf). */
const TYPES: Record<string, string> = {
  свадьба: 'wedding',
  'день рождения': 'birthday',
  'детский праздник': 'kids-party',
  корпоратив: 'corporate',
  'выставка или презентация': 'exhibition',
  открытие: 'opening',
};
const FOUNTAINS: Record<string, string> = { малый: 'small', средний: 'medium', большой: 'large', несколько: 'several' };

/** RFC 4180 CSV: quoted fields may hold commas, quotes and line breaks. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [[]];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') (field += '"'), (i += 1);
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') rows[rows.length - 1].push(field), (field = '');
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      rows[rows.length - 1].push(field);
      field = '';
      rows.push([]);
    } else field += char;
  }
  rows[rows.length - 1].push(field);
  const [header, ...data] = rows.filter((row) => row.some((cell) => cell.trim()));
  const keys = header.map((cell) => cell.trim().toLowerCase());
  return data.map((row) => Object.fromEntries(keys.map((key, index) => [key, (row[index] ?? '').trim()])));
}

/** The value of the first column whose header starts with `prefix` (sheet headers carry hints). */
export const column = (row: Record<string, string>, prefix: string) =>
  Object.entries(row).find(([key]) => key.startsWith(prefix))?.[1] ?? '';

/** The sheet's number as a plain string: «2.0» (a spreadsheet export) and «2» are the same row. */
export const numberOf = (row: Record<string, string>) => String(Number.parseInt(column(row, '№'), 10));

/** «Coca-Cola (CCI)» → «Coca-Cola», «Agio Pharmaceuticals Ltd» → «Agio Pharmaceuticals». */
export const cleanName = (value: string) =>
  value
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+(Ltd|LLC|Inc|Co)\.?$/i, '')
    .trim();

/** «большой (5 ярусов, ~80 см)» → «large»; «не видно» → nothing. */
export const fountainOf = (value: string) => FOUNTAINS[value.toLowerCase().split(/[\s(,]/)[0]];

/** «корпоратив» → «corporate»; «другое: банкет» → «other»; anything else → nothing. */
export function eventTypeOf(typeText: string): string {
  const text = typeText.toLowerCase();
  return TYPES[text] ?? (text.startsWith('другое') ? 'other' : '');
}

/** «другое: стол с десертами» → «Стол с десертами». */
export function ownTitleOf(typeText: string): string {
  const title = typeText.replace(/^другое:?\s*/i, '').trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}
