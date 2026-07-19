/**
 * Shared URL builders for inventory_matches → customer-facing site links.
 * Used by WhatsApp bridge (page recommendation). Keep in sync with
 * sales_core/inventory_public.py SITE_URL helpers.
 */

export const SITE_ORIGIN = "https://asia-power.com";

/** Category landing when we only know part intent (no stock match). */
export function categoryPageUrl(partIntent, vehicleCategory) {
  const cat = String(vehicleCategory || "").toLowerCase();
  if (cat.includes("truck")) return `${SITE_ORIGIN}/trucks/`;
  if (cat.includes("machin")) return `${SITE_ORIGIN}/machinery/`;
  const part = String(partIntent || "").toLowerCase();
  if (part === "engine") return `${SITE_ORIGIN}/engines/`;
  if (part === "gearbox") return `${SITE_ORIGIN}/half-cuts/?part=transmission`;
  if (part === "half_cut" || part === "half-cut") return `${SITE_ORIGIN}/half-cuts/`;
  return `${SITE_ORIGIN}/half-cuts/`;
}

/** Detail page for a public-catalog row (half-cuts API powers trucks/machinery too). */
export function detailPageUrl(item) {
  const slug = String(item?.slug || "").trim();
  if (!slug) return null;
  const cat = String(item?.vehicleCategory || "").toLowerCase();
  if (cat.includes("truck")) {
    return `${SITE_ORIGIN}/trucks/detail.html?slug=${encodeURIComponent(slug)}`;
  }
  if (cat.includes("machin")) {
    return `${SITE_ORIGIN}/machinery/detail.html?slug=${encodeURIComponent(slug)}`;
  }
  // Engines in the half-cut public dump still use half-cuts detail pages.
  return `${SITE_ORIGIN}/half-cuts/detail.html?slug=${encodeURIComponent(slug)}`;
}

export function enrichInventoryMatch(item) {
  const detail_url = detailPageUrl(item);
  const category_url = categoryPageUrl(null, item?.vehicleCategory);
  return {
    stock_id: item.stockId,
    slug: item.slug || null,
    title: item.title,
    price_usd: item.priceUsd,
    condition: item.vehicleCondition,
    vehicle_category: item.vehicleCategory || null,
    engine_code: item.engineCode || null,
    transmission_code: item.transmissionCode || null,
    detail_url,
    category_url,
  };
}
