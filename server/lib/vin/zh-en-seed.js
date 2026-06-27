'use strict';

/**
 * Seed data for the Chinese → English display dictionary.
 *
 * Source: established industry/market naming conventions (manufacturer
 * official English model names as sold internationally or in English-
 * language China-market reporting) — NOT derived from QXB or guessed.
 * Marked `source: 'manual_seed'` in the knowledge base so it's clearly
 * distinguished from entries later learned + confirmed from real API
 * responses (`source: 'qxb_confirmed'`).
 *
 * This is intentionally small. Anything not listed here falls through to
 * the Unknown Queue for human research/confirmation rather than being
 * guessed — see server/lib/vin/localize.js.
 */

// Chinese brand name (as returned by QXB) -> AsiaPower brand (must match a
// key in js/vehicle-catalog.js BRAND_SLUG).
const BRAND_ZH_TO_EN = {
  '日产': 'Nissan',
  '东风日产': 'Nissan',
  '丰田': 'Toyota',
  '一汽丰田': 'Toyota',
  '广汽丰田': 'Toyota',
  '雷克萨斯': 'Lexus',
  '凌志': 'Lexus',
  '本田': 'Honda',
  '东风本田': 'Honda',
  '广汽本田': 'Honda',
  '讴歌': 'Acura',
  '英菲尼迪': 'Infiniti',
  '马自达': 'Mazda',
  '长安马自达': 'Mazda',
  '一汽马自达': 'Mazda',
  '三菱': 'Mitsubishi',
  '广汽三菱': 'Mitsubishi',
  '斯巴鲁': 'Subaru',
  '铃木': 'Suzuki',
  '大发': 'Daihatsu',
  '现代': 'Hyundai',
  '北京现代': 'Hyundai',
  '起亚': 'Kia',
  '悦达起亚': 'Kia',
  '捷尼赛思': 'Genesis',
  '福特': 'Ford',
  '长安福特': 'Ford',
  '江铃福特': 'Ford',
  '林肯': 'Lincoln',
  '雪佛兰': 'Chevrolet',
  '别克': 'Buick',
  '凯迪拉克': 'Cadillac',
  '大众': 'Volkswagen',
  '上汽大众': 'Volkswagen',
  '一汽大众': 'Volkswagen',
  '奥迪': 'Audi',
  '一汽奥迪': 'Audi',
  '斯柯达': 'Skoda',
  '西雅特': 'Seat',
  '奔驰': 'Mercedes-Benz',
  '北京奔驰': 'Mercedes-Benz',
  '宝马': 'BMW',
  '华晨宝马': 'BMW',
  '迷你': 'MINI',
  '保时捷': 'Porsche',
  '双龙': 'Ssangyong',
  '五十铃': 'Isuzu',
  '比亚迪': 'BYD',
  '吉利': 'Geely',
  '极氪': 'Zeekr',
  '领克': 'Lynk & Co',
  '几何': 'Geometry',
  '奇瑞': 'Chery',
  '星途': 'Exeed',
  '捷途': 'Jetour',
  '欧萌达': 'Omoda',
  '捷酷': 'Jaecoo',
  '长城': 'Great Wall',
  '哈弗': 'Haval',
  '坦克': 'Tank',
  '欧拉': 'Ora',
  '名爵': 'MG',
  '荣威': 'Roewe',
  '广汽': 'GAC',
  '长安': 'Changan',
  '江淮': 'JAC',
  '东风': 'Dongfeng',
  '一汽': 'FAW',
  '福田': 'Foton',
  '江铃': 'JMC',
  '大通': 'Maxus',
};

// Chinese series/model name (as returned by QXB `series`) -> English model
// name. Keyed by AsiaPower brand slug, then the Chinese series string.
// Only well-known, unambiguous official English names — anything else goes
// to the Unknown Queue.
const MODEL_ZH_TO_EN = {
  // Verified 2026-06-27 via zh.wikipedia.org/Nissan_March + Nissan/Honda official
  // sources (see conversation log); BMW/Mercedes-Benz alphanumeric series names
  // (3系/X5/C级/GLC etc.) are handled generically in localize.js, not listed here.
  nissan: {
    '玛驰': 'March', // verified: zh.wikipedia.org "日产March", baike.baidu.com/item/玛驰
    '天籁': 'Teana',
    '轩逸': 'Sylphy',
    '骐达': 'Tiida',
    '逍客': 'Qashqai',
    '楼兰': 'Murano',
    '途达': 'Terra',
    '阳光': 'Sunny',
    '西玛': 'Cefiro',
    '奇骏': 'X-Trail',
    '骊威': 'Livina',
  },
  toyota: {
    '卡罗拉': 'Corolla',
    '威驰': 'Vios',
    '雅力士': 'Yaris',
    '汉兰达': 'Highlander',
    '普拉多': 'Land Cruiser Prado',
    '塞纳': 'Sienna',
    '海狮': 'Hiace',
    '海拉克斯': 'Hilux',
    '陆地巡洋舰': 'Land Cruiser',
  },
  honda: {
    '雅阁': 'Accord',
    '思域': 'Civic',
    '飞度': 'Fit',
    '缤智': 'HR-V',
    '凌派': 'Crider', // verified: ghac.cn/vehicles/crider (GAC Honda official), honda.com.cn/news/20130626.html
    '本田CR-V': 'CR-V',
  },
  hyundai: {
    '途胜': 'Tucson',
    '胜达': 'Santa Fe',
    '伊兰特': 'Elantra',
    '索纳塔': 'Sonata',
  },
  kia: {
    '智跑': 'Sportage',
    '索兰托': 'Sorento',
    '嘉华': 'Carnival',
  },
};

const FUEL_TYPE_ZH_TO_EN = {
  '汽油': 'Petrol',
  '柴油': 'Diesel',
  '混合动力': 'Hybrid',
  '插电式混合动力': 'Plug-in Hybrid',
  '纯电动': 'Electric',
  '油电混合': 'Hybrid',
};

// QXB `driver_type` free-text phrase -> AsiaPower drivetrain code.
const DRIVETRAIN_ZH_TO_CODE = {
  '前置前驱': '2WD',
  '前置后驱': 'RWD',
  '前置四驱': '4WD',
  '后置后驱': 'RWD',
  '中置后驱': 'RWD',
  '全时四驱': 'AWD',
  '分时四驱': '4WD',
};

module.exports = {
  BRAND_ZH_TO_EN,
  MODEL_ZH_TO_EN,
  FUEL_TYPE_ZH_TO_EN,
  DRIVETRAIN_ZH_TO_CODE,
};
