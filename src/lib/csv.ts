// Planilhas CSV de clientes, montadas e lidas no navegador. Lê o que o Excel
// em português salva (separador ";") e o padrão com ",".

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // ";" + BOM: o Excel em português abre com acentos e colunas certas.
  return `﻿${[header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')}`;
}

export function downloadFile(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

// Coluna da planilha -> campo do cliente, pelo nome do cabeçalho.
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const ALIASES: Record<string, string[]> = {
  name: ['nome', 'name', 'cliente', 'nomecompleto'],
  phone: ['telefone', 'celular', 'whatsapp', 'phone', 'fone', 'numero', 'contato'],
  email: ['email', 'mail'],
  birthday: ['aniversario', 'nascimento', 'datadenascimento', 'birthday'],
  notes: ['observacoes', 'observacao', 'obs', 'notas', 'anotacoes', 'notes'],
  tags: ['etiquetas', 'etiqueta', 'tags', 'tag'],
};

export type ColumnMap = Partial<Record<keyof typeof ALIASES, number>>;

export function guessColumns(header: string[]): ColumnMap {
  const map: ColumnMap = {};
  header.forEach((h, index) => {
    const key = normalize(h);
    for (const [field, names] of Object.entries(ALIASES)) {
      if (map[field] === undefined && names.includes(key)) map[field] = index;
    }
  });
  return map;
}
