#!/usr/bin/env node
// reporte.mjs v2 — Andrea Carrió Studio
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch { /* ok */ }
}
loadEnvFile(join(HERE, '..', 'meta-ads', '.env'));
loadEnvFile(join(HERE, '..', '..', 'frontend', '.env.local'));

const args  = process.argv.slice(2);
const DRY   = args.includes('--dry');
const HOURS = (() => { const i = args.indexOf('--hours'); return i >= 0 && args[i+1] ? Number(args[i+1]) : 3; })();
const PRESET = (() => { const i = args.indexOf('--preset'); return i >= 0 && args[i+1] ? args[i+1] : 'today'; })();

const META_TOKEN   = process.env.META_ACCESS_TOKEN;
const META_ACCOUNT = (process.env.META_AD_ACCOUNT_ID || '1239097093670462').replace(/^act_/, '');
const META_VERSION = process.env.META_API_VERSION || 'v22.0';
const SUPA_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM         = process.env.FROM_EMAIL || 'noreply@andreacarriostudio.es';
const TO           = process.env.REPORT_TO  || 'gioacchinopalumbo38@gmail.com';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;  // misma clave que usa Sofía

const eur = v => `${Number(v||0).toLocaleString('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2 })} €`;
const num = v => Number(v||0).toLocaleString('es-ES');
const pct = v => `${Number(v||0).toLocaleString('es-ES', { minimumFractionDigits:1, maximumFractionDigits:1 })}%`;

// Valoración automática de una creatividad (útil para vigilar la fase de aprendizaje).
const analisisCreatividad = a => {
  if (!a.impressions) return '⏸ Sin entrega';
  if (a.leads === 0) return a.impressions < 300 ? '🌱 Arrancando' : '⚠️ Llega, no convierte';
  if (a.cpl != null && a.cpl <= 6) return '🔥 Funcionando';
  return '🟡 Convierte caro';
};

const actionVal = (arr, type) => {
  const h = Array.isArray(arr) ? arr.find(a => a.action_type === type) : null;
  return h ? Number(h.value) : 0;
};
const arrVal = arr => Array.isArray(arr) ? Number(arr[0]?.value || 0) : 0;

function getMadridDayStart() {
  const now      = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
  const [y, mo, da] = todayStr.split('-').map(Number);
  for (const offsetH of [1, 2]) {
    const utcMs   = Date.UTC(y, mo - 1, da, 0, 0, 0) - offsetH * 3600_000;
    const madridH = parseInt(
      new Date(utcMs).toLocaleString('en-US', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false })
    );
    if (madridH === 0) return utcMs;
  }
  return Date.UTC(y, mo - 1, da, 0, 0, 0);
}

async function getMeta(preset = 'today') {
  if (!META_TOKEN) return { ok: false, error: 'Falta META_ACCESS_TOKEN', rows: [], adsBallet: [], adsBarre: [] };
  const base = `https://graph.facebook.com/${META_VERSION}/act_${META_ACCOUNT}/insights`;
  async function fetchLevel(level) {
    const extraFields = level === 'ad' ? ',ad_name,adset_name' : '';
    const p = new URLSearchParams({
      level,
      fields: `campaign_name,spend,impressions,reach,inline_link_clicks,outbound_clicks,actions${extraFields}`,
      date_preset: preset,
      limit: '200',
      access_token: META_TOKEN,
    });
    const res  = await fetch(`${base}?${p}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.data || [];
  }
  try {
    const [campData, adData] = await Promise.all([fetchLevel('campaign'), fetchLevel('ad')]);
    const rows = campData.map(c => {
      const spend = Number(c.spend || 0);
      const impressions = Number(c.impressions || 0);
      const reach = Number(c.reach || 0);
      const leads = actionVal(c.actions, 'lead');
      const lpv = actionVal(c.actions, 'landing_page_view');
      const outboundClicks = arrVal(c.outbound_clicks);
      const ctr = impressions > 0 ? (outboundClicks / impressions) * 100 : 0;
      const convRate = outboundClicks > 0 ? (leads / outboundClicks) * 100 : null;
      return { name: c.campaign_name, spend, impressions, reach, clicks: outboundClicks, lpv, leads, cpl: leads > 0 ? spend / leads : null, ctr, convRate };
    }).sort((a, b) => b.spend - a.spend);
    // Metricas por creatividad, incl. coste por visita a la landing y CR lead/visita.
    const mapAd = a => {
      const spend = Number(a.spend || 0);
      const leads = actionVal(a.actions, 'lead');
      const lpv   = actionVal(a.actions, 'landing_page_view');
      const impressions = Number(a.impressions || 0);
      return {
        name: a.ad_name || a.adset_name || '(sin nombre)',
        spend, leads, lpv, impressions,
        cpl:      leads > 0 ? spend / leads : null,
        costeLpv: lpv   > 0 ? spend / lpv   : null,
        crLead:   lpv   > 0 ? (leads / lpv) * 100 : null,
      };
    };
    const ordenarPorCpl = (a, b) => {
      if (a.cpl != null && b.cpl != null) return a.cpl - b.cpl;
      if (a.cpl != null) return -1;
      if (b.cpl != null) return 1;
      return b.leads - a.leads;
    };
    // Clasifica por campana: barre = nombre con "barre"; ballet = "pre_lancio" sin barre.
    const esBarre  = name => (name || '').toLowerCase().includes('barre');
    const esBallet = name => (name || '').toLowerCase().replace(/[^a-z]/g, '').includes('prelancio') && !esBarre(name);
    const adsBallet = adData.filter(a => esBallet(a.campaign_name)).map(mapAd).sort(ordenarPorCpl);
    const adsBarre  = adData.filter(a => esBarre(a.campaign_name)).map(mapAd).sort(ordenarPorCpl);
    return { ok: true, rows, adsBallet, adsBarre };
  } catch (e) {
    return { ok: false, error: e.message, rows: [], adsBallet: [], adsBarre: [] };
  }
}

async function sbFetch(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} — ${path}`);
  return res.json();
}

async function getInscritos(sinceMs, todayMs) {
  if (!SUPA_URL || !SUPA_KEY) return { ok: false, error: 'Faltan llaves de Supabase' };
  const isRecent = r => r.created_at && new Date(r.created_at).getTime() >= sinceMs;
  const isToday  = r => r.created_at && new Date(r.created_at).getTime() >= todayMs;
  const PLAZA    = new Set(['pagato', 'pagado', 'activa', 'matricula_pagada']);
  const getName = r =>
    [r.nombre, r.apellido].filter(Boolean).join(' ')
    || [r.nome, r.cognome].filter(Boolean).join(' ')
    || r.email?.split('@')[0]
    || '—';
  const fmtNames = lista =>
    lista.map(r => {
      const base = getName(r);
      return r.nome_alumna && r.nome_alumna !== base ? `${r.nome_alumna} (${base})` : base;
    }).filter(n => n && n !== '—');

  // IDs de disciplinas por categoria (tabla `discipline`)
  const BALLET_IDS = new Set(['ballet-i','ballet-ii','ballet-adultos','pre-ballet']);
  const BARRE_IDS  = new Set(['barre-fit','pilates-mat']);
  // puertas_abiertas_adultas usa texto libre en `disciplina`
  const esBallet_paa = d => !!d && (BALLET_IDS.has(d) || d === 'ballet-nina' || d.toLowerCase().includes('ballet'));
  // Todo lo demás (pilates, barre, ambas, sin elegir) son adultas → Barre & Pilates.
  const esBarre_paa  = d => !esBallet_paa(d);

  try {
    const [pa, paa, isc] = await Promise.all([
      sbFetch('puertas_abiertas?select=nombre,apellido,email,created_at&order=created_at.desc')
        .catch(() => sbFetch('puertas_abiertas?select=created_at&order=created_at.desc')),
      sbFetch('puertas_abiertas_adultas?select=nombre,email,created_at,disciplina&order=created_at.desc')
        .catch(() => sbFetch('puertas_abiertas_adultas?select=created_at,disciplina&order=created_at.desc')),
      sbFetch('iscrizioni?select=created_at,stato,nome,cognome,nome_alumna,email,matricula,disciplina_id&order=created_at.desc'),
    ]);

    const inscritas = isc.filter(r => PLAZA.has(r.stato));

    // NOTA: iscrizioni aun no tiene updated_at; renovaciones quedan en 0 por ahora.
    const makeReno = list => list.filter(r => {
      if (!r.updated_at) return false;
      return new Date(r.updated_at).getTime() >= todayMs && (!r.created_at || new Date(r.created_at).getTime() < todayMs);
    });

    // Separar por disciplina
    const paa_ballet = paa.filter(r => esBallet_paa(r.disciplina));
    const paa_barre  = paa.filter(r => esBarre_paa(r.disciplina));
    const isc_ballet = inscritas.filter(r => BALLET_IDS.has(r.disciplina_id));
    const isc_barre  = inscritas.filter(r => BARRE_IDS.has(r.disciplina_id));

    const snap = list => ({
      total:      list.length,
      recientes:  list.filter(isRecent).length,
      hoyCount:   list.filter(isToday).length,
      hoyNombres: fmtNames(list.filter(isToday)),
    });
    const renoSnap = list => ({ hoyCount: list.length, hoyNombres: fmtNames(list) });

    // Reservas REALES de hoy por disciplina (para el coste real por reserva).
    const paaHoy = paa.filter(isToday);
    const cd = d => paaHoy.filter(r => (r.disciplina || '').toLowerCase() === d).length;
    const regHoy = {
      pilates:      cd('pilates'),
      barre:        cd('barre'),
      ambas:        cd('ambas'),
      adultasTotal: paaHoy.length,
      ninas:        pa.filter(isToday).length,
    };

    return {
      ok: true,
      regHoy,
      ballet: {
        paNinas:    snap(pa),
        paaAdultas: snap(paa_ballet),
        isc:        snap(isc_ballet),
        reno:       renoSnap(makeReno(isc_ballet)),
      },
      barre: {
        paa:  snap(paa_barre),
        isc:  snap(isc_barre),
        reno: renoSnap(makeReno(isc_barre)),
      },
      totales: { pa: pa.length, paa: paa.length, isc: inscritas.length },
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Markdown muy básico → HTML (negritas y saltos de línea), escapando antes.
const mdLite = s => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\n/g, '<br>');

// Reservas REALES de los últimos 3 días, por disciplina (para el análisis del agente).
async function getReservas3d() {
  if (!SUPA_URL || !SUPA_KEY) return null;
  const since = Date.now() - 3 * 24 * 3600_000;
  try {
    const [paa, pa] = await Promise.all([
      sbFetch('puertas_abiertas_adultas?select=created_at,disciplina&order=created_at.desc'),
      sbFetch('puertas_abiertas?select=created_at&order=created_at.desc'),
    ]);
    const rec = r => r.created_at && new Date(r.created_at).getTime() >= since;
    const paaR = paa.filter(rec);
    const cd = d => paaR.filter(r => (r.disciplina || '').toLowerCase() === d).length;
    return { pilates: cd('pilates'), barre: cd('barre'), ambas: cd('ambas'), adultasTotal: paaR.length, ninas: pa.filter(rec).length };
  } catch { return null; }
}

// ── EL AGENTE ── Análisis escrito por IA (Claude Haiku) con la metodología del
// skill meta-ads-auditor. Analiza SIEMPRE los últimos 3 días (más señal que un
// solo día). Solo corre si hay clave configurada.
async function analisisIA({ meta, reservas }) {
  if (!ANTHROPIC_KEY || !meta.ok) return '';
  const reg1 = r => (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ','));

  let realTxt = 'Reservas reales: no disponibles.';
  if (reservas) {
    const rg = reservas;
    const gastoDe = pred => meta.rows.filter(r => pred((r.name || '').toLowerCase())).reduce((s, r) => s + r.spend, 0);
    const gPil = gastoDe(n => n.includes('pilates'));
    const gBar = gastoDe(n => n.includes('barre'));
    const rPil = rg.pilates + rg.ambas / 2;
    const rBar = rg.barre + rg.ambas / 2;
    realTxt =
      `COSTE REAL POR RESERVA (de la base de datos — la métrica que importa):\n` +
      `  · Pilates: ${rPil > 0 ? eur(gPil / rPil) : '—'} (${reg1(rPil)} reservas, ${eur(gPil)} gastados)\n` +
      `  · Barre: ${rBar > 0 ? eur(gBar / rBar) : '—'} (${reg1(rBar)} reservas, ${eur(gBar)} gastados)\n` +
      `  · Reservas reales (3 días): ${rg.adultasTotal} adultas, ${rg.ninas} niñas.`;
  }
  const camps = meta.rows.filter(r => r.spend > 0)
    .map(r => `  · ${r.name}: ${eur(r.spend)}, CTR ${pct(r.ctr)}, ${r.leads} "leads" Meta (inflado)`).join('\n') || '  (sin gasto aún)';
  const ads = [...(meta.adsBallet || []), ...(meta.adsBarre || [])].filter(a => a.spend > 0).sort((a, b) => b.spend - a.spend)
    .map(a => `  · ${a.name} [${analisisCreatividad(a)}]: ${eur(a.spend)}, ${num(a.impressions)} impr, ${a.leads} leads Meta`).join('\n') || '  (sin anuncios con gasto)';

  const system =
    `Eres un media-buyer senior que asesora a Andrea, dueña de una escuela de danza local en Valencia (zona Alfahuir). Analizas sus campañas de Meta Ads de "Puertas Abiertas" (clases de prueba gratis; objetivo = reservas).\n\n` +
    `REGLAS (metodología meta-ads-auditor):\n` +
    `- La métrica REAL es el coste por RESERVA real (las que entran en su base de datos), NO el "CPL" de Meta (inflado porque cuenta clics de botón). Razona SIEMPRE con el coste real.\n` +
    `- Es captación de leads: nunca uses ROAS.\n` +
    `- Solo recomiendas; Andrea aplica los cambios en Ads Manager. No ejecutas nada.\n` +
    `- No te precipites: si un anuncio tiene menos de 3-5 reservas reales aún hay poca señal; sé prudente al pausar/escalar.\n` +
    `- Nunca recomiendes pausar el anuncio que más reservas trae.\n` +
    `- Fatiga = frecuencia subiendo + CTR cayendo a lo largo de los días.\n` +
    `- Un anuncio que gasta y trae 0 reservas con bastante entrega = vigilar / candidato a pausar, con cautela.\n\n` +
    `FORMATO:\n` +
    `- Español, cercano y directo. Andrea es profesora de danza, no experta en marketing.\n` +
    `- MÁXIMO 5 viñetas cortas (empieza cada una con "• "). Primero lo que funciona, luego lo que vigilar, y UNA acción concreta solo si está justificada.\n` +
    `- Usa los números reales. Sin relleno ni teoría.`;

  const userMsg =
    `Datos de los ÚLTIMOS 3 DÍAS:\n\n` +
    `${realTxt}\n\nCAMPAÑAS (Meta, 3 días):\n${camps}\n\nANUNCIOS (Meta, 3 días):\n${ads}\n\n` +
    `Dame tu análisis de estos 3 días siguiendo las reglas.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 700, system, messages: [{ role: 'user', content: userMsg }] }),
    });
    const data = await res.json();
    if (!res.ok) { console.error('IA error:', JSON.stringify(data)); return ''; }
    return (data?.content?.[0]?.text || '').trim();
  } catch (e) {
    console.error('IA fetch fail:', e.message);
    return '';
  }
}

function buildHtml({ meta, ins, ahora, hours, analisis }) {
  const fecha = ahora.toLocaleString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  });

  const analisisBloque = analisis
    ? `<tr><td style="padding:18px 28px 0;">` +
      `<div style="background:#25190f;border-radius:14px;padding:16px 18px;">` +
      `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#ffd9c9;">🤖 Análisis del día · el agente</p>` +
      `<div style="font-size:13px;line-height:1.65;color:#fff8f5;">${mdLite(analisis)}</div>` +
      `</div></td></tr>`
    : '';

  let metaBloque;
  if (meta.ok && meta.rows.length > 0) {
    const tGasto   = meta.rows.reduce((s, r) => s + r.spend,  0);
    const tLeads   = meta.rows.reduce((s, r) => s + r.leads,  0);
    const tClicks  = meta.rows.reduce((s, r) => s + r.clicks, 0);
    const tAlcance = meta.rows.reduce((s, r) => s + r.reach,  0);
    const tImpr    = meta.rows.reduce((s, r) => s + r.impressions, 0);
    const tCtr     = tImpr > 0 ? (tClicks / tImpr) * 100 : 0;
    const tConv    = tClicks > 0 ? (tLeads / tClicks) * 100 : null;
    const tCpl     = tLeads > 0 ? tGasto / tLeads : null;

    const card = (emoji, label, value, highlight = false) =>
      `<td style="padding:12px 8px;text-align:center;vertical-align:top;">` +
      `<div style="font-size:18px;">${emoji}</div>` +
      `<div style="font-size:10px;color:#89726c;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">${label}</div>` +
      `<div style="font-size:${highlight ? '18px' : '15px'};font-weight:700;color:${highlight ? '#7d2b13' : '#25190f'};margin-top:4px;">${value}</div>` +
      `</td>`;

    const tarjetas =
      `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;background:#fff8f5;border-radius:12px;">` +
      `<tr>${card('💸','Gasto hoy',eur(tGasto))}${card('👁️','Alcance',num(tAlcance))}${card('📊','Impr.',num(tImpr))}${card('🔗','Clics link',num(tClicks))}</tr>` +
      `<tr>${card('📈','CTR link',pct(tCtr))}${card('🎯','Leads',num(tLeads),true)}${card('💰','CPL',tCpl!=null?eur(tCpl):'—',true)}${card('🔄','Conversión',tConv!=null?pct(tConv):'—')}</tr>` +
      `</table>`;

    const filas = meta.rows.map(r =>
      `<tr>` +
      `<td style="padding:9px 8px;border-bottom:1px solid #f0ddd5;font-size:12px;color:#25190f;font-weight:600;">${r.name}</td>` +
      `<td style="padding:9px 8px;border-bottom:1px solid #f0ddd5;font-size:12px;color:#56423d;text-align:right;">${eur(r.spend)}</td>` +
      `<td style="padding:9px 8px;border-bottom:1px solid #f0ddd5;font-size:12px;color:#56423d;text-align:right;">${num(r.reach)}</td>` +
      `<td style="padding:9px 8px;border-bottom:1px solid #f0ddd5;font-size:12px;color:#56423d;text-align:right;">${num(r.clicks)}</td>` +
      `<td style="padding:9px 8px;border-bottom:1px solid #f0ddd5;font-size:13px;color:#7d2b13;font-weight:700;text-align:right;">${num(r.leads)}</td>` +
      `<td style="padding:9px 8px;border-bottom:1px solid #f0ddd5;font-size:12px;color:#56423d;text-align:right;">${r.cpl!=null?eur(r.cpl):'—'}</td>` +
      `<td style="padding:9px 8px;border-bottom:1px solid #f0ddd5;font-size:12px;color:#56423d;text-align:right;">${r.convRate!=null?pct(r.convRate):'—'}</td>` +
      `</tr>`
    ).join('');

    const thS = 'padding:7px 8px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;';
    const tablaCampanas =
      `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;">` +
      `<tr><th style="${thS.replace('right','left')}">Campaña</th><th style="${thS}">Gasto</th><th style="${thS}">Alcance</th><th style="${thS}">Clics</th><th style="${thS}">Leads</th><th style="${thS}">CPL</th><th style="${thS}">Conv.%</th></tr>` +
      filas +
      `<tr>` +
      `<td style="padding:10px 8px;font-size:12px;color:#25190f;font-weight:700;">TOTAL</td>` +
      `<td style="padding:10px 8px;font-size:12px;color:#25190f;font-weight:700;text-align:right;">${eur(tGasto)}</td>` +
      `<td style="padding:10px 8px;text-align:right;color:#56423d;">${num(tAlcance)}</td>` +
      `<td style="padding:10px 8px;text-align:right;color:#56423d;">${num(tClicks)}</td>` +
      `<td style="padding:10px 8px;font-size:14px;color:#7d2b13;font-weight:700;text-align:right;">${num(tLeads)}</td>` +
      `<td style="padding:10px 8px;font-size:12px;color:#25190f;font-weight:700;text-align:right;">${tCpl!=null?eur(tCpl):'—'}</td>` +
      `<td style="padding:10px 8px;font-size:12px;color:#25190f;font-weight:700;text-align:right;">${tConv!=null?pct(tConv):'—'}</td>` +
      `</tr></table>`;

    const tablaCreatividades = (titulo, ads) => {
      if (!ads || ads.length === 0) return '';
      const celdaDer = (txt, extra = '') =>
        `<td style="padding:8px;border-bottom:1px solid #f0ddd5;font-size:12px;color:#56423d;text-align:right;${extra}">${txt}</td>`;
      const adFilas = ads.map((a, i) => {
        const esMejor = i === 0 && a.cpl != null;
        const esPeor  = i === ads.length - 1 && ads.length > 1 && a.cpl != null;
        const badge   = esMejor ? '🥇 ' : esPeor ? '⚠️ ' : '';
        const rowBg   = esMejor ? 'background:#f0faf0;' : esPeor ? 'background:#fff5f5;' : '';
        return `<tr style="${rowBg}">` +
          `<td style="padding:8px;border-bottom:1px solid #f0ddd5;font-size:12px;color:#25190f;">${badge}${a.name}` +
            `<div style="font-size:10px;color:#89726c;font-weight:600;margin-top:2px;">${analisisCreatividad(a)}</div></td>` +
          celdaDer(num(a.impressions)) +
          celdaDer(eur(a.spend)) +
          `<td style="padding:8px;border-bottom:1px solid #f0ddd5;font-size:13px;color:#7d2b13;font-weight:700;text-align:right;">${num(a.leads)}</td>` +
          celdaDer(a.cpl != null ? eur(a.cpl) : '—', esMejor ? 'color:#2e7d32;font-weight:700;' : '') +
          celdaDer(a.costeLpv != null ? eur(a.costeLpv) : '—') +
          celdaDer(a.crLead != null ? pct(a.crLead) : '—') +
          `</tr>`;
      }).join('');
      return `<p style="margin:20px 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:700;">🎨 Creatividades · ${titulo}</p>` +
        `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">` +
        `<tr><th style="${thS.replace('right','left')}">Anuncio</th><th style="${thS}">Impr.</th><th style="${thS}">Gasto</th><th style="${thS}">Leads</th><th style="${thS}">CPL</th><th style="${thS}">€/visita</th><th style="${thS}">CR%</th></tr>` +
        adFilas + `</table>`;
    };
    const hayCreatividades = (meta.adsBallet && meta.adsBallet.length) || (meta.adsBarre && meta.adsBarre.length);
    const leyenda = hayCreatividades
      ? `<p style="margin:8px 0 0;font-size:10px;color:#bcb0ab;line-height:1.5;">€/visita = coste por visita a la página de destino · CR% = leads por cada 100 visitas a la página</p>`
      : '';
    const creatividades = tablaCreatividades('Ballet · Pre_lancio', meta.adsBallet) + tablaCreatividades('Barre Fit', meta.adsBarre) + leyenda;

    // ── Coste REAL por reserva: gasto de Meta ÷ reservas reales de la BD ──
    // (No el CPL de Meta, que cuenta también los clics de botón y sale inflado.)
    let costeRealBox = '';
    if (ins.ok && ins.regHoy) {
      const rg = ins.regHoy;
      const gastoDe = pred => meta.rows.filter(r => pred((r.name || '').toLowerCase())).reduce((s, r) => s + r.spend, 0);
      const gPil = gastoDe(n => n.includes('pilates'));
      const gBar = gastoDe(n => n.includes('barre'));
      const gNin = gastoDe(n => !n.includes('pilates') && !n.includes('barre'));
      const rPil = rg.pilates + rg.ambas / 2; // "ambas" se reparte a medias
      const rBar = rg.barre + rg.ambas / 2;
      const hayNinas = gNin > 0 || rg.ninas > 0;
      const gTot = gPil + gBar + (hayNinas ? gNin : 0);
      const rTot = rg.adultasTotal + (hayNinas ? rg.ninas : 0);
      const reg1 = r => (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ','));
      const cpr = (g, r) => (r > 0 ? eur(g / r) : '—');
      const thCR = 'padding:7px 8px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #d98c6a;';
      const filaCR = (label, g, r, hi = false) =>
        `<tr>` +
        `<td style="padding:8px;border-bottom:1px solid #f3d9cf;font-size:12px;color:#25190f;${hi ? 'font-weight:700;' : ''}">${label}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #f3d9cf;font-size:12px;color:#56423d;text-align:right;">${eur(g)}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #f3d9cf;font-size:12px;color:#56423d;text-align:right;">${reg1(r)}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #f3d9cf;font-size:13px;color:#7d2b13;font-weight:700;text-align:right;">${cpr(g, r)}</td></tr>`;
      costeRealBox =
        `<div style="background:#fff0eb;border:1px solid #f3c9b8;border-radius:12px;padding:14px 14px 6px;margin-bottom:20px;">` +
        `<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#7d2b13;">💡 Coste REAL por reserva <span style="font-weight:400;color:#89726c;">— las que de verdad entraron en tu base de datos</span></p>` +
        `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">` +
        `<tr><th style="${thCR}text-align:left;">Disciplina</th><th style="${thCR}text-align:right;">Gasto</th><th style="${thCR}text-align:right;">Reservas reales</th><th style="${thCR}text-align:right;">€ / reserva</th></tr>` +
        filaCR('Pilates Mat', gPil, rPil) +
        filaCR('Barre Fit', gBar, rBar) +
        (hayNinas ? filaCR('Ballet niñas', gNin, rg.ninas) : '') +
        filaCR('TOTAL', gTot, rTot, true) +
        `</table>` +
        `<p style="margin:8px 0 0;font-size:10px;color:#bcb0ab;line-height:1.5;">El CPL de Meta (tabla de abajo) cuenta también los clics de botón, por eso sale más bajo. Este es el coste de verdad. "Ambas" se reparte a medias entre Pilates y Barre. A primera hora hay pocas reservas; el dato se afina a lo largo del día.</p>` +
        `</div>`;
    }

    metaBloque = tarjetas + costeRealBox + tablaCampanas + creatividades;
  } else {
    metaBloque = `<p style="margin:0;font-size:13px;color:#b00020;">⚠️ No se pudieron leer los datos de Meta${meta.error ? ` — ${meta.error}` : ''}.</p>`;
  }

  let insBloque;
  if (ins.ok) {
    const filaReg = (emoji, label, sub, count, nombres) => {
      const nombresTxt = nombres.length ? `<div style="margin-top:5px;font-size:11px;color:#56423d;">${nombres.join(' · ')}</div>` : '';
      return `<tr>` +
        `<td style="padding:12px 14px;border-bottom:1px solid #f0ddd5;vertical-align:top;">` +
        `<span style="font-size:13px;color:#25190f;font-weight:600;">${emoji} ${label}</span>` +
        `<span style="font-size:11px;color:#89726c;"> · ${sub}</span>${nombresTxt}</td>` +
        `<td style="padding:12px 14px;border-bottom:1px solid #f0ddd5;text-align:right;vertical-align:top;">` +
        (count > 0
          ? `<span style="background:#e8f5e9;color:#2e7d32;font-size:14px;font-weight:700;padding:4px 12px;border-radius:9999px;">+${count}</span>`
          : `<span style="color:#bcb0ab;font-size:13px;">—</span>`) +
        `</td></tr>`;
    };
    const thS2 = 'padding:7px 14px;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#89726c;border-bottom:2px solid #7d2b13;';
    const tablaSection = (filas) =>
      `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">` +
      `<tr><th style="${thS2}text-align:left;">Categoría · hoy</th>` +
      `<th style="${thS2}text-align:right;">Nuevos</th></tr>` +
      filas + `</table>`;
    const subtitulo = (emoji, txt, color) =>
      `<p style="margin:20px 0 10px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:${color};font-weight:700;border-left:3px solid ${color};padding-left:8px;">${emoji} ${txt}</p>`;

    // Ballet
    const balletFilas =
      filaReg('👧','Puertas Abiertas','niñas ballet',ins.ballet.paNinas.hoyCount,ins.ballet.paNinas.hoyNombres) +
      filaReg('👩','Puertas Abiertas','adultas ballet',ins.ballet.paaAdultas.hoyCount,ins.ballet.paaAdultas.hoyNombres) +
      filaReg('✅','Matrículas','nuevas hoy',ins.ballet.isc.hoyCount,ins.ballet.isc.hoyNombres) +
      (ins.ballet.reno.hoyCount > 0 ? filaReg('🔄','Renovaciones','pagadas hoy',ins.ballet.reno.hoyCount,ins.ballet.reno.hoyNombres) : '');

    // Barre
    const barreFilas =
      filaReg('👩','Puertas Abiertas','adultas barre',ins.barre.paa.hoyCount,ins.barre.paa.hoyNombres) +
      filaReg('✅','Matrículas','nuevas hoy',ins.barre.isc.hoyCount,ins.barre.isc.hoyNombres) +
      (ins.barre.reno.hoyCount > 0 ? filaReg('🔄','Renovaciones','pagadas hoy',ins.barre.reno.hoyCount,ins.barre.reno.hoyNombres) : '');

    insBloque =
      subtitulo('🩰','Ballet','#7d2b13') +
      tablaSection(balletFilas) +
      `<p style="margin:8px 0 0;font-size:11px;color:#89726c;">Totales — PA niñas: <strong>${ins.ballet.paNinas.total}</strong> · PA adultas: <strong>${ins.ballet.paaAdultas.total}</strong> · Matrículas: <strong>${ins.ballet.isc.total}</strong></p>` +
      subtitulo('🏋️','Barre &amp; Pilates','#2b5c7d') +
      tablaSection(barreFilas) +
      `<p style="margin:8px 0 0;font-size:11px;color:#89726c;">Totales — PA adultas: <strong>${ins.barre.paa.total}</strong> · Matrículas: <strong>${ins.barre.isc.total}</strong></p>`;
  } else {
    insBloque = `<p style="margin:0;font-size:13px;color:#b00020;">⚠️ No se pudieron leer los inscritos${ins.error ? ` — ${ins.error}` : ''}.</p>`;
  }

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede8;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:580px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(37,25,15,0.10);">
  <tr><td style="padding:28px 28px 8px;">
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7d2b13;">Informe automático</p>
    <h1 style="margin:6px 0 2px;font-size:22px;color:#25190f;font-family:Georgia,serif;">Andrea Carrió Studio</h1>
    <p style="margin:0;font-size:12px;color:#89726c;text-transform:capitalize;">${fecha}</p>
  </td></tr>
  ${analisisBloque}
  <tr><td style="padding:20px 28px 8px;">
    <p style="margin:0 0 14px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:700;">📊 Publicidad · hoy</p>
    ${metaBloque}
  </td></tr>
  <tr><td style="padding:20px 28px 8px;">
    <p style="margin:0 0 14px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:700;">👥 Registros · hoy</p>
    ${insBloque}
  </td></tr>
  <tr><td style="background:#fff8f5;border-top:1px solid #f0ddd5;padding:16px 28px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#89726c;">Informe automático de Andrea Carrió Studio · <a href="https://andreacarriostudio.es" style="color:#7d2b13;text-decoration:none;">andreacarriostudio.es</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`.trim();
}

function buildSubject({ meta, ins }) {
  const leads    = meta.ok ? meta.rows.reduce((s, r) => s + r.leads, 0) : 0;
  const gasto    = meta.ok ? meta.rows.reduce((s, r) => s + r.spend, 0) : 0;
  const cpl      = leads > 0 ? eur(gasto / leads) : '—';
  const nuevosPA = ins.ok ? ins.ballet.paNinas.hoyCount + ins.ballet.paaAdultas.hoyCount + ins.barre.paa.hoyCount : 0;
  const hora     = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  const paTxt    = nuevosPA > 0 ? ` · +${nuevosPA} PA` : '';
  return `📊 ${hora} · ${leads} leads · CPL ${cpl}${paTxt}`;
}

async function enviar(subject, html) {
  if (!RESEND_KEY) throw new Error('Falta RESEND_API_KEY');
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM, to: TO, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Resend: ${JSON.stringify(data)}`);
  return data;
}

const ahora       = new Date();
const sinceMs     = ahora.getTime() - HOURS * 3600_000;
const todayMs     = getMadridDayStart();
const [meta, ins] = await Promise.all([getMeta(PRESET), getInscritos(sinceMs, todayMs)]);

// El agente IA solo corre en el email de cierre (≈22:00 España) o forzado con --ia.
const madridHour = Number(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }));
// El análisis IA corre solo en el email de cierre (~22:00) y un día sí, otro no
// (paridad del día) → 1 vez cada 2 días. El correo se envía siempre igual.
const esDiaAnalisis = Math.floor(Date.now() / 86400000) % 2 === 0;
const RUN_IA = !!ANTHROPIC_KEY && (args.includes('--ia') || (madridHour >= 21 && esDiaAnalisis));
let analisis = '';
if (RUN_IA) {
  // El agente analiza una ventana de 3 días (más señal que un solo día).
  const [meta3d, reservas3d] = await Promise.all([getMeta('last_3d'), getReservas3d()]);
  analisis = await analisisIA({ meta: meta3d, reservas: reservas3d });
}

const subject = buildSubject({ meta, ins });
const html    = buildHtml({ meta, ins, ahora, hours: HOURS, analisis });

if (DRY) {
  console.log('=== ASUNTO ===');
  console.log(subject);
  console.log('\n=== META ADS ===');
  if (meta.ok) {
    const tGasto = meta.rows.reduce((s, r) => s + r.spend, 0);
    const tLeads = meta.rows.reduce((s, r) => s + r.leads, 0);
    console.log(`Total: ${eur(tGasto)} · ${tLeads} leads · CPL ${tLeads > 0 ? eur(tGasto/tLeads) : '—'}`);
    meta.rows.forEach(r => {
      const conv = r.convRate != null ? ` · conv ${pct(r.convRate)}` : '';
      console.log(`  ${r.name}: ${eur(r.spend)} · alcance ${num(r.reach)} · ${r.leads} leads · CTR ${pct(r.ctr)}${conv}`);
    });
    const dumpAds = (titulo, ads) => {
      if (!ads || ads.length === 0) return;
      console.log(`\nCreatividades ${titulo} (${ads.length}):`);
      ads.forEach((a, i) => {
        const tag = i === 0 ? '🥇' : i === ads.length - 1 ? '⚠️' : '  ';
        console.log(`  ${tag} ${a.name} [${analisisCreatividad(a)}]: ${num(a.impressions)} impr · ${eur(a.spend)} · ${a.leads} leads · CPL ${a.cpl != null ? eur(a.cpl) : '—'} · €/visita ${a.costeLpv != null ? eur(a.costeLpv) : '—'} · CR ${a.crLead != null ? pct(a.crLead) : '—'}`);
      });
    };
    dumpAds('Ballet', meta.adsBallet);
    dumpAds('Barre', meta.adsBarre);
  } else console.log(`ERROR: ${meta.error}`);
  console.log('\n=== SUPABASE ===');
  if (ins.ok) {
    console.log('--- Ballet ---');
    console.log(`PA niñas hoy:        ${ins.ballet.paNinas.hoyCount}${ins.ballet.paNinas.hoyNombres.length ? ' — ' + ins.ballet.paNinas.hoyNombres.join(', ') : ''}`);
    console.log(`PA adultas hoy:      ${ins.ballet.paaAdultas.hoyCount}${ins.ballet.paaAdultas.hoyNombres.length ? ' — ' + ins.ballet.paaAdultas.hoyNombres.join(', ') : ''}`);
    console.log(`Matrículas hoy:      ${ins.ballet.isc.hoyCount}${ins.ballet.isc.hoyNombres.length ? ' — ' + ins.ballet.isc.hoyNombres.join(', ') : ''}`);
    console.log(`Renovaciones hoy:    ${ins.ballet.reno.hoyCount}${ins.ballet.reno.hoyNombres.length ? ' — ' + ins.ballet.reno.hoyNombres.join(', ') : ''}`);
    console.log(`Totales ballet: PA niñas ${ins.ballet.paNinas.total} · PA adultas ${ins.ballet.paaAdultas.total} · matrículas ${ins.ballet.isc.total}`);
    console.log('--- Barre & Pilates ---');
    console.log(`PA adultas hoy:      ${ins.barre.paa.hoyCount}${ins.barre.paa.hoyNombres.length ? ' — ' + ins.barre.paa.hoyNombres.join(', ') : ''}`);
    console.log(`Matrículas hoy:      ${ins.barre.isc.hoyCount}${ins.barre.isc.hoyNombres.length ? ' — ' + ins.barre.isc.hoyNombres.join(', ') : ''}`);
    console.log(`Renovaciones hoy:    ${ins.barre.reno.hoyCount}${ins.barre.reno.hoyNombres.length ? ' — ' + ins.barre.reno.hoyNombres.join(', ') : ''}`);
    console.log(`Totales barre: PA adultas ${ins.barre.paa.total} · matrículas ${ins.barre.isc.total}`);
  } else console.log(`ERROR: ${ins.error}`);
  console.log('\n(--dry: no se ha enviado nada)');
} else {
  const r = await enviar(subject, html);
  console.log(`✓ Correo enviado a ${TO} (id ${r.id || '?'})`);
}
