# meta-ads — consulta directa a la Marketing API de Meta

CLI mínimo (Node, sin dependencias) que consulta **directamente** la Graph API de
Meta. A diferencia del conector MCP, aquí elegimos nosotros los campos, así que
hay **visibilidad total** de las métricas del Ads Manager: visitas a la página de
destino y su coste, coste por cada tipo de acción, ROAS, conversiones, etc.

## 1. Crear el token (System User, recomendado)

1. Entra en **Business Settings** (Configuración del negocio) de tu Business Manager:
   https://business.facebook.com/settings
2. Menú lateral → **Usuarios → Usuarios del sistema** (System Users).
3. Crea uno (o usa uno existente). Rol: *Empleado* basta para leer.
4. Asígnale el activo **Cuenta publicitaria** "Palumbo consulting" con permiso de **ver rendimiento**.
5. Botón **Generar token nuevo** → elige tu app → marca el permiso **`ads_read`**.
   - Marca *token sin caducidad* si la opción está disponible.
6. Copia el token (empieza por algo tipo `EAA...`). **Solo se muestra una vez.**

> Alternativa rápida para probar hoy: [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
> → permiso `ads_read` → "Generate Access Token". Caduca en 1-2 h.

## 2. Configurar

```bash
# desde tools/meta-ads/
cp .env.example .env        # en Windows PowerShell: Copy-Item .env.example .env
```

Abre `.env` y pega tu token en `META_ACCESS_TOKEN=`.
El `.env` está ignorado por git, así que el token no se sube nunca.

## 3. Usar

```bash
node meta-ads.mjs                                   # cuenta, ayer
node meta-ads.mjs --level campaign --preset yesterday
node meta-ads.mjs --level campaign --since 2026-06-01 --until 2026-06-18
node meta-ads.mjs --level ad --preset last_7d
node meta-ads.mjs --fields spend,impressions,actions --json   # respuesta cruda
node meta-ads.mjs --help
```

### Flags

| Flag | Valores | Por defecto |
|------|---------|-------------|
| `--level` | `account` `campaign` `adset` `ad` | `account` |
| `--preset` | `today` `yesterday` `last_7d` `last_30d` `this_month`… | `yesterday` |
| `--since` / `--until` | `YYYY-MM-DD` (rango, alternativa a `--preset`) | — |
| `--fields` | lista separada por comas (sobrescribe los por defecto) | conjunto útil |
| `--json` | imprime la respuesta cruda de la API | — |

## Notas

- Requiere **Node 18+** (usa `fetch` nativo).
- Los importes se muestran en **EUR** (la cuenta del estudio es en euros).
- "Visitas a la página (LPV)" = evento `landing_page_view`, extraído de `actions`;
  su coste, de `cost_per_action_type`. Es justo la métrica que el conector MCP no exponía.
- Si la API responde error de versión, sube `META_API_VERSION` en el `.env`.
