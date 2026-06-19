#!/usr/bin/env node
// CLI mínimo para consultar la Marketing API de Meta DIRECTAMENTE.
// Da acceso a todas las métricas del Ads Manager (incl. visitas a la página
// de destino y su coste), eligiendo nosotros mismos los campos.
//
// Uso:
//   node meta-ads.mjs                                 -> cuenta, ayer
//   node meta-ads.mjs --level campaign --preset yesterday
//   node meta-ads.mjs --level campaign --since 2026-06-01 --until 2026-06-18
//   node meta-ads.mjs --fields spend,impressions,actions --json
//
// Requiere Node 18+ (fetch nativo) y un .env junto a este archivo (ver .env.example).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// --- mini cargador de .env (sin dependencias) ---
function loadEnv() {
  try {
    const raw = readFileSync(join(HERE, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch {
    /* sin .env: se usará lo que haya en process.env */
  }
}
loadEnv();

// --- parseo de argumentos ---
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const hasFlag = (name) => args.includes(`--${name}`);

if (hasFlag('help') || hasFlag('h')) {
  console.log(`meta-ads — consulta directa a la Marketing API de Meta

  --level    account | campaign | adset | ad   (def: account)
  --preset   today, yesterday, last_7d, last_30d, this_month...  (def: yesterday)
  --since / --until   rango YYYY-MM-DD (alternativa a --preset)
  --fields   lista separada por comas (sobrescribe los campos por defecto)
  --json     imprime la respuesta cruda de la API
  --help     esta ayuda`);
  process.exit(0);
}

const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCOUNT = (process.env.META_AD_ACCOUNT_ID || '1239097093670462').replace(/^act_/, '');
const VERSION = process.env.META_API_VERSION || 'v22.0';

if (!TOKEN) {
  console.error('✗ Falta META_ACCESS_TOKEN.');
  console.error('  Copia .env.example a .env (en tools/meta-ads/) y pega tu token ads_read.');
  process.exit(1);
}

const level = getArg('level', 'account');
const preset = getArg('preset', 'yesterday');
const since = getArg('since', null);
const until = getArg('until', null);
const asJson = hasFlag('json');

// Campos por defecto: lo esencial + actions/cost_per_action_type, de donde
// se extraen las visitas a la página de destino (landing_page_view).
const fields = [
  'spend', 'impressions', 'reach', 'frequency', 'clicks', 'ctr', 'cpc', 'cpm',
  'inline_link_clicks', 'cost_per_inline_link_click', 'actions', 'cost_per_action_type',
];
if (level === 'account') fields.unshift('account_name');
else fields.unshift(`${level}_name`);

const customFields = getArg('fields', null);
const finalFields = customFields ? customFields.split(',').map((s) => s.trim()) : fields;

// --- construir y lanzar la petición ---
const params = new URLSearchParams();
params.set('level', level);
params.set('fields', finalFields.join(','));
if (since && until) params.set('time_range', JSON.stringify({ since, until }));
else params.set('date_preset', preset);
params.set('limit', '500');
params.set('access_token', TOKEN);

const url = `https://graph.facebook.com/${VERSION}/act_${ACCOUNT}/insights?${params}`;

let data;
try {
  const res = await fetch(url);
  data = await res.json();
} catch (e) {
  console.error('✗ Error de red al llamar a la Graph API:', e.message);
  process.exit(1);
}

if (data.error) {
  console.error('✗ Error de la Graph API:');
  console.error(JSON.stringify(data.error, null, 2));
  process.exit(1);
}

if (asJson) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

// --- presentación legible ---
const findAction = (arr, type) =>
  Array.isArray(arr) ? (arr.find((a) => a.action_type === type)?.value ?? null) : null;
const eur = (v) => (v == null || v === '' ? '—' : `€${Number(v).toFixed(2)}`);
const num = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('es-ES'));

const rows = (data.data || []).sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0));
const periodo = since && until ? `${since} → ${until}` : preset;

console.log(`\nCuenta act_${ACCOUNT} · nivel ${level} · periodo ${periodo} · API ${VERSION}\n`);

for (const r of rows) {
  const titulo = r[`${level}_name`] || r.account_name || `act_${ACCOUNT}`;
  const lpv = findAction(r.actions, 'landing_page_view');
  const lpvCost = findAction(r.cost_per_action_type, 'landing_page_view');
  const linkClicks = r.inline_link_clicks ?? findAction(r.actions, 'link_click');
  console.log(`■ ${titulo}`);
  console.log(`   Gasto ${eur(r.spend)}  ·  Impresiones ${num(r.impressions)}  ·  Alcance ${num(r.reach)}`);
  console.log(`   Clics enlace ${num(linkClicks)}  ·  CPC enlace ${eur(r.cost_per_inline_link_click)}  ·  CTR ${r.ctr ? Number(r.ctr).toFixed(2) + '%' : '—'}`);
  console.log(`   Visitas a la página (LPV) ${num(lpv)}  ·  Coste por visita ${eur(lpvCost)}`);
  console.log('');
}
console.log(`(${rows.length} fila(s))`);
