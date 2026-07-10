'use strict';

const vehicleTitleI18n = require('./half-cut-vehicle-title-i18n');

function isRemarkBoilerplate(line) {
  if (!line) return true;
  if (/^汽修宝批量导入/.test(line)) return true;
  if (/supplier-verified listing via AsiaPower/i.test(line)) return true;
  if (/QXB image set restored/i.test(line)) return true;
  if (/^里程数为系统默认/.test(line)) return true;
  return false;
}

function isRemarkMetadataLine(line) {
  if (/^原始车型:/.test(line) || /^原始说明:/.test(line)) return false;
  if (/^VIN /i.test(line) || /^VIN decode:/i.test(line)) return true;
  if (/^mileage/i.test(line) || /^里程数/.test(line)) return true;
  if (/子龙预估/.test(line) || /VIN OCR confidence:/i.test(line)) return true;
  return isRemarkBoilerplate(line);
}

function qxbMarkerText(item) {
  const parts = [
    item?.notes,
    item?.shortDescription,
    item?.originalVehicleName,
    ...(Array.isArray(item?.includedParts) ? item.includedParts : []),
  ];
  return parts.filter(Boolean).join('\n');
}

function isQxbListing(item) {
  if (!item) return false;
  if (String(item.stockId || '').toUpperCase().startsWith('QXB')) return true;
  if (item.supplierName === '汽修宝') return true;
  const notes = String(item.notes || '').trim();
  if (notes.startsWith('汽修宝批量导入') || /原始车型:/.test(notes)) return true;
  const blob = qxbMarkerText(item);
  if (/原始车型:/.test(blob) || /汽修宝批量导入/.test(blob)) return true;
  return false;
}

function extractOriginalVehicleName(text) {
  const remark = String(text || '').trim();
  if (!remark) return '';

  const modelLine = remark.match(/原始车型:\s*([^\n]+)/);
  if (modelLine) return modelLine[1].trim();

  const descLine = remark.match(/原始说明:\s*([^\n]+)/);
  if (descLine) return descLine[1].trim();

  for (const line of remark.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || isRemarkMetadataLine(trimmed)) continue;
    if (/\d{4}款/.test(trimmed)) return trimmed;
  }

  const firstLine = remark.split('\n')[0].trim();
  if (isRemarkBoilerplate(firstLine)) return '';
  if (/^原始说明:/.test(firstLine)) return '';
  if (/\d{4}款/.test(firstLine)) return firstLine;
  return firstLine;
}

function listingNotesText(item) {
  if (!isQxbListing(item)) return String(item?.notes || '').trim();

  const original = String(item?.originalVehicleName || '').trim();
  if (original) return original;

  const notes = String(item?.notes || '').trim();
  const short = String(item?.shortDescription || '').trim();
  if (notes && /原始车型:/.test(notes)) return notes;
  if (short && !isRemarkBoilerplate(short.split('\n')[0].trim())) return short;
  return notes || short;
}

function appendEngineToTitle(base, item) {
  const title = String(base || '').trim();
  if (!title) return '';
  const engine = String(item?.engineCode || '').trim();
  if (!engine) return title;
  if (title.toUpperCase().includes(engine.toUpperCase())) return title;
  return `${title} ${engine}`.replace(/\s+/g, ' ').trim();
}

function buildStructuredTitle(item) {
  const year = Number(item?.year);
  const yearText = Number.isFinite(year) && year >= 1900 && year <= 2100 ? String(Math.round(year)) : '';
  const brand = String(item?.brand || '').trim();
  const model = String(item?.model || '').trim();
  if (!brand && !model) return '';

  const parts = [[yearText, brand, model].filter(Boolean).join(' ')];
  const engine = String(item?.engineCode || '').trim().toUpperCase();
  const trans = String(item?.transmissionCode || '').trim().toUpperCase();
  const powertrain = item?.vehicleCategory === 'machinery'
    ? engine
    : [engine, trans].filter(Boolean).join(' ');
  if (powertrain) parts.push(powertrain);

  const rawDrive = String(item?.drivetrain || '').trim().toUpperCase();
  let drive = '';
  if (rawDrive) {
    if (rawDrive === '2WD' || rawDrive === 'FWD' || rawDrive === 'RWD') drive = '2WD';
    else if (rawDrive === '4WD' || rawDrive === 'AWD' || rawDrive === '4MATIC' || rawDrive === 'QUATTRO') drive = '4WD';
    else drive = rawDrive;
  }
  if (drive) parts.push(drive);

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function preferChineseTitle(lang) {
  return String(lang || 'en').toLowerCase() === 'zh';
}

function buildDisplayTitle(item, lang = 'en') {
  const activeLang = String(lang || 'en').toLowerCase();
  if (isQxbListing(item)) {
    const originalName = extractOriginalVehicleName(listingNotesText(item));
    if (originalName) {
      if (activeLang === 'zh') return appendEngineToTitle(originalName, item);
      const translated = vehicleTitleI18n.translateOriginalVehicleName(originalName, activeLang, item);
      if (translated) return appendEngineToTitle(translated, item);
    }
  }
  const structured = buildStructuredTitle(item);
  if (structured) return structured;
  return '';
}

function buildShortDescriptionFromNotes(notes, fallback, item) {
  if (item && !isQxbListing(item)) return fallback || '';
  const original = extractOriginalVehicleName(notes);
  if (original) return original.slice(0, 220);
  const line = String(notes || '').split('\n')[0].trim();
  if (line && !isRemarkBoilerplate(line)) return line.slice(0, 220);
  return fallback || '';
}

const EXPORT_USED_CAR_REMARK_KEYWORDS = [
  '可整车出口',
  '可做整车出口',
  '整车可出口',
  '整车可以出口',
  '整车出口',
  '可整车出售',
  '可整车交货',
  '可整车',
  '有手续',
  '手续齐全',
  '手续全',
  '正规手续',
  '可出口',
];

function normalizeExportRemarkText(text) {
  return String(text || '')
    .replace(/\s+/g, '')
    .replace(/[，,。.；;：:、]/g, '');
}

function exportRemarkText(item) {
  if (!item) return '';
  return [
    item.notes,
    item.shortDescription,
    item.qxb?.description,
  ].filter(Boolean).join('\n');
}

function hasExportReadyRemark(item) {
  const text = normalizeExportRemarkText(exportRemarkText(item));
  if (!text) return false;
  return EXPORT_USED_CAR_REMARK_KEYWORDS.some(
    (kw) => text.includes(normalizeExportRemarkText(kw))
  );
}

function isTruckOrMachineryItem(item) {
  if (!item) return true;
  if (item.vehicleCategory === 'truck' || item.vehicleCategory === 'machinery') return true;
  const slug = String(item.slug || '');
  if (slug.includes('-truck-cab-') || slug.includes('-truck-half-cut-')) return true;
  if (String(item.title || '').includes('Driver Cab')) return true;
  return false;
}

function computeIsExportUsedCar(item) {
  if (!item || isTruckOrMachineryItem(item)) return false;
  return hasExportReadyRemark(item);
}

function enrichInventoryFromSubmission(item, submission) {
  if (!item || !submission) return item;
  const next = { ...item };
  if (!next.notes && submission.notes) next.notes = submission.notes;
  if (!next.supplierName && submission.supplierName) next.supplierName = submission.supplierName;
  if (isQxbListing({ ...next, notes: next.notes || submission.notes || '' })) {
    if (!next.originalVehicleName) {
      next.originalVehicleName = extractOriginalVehicleName(next.notes || submission.notes || '');
    }
    const displayTitle = buildDisplayTitle(next, 'zh');
    if (displayTitle) next.title = displayTitle;
    const short = buildShortDescriptionFromNotes(
      next.notes || submission.notes || '',
      next.shortDescription,
      next
    );
    if (short && isRemarkBoilerplate(String(next.shortDescription || '').split('\n')[0].trim())) {
      next.shortDescription = short;
    }
  }
  return next;
}

module.exports = {
  isRemarkBoilerplate,
  isQxbListing,
  qxbMarkerText,
  extractOriginalVehicleName,
  listingNotesText,
  appendEngineToTitle,
  buildStructuredTitle,
  preferChineseTitle,
  buildDisplayTitle,
  buildShortDescriptionFromNotes,
  computeIsExportUsedCar,
  enrichInventoryFromSubmission,
};
