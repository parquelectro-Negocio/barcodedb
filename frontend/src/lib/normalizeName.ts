import { API_BASE } from './config';

let brandsCache: string[] | null = null;
let brandsPromise: Promise<string[]> | null = null;

async function getBrands(): Promise<string[]> {
  if (brandsCache) return brandsCache;
  if (!brandsPromise) {
    brandsPromise = fetch(`${API_BASE}/search/brands?q=`)
      .then(r => r.json())
      .then(list => { brandsCache = list; return list; })
      .catch(() => []);
  }
  return brandsPromise;
}

const TYPE_KEYWORDS: [RegExp, string][] = [
  [/^(auriculares?|auricular|headset|earphone)/i, 'Auricular'],
  [/^(parlante|parlantes|speaker|altavoz)/i, 'Parlante'],
  [/^(cable|cables)/i, 'Cable'],
  [/^(notebook|notebooks|laptop|laptops)/i, 'Notebook'],
  [/^(monitor|monitores|pantalla)/i, 'Monitor'],
  [/^(mouse|ratón|raton)/i, 'Mouse'],
  [/^(teclado|teclados|keyboard)/i, 'Teclado'],
  [/^(celular|celulares|teléfono|telefono|smartphone|phone)/i, 'Celular'],
  [/^(tablet|tableta)/i, 'Tablet'],
  [/^(impresora|impresoras|printer)/i, 'Impresora'],
  [/^(router|routers|módem|modem)/i, 'Router'],
  [/^(alfajor|alfajores)/i, 'Alfajor'],
  [/^(galletitas?|galletas?|cookie|crackers?)/i, 'Galletita'],
  [/^(bebida|gaseosa|soda|jugo|agua)/i, 'Bebida'],
  [/^(cargador|cargadores|charger)/i, 'Cargador'],
  [/^(funda|fundas|covers?|case)/i, 'Funda'],
  [/^(memoria|memorias|sd|microsd)/i, 'Memoria'],
  [/^(disco|discos|hd|ssd)/i, 'Disco'],
  [/^(película|pelicula|film|protector)/i, 'Protector'],
];

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function capitalizeWords(s: string): string {
  return s.split(/\s+/).map(capitalize).join(' ');
}

export async function normalizeName(raw: string, categoryId?: string): Promise<{
  name: string;
  brand: string | null;
  type: string | null;
}> {
  const trimmed = raw.trim();
  if (!trimmed) return { name: raw, brand: null, type: null };

  const brands = await getBrands();
  const lower = trimmed.toLowerCase();

  // Detect brand: longest match first
  const sortedBrands = [...brands].sort((a, b) => b.length - a.length);
  let detectedBrand: string | null = null;
  let brandIdx = -1;
  for (const b of sortedBrands) {
    const idx = lower.indexOf(b.toLowerCase());
    if (idx !== -1) {
      detectedBrand = b;
      brandIdx = idx;
      break;
    }
  }

  // Detect type keyword at start
  let detectedType: string | null = null;
  for (const [regex, label] of TYPE_KEYWORDS) {
    if (regex.test(trimmed)) {
      detectedType = label;
      break;
    }
  }

  // Tokenize
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  // Remove brand tokens and type tokens from the "descriptive" part
  const brandTokens = detectedBrand ? detectedBrand.toLowerCase().split(/\s+/) : [];
  const typeLower = detectedType ? detectedType.toLowerCase() : null;

  // Filter: remove brand tokens and leading type token
  let descTokens = tokens.filter(t => !brandTokens.includes(t.toLowerCase()));
  if (typeLower && descTokens.length > 0 && descTokens[0].toLowerCase() === typeLower) {
    descTokens = descTokens.slice(1);
  }

  // If brand was at the END, move it before description
  // Rebuild: [Type] [Brand] [Description]
  const parts: string[] = [];
  if (detectedType) parts.push(detectedType);
  if (detectedBrand) parts.push(capitalizeWords(detectedBrand));
  if (descTokens.length > 0) parts.push(capitalizeWords(descTokens.join(' ')));

  const normalized = parts.length > 0 ? parts.join(' ') : capitalizeWords(trimmed);

  return { name: normalized, brand: detectedBrand, type: detectedType };
}