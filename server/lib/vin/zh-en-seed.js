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
  '华泰': 'Hawtai', // verified: hawtaimotor.com official site, en.wikipedia.org/wiki/Hawtai
  '华泰汽车': 'Hawtai',
  '五菱汽车': 'Wuling', // verified: en.wikipedia.org/wiki/Wuling_Motors
  '长安跨越': 'Changan Kuayue', // verified: caky.com.cn official site, en.wikipedia.org/wiki/Kuayue_Kuayuexing
  '沃尔沃': 'Volvo',
  '雪铁龙': 'Citroën',
  '东风雪铁龙': 'Citroën',
  '标致': 'Peugeot',
  '东风标致': 'Peugeot',
  '道奇': 'Dodge',
  '吉利': 'Geely',
  '吉利汽车': 'Geely', // QXB sometimes returns the full corporate name with "汽车" suffix
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
  '江汽集团': 'JAC', // verified: jac.com.cn official site self-identifies as "JAC GROUP江汽集团"
  '东风': 'Dongfeng',
  '一汽': 'FAW',
  '福田': 'Foton',
  '江铃': 'JMC',
  '大通': 'Maxus',
  '猎豹': 'Liebao',
  '猎豹汽车': 'Liebao',
  '克莱斯勒': 'Chrysler',
  '北京克莱斯勒': 'Chrysler',
  '吉普': 'Jeep',
  '路虎': 'Land Rover',
  '捷豹': 'Jaguar',
  '捷豹路虎': 'Land Rover',
  '宝骏': 'Baojun',
  '东风风光': 'Dongfeng Fengguang',
  '风光': 'Dongfeng Fengguang',
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
    '凯美瑞': 'Camry', // verified: zh.wikipedia.org/丰田凯美瑞, gac-toyota.com.cn official site
    '卡罗拉': 'Corolla',
    '威驰': 'Vios',
    '雅力士': 'Yaris',
    '汉兰达': 'Highlander',
    '普拉多': 'Land Cruiser Prado',
    '霸道': 'Land Cruiser Prado',
    '塞纳': 'Sienna',
    '海狮': 'Hiace',
    '海拉克斯': 'Hilux',
    '陆地巡洋舰': 'Land Cruiser',
    '兰德酷路泽': 'Land Cruiser',
    '兰德酷路泽(进口)': 'Land Cruiser',
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
    '胜达经典': 'Santa Fe', // verified: car.autohome.com.cn/baike — 胜达经典 is a Santa Fe trim, distinct series from 途胜/Tucson
    '伊兰特': 'Elantra',
    '悦动': 'Elantra',
    '索纳塔': 'Sonata',
    '御翔': 'Sonata', // verified: NF御翔 was renamed 索纳塔御翔 (Sonata trim), baike.baidu.com/北京现代SONATA·领翔
    '领翔': 'Sonata', // verified: successor trim to 御翔, both are Sonata generations
    '创虎': 'Xcient',
    '瑞越': 'Mighty',
  },
  kia: {
    '起亚K2': 'Rio', // verified: en.wikipedia.org/wiki/Kia_Rio — K2 is the China-market internal name for the international Rio
    '起亚K5': 'K5',
    '智跑': 'Sportage',
    '狮跑': 'Sportage',
    '索兰托': 'Sorento',
    '嘉华': 'Carnival',
    '赛拉图': 'Cerato', // verified: auto.sohu.com/20050525 "东风悦达起亚新车Cerato定名'赛拉图'" — NOT Seltos (a different, newer Kia SUV)
  },
  chery: {
    '瑞虎3': 'Tiggo 3', // verified: en.wikipedia.org/wiki/Chery_Tiggo_3 ("Chinese: 奇瑞瑞虎3")
  },
  buick: {
    '昂科雷': 'Enclave', // verified: baike.baidu.com/别克昂科雷 — NOT Envision (that's 昂科威, a different/smaller SUV)
    '英朗': 'Excelle GT',
    '凯越': 'Excelle',
    '君威': 'Regal',
    '君越': 'LaCrosse',
    '昂科威': 'Envision',
    'GL8': 'GL8',
  },
  chevrolet: {
    '赛欧': 'Sail', // verified: en.wikipedia.org/wiki/Chevrolet_Sail ("Chinese: 雪佛兰赛欧")
    '科鲁兹': 'Cruze',
    '迈锐宝': 'Malibu',
    '科帕奇': 'Captiva',
  },
  ford: {
    '福克斯': 'Focus',
    '福睿斯': 'Escort',
    '蒙迪欧': 'Mondeo',
    '翼虎': 'Kuga',
    '锐界': 'Edge',
  },
  volkswagen: {
    '朗逸': 'Lavida',
    '宝来': 'Bora',
    '捷达': 'Jetta',
    '速腾': 'Sagitar',
    '帕萨特': 'Passat',
    'Passat领驭': 'Passat Lingyu',
    '途观': 'Tiguan',
    '桑塔纳': 'Santana',
    '桑塔纳志俊': 'Santana Vista',
    'Polo': 'Polo',
    '尚酷': 'Scirocco',
    '途安': 'Touran',
    '凌渡': 'Lamando',
  },
  geely: {
    '帝豪': 'Emgrand',
    '经典帝豪': 'Emgrand',
    '帝豪GL': 'Emgrand GL',
    '博越': 'Boyue',
    '远景': 'Yuanjing',
  },
  haval: {
    'H6': 'H6',
    'H2': 'H2',
    'H6 Coupe': 'H6 Coupe',
  },
  mg: {
    '锐行': 'GT',
    '锐腾': 'GS',
    '名爵6': 'MG6',
    '名爵3': 'MG3',
  },
  changan: {
    '奔奔': 'Benben',
    '逸动': 'Eado',
    'CS75': 'CS75',
    'CS35': 'CS35',
  },
  'changan-kuayue': {
    '新豹MINI': 'Xinbao Mini',
    '新豹': 'Xinbao',
  },
  bmw: {
    '7系': '7 Series',
    '5系': '5 Series',
    '3系': '3 Series',
    'X5': 'X5',
    'X3': 'X3',
  },
  mazda: {
    '3(进口)': 'Mazda3',
    '3': 'Mazda3',
    '6': 'Mazda6',
    'CX-5': 'CX-5',
    'CX-9': 'CX-9',
  },
  liebao: {
    '猎豹CS10': 'CS10',
    'CS10': 'CS10',
  },
  byd: {
    '速锐': 'Surui',
    '秦': 'Qin',
    '唐': 'Tang',
    '宋': 'Song',
  },
  citroen: {
    '世嘉': 'C-Quatre',
    '爱丽舍': 'Elysee',
  },
  jac: {
    '瑞风M5': 'Refine M5',
    '瑞风': 'Refine',
  },
  dodge: {
    '酷威': 'Journey',
  },
  isuzu: {
    '巨咖': 'GIGA',
    '庆龄皮卡': 'Qingling Pickup',
  },
  sinotruk: {
    '豪瀚': 'Hohhan',
    '豪沃': 'HOWO',
  },
  hongyan: {
    '杰狮': 'Genlyon',
  },
  wuling: {
    '五菱宏光': 'Hongguang',
    '宏光': 'Hongguang',
    '五菱之光': 'Sunshine',
    '之光': 'Sunshine',
  },
  dongfeng: {
    '东风': 'Dongfeng',
  },
  'great-wall': {
    '风骏皮卡': 'Wingle',
    '风骏': 'Wingle',
  },
  mitsubishi: {
    '欧蓝德(进口)': 'Outlander', // verified: en.wikipedia.org/wiki/Mitsubishi_Outlander ("Chinese: 欧蓝德") — NOT Challenger
    '欧蓝德': 'Outlander',
  },
  peugeot: {
    '标致408': '408',
  },
  'land-rover': {
    '揽胜': 'Range Rover',
    '揽胜运动': 'Range Rover Sport',
    '揽胜运动版': 'Range Rover Sport',
    '揽胜极光': 'Range Rover Evoque',
    '发现': 'Discovery',
    '发现神行': 'Discovery Sport',
    '神行者': 'Freelander',
    '神行者2': 'Freelander 2',
    '卫士': 'Defender',
    '揽胜星脉': 'Range Rover Velar',
  },
  jaguar: {
    '捷豹XJ': 'XJ',
    '捷豹XF': 'XF',
    '捷豹XE': 'XE',
    '捷豹F-PACE': 'F-PACE',
    'F-PACE': 'F-PACE',
    'XJ': 'XJ',
    'XF': 'XF',
    'XE': 'XE',
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
