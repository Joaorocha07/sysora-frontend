// CPF e CNPJ no mesmo campo, com máscara e validação dos dígitos verificadores.
// CNPJ alfanumérico (Receita Federal, a partir de julho de 2026): as 12
// primeiras posições aceitam letras e números; os 2 dígitos verificadores
// continuam numéricos. No cálculo, cada caractere vale o código ASCII - 48
// ("0"-"9" = 0-9, "A" = 17 ... "Z" = 42), o que mantém o CNPJ numérico igual.
// Mesma regra no backend (src/lib/document.ts).

export type DocumentKind = 'cpf' | 'cnpj';

// Só letras maiúsculas e números; letras só nas 12 primeiras posições.
function clean(value: string): string {
  const chars = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  let out = '';
  for (const ch of chars) {
    if (out.length >= 14) break;
    if (out.length >= 12 && !/\d/.test(ch)) continue;
    out += ch;
  }
  return out;
}

// Tem letra: CNPJ. Só números: CPF até 11 dígitos, CNPJ a partir do 12º.
export function documentKind(value: string): DocumentKind | null {
  const raw = clean(value);
  if (!raw) return null;
  return /[A-Z]/.test(raw) || raw.length > 11 ? 'cnpj' : 'cpf';
}

function applyPattern(raw: string, pattern: string): string {
  let out = '';
  let i = 0;
  for (const p of pattern) {
    if (i >= raw.length) break;
    if (p === '#') out += raw[i++];
    else out += p;
  }
  return out;
}

export const maskCpf = (value: string) => applyPattern(value.replace(/\D/g, '').slice(0, 11), '###.###.###-##');

// Máscara inteligente para o campo que aceita os dois.
export function maskDocument(value: string): string {
  const raw = clean(value);
  return documentKind(raw) === 'cnpj' ? applyPattern(raw, '##.###.###/####-##') : applyPattern(raw, '###.###.###-##');
}

export function isValidCpf(value: string): boolean {
  const d = value.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

export function isValidCnpj(value: string): boolean {
  const c = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c) || /^(.)\1{13}$/.test(c)) return false;
  const val = (ch: string) => ch.charCodeAt(0) - 48;
  const check = (len: number) => {
    let sum = 0;
    let weight = 2;
    for (let i = len - 1; i >= 0; i--) {
      sum += val(c[i]) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(c[12]) && check(13) === Number(c[13]);
}

// Situação do que foi digitado, para a dica embaixo do campo.
export function documentStatus(value: string): { kind: DocumentKind | null; complete: boolean; valid: boolean } {
  const raw = clean(value);
  const kind = documentKind(raw);
  if (!kind) return { kind: null, complete: false, valid: true };
  const complete = raw.length === (kind === 'cpf' ? 11 : 14);
  return { kind, complete, valid: complete && (kind === 'cpf' ? isValidCpf(raw) : isValidCnpj(raw)) };
}
