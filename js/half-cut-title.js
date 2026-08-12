/**
 * AsiaPower — display titles from remark / original vehicle name
 */
(function () {
  'use strict';

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

  function isExportUsedCarListing(item) {
    if (!item) return false;
    if (item.vehicleCategory === 'truck' || item.vehicleCategory === 'machinery') return false;
    if (String(item.vehicleListingType || '').trim().toLowerCase() === 'used') return true;
    if (item.isExportUsedCar === true) return true;
    return String(item.vehicleCondition || '').trim().toLowerCase() === 'running vehicle';
  }

  function sanitizeExportUsedCarTitle(title) {
    return String(title || '')
      .replace(/\bhalf[\s-]*cut\b/gi, ' ')
      .replace(/\bfront[\s-]*cut\b/gi, ' ')
      .replace(/半截车|半切车|半切|半截/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatExportUsedCarTitle(title) {
    const clean = sanitizeExportUsedCarTitle(title);
    if (!clean) return 'Export Used Car';
    if (/\bexport\s+used\s+car\b/i.test(clean)) return clean;
    return `${clean} — Export Used Car`;
  }

  function buildExportUsedCarTitle(item) {
    const year = Number(item?.vinSpecs?.modelYear || item?.year);
    const yearText = Number.isFinite(year) && year >= 1900 && year <= 2100 ? String(Math.round(year)) : '';
    const brand = String(item?.brand || '').trim();
    const model = String(item?.model || '').trim();
    const core = [yearText, brand, model].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (core) return formatExportUsedCarTitle(core);
    return formatExportUsedCarTitle(item?.title || '');
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

  function buildDisplayTitle(item, lang) {
    const activeLang = String(lang || 'en').toLowerCase();
    const exportUsedCar = isExportUsedCarListing(item);
    if (exportUsedCar) return buildExportUsedCarTitle(item);
    if (isQxbListing(item)) {
      const originalName = extractOriginalVehicleName(listingNotesText(item));
      if (originalName) {
        if (activeLang === 'zh') {
          const title = appendEngineToTitle(originalName, item);
          return exportUsedCar ? formatExportUsedCarTitle(title) : title;
        }
        const translated = window.HalfCutVehicleTitleI18n?.translateOriginalVehicleName?.(
          originalName,
          activeLang,
          item
        );
        if (translated) {
          const title = appendEngineToTitle(translated, item);
          return exportUsedCar ? formatExportUsedCarTitle(title) : title;
        }
      }
    }
    const structured = buildStructuredTitle(item);
    if (structured) return exportUsedCar ? formatExportUsedCarTitle(structured) : structured;
    if (item?.title) return exportUsedCar ? formatExportUsedCarTitle(item.title) : item.title;
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

  window.HalfCutTitle = {
    isRemarkBoilerplate,
    isQxbListing,
    isExportUsedCarListing,
    sanitizeExportUsedCarTitle,
    formatExportUsedCarTitle,
    buildExportUsedCarTitle,
    qxbMarkerText,
    extractOriginalVehicleName,
    listingNotesText,
    appendEngineToTitle,
    buildStructuredTitle,
    preferChineseTitle,
    buildDisplayTitle,
    buildShortDescriptionFromNotes,
  };
})();
