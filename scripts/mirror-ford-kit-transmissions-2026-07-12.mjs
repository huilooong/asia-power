#!/usr/bin/env node
/**
 * Mirror the four Ford engine+transmission kit listings into dedicated
 * transmission-category SKUs so buyers can find them under Gearboxes.
 *
 * Engine-side package SKUs stay untouched. Pure engines are never mirrored.
 *
 * Default is dry-run. Use --apply after reviewing the plan.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DEFAULT = path.join(__dirname, '..');
const LOT_SOURCE = 'ford-test-powertrain-lot-2026-07-12';
const MIRROR_SOURCE = 'ford-kit-transmission-mirror-2026-07-12';
const TRANSMISSION_PRICE_USD = 441;
const SALES_HIGHLIGHT = 'Low mileage · nearly new condition';
const PLACEHOLDER_PHOTO = {
  label: 'Ford x AsiaPower dual-brand placeholder',
  url: '/assets/images/ford-asiapower-powertrain-placeholder.png',
  thumbUrl: '/assets/images/ford-asiapower-powertrain-placeholder.png',
  placeholder: true,
  placeholderKind: 'ford-asiapower-dual-brand',
};

const MIRRORS = [
  {
    packageStockId: 'HC250556',
    code: 'CAF372WQ',
    displacement: '1.0T',
    transmissionCode: 'MT',
    gearLabel: 'Manual',
    gearLabelZh: '手动挡',
    qty: 24,
  },
  {
    packageStockId: 'HC250557',
    code: 'CAF384Q',
    displacement: '1.5L',
    transmissionCode: 'AT',
    gearLabel: 'Automatic',
    gearLabelZh: '自动挡',
    qty: 47,
  },
  {
    packageStockId: 'HC250558',
    code: 'CAF384Q',
    displacement: '1.5L',
    transmissionCode: 'MT',
    gearLabel: 'Manual',
    gearLabelZh: '手动挡',
    qty: 18,
  },
  {
    packageStockId: 'HC250561',
    code: 'CAF488WQ',
    displacement: '2.0T',
    transmissionCode: 'AT',
    gearLabel: 'Automatic',
    gearLabelZh: '自动挡',
    qty: 17,
  },
];

function parseArgs(argv) {
  const args = { root: ROOT_DEFAULT, apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) args.root = argv[++i];
    else if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--out' && argv[i + 1]) args.out = argv[++i];
  }
  return args;
}

function loadJson(file, fallback = []) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function saveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function nextStockIds(approved, count) {
  let max = 250000;
  for (const item of approved || []) {
    const m = String(item.stockId || '').match(/HC(\d+)/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return Array.from({ length: count }, (_, i) => `HC${max + 1 + i}`);
}

function slugify(parts) {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildMirror(spec, stockId, packageItem, nowIso) {
  const publicModel = `${spec.code} ${spec.displacement} ${spec.gearLabel} Transmission · ${spec.qty} units`;
  const title = `Ford ${publicModel}`;
  const notes = [
    '来源：福特厂家试验车发动机/变速器出售清单（套装行变速箱类目镜像）',
    '重要：本批无铭牌（非零售拆车件，不可 OCR）',
    `镜像来源套装：${spec.packageStockId}`,
    `型号 ${spec.code}`,
    `排量 ${spec.displacement}`,
    `变速箱类型 ${spec.gearLabelZh}`,
    `数量 ${spec.qty}台`,
    `可售数量 ${spec.qty}台（Sellable qty: ${spec.qty}）`,
    '挂牌结构：套装仍在发动机类目；本条仅进变速箱类目',
    `定价：变速箱 USD ${TRANSMISSION_PRICE_USD}`,
    '卖点：低里程几乎全新（Low mileage · nearly new condition）',
    '占位图：Ford logo + AsiaPower 双品牌',
  ].join('\n');

  return {
    stockId,
    submissionId: `MIRROR-${spec.packageStockId}-${stockId}`,
    vehicleCondition: 'Transmission Assembly',
    vehicleCategory: 'passenger',
    truckPartType: '',
    machineryType: '',
    brand: 'Ford',
    brandSlug: 'ford',
    model: publicModel,
    year: '',
    engineCode: '',
    transmissionCode: spec.transmissionCode,
    displacement: spec.displacement,
    drivetrain: '',
    mileage: 'Low mileage · nearly new condition · factory test-vehicle lot',
    priceUsd: TRANSMISSION_PRICE_USD,
    priceCurrency: 'USD',
    currency: 'USD',
    origin: 'China',
    status: 'Available',
    title,
    slug: slugify([
      'ford',
      spec.code,
      spec.displacement,
      spec.gearLabel,
      'transmission',
      `qty${spec.qty}`,
      'kit-mirror',
      'passenger-transmission',
      stockId.toLowerCase(),
    ]),
    photos: [PLACEHOLDER_PHOTO],
    video: null,
    videoUrl: '',
    includedParts: [
      'Transmission assembly',
      `Mirrored from powertrain package ${spec.packageStockId}`,
      `Sellable qty: ${spec.qty}`,
    ],
    shortDescription: `${SALES_HIGHLIGHT} · ${title}`,
    supplierVerified: true,
    passengerPartType: 'transmission',
    isExportUsedCar: false,
    quantityUnits: spec.qty,
    quantity: spec.qty,
    sellableQty: spec.qty,
    publicQtyNote: `Sellable qty: ${spec.qty}`,
    lotName: '福特厂家试验车发动机/变速器出售清单（无铭牌）',
    lotLineNo: packageItem?.lotLineNo || null,
    assemblyStatusZh: '变速器总成',
    remarkZh: spec.gearLabelZh,
    remarkEn: `${spec.code} ${spec.displacement} ${spec.gearLabel.toLowerCase()} transmission mirrored from package ${spec.packageStockId}`,
    listedAt: nowIso,
    approvedAt: nowIso,
    updatedAt: nowIso,
    sourceImport: LOT_SOURCE,
    mirrorSource: MIRROR_SOURCE,
    mirroredFromPackageStockId: spec.packageStockId,
    listingStructure: 'kit_transmission_mirror_sku',
    packageIncludesTransmission: false,
    packageUnitCount: 0,
    source: '福特厂家试验车发动机/变速器出售清单；无铭牌（套装变速箱类目镜像）',
    sourceDetail: `Mirrored transmission listing for package ${spec.packageStockId}`,
    noNameplate: true,
    nameplateAvailable: false,
    conditionHighlights: ['Low mileage', 'Nearly new condition'],
    pricingExchangeRate: 6.8,
    pricingSourceRmb: 3000,
    pricingUpdatedAt: nowIso,
    pricingUpdateSource: 'ceo-2026-07-12-kit-transmission-mirror',
    placeholderPhotoSource: 'ford-asiapower-powertrain-placeholder.png',
    notes,
    vin: '',
    supplierName: packageItem?.supplierName || 'AsiaPower Internal Lot',
  };
}

function main() {
  const args = parseArgs(process.argv);
  const dataDir = path.join(args.root, 'data');
  const approvedFile = path.join(dataDir, 'half-cut-approved.json');
  const submissionsFile = path.join(dataDir, 'half-cut-submissions.json');
  const approved = loadJson(approvedFile);
  const submissions = loadJson(submissionsFile);
  const nowIso = new Date().toISOString();

  const byId = new Map(
    approved.map((item) => [String(item.stockId || '').toUpperCase(), item]),
  );

  for (const spec of MIRRORS) {
    const pkg = byId.get(spec.packageStockId);
    if (!pkg) throw new Error(`Missing package ${spec.packageStockId}`);
    if (pkg.passengerPartType !== 'engine') {
      throw new Error(`${spec.packageStockId} is not an engine package`);
    }
    const qty = Number(pkg.quantityUnits || pkg.sellableQty || pkg.quantity || 0);
    if (qty !== spec.qty) {
      throw new Error(`${spec.packageStockId} qty ${qty} != expected ${spec.qty}`);
    }
  }

  const existingMirrors = approved.filter(
    (item) => item.mirrorSource === MIRROR_SOURCE || item.listingStructure === 'kit_transmission_mirror_sku',
  );
  if (existingMirrors.length) {
    const plan = existingMirrors.map((item) => ({
      stockId: item.stockId,
      mirroredFromPackageStockId: item.mirroredFromPackageStockId,
      qty: item.quantityUnits || item.sellableQty,
      title: item.title,
      alreadyExists: true,
    }));
    console.log(JSON.stringify({
      ok: true,
      dryRun: !args.apply,
      skipped: true,
      reason: 'mirror listings already present',
      plan,
    }, null, 2));
    return;
  }

  // Guard: never invent transmissions for pure engines.
  for (const pureId of ['HC250559', 'HC250560', 'HC250562', 'HC250563', 'HC250564']) {
    if (MIRRORS.some((row) => row.packageStockId === pureId)) {
      throw new Error(`Refusing to mirror pure engine ${pureId}`);
    }
  }

  const stockIds = nextStockIds(approved, MIRRORS.length);
  const plan = MIRRORS.map((spec, index) => {
    const packageItem = byId.get(spec.packageStockId);
    const item = buildMirror(spec, stockIds[index], packageItem, nowIso);
    return {
      stockId: item.stockId,
      packageStockId: spec.packageStockId,
      qty: item.quantityUnits,
      priceUsd: item.priceUsd,
      category: item.passengerPartType,
      title: item.title,
      item,
    };
  });

  const outPath = args.out || path.join(
    ROOT_DEFAULT,
    'reports',
    'ford-kit-transmission-mirror-2026-07-12.json',
  );
  saveJson(outPath, {
    generatedAt: nowIso,
    apply: args.apply,
    plan: plan.map(({ item, ...rest }) => rest),
  });

  if (!args.apply) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      plan: plan.map(({ item, ...rest }) => rest),
      outPath,
    }, null, 2));
    return;
  }

  const stamp = nowIso.replace(/[:.]/g, '-');
  const backupDir = path.join(dataDir, 'backups', `ford-kit-transmission-mirror-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(approvedFile, path.join(backupDir, 'half-cut-approved.json'));
  if (fs.existsSync(submissionsFile)) {
    fs.copyFileSync(submissionsFile, path.join(backupDir, 'half-cut-submissions.json'));
  }

  const nextApproved = [...approved, ...plan.map((row) => row.item)];
  saveJson(approvedFile, nextApproved);
  saveJson(path.join(dataDir, 'public-catalog-cache-bust.json'), {
    bustAt: nowIso,
    reason: MIRROR_SOURCE,
  });
  saveJson(outPath, {
    generatedAt: nowIso,
    apply: true,
    backupDir,
    plan: plan.map(({ item, ...rest }) => rest),
  });

  console.log(JSON.stringify({
    ok: true,
    dryRun: false,
    success: plan.length,
    failed: 0,
    backupDir,
    outPath,
    stockIds: plan.map((row) => row.stockId),
  }, null, 2));
}

main();
