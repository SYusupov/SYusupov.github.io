"""Convert each sheet of an xlsx workbook to CSV without third-party libraries.

A cell with a hyperlink becomes «text URL», the shape scripts/import-archive.ts reads
(«IMG_0012.jpg https://photos…»). Usage: python3 -I xlsx2csv.py book.xlsx out_dir
"""
import csv
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'rel': 'http://schemas.openxmlformats.org/package/2006/relationships',
}
R_ID = '{%s}id' % NS['r']

book_path, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
book = zipfile.ZipFile(book_path)

shared = []
if 'xl/sharedStrings.xml' in book.namelist():
    for si in ET.fromstring(book.read('xl/sharedStrings.xml')).findall('m:si', NS):
        shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))

rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(book.read('xl/_rels/workbook.xml.rels')).findall('rel:Relationship', NS)}
sheets = ET.fromstring(book.read('xl/workbook.xml')).find('m:sheets', NS)


def col_index(ref):
    letters = re.match(r'[A-Z]+', ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def cell_text(c):
    kind = c.get('t')
    v = c.find('m:v', NS)
    if kind == 's' and v is not None:
        return shared[int(v.text)]
    if kind == 'inlineStr':
        return ''.join(t.text or '' for t in c.iter('{%s}t' % NS['m']))
    return v.text if v is not None and v.text is not None else ''


for sheet in sheets.findall('m:sheet', NS):
    name = sheet.get('name')
    target = rels[sheet.get(R_ID)]
    path = 'xl/' + target.lstrip('/').replace('xl/', '', 1) if not target.startswith('xl/') else target
    root = ET.fromstring(book.read(path))
    rel_path = os.path.join(os.path.dirname(path), '_rels', os.path.basename(path) + '.rels')
    links_by_id = {}
    if rel_path in book.namelist():
        for r in ET.fromstring(book.read(rel_path)).findall('rel:Relationship', NS):
            links_by_id[r.get('Id')] = r.get('Target')
    links = {}
    hyperlinks = root.find('m:hyperlinks', NS)
    if hyperlinks is not None:
        for h in hyperlinks.findall('m:hyperlink', NS):
            if h.get(R_ID) in links_by_id:
                links[h.get('ref')] = links_by_id[h.get(R_ID)]
    rows = []
    for row in root.find('m:sheetData', NS).findall('m:row', NS):
        cells = {}
        for c in row.findall('m:c', NS):
            ref = c.get('r')
            text = cell_text(c)
            formula = c.find('m:f', NS)
            url = links.get(ref)
            if url is None and formula is not None and formula.text and 'HYPERLINK' in formula.text.upper():
                found = re.search(r'HYPERLINK\(\s*"([^"]+)"', formula.text, re.I)
                url = found.group(1) if found else None
            if url and url not in text:
                text = (text + ' ' + url).strip()
            cells[col_index(ref)] = text
        if cells:
            width = max(cells) + 1
            rows.append([cells.get(i, '') for i in range(width)])
    while rows and not any(cell.strip() for cell in rows[-1]):
        rows.pop()
    width = max((len(r) for r in rows), default=0)
    out = os.path.join(out_dir, name + '.csv')
    with open(out, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        for r in rows:
            writer.writerow(r + [''] * (width - len(r)))
    print(f'{name}: {len(rows)} rows, {width} columns, {len(links)} links -> {out}')
