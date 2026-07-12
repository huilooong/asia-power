#!/usr/bin/env node
/**
 * Reconcile the Ford test-vehicle powertrain lot to the CEO's source table.
 *
 * One source-table row remains one SKU with the source quantity. The three
 * engine+transmission rows use a single powertrain-package SKU in the engine
 * category because the current catalog has mutually exclusive part categories.
 *
 * Default is dry-run. Use --apply only after reviewing the plan.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DEFAULT = path.join(__dirname, '..');
const LOT_SOURCE = 'ford-test-powertrain-lot-2026-07-12';
const ENGINE_PRICE_USD = 1250;
const TRANSMISSION_PRICE_USD = 441;
const PACKAGE_PRICE_USD = ENGINE_PRICE_USD + TRANSMISSION_PRICE_USD;
const SALES_HIGHLIGHT = 'Low mileage · nearly new condition';

const EXPECTED = {
  HC250556: {
    lineNo: 1, code: 'CAF372WQ', displacement: '1.0T', qty: 24,
    kind: 'package', transmissionCode: 'MT', remarkZh: '手动挡',
    title: 'Ford CAF372WQ 1.0T Engine + Manual Transmission Powertrain Package · 24 units',
  },
  HC250557: {
    lineNo: 2, code: 'CAF384Q', displacement: '1.5L', qty: 47,
    kind: 'package', transmissionCode: 'AT', remarkZh: '自动挡',
    title: 'Ford CAF384Q 1.5L Engine + Automatic Transmission Powertrain Package · 47 units',
  },
  HC250558: {
    lineNo: 3, code: 'CAF384Q', displacement: '1.5L', qty: 18,
    kind: 'package', transmissionCode: 'MT', remarkZh: '手动挡',
    title: 'Ford CAF384Q 1.5L Engine + Manual Transmission Powertrain Package · 18 units',
  },
  HC250559: {
    lineNo: 4, code: 'CAF384Q', displacement: '1.5L', qty: 2,
    kind: 'engine', transmissionCode: '', remarkZh: '无变速器',
    title: 'Ford CAF384Q 1.5L Engine Assembly · 2 units',
  },
  HC250560: {
    lineNo: 5, code: 'CAF384WQ', displacement: '1.5T', qty: 4,
    kind: 'engine', transmissionCode: '', remarkZh: '无变速器',
    title: 'Ford CAF384WQ 1.5T Engine Assembly · 4 units',
  },
  HC250561: {
    lineNo: 6, code: 'CAF488WQ', displacement: '2.0T', qty: 17,
    kind: 'package', transmissionCode: 'AT', remarkZh: '自动挡',
    title: 'Ford CAF488WQ 2.0T Engine + Automatic Transmission Powertrain Package · 17 units',
  },
  HC250562: {
    lineNo: 7, code: 'CAF488WQ', displacement: '2.0T', qty: 62,
    kind: 'engine', transmissionCode: '', remarkZh: '无变速器',
    title: 'Ford CAF488WQ 2.0T Engine Assembly · 62 units',
  },
  HC250563: {
    lineNo: 8, code: 'GTDIQ8', displacement: '2.7T', qty: 3,
    kind: 'engine', transmissionCode: '', remarkZh: '无变速器',
    title: 'Ford GTDIQ8 2.7T Engine Assembly · 3 units',
  },
  HC250564: {
    lineNo: 9, code: 'CAF488Q10', displacement: '2.0L', qty: 34,
    kind: 'engine', transmissionCode: '', remarkZh: '无变速器（福特混动）',
    title: 'Ford CAF488Q10 2.0L Hybrid Engine Assembly · 34 units',
  },
  HC250565: {
    lineNo: 10, code: '', displacement: '1.5L', qty: 33,
    kind: 'transmission', transmissionCode: 'AT', remarkZh: '',
    title: 'Ford Focus 2019-2021 1.5L Automatic Transmission Assembly · 33 units',
  },
};

function parseArgs(argv) {
  const args = { root: ROOT_DEFAULT, apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) {
      args.root = argv[++i];
    } else if (argv[i] === '--apply') {
      args.apply = true;
    } else if (argv[i] === '--out' && argv[i + 1]) {
      args.out = argv[++i];
    }
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

function replaceLine(notes, prefix, line) {
  const lines = String(notes || '').split('\n').filter(Boolean);
  const filtered = lines.filter((entry) => !entry.startsWith(prefix));
  filtered.push(line);
  return filtered.join('\n');
}

function patchItem(item, spec, nowIso) {
  const isPackage = spec.kind === 'package';
  const isTransmission = spec.kind === 'transmission';
  const priceUsd = isPackage
    ? PACKAGE_PRICE_USD
    : (isTransmission ? TRANSMISSION_PRICE_USD : ENGINE_PRICE_USD);
  const assemblyStatusZh = isPackage
    ? '发动机+变速器'
    : (isTransmission ? '变速器总成' : '发动机总成');
  const includedParts = isPackage
    ? ['Engine assembly', 'Transmission assembly', `Sellable package qty: ${spec.qty}`]
    : [
        isTransmission ? 'Transmission assembly' : 'Engine assembly',
        `Sellable qty: ${spec.qty}`,
      ];
  let notes = String(item.notes || '');
  notes = replaceLine(notes, '重要：挂牌结构', `重要：挂牌结构 ${isPackage ? '动力总成套装（发动机+变速器，单 SKU）' : assemblyStatusZh}`);
  notes = replaceLine(notes, '定价：', `定价：${isPackage ? '套装' : (isTransmission ? '变速箱' : '发动机')} USD ${priceUsd}`);
  notes = replaceLine(notes, '数量口径：', `数量口径：源表第 ${spec.lineNo} 行 ${spec.qty} ${isPackage ? '套' : '台'}，禁止解释为单台`);
  if (isTransmission) {
    notes = replaceLine(
      notes,
      '适配命名依据：',
      '适配命名依据：延用既有 Focus 2019-2021 1.5L 自动变速箱上下文；原表本身未提供车型/年份'
    );
  }

  return {
    ...item,
    title: spec.title,
    engineCode: spec.code,
    transmissionCode: spec.transmissionCode,
    displacement: spec.displacement,
    passengerPartType: isTransmission ? 'transmission' : 'engine',
    vehicleCondition: isTransmission ? 'Transmission Assembly' : 'Engine Assembly',
    quantityUnits: spec.qty,
    quantity: spec.qty,
    sellableQty: spec.qty,
    publicQtyNote: `Sellable qty: ${spec.qty}`,
    includedParts,
    shortDescription: `${SALES_HIGHLIGHT} · ${spec.title}`,
    mileage: 'Low mileage · nearly new condition · factory test-vehicle lot',
    priceUsd,
    priceCurrency: 'USD',
    currency: 'USD',
    assemblyStatusZh,
    remarkZh: spec.remarkZh,
    listingStructure: isPackage ? 'single_sku_powertrain_package' : 'single_component_sku',
    packageIncludesTransmission: isPackage,
    packageUnitCount: isPackage ? spec.qty : 0,
    notes,
    reconciledFromCeoTableAt: nowIso,
    reconciledFromCeoTableSource: 'ceo-original-table-image-2026-07-12',
    updatedAt: nowIso,
  };
}

function summarize(item, patched, spec) {
  return {
    stockId: item.stockId || item.approvedStockId,
    lineNo: spec.lineNo,
    oldTitle: item.title,
    newTitle: patched.title,
    kind: spec.kind,
    qty: patched.quantityUnits,
    category: patched.passengerPartType,
    priceUsd: patched.priceUsd,
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
  const ids = Object.keys(EXPECTED);
  const lotRows = approved.filter((item) => item.sourceImport === LOT_SOURCE);
  const foundIds = lotRows.map((item) => String(item.stockId || '').toUpperCase()).sort();

  if (JSON.stringify(foundIds) !== JSON.stringify([...ids].sort())) {
    throw new Error(`Exact lot scope failed: expected ${ids.join(',')}; found ${foundIds.join(',')}`);
  }

  const plan = lotRows
    .map((item) => {
      const id = String(item.stockId || '').toUpperCase();
      const patched = patchItem(item, EXPECTED[id], nowIso);
      return summarize(item, patched, EXPECTED[id]);
    })
    .sort((a, b) => a.lineNo - b.lineNo);
  const totals = {
    sourceRows: plan.length,
    packages: plan.filter((row) => row.kind === 'package').reduce((sum, row) => sum + row.qty, 0),
    engines: plan.filter((row) => row.kind !== 'transmission').reduce((sum, row) => sum + row.qty, 0),
    transmissions: plan.filter((row) => row.kind !== 'engine').reduce((sum, row) => sum + row.qty, 0),
    physicalListingsQty: plan.reduce((sum, row) => sum + row.qty, 0),
  };
  if (JSON.stringify(totals) !== JSON.stringify({
    sourceRows: 10, packages: 106, engines: 211, transmissions: 139, physicalListingsQty: 244,
  })) {
    throw new Error(`Source totals guard failed: ${JSON.stringify(totals)}`);
  }

  const outPath = args.out || path.join(
    ROOT_DEFAULT,
    'reports',
    'ford-powertrain-table-reconcile-2026-07-12.json'
  );
  saveJson(outPath, { generatedAt: nowIso, apply: args.apply, totals, plan });

  if (!args.apply) {
    console.log(JSON.stringify({ ok: true, dryRun: true, totals, plan, outPath }, null, 2));
    return;
  }

  const stamp = nowIso.replace(/[:.]/g, '-');
  const backupDir = path.join(dataDir, 'backups', `ford-powertrain-table-reconcile-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(approvedFile, path.join(backupDir, 'half-cut-approved.json'));
  if (fs.existsSync(submissionsFile)) {
    fs.copyFileSync(submissionsFile, path.join(backupDir, 'half-cut-submissions.json'));
  }

  const patchById = (item, idField) => {
    const id = String(item[idField] || '').toUpperCase();
    const spec = EXPECTED[id];
    if (!spec || item.sourceImport !== LOT_SOURCE) return item;
    return patchItem(item, spec, nowIso);
  };
  const nextApproved = approved.map((item) => patchById(item, 'stockId'));
  const nextSubmissions = submissions.map((item) => patchById(item, 'approvedStockId'));
  saveJson(approvedFile, nextApproved);
  if (fs.existsSync(submissionsFile)) saveJson(submissionsFile, nextSubmissions);
  saveJson(path.join(dataDir, 'public-catalog-cache-bust.json'), {
    bustAt: nowIso,
    reason: 'ford-powertrain-table-reconcile-2026-07-12',
  });

  console.log(JSON.stringify({
    ok: true,
    dryRun: false,
    success: plan.length,
    failed: 0,
    backupDir,
    outPath,
    totals,
    plan,
  }, null, 2));
}

main();
