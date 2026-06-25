/**
 * AsiaPower — Public website language (EN default; ZH, FR, AR optional).
 * Does not apply to supplier portal or admin review.
 * Coverage: nav/footer/topbar/trust/whatsapp/home strings are translated for all
 * languages; other keys fall back to English where a translation is missing.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'asiapower.lang';
  const DEFAULT_LANG = 'en';
  const SUPPORTED_LANGS = ['en', 'zh', 'fr', 'ar'];
  const RTL_LANGS = ['ar'];
  const LANG_HTML_TAG = { en: 'en', zh: 'zh-CN', fr: 'fr', ar: 'ar' };

  const STRINGS = {
    'nav.home': { zh: '首页' , fr: 'Accueil', ar: 'الرئيسية' },
    'nav.brands': { zh: '乘用车' , fr: 'Voitures particulières', ar: 'السيارات الخاصة' },
    'nav.halfcuts': { zh: '半车' , fr: 'Demi-carcasses', ar: 'نصف مقطوعة' },
    'nav.truckheads': { zh: '卡车车头' , fr: 'Cabines de camion', ar: 'مقدمات الشاحنات' },
    'nav.trucks': { zh: '卡车' , fr: 'Camions', ar: 'شاحنات' },
    'nav.motorcycles': { zh: '摩托车' , fr: 'Motos', ar: 'دراجات نارية' },
    'nav.machinery': { zh: '工程机械' , fr: 'Engins de chantier', ar: 'معدات ثقيلة' },
    'nav.supplier': { zh: '供应商门户' , fr: 'Portail fournisseur', ar: 'بوابة المورد' },
    'nav.contact': { zh: '联系我们' , fr: 'Contact', ar: 'اتصل بنا' },
    'nav.requestQuote': { zh: '获取报价' , fr: 'Demander un devis', ar: 'طلب عرض سعر' },
    'trucks.subcatTruckHeads': { zh: '卡车车头与驾驶室 →' },
    'nav.openMenu': { zh: '打开菜单' , fr: 'Ouvrir le menu', ar: 'فتح القائمة' },
    'nav.closeMenu': { zh: '关闭菜单' , fr: 'Fermer le menu', ar: 'إغلاق القائمة' },
    'skipLink': { zh: '跳转到主要内容' },
    'topbar.badge': { zh: '全球动力总成采购' , fr: 'Plateforme mondiale d\'approvisionnement', ar: 'منصة عالمية لتوريد مجموعة نقل الحركة' },
    'topbar.tagline': { zh: '中国供应网络 → 全球买家' , fr: 'Réseau d\'approvisionnement chinois vers acheteurs mondiaux', ar: 'شبكة توريد من الصين إلى مشترين حول العالم' },
    'footer.ctaTitle': { zh: '需要全球发运的动力总成配件？' , fr: 'Besoin de pièces de groupe motopropulseur expédiées dans le monde ?', ar: 'بحاجة لشحن قطع غيار مجموعة نقل الحركة عالميًا؟' },
    'footer.ctaLead': { zh: '发送车辆详情 — 我们将在 24 小时内回复 FOB/CIF 报价。' , fr: 'Envoyez les détails du véhicule — nous répondons sous 24 heures avec un devis FOB/CIF.', ar: 'أرسل تفاصيل المركبة - سنرد خلال 24 ساعة بعرض سعر FOB/CIF.' },
    'footer.whatsapp': { zh: 'WhatsApp 联系' , fr: 'WhatsApp', ar: 'واتساب' },
    'footer.nav': { zh: '导航' , fr: 'Navigation', ar: 'التنقل' },
    'footer.startHere': { zh: '快速入口' , fr: 'Commencer ici', ar: 'ابدأ هنا' },
    'footer.brandDirectory': { zh: '品牌目录' , fr: 'Répertoire des marques', ar: 'دليل العلامات التجارية' },
    'footer.buyerGuides': { zh: '采购指南', fr: 'Guides d\'achat', ar: 'دليل الشراء' },
    'footer.supplierPortal': { zh: '供应商门户' , fr: 'Portail fournisseur', ar: 'بوابة المورد' },
    'footer.requestQuote': { zh: '获取报价' , fr: 'Demander un devis', ar: 'طلب عرض سعر' },
    'footer.contactUs': { zh: '联系我们' , fr: 'Contactez-nous', ar: 'اتصل بنا' },
    'footer.offices': { zh: '办公地址' , fr: 'Nos bureaux', ar: 'مكاتبنا' },
    'footer.about': {
      zh: 'AsiaPower 是全球动力总成采购平台 — 为进口商、维修厂和车队运营商对接中国验证供应网络，覆盖日系、韩系及中国品牌应用。',
      fr: 'AsiaPower est une plateforme mondiale d\'approvisionnement en groupes motopropulseurs — connectant importateurs, ateliers et opérateurs de flottes à un réseau d\'approvisionnement basé en Chine pour les applications de véhicules japonais, coréens et chinois.',
      ar: 'AsiaPower هي منصة عالمية لتوريد مجموعات نقل الحركة - تربط المستوردين وورش العمل ومشغلي الأساطيل بشبكة توريد مقرها الصين للتطبيقات اليابانية والكورية والصينية للمركبات.',
    },
    'footer.popularEngines': { zh: '热门发动机型号' , fr: 'Modèles de moteurs populaires', ar: 'موديلات المحركات الشائعة' },
    'footer.popularBrands': { zh: '热门品牌' , fr: 'Marques populaires', ar: 'العلامات التجارية الشائعة' },
    'footer.productCatalog': { zh: '产品目录' , fr: 'Catalogue produits', ar: 'كتالوج المنتجات' },
    'footer.rights': { zh: '版权所有。' , fr: 'Tous droits réservés.', ar: 'جميع الحقوق محفوظة.' },
    'footer.supplierReg': { zh: '供应商注册' , fr: 'Inscription fournisseur', ar: 'تسجيل المورد' },
    'whatsapp.label': { zh: 'WhatsApp 咨询' , fr: 'Discuter sur WhatsApp', ar: 'تحدث عبر واتساب' },
    'catalog.home': { zh: '首页' },
    'catalog.brands': { zh: '品牌' },
    'catalog.engines': { zh: '发动机' },
    'catalog.gearboxes': { zh: '变速箱' },
    'catalog.halfCuts': { zh: '半车' },
    'catalog.chassis': { zh: '底盘件' },
    'catalog.browseByBrand': { zh: '按品牌浏览' },
    'catalog.viewBrands': { zh: '查看品牌' },
    'home.eyebrow': { zh: '全球动力总成采购平台' , fr: 'Plateforme mondiale d\'approvisionnement en groupes motopropulseurs', ar: 'منصة عالمية لتوريد مجموعة نقل الحركة' },
    'home.title': { zh: '乘用车、卡车、摩托车与工程机械配件<br><em>源自中国，出口全球</em>' , fr: 'Pièces pour voitures, camions, motos et engins de chantier<br><em>Source en Chine. Exporté dans le monde entier.</em>', ar: 'قطع غيار للسيارات والشاحنات والدراجات النارية والمعدات الثقيلة<br><em>المصدر من الصين. التصدير لجميع أنحاء العالم.</em>' },
    'home.lead': {
      zh: 'AsiaPower 为全球进口商、维修厂和车队运营商对接中国供应网络 — 提供发动机、变速箱、底盘件及定制拆解半车，覆盖乘用车、卡车、摩托车与工程机械。',
      fr: 'AsiaPower connecte les importateurs, ateliers et opérateurs de flottes du monde entier à un réseau d\'approvisionnement basé en Chine couvrant moteurs, boîtes de vitesses, pièces de châssis et demi-carcasses sur mesure — pour voitures particulières, camions, motos et engins de chantier.',
      ar: 'تربط AsiaPower المستوردين وورش العمل ومشغلي الأساطيل حول العالم بشبكة توريد مقرها الصين تشمل المحركات وعلب التروس وقطع الشاسيه والتفكيك المخصص (نصف مقطوعة) - للسيارات الخاصة والشاحنات والدراجات النارية والمعدات الثقيلة.',
    },
    'home.productLines': { zh: '产品线' , fr: 'Lignes de produits', ar: 'خطوط المنتجات' },
    'home.truckHeadsAvail': { zh: '卡车车头 / 驾驶室' , fr: 'Cabines de camion', ar: 'مقدمات/كبائن الشاحنات' },
    'home.truckHeadQuote': { zh: '索取卡车车头报价' , fr: 'Demander un devis pour cabine de camion', ar: 'طلب عرض سعر لمقدمة شاحنة' },
    'home.whatsappTruck': { zh: 'WhatsApp 发送卡车需求' , fr: 'Envoyer une demande de camion sur WhatsApp', ar: 'إرسال طلب شاحنة عبر واتساب' },
    'home.requestQuoteCta': { zh: '索取报价' , fr: 'Demander un devis', ar: 'طلب عرض سعر' },
    'home.whatsappGeneral': { zh: 'WhatsApp 联系我们' , fr: 'Discuter avec nous sur WhatsApp', ar: 'تحدث معنا عبر واتساب' },
    'home.requestQuote': { zh: '索取报价' , fr: 'Demander un devis', ar: 'طلب عرض سعر' },
    'trust.block': { zh: '适用时可提供拆解前整车启动视频。客户确认后可按买方要求拆解部件。', fr: 'Vidéo de démarrage du véhicule complet disponible avant démontage. Les pièces peuvent être démontées selon les exigences de l\'acheteur après confirmation.', ar: 'فيديو تشغيل المركبة الكاملة متاح قبل التفكيك. يمكن تفكيك القطع حسب متطلبات المشتري بعد التأكيد.' },
    'trust.startupVideo': { zh: '适用时可提供拆解前整车启动视频。' , fr: 'Vidéo de démarrage du véhicule complet disponible avant démontage.', ar: 'فيديو تشغيل المركبة الكاملة متاح قبل التفكيك.' },
    'trust.buyerDismantle': { zh: '客户确认后可按买方要求拆解部件。' , fr: 'Les pièces peuvent être démontées selon les exigences de l\'acheteur après confirmation.', ar: 'يمكن تفكيك القطع حسب متطلبات المشتري بعد التأكيد.' },
    'home.capabilityTitle': { zh: '规模化全球采购' , fr: 'Approvisionnement mondial à grande échelle', ar: 'توريد عالمي على نطاق واسع' },
    'home.enginesAvail': { zh: '可用发动机', fr: 'Moteurs disponibles', ar: 'محركات متوفرة' },
    'home.gearboxesAvail': { zh: '可用变速箱' , fr: 'Boîtes de vitesses disponibles', ar: 'علب تروس متوفرة' },
    'home.halfCutsAvail': { zh: '可用半车' , fr: 'Demi-carcasses disponibles', ar: 'نصف مقطوعة متوفرة' },
    'home.exportNetwork': { zh: '全球出口网络' , fr: 'Réseau d\'exportation mondial', ar: 'شبكة تصدير عالمية' },
    'home.marketsLabel': { zh: '目标市场' , fr: 'Marchés cibles', ar: 'الأسواق المستهدفة' },
    'home.whatsappQuote': { zh: 'WhatsApp 获取报价' , fr: 'Devis sur WhatsApp', ar: 'عرض سعر عبر واتساب' },
    'home.browseBrands': { zh: '浏览品牌' , fr: 'Parcourir les marques', ar: 'تصفح العلامات التجارية' },
    'brands.label': { zh: '主要入口' },
    'brands.title': { zh: '品牌目录' },
    'brands.lead': {
      zh: '选择车辆品牌，查看发动机、变速箱、底盘件及半车。AsiaPower 通过中国验证供应网络采购日系、韩系、中美欧多品牌应用。',
    },
    'brands.vehicleBrands': { zh: '车辆品牌' },
    'brands.productLines': { zh: '产品线' },
    'brands.globalExport': { zh: '全球出口' },
    'engines.title': { zh: '发动机型号目录' },
    'engines.lead': { zh: '按品牌分组的公开发动机型号目录。适用时可提供拆解前整车启动视频。可索取 FOB/CIF 报价。' },
    'engines.countLabel': { zh: '个发动机型号' },
    'engines.allBrands': { zh: '全部品牌' },
    'engines.petrol': { zh: '汽油' },
    'engines.diesel': { zh: '柴油' },
    'engines.hybrid': { zh: '混动' },
    'catalog.popularBrands': { zh: '热门品牌' },
    'catalog.searchEngines': { zh: '搜索发动机代号、品牌或适用车型…' },
    'catalog.searchGearboxes': { zh: '搜索变速箱代号、品牌或车型…' },
    'catalog.searchChassis': { zh: '搜索底盘平台、品牌或适用车型…' },
    'catalog.noMatch': { zh: '没有符合搜索条件的条目。' },
    'gearboxes.title': { zh: '变速箱目录' },
    'gearboxes.lead': { zh: '自动、手动、CVT 及四驱变速箱，支持全球出口。按品牌浏览或索取 FOB/CIF 报价。' },
    'gearboxes.catalogLabel': { zh: '公开变速箱目录' },
    'gearboxes.all': { zh: '全部' },
    'gearboxes.automatic': { zh: '自动' },
    'gearboxes.manual': { zh: '手动' },
    'gearboxes.cvt': { zh: 'CVT' },
    'gearboxes.4wd': { zh: '四驱' },
    'gearboxes.countLabel': { zh: '个变速箱型号' },
    'gearboxes.countUnit': { zh: '变速箱型号' },
    'gearboxes.inventorySection': { zh: '半切库存参考' },
    'chassis.title': { zh: '底盘件目录' },
    'chassis.lead': { zh: '悬架、转向、制动、车桥及差速器 — 按品牌采购，支持全球出口。' },
    'chassis.catalogLabel': { zh: '公开底盘件目录' },
    'chassis.suspension': { zh: '悬架' },
    'chassis.steering': { zh: '转向' },
    'chassis.brakes': { zh: '制动' },
    'chassis.drivetrain': { zh: '传动系统' },
    'chassis.countLabel': { zh: '个底盘平台' },
    'chassis.countUnit': { zh: '底盘平台' },
    'chassis.inventorySection': { zh: '半切库存参考' },
    'chassis.browseLead': { zh: '查看该品牌全部底盘件分类。' },
    'halfcuts.title': { zh: '半车目录' },
    'halfcuts.lead': {
      zh: '按品牌、车型、发动机代号、变速箱代号或库存编号搜索半车。适用时可提供拆解前整车启动视频；客户确认后可按买方要求拆解部件。',
    },
    'halfcuts.browseLead': { zh: '查看该品牌全部半车选项。' },
    'trucks.title': { zh: '卡车' },
    'trucks.lead': { zh: '轻中重卡车头、驾驶室及拆车件 — 亚洲及欧洲品牌。适用时可提供拆解前整车启动视频。支持 FOB/CIF 全球出口。' },
    'trucks.ctaTitle': { zh: '需要卡车库存？' },
    'trucks.ctaLead': { zh: '发送品牌、车型及数量需求，24 小时内回复 FOB/CIF 报价。' },
    'trucks.searchPlaceholder': { zh: '搜索库存编号、品牌、车型、发动机或变速箱…' },
    'trucks.units': { zh: '台卡车' },
    'trucks.noMatch': { zh: '没有符合搜索条件的卡车。' },
    'trucks.empty': { zh: '暂无卡车库存，请联系我们采购。' },
    'trucks.halfCut': { zh: '卡车半车' },
    'trucks.allTrucks': { zh: '全部卡车' },
    'trucks.truckHeadUnits': { zh: '车头 / 半车' },
    'trucks.truckCabUnits': { zh: '驾驶室' },
    'trucks.driverCab': { zh: '驾驶室' },
    'trucks.supplierUpload': { zh: '供应商上传卡车库存' },
    'trucks.supplierUploadHint': { zh: '合作供应商？上传卡车半车照片与车辆信息，提交 AsiaPower 审核。' },
    'truckheads.title': { zh: '二手卡车车头及驾驶室出口' },
    'truckheads.lead': { zh: '日野、五十铃、扶桑、UD、豪沃、重汽等商用车车头及驾驶室。适用时提供拆解前整车启动视频，确认后可按客户要求拆解。' },
    'truckheads.brandsEyebrow': { zh: '商用车品牌' },
    'truckheads.brandsTitle': { zh: '卡车车头与驾驶室采购' },
    'truckheads.brandsLead': { zh: '请提供品牌、型号、年份、发动机号、驾驶室类型、底盘号、目的国及数量，以便 FOB/CIF 报价。' },
    'truckheads.ctaTitle': { zh: '需要二手卡车车头或驾驶室？' },
    'truckheads.ctaLead': { zh: 'AsiaPower 从中国供应渠道采购商用车车头及驾驶室。发送需求 — 24 小时内回复。' },
    'motorcycles.title': { zh: '摩托车' },
    'motorcycles.lead': { zh: '日系及中国品牌摩托车半车、发动机及配件 — 面向非洲、东南亚及中东出口。' },
    'motorcycles.ctaTitle': { zh: '需要摩托车库存？' },
    'motorcycles.ctaLead': { zh: '发送品牌、排量及数量需求，24 小时内回复报价。' },
    'machinery.title': { zh: '工程机械' },
    'machinery.lead': { zh: '装载机、挖掘机、推土机等工程机械 — 出口现货，部分库存含发动机启动视频。龙工、徐工、三一、临工、柳工及国际品牌。' },
    'machinery.ctaTitle': { zh: '需要工程机械库存？' },
    'machinery.ctaLead': { zh: '发送设备类型、品牌及数量需求，24 小时内回复 FOB/CIF 报价。' },
    'machinery.searchPlaceholder': { zh: '搜索库存编号、龙工、装载机、挖掘机、发动机号…' },
    'machinery.listings': { zh: '条工程机械' },
    'machinery.empty': { zh: '该分类暂无工程机械库存，请联系我们采购。' },
    'machinery.allTypes': { zh: '全部类型' },
    'machinery.allMachinery': { zh: '全部工程机械' },
    'machinery.equipment': { zh: '工程机械' },
    'machinery.equipmentType': { zh: '设备类型' },
    'machinery.hours': { zh: '工时 / 里程' },
    'machinery.popularBrands': { zh: '热门品牌' },
    'machinery.noMatch': { zh: '没有符合搜索条件的工程机械。' },
    'catalog.comingSoonEyebrow': { zh: '即将上线' },
    'catalog.comingSoonTitle': { zh: '敬请期待' },
    'catalog.comingSoonLead': { zh: '该栏目正在筹备中，即将开放。您可先浏览半车库存，或通过 WhatsApp 联系我们。' },
    'catalog.or': { zh: '或' },
    'hc.searchPlaceholder': { zh: '搜索库存编号、品牌、车型、发动机或变速箱…' },
    'hc.brand': { zh: '品牌' },
    'hc.allBrands': { zh: '全部品牌' },
    'hc.all': { zh: '全部' },
    'hc.available': { zh: '现货' },
    'hc.reserved': { zh: '预留' },
    'hc.inTransit': { zh: '在途' },
    'hc.sold': { zh: '已售' },
    'hc.showing': { zh: '显示' },
    'hc.of': { zh: '共' },
    'hc.halfCuts': { zh: '台半车' },
    'hc.photosOnRequest': { zh: '照片备索' },
    'hc.noMatch': { zh: '没有匹配的半车。' },
    'hc.sendRequest': { zh: '发送您的需求' },
    'spec.brand': { zh: '品牌' },
    'spec.model': { zh: '车型' },
    'spec.year': { zh: '年份' },
    'spec.engine': { zh: '发动机' },
    'spec.transmission': { zh: '变速箱' },
    'spec.mileage': { zh: '里程' },
    'spec.vin': { zh: 'VIN' },
    'hc.inventoryDisclaimer': { zh: '适用时可提供拆解前整车启动视频。客户确认后可按买方要求拆解部件。库存以最终确认为准。照片、价格及运费均在询价后确认。' },
    'hc.inventoryDisclaimerBase': { zh: '库存以最终确认为准。照片、价格及运费均在询价后确认。' },
    'hc.viewDetails': { zh: '查看详情' },
    'hc.requestPrice': { zh: '索取价格' },
    'hc.requestPhotos': { zh: '索取照片' },
    'hc.checkAvailability': { zh: '确认现货' },
    'hc.requestSimilar': { zh: '索取类似车源' },
    'hc.photos': { zh: '照片' },
    'hc.video': { zh: '视频' },
    'hc.videoMovFallback': { zh: 'QuickTime (.mov) 视频可能无法在本浏览器内播放。' },
    'hc.videoDownload': { zh: '下载视频' },
    'hc.videoMp4Hint': { zh: '建议供应商上传 MP4 格式以获得最佳兼容性。' },
    'hc.fobPrice': { zh: '离岸价' },
    'hc.priceOnEnquiry': { zh: '离岸价询价' },
    'spec.fobPrice': { zh: '离岸价（美元）' },
    'home.whyEyebrow': { zh: '为什么选择 AsiaPower' , fr: 'Pourquoi AsiaPower', ar: 'لماذا AsiaPower' },
    'home.whyTitle': { zh: '为专业全球贸易而生' , fr: 'Conçu pour le commerce mondial professionnel', ar: 'مصمم للتجارة العالمية المتخصصة' },
    'home.pillar1Title': { zh: '可信赖' , fr: 'Confiance', ar: 'الثقة' },
    'home.pillar1Desc': { zh: '适用时可提供拆解前整车启动视频，附照片及出口单证。客户确认后可按买方要求拆解部件。', fr: 'Vidéo de démarrage du véhicule complet disponible avant démontage, ainsi que photos et documentation d\'exportation. Les pièces peuvent être démontées selon les exigences de l\'acheteur après confirmation.', ar: 'فيديو تشغيل المركبة الكاملة متاح قبل التفكيك، إلى جانب الصور ووثائق التصدير. يمكن تفكيك القطع حسب متطلبات المشتري بعد التأكيد.' },
    'home.pillar2Title': { zh: '规模' , fr: 'Échelle', ar: 'النطاق' },
    'home.pillar2Desc': { zh: '已向 110+ 国家出口 6,000+ 台套。支持单台 LCL 与整柜批量采购。' , fr: 'Plus de 6 000 unités exportées dans plus de 110 pays. Programmes conteneur et LCL pour acheteurs à l\'unité ou en volume.', ar: 'تم تصدير أكثر من 6000 وحدة إلى أكثر من 110 دولة. برامج الحاويات وLCL للمشترين بالوحدة أو بالجملة.' },
    'home.pillar3Title': { zh: '供应网络' , fr: 'Réseau de fournisseurs', ar: 'شبكة الموردين' },
    'home.pillar3Desc': { zh: '200+ 验证供应商覆盖日本、韩国及中国 — 经郑州出口渠道整合。' , fr: 'Plus de 200 fournisseurs vérifiés au Japon, en Corée et en Chine — regroupés via des canaux d\'exportation basés à Zhengzhou.', ar: 'أكثر من 200 مورد موثّق في اليابان وكوريا والصين - مجمّعة عبر قنوات تصدير مقرها تشنغتشو.' },
    'home.pillar4Title': { zh: '全球出口' , fr: 'Exportation mondiale', ar: 'تصدير عالمي' },
    'home.pillar4Desc': { zh: 'FOB/CIF 发运至非洲、美洲、加勒比、中东、东南亚及澳洲。专业出口包装与物流。' , fr: 'Expédition FOB et CIF vers l\'Afrique, les Amériques, les Caraïbes, le Moyen-Orient, l\'Asie du Sud-Est et l\'Australie. Emballage et logistique d\'exportation complets.', ar: 'شحن FOB وCIF إلى أفريقيا والأمريكتين والكاريبي والشرق الأوسط وجنوب شرق آسيا وأستراليا. تعبئة وخدمات لوجستية تصدير كاملة.' },
    'home.pillar5Title': { zh: '专业采购' , fr: 'Approvisionnement professionnel', ar: 'توريد متخصص' },
    'home.pillar5Desc': { zh: '24 小时内 B2B 报价。批量价格、客户管理及稳定复购供应。' , fr: 'Devis B2B dédié sous 24 heures. Tarification au volume, gestion de compte et approvisionnement constant pour acheteurs récurrents.', ar: 'عرض سعر B2B مخصص في غضون 24 ساعة. تسعير بالجملة، وإدارة حسابات، وتوريد ثابت للمشترين المتكررين.' },
    'home.modelEyebrow': { zh: '商业模式' , fr: 'Modèle économique', ar: 'نموذج الأعمال' },
    'home.modelTitle': { zh: 'AsiaPower 如何运作' , fr: 'Comment fonctionne AsiaPower', ar: 'كيف تعمل AsiaPower' },
    'home.modelLead': { zh: '中国采购平台 — 非零售门店。我们整合供应、检验品质并出口至全球买家。' , fr: 'Plateforme d\'approvisionnement en Chine — pas un magasin de détail. Nous consolidons l\'approvisionnement, inspectons la qualité et exportons vers des acheteurs du monde entier.', ar: 'منصة توريد في الصين - ليست متجر تجزئة. نقوم بتوحيد التوريد وفحص الجودة والتصدير للمشترين حول العالم.' },
    'home.model1Title': { zh: '中国供应网络' , fr: 'Réseau d\'approvisionnement chinois', ar: 'شبكة التوريد الصينية' },
    'home.model1Desc': { zh: '验证拆解场与出口商，经郑州及沿海枢纽整合。' , fr: 'Casses et exportateurs vérifiés, regroupés via Zhengzhou et les hubs côtiers.', ar: 'مفككات ومصدّرون موثّقون، مجمّعون عبر تشنغتشو والمحاور الساحلية.' },
    'home.model2Title': { zh: '车辆应用' , fr: 'Applications véhicules', ar: 'تطبيقات المركبات' },
    'home.model2Desc': { zh: '日系、韩系及中国品牌 — 支持 Toyota、Hyundai、BYD、Honda、Nissan 等 30+ 品牌。' , fr: 'Marques japonaises, coréennes et chinoises — plus de 30 marques prises en charge dont Toyota, Hyundai, BYD, Honda, Nissan.', ar: 'العلامات التجارية اليابانية والكورية والصينية - أكثر من 30 علامة تجارية مدعومة تشمل Toyota و Hyundai و BYD و Honda و Nissan.' },
    'home.model3Title': { zh: '全球买家' , fr: 'Acheteurs mondiaux', ar: 'مشترون حول العالم' },
    'home.model3Desc': { zh: '非洲、美洲、加勒比、中东、东南亚及澳洲的进口商、维修厂、车队及经销商。' , fr: 'Importateurs, ateliers, flottes et concessionnaires en Afrique, dans les Amériques, les Caraïbes, au Moyen-Orient, en Asie du Sud-Est et en Australie.', ar: 'مستوردون وورش عمل وأساطيل ووكلاء في أفريقيا والأمريكتين والكاريبي والشرق الأوسط وجنوب شرق آسيا وأستراليا.' },
    'home.supplyEyebrow': { zh: '供应范围' , fr: 'Ce que nous fournissons', ar: 'ما الذي نوفره' },
    'home.supplyTitle': { zh: '四大产品线 · 一个采购平台' , fr: 'Quatre lignes de produits. Une plateforme d\'approvisionnement.', ar: 'أربعة خطوط منتجات. منصة توريد واحدة.' },
    'home.supplyLead': { zh: 'AsiaPower 不是电商目录。按品牌浏览发动机、变速箱、底盘件及定制拆解 — 或联系我们定制商用车采购。' , fr: 'AsiaPower n\'est pas un catalogue e-commerce. Parcourez moteurs, boîtes de vitesses, pièces de châssis et démontage sur mesure par marque — ou contactez-nous pour un approvisionnement de véhicules commerciaux personnalisé.', ar: 'AsiaPower ليست كتالوج تجارة إلكترونية. تصفح المحركات وعلب التروس وقطع الشاسيه والتفكيك المخصص حسب العلامة التجارية - أو اتصل بنا لتوريد مركبات تجارية مخصصة.' },
    'home.catEngines': { zh: '发动机' , fr: 'Moteurs', ar: 'محركات' },
    'home.catEnginesDesc': { zh: '汽油、柴油及混动。适用时可提供拆解前整车启动视频，附出口单证。' , fr: 'Unités essence, diesel et hybrides. Vidéo de démarrage du véhicule complet disponible avant démontage, avec documentation d\'exportation.', ar: 'وحدات بنزين وديزل وهجينة. فيديو تشغيل المركبة الكاملة متاح قبل التفكيك، مع وثائق التصدير.' },
    'home.catGearboxes': { zh: '变速箱' , fr: 'Boîtes de vitesses', ar: 'علب التروس' },
    'home.catGearboxesDesc': { zh: '自动、手动、CVT 及四驱。换挡测试，出口包装。' , fr: 'Automatiques, manuelles, CVT et 4WD. Testées au passage de vitesses et conditionnées pour l\'export.', ar: 'أوتوماتيكية ويدوية وCVT ودفع رباعي. مختبرة التعشيق ومعبأة للتصدير.' },
    'home.catChassis': { zh: '底盘件' , fr: 'Pièces de châssis', ar: 'قطع الشاسيه' },
    'home.catChassisDesc': { zh: '悬架、转向、制动、车桥及差速器，按应用采购。' , fr: 'Suspension, direction, freins, essieux et différentiels selon l\'application.', ar: 'التعليق والتوجيه والمكابح والمحاور والتفاضلية حسب التطبيق.' },
    'home.catHalfCuts': { zh: '定制拆解（半车）' , fr: 'Démontage sur mesure (demi-carcasses)', ar: 'تفكيك مخصص (نصف مقطوعة)' },
    'home.catHalfCutsDesc': { zh: '按买家要求拆解的前切、后切、鼻切及完整半车，用于翻新与拆解项目。' , fr: 'Coupes avant, arrière, avant complet et carcasses entières démontées selon les spécifications de l\'acheteur pour la reconstruction et l\'extraction.', ar: 'قطع أمامية وخلفية وكاملة مفككة حسب مواصفات المشتري لمشاريع إعادة البناء والاستخراج.' },
    'home.viewCategory': { zh: '查看目录 →' , fr: 'Voir la catégorie →', ar: 'عرض الفئة ←' },
    'home.brandsEyebrow': { zh: '从这里开始' , fr: 'Commencez ici', ar: 'ابدأ من هنا' },
    'home.brandsTitle': { zh: '支持品牌' , fr: 'Marques prises en charge', ar: 'العلامات التجارية المدعومة' },
    'home.brandsLead': { zh: '品牌是主要入口。选择车辆品牌，查看该品牌的发动机、变速箱、底盘件及半车。' , fr: 'La marque est le point d\'entrée principal. Choisissez la marque du véhicule pour voir ses moteurs, boîtes de vitesses, pièces de châssis et demi-carcasses.', ar: 'العلامة التجارية هي نقطة الدخول الرئيسية. اختر علامة المركبة لعرض محركاتها وعلب تروسها وقطع شاسيها ونصف مقطوعاتها.' },
    'home.viewAllBrands': { zh: '查看全部 50+ 品牌' , fr: 'Voir toutes les 50+ marques', ar: 'عرض جميع العلامات التجارية (+50)' },
    'home.processEyebrow': { zh: '采购流程' , fr: 'Processus d\'approvisionnement', ar: 'عملية التوريد' },
    'home.processTitle': { zh: '从询价到全球交付' , fr: 'De la demande à la livraison mondiale', ar: 'من الاستعلام إلى التسليم العالمي' },
    'home.process1Title': { zh: '选择品牌与产品' , fr: 'Choisir la marque et le produit', ar: 'اختيار العلامة التجارية والمنتج' },
    'home.process1Desc': { zh: '浏览品牌目录，或发送车辆品牌、车型、年份及发动机代号。' , fr: 'Parcourez le répertoire des marques ou envoyez la marque, le modèle, l\'année et le code moteur du véhicule.', ar: 'تصفح دليل العلامات التجارية أو أرسل العلامة التجارية والموديل والسنة ورمز المحرك.' },
    'home.process2Title': { zh: '获取报价' , fr: 'Obtenir un devis', ar: 'الحصول على عرض سعر' },
    'home.process2Desc': { zh: '24 小时内 FOB/CIF 报价。适用时可提供拆解前整车启动视频。' , fr: 'Devis FOB/CIF sous 24 heures. Vidéo de démarrage du véhicule complet disponible avant démontage le cas échéant.', ar: 'عرض سعر FOB/CIF خلال 24 ساعة. فيديو تشغيل المركبة الكاملة متاح قبل التفكيك عند الإمكان.' },
    'home.process3Title': { zh: '检验与确认' , fr: 'Inspection et confirmation', ar: 'الفحص والتأكيد' },
    'home.process3Desc': { zh: '从供应网络调货。启动视频、照片及客户确认后按需拆解。' , fr: 'Approvisionnement depuis le réseau de fournisseurs. Vidéo de démarrage, photos et démontage selon besoin après confirmation de l\'acheteur.', ar: 'التوريد من شبكة الموردين. فيديو التشغيل والصور والتفكيك حسب الحاجة بعد تأكيد المشتري.' },
    'home.process4Title': { zh: '出口发运' , fr: 'Expédition à l\'export', ar: 'شحن التصدير' },
    'home.process4Desc': { zh: '专业包装及完整出口单证。整柜或 LCL 至目的港。' , fr: 'Emballage professionnel et documentation d\'exportation complète. Conteneur complet ou LCL vers le port de destination.', ar: 'تعبئة متخصصة ووثائق تصدير كاملة. حاوية كاملة أو LCL إلى ميناء الوجهة.' },
    'home.reachEyebrow': { zh: '全球覆盖' , fr: 'Portée mondiale', ar: 'الانتشار العالمي' },
    'home.reachTitle': { zh: '服务全球买家' , fr: 'Au service des acheteurs du monde entier', ar: 'خدمة المشترين حول العالم' },
    'home.reachLead': { zh: 'AsiaPower 从中国向六大出口区域发货 — 覆盖非洲各国及美洲、加勒比、中东、东南亚与澳洲。郑州（中国）及阿克拉（加纳）办公室支持全球沟通。' , fr: 'AsiaPower exporte de la Chine vers des importateurs et opérateurs de flottes dans six grandes régions — tous les pays d\'Afrique ainsi que les Amériques, les Caraïbes, le Moyen-Orient, l\'Asie du Sud-Est et l\'Australie. Des bureaux à Zhengzhou (Chine) et Accra (Ghana) soutiennent la communication mondiale.', ar: 'تصدّر AsiaPower من الصين إلى المستوردين ومشغلي الأساطيل في ست مناطق رئيسية - جميع دول أفريقيا بالإضافة إلى الأمريكتين والكاريبي والشرق الأوسط وجنوب شرق آسيا وأستراليا. تدعم المكاتب في تشنغتشو (الصين) وأكرا (غانا) التواصل العالمي.' },
    'home.regionAfrica': { zh: '非洲' , fr: 'Afrique', ar: 'أفريقيا' },
    'home.regionAmericas': { zh: '美洲' , fr: 'Amériques', ar: 'الأمريكتين' },
    'home.regionCaribbean': { zh: '加勒比' , fr: 'Caraïbes', ar: 'الكاريبي' },
    'home.regionMiddleEast': { zh: '中东' , fr: 'Moyen-Orient', ar: 'الشرق الأوسط' },
    'home.regionSoutheastAsia': { zh: '东南亚' , fr: 'Asie du Sud-Est', ar: 'جنوب شرق آسيا' },
    'home.regionAustralia': { zh: '澳洲' , fr: 'Australie', ar: 'أستراليا' },
    'home.marketIntro': { zh: '我们的出口市场覆盖：' , fr: 'Notre couverture export s\'étend sur :', ar: 'يمتد نطاق تصديرنا إلى:' },
    'home.statCountries': { zh: '国家及地区' , fr: 'Pays et territoires', ar: 'دول وأقاليم' },
    'home.statPopulation': { zh: '合计人口' , fr: 'Population combinée', ar: 'إجمالي السكان' },
    'home.statVehicles': { zh: '机动车保有量' , fr: 'Véhicules à moteur immatriculés', ar: 'مركبات مسجلة' },
    'home.statMarket': { zh: '估算年度售后市场规模' , fr: 'Demande estimée du marché de rechange annuel', ar: 'الطلب التقديري السنوي لسوق ما بعد البيع' },
    'home.marketNote': { zh: '数据为基于公开人口、车辆登记及汽车售后行业资料的近似区域合计。' , fr: 'Totaux régionaux approximatifs basés sur des données publiques de population, d\'immatriculation de véhicules et de l\'industrie du marché de rechange automobile.', ar: 'إجماليات إقليمية تقريبية مستندة إلى بيانات عامة عن السكان وتسجيل المركبات وصناعة سوق ما بعد البيع.' },
    'home.faqEyebrow': { zh: '常见问题' , fr: 'FAQ', ar: 'الأسئلة الشائعة' },
    'home.faqTitle': { zh: '常见问题' , fr: 'Questions fréquentes', ar: 'الأسئلة المتكررة' },
    'home.faq1Q': { zh: 'AsiaPower 是什么？' , fr: 'Qu\'est-ce qu\'AsiaPower ?', ar: 'ما هي AsiaPower؟' },
    'home.faq1A': { zh: 'AsiaPower 是全球动力总成采购平台 — 非零售汽配店。我们为 B2B 买家对接中国供应网络，覆盖日系、韩系及中国品牌，并提供检验、出口单证及国际运输。' , fr: 'AsiaPower est une plateforme mondiale d\'approvisionnement en groupes motopropulseurs — pas un magasin de détail. Nous connectons les acheteurs B2B à un réseau d\'approvisionnement basé en Chine pour les applications de véhicules japonais, coréens et chinois, en gérant l\'inspection, la documentation d\'exportation et l\'expédition internationale.', ar: 'AsiaPower هي منصة عالمية لتوريد مجموعات نقل الحركة - ليست متجر تجزئة. نربط مشتري B2B بشبكة توريد مقرها الصين للتطبيقات اليابانية والكورية والصينية للمركبات، مع التعامل مع الفحص ووثائق التصدير والشحن الدولي.' },
    'home.faq2Q': { zh: '如何找到我车辆品牌的配件？' , fr: 'Comment trouver des pièces pour la marque de mon véhicule ?', ar: 'كيف أجد قطع غيار لعلامة مركبتي؟' },
    'home.faq2A': { zh: '从品牌页开始。选择车辆品牌（例如 Toyota），浏览该品牌的发动机、变速箱、底盘件及半车。发送报价请求并附上发动机代号或 VIN 以便精准采购。' , fr: 'Commencez par notre page Marques. Sélectionnez la marque de votre véhicule — par exemple Toyota — puis parcourez les moteurs, boîtes de vitesses, pièces de châssis et demi-carcasses pour cette marque. Envoyez une demande de devis avec votre code moteur ou VIN pour un approvisionnement précis.', ar: 'ابدأ من صفحة العلامات التجارية. اختر علامة مركبتك - مثل Toyota - ثم تصفح المحركات وعلب التروس وقطع الشاسيه ونصف المقطوعة لهذه العلامة. أرسل طلب عرض سعر مع رمز المحرك أو رقم الهيكل (VIN) للحصول على توريد دقيق.' },
    'home.faq3Q': { zh: '是否支持国际运输？' , fr: 'Expédiez-vous à l\'international ?', ar: 'هل تشحنون دوليًا؟' },
    'home.faq3A': { zh: '支持。我们提供 FOB/CIF 发运至全球港口，包括非洲、美洲、加勒比、中东、东南亚及澳洲。所有订单规模均支持整柜及 LCL。' , fr: 'Oui. Nous proposons une expédition FOB et CIF vers des ports du monde entier, y compris l\'Afrique, les Amériques, les Caraïbes, le Moyen-Orient, l\'Asie du Sud-Est et l\'Australie. Options conteneur et LCL disponibles pour toutes les tailles de commande.', ar: 'نعم. نقدم شحن FOB وCIF إلى موانئ حول العالم بما في ذلك أفريقيا والأمريكتين والكاريبي والشرق الأوسط وجنوب شرق آسيا وأستراليا. خيارات الحاويات وLCL متاحة لجميع أحجام الطلبات.' },
    'home.ctaTitle': { zh: '准备采购动力总成配件？' , fr: 'Prêt à vous approvisionner en pièces de groupe motopropulseur ?', ar: 'هل أنت مستعد لتوريد قطع مجموعة نقل الحركة؟' },
    'home.ctaLead': { zh: '发送您的需求 — 24 小时内提供有竞争力的 FOB/CIF 报价。' , fr: 'Envoyez vos besoins — devis FOB/CIF compétitif sous 24 heures.', ar: 'أرسل متطلباتك - عرض سعر FOB/CIF تنافسي خلال 24 ساعة.' },
    'home.contactTeam': { zh: '联系采购团队' , fr: 'Contacter l\'équipe d\'approvisionnement', ar: 'التواصل مع فريق التوريد' },
    'home.enginesAvail': { zh: '发动机库存', fr: 'Moteurs disponibles', ar: 'محركات متوفرة' },
    'home.gearboxesAvail': { zh: '变速箱库存' , fr: 'Boîtes de vitesses disponibles', ar: 'علب تروس متوفرة' },
    'home.halfCutsAvail': { zh: '半车资源' , fr: 'Demi-carcasses disponibles', ar: 'نصف مقطوعة متوفرة' },
    'brands.searchPlaceholder': { zh: '搜索品牌或发动机型号（如 G4KD、2TR、K24A）…' },
    'brands.showing': { zh: '显示' },
    'brands.of': { zh: '共' },
    'brands.brandsWord': { zh: '个品牌' },
    'brands.featuredEyebrow': { zh: '重点渠道' },
    'brands.featuredTitle': { zh: '重点品牌' },
    'brands.featuredLead': { zh: '高出货量采购渠道，专属供应商对接、更快报价及出口方案。' },
    'brands.allEyebrow': { zh: '全面覆盖' },
    'brands.allTitle': { zh: '全部支持品牌' },
    'brands.allLead': { zh: '全球动力总成采购完整品牌索引 — 选择任意品牌索取发动机、变速箱、底盘件或半车。' },
    'catalog.browseLeadEngines': { zh: '从品牌目录开始，浏览发动机、变速箱、底盘件及半车。' },
    'catalog.browseLeadGearboxes': { zh: '从品牌目录开始，按车辆品牌查看变速箱列表。' },
    'contact.title': { zh: '联系我们' },
    'contact.lead': { zh: '发送发动机或变速箱询价。所有 B2B 请求 24 小时内回复 FOB/CIF 报价。' },
    'contact.eyebrow': { zh: '取得联系' },
    'contact.sectionTitle': { zh: '我们随时为您服务' },
    'contact.sectionLead': { zh: '通过 WhatsApp、邮件或询价表联系我们。中国办公室负责采购与出口；加纳办公室服务西非客户。' },
    'contact.whatsapp': { zh: 'WhatsApp' },
    'contact.whatsappOpen': { zh: 'WhatsApp 联系' },
    'contact.whatsappNote': { zh: '最快回复 — 周一至周六' },
    'contact.email': { zh: '邮箱' },
    'contact.emailNote': { zh: '报价、合作及一般咨询' },
    'contact.chinaOffice': { zh: '🇨🇳 中国办公室' },
    'contact.ghanaOffice': { zh: '🇬🇭 加纳办公室' },
    'contact.formTitle': { zh: '发送询价' },
    'contact.formLead': { zh: '填写车辆详情和邮箱。我们将在 24 小时内回复。' },
    'contact.labelPhoneOptional': { zh: '电话 / WhatsApp（选填）' },
    'contact.phoneOptionalHint': { zh: '选填。请先选择国家，区号会自动填入。' },
    'contact.emailUs': { zh: '邮件联系' },
    'footer.emailUs': { zh: '邮件联系' , fr: 'Envoyez-nous un e-mail', ar: 'راسلنا عبر البريد الإلكتروني' },
    'contact.faqEyebrow': { zh: '常见问题' },
    'contact.faqTitle': { zh: '联系前须知' },
    'quote.boundary': { zh: '正式报价应分项列明产品成本、验证费、国内运费、港杂费、装箱、报关及运费（如适用）。CIF 报价含至目的港海运及保险；FOB 为中国装运港交货。所有库存、价格及运费在付款前须最终确认。目的港关税、税费及当地港杂费除非另有说明，否则不含在内。' },
    'quote.cifHint': { zh: 'CIF 报价含至目的港海运及保险。目的港关税、税费及当地港杂费除非另有说明，另计。' },
    'quote.cifBothHint': { zh: '可同时报 FOB（中国装运港）及 CIF（含至目的港运费与保险）。目的港关税及当地费用另计。' },
    'quote.fobHint': { zh: 'FOB 为中国装运港交货价。如需可另报海运费及保险。' },
    'quote.trustGhana': { zh: '加纳办公室支持' },
    'quote.trustZhengzhou': { zh: '郑州供应网络' },
    'quote.trustVideo': { zh: '拆解前整车启动视频' },
    'quote.trustLcl': { zh: 'LCL 或整柜采购' },
    'quote.trustDismantle': { zh: '客户确认后按需拆解' },
    'quote.proofVideoDesc': { zh: '适用时可提供拆解前整车启动视频。' },
    'quote.proofDismantle': { zh: '拆解照片' },
    'quote.proofDismantleDesc': { zh: '按您的部件清单拆解时拍照。' },
    'quote.proofThirdParty': { zh: '第三方检测' },
    'quote.proofThirdPartyDesc': { zh: '独立检测，费用另计。' },
    'quote.proofInspectDesc': { zh: '铭牌、发动机号、漏油及破损等检查项（如适用）。' },
    'brand.navOverview': { zh: '概览' },
    'brand.navCategories': { zh: '分类' },
    'brand.navEngines': { zh: '发动机' },
    'brand.navGearboxes': { zh: '变速箱' },
    'brand.navChassis': { zh: '底盘件' },
    'brand.navHalfCuts': { zh: '半车' },
    'brand.gearboxInventorySuffix': { zh: '变速箱' },
    'brand.chassisInventorySuffix': { zh: '全套底盘' },
    'brand.inventoryGearboxLead': { zh: '来自已审核半切库存的变速箱参考条目；若无工厂代号，则按年份与车型命名。' },
    'brand.inventoryChassisLead': { zh: '来自已审核半切库存的全套底盘参考条目；按年份与车型列出。' },
    'brand.navQuote': { zh: '获取报价' },
    'brand.allBrands': { zh: '全部品牌' },
    'brand.whatsappInquiry': { zh: 'WhatsApp 咨询' },
    'brand.requestQuote': { zh: '获取报价' },
    'brand.browseCatalog': { zh: '查看目录 →' },
    'brand.overviewEyebrow': { zh: '品牌概览' },
    'brand.powertrainSourcing': { zh: '动力总成采购' },
    'brand.point1': { zh: '发动机、变速箱、底盘件及半车' },
    'brand.point2': { zh: 'FOB/CIF 出口至全球目的地' },
    'brand.point3': { zh: '可按需提供检验单证' },
    'brand.point4': { zh: '现货取决于供应网络及当前库存' },
    'brand.engineModelsListed': { zh: '已列发动机型号' },
    'brand.productCategories': { zh: '产品分类' },
    'brand.vehicleOrigin': { zh: '车辆来源' },
    'brand.categoriesEyebrow': { zh: '产品线' },
    'brand.categoriesTitle': { zh: '可用产品分类' },
    'brand.categoriesLead': { zh: '四大采购分类 — 选择产品线索取 FOB/CIF 报价。' },
    'brand.categoriesLeadStart': { zh: '四大采购分类：' },
    'brand.categoriesLeadEnd': { zh: '选择产品线索取 FOB/CIF 报价。' },
    'brand.enginesTitle': { zh: '发动机' },
    'brand.gearboxesTitle': { zh: '变速箱' },
    'brand.chassisTitle': { zh: '底盘件' },
    'brand.halfCutsTitle': { zh: '半车' },
    'brand.availableOnRequest': { zh: '可按需供应' },
    'brand.availabilityNote': { zh: '现货取决于供应网络及当前库存。' },
    'brand.engineCatalogEyebrow': { zh: '发动机目录' },
    'brand.popularEnginesTitle': { zh: '热门发动机型号' },
    'brand.popularEnginesLead': { zh: '全球出口常询发动机代号。所有型号均可按需供应 — 发送代号获取 FOB/CIF 报价。' },
    'brand.halfCutEyebrow': { zh: '半车库存' },
    'brand.halfCutListings': { zh: '半车列表' },
    'brand.halfCutLead': { zh: '半车出口参考列表 — 报价前需确认现货。' },
    'brand.halfCutEmpty': { zh: '暂无半车列表。请发送您的需求。' },
    'brand.requestHalfCut': { zh: '索取半车' },
    'brand.viewAllHalfCuts': { zh: '查看全部半车库存 →' },
    'brand.quoteEyebrow': { zh: '立即开始' },
    'brand.quoteTitle': { zh: '索取采购报价' },
    'brand.quoteLead': { zh: '发送发动机代号、VIN、车型或整柜需求。采购团队 24 小时内回复 FOB/CIF 报价。' },
    'brand.globalSourcing': { zh: '全球动力总成采购' },

    'supplier.title': { zh: '供应商门户' },
    'supplier.lead': { zh: '加入我们的验证供应商网络。对接非洲各国及美洲、加勒比、中东、东南亚与澳洲的出口需求。' },
    'supplier.marketScope': { zh: '六大出口区域 — 覆盖非洲各国及美洲、加勒比、中东、东南亚与澳洲 — 构成全球最大的汽车再制造与进口采购市场之一。' },
    'supplier.marketIntro': { zh: 'AsiaPower 所服务的买家网络规模：' },
    'supplier.statCountries': { zh: '国家及地区' },
    'supplier.statPopulation': { zh: '合计人口' },
    'supplier.statVehicles': { zh: '机动车保有量' },
    'supplier.statMarket': { zh: '估算年度售后市场规模' },
    'supplier.marketNote': { zh: '数据为基于公开人口、车辆登记及汽车售后行业资料的近似区域合计。需求涵盖再制造、车队更新所需的二手发动机、变速箱、底盘件及半车。' },
    'supplier.submitHalfCut': { zh: '上传半车库存' },
    'supplier.eyebrow': { zh: '合作伙伴计划' },
    'supplier.whyTitle': { zh: '为何通过 AsiaPower 供货？' },
    'supplier.marketsTitle': { zh: '全球出口市场' },
    'supplier.marketsLead': { zh: '非洲各国及美洲、加勒比、中东、东南亚与澳洲的进口商、维修厂与车队采购需求。' },
    'supplier.ordersTitle': { zh: '稳定订单' },
    'supplier.ordersLead': { zh: '维修厂、车队运营商及整柜进口商的持续采购量。' },
    'supplier.networkTitle': { zh: '验证网络' },
    'supplier.networkLead': { zh: '质量标准保护每位合作伙伴。仅列出已批准供应商。' },
    'supplier.logisticsTitle': { zh: '物流托管' },
    'supplier.logisticsLead': { zh: '我们负责包装、出口单证、清关及全球港口海运。' },
    'supplier.regEyebrow': { zh: '注册' },
    'supplier.regTitle': { zh: '成为验证供应商' },
    'supplier.regLead': { zh: '填写表格，我们的团队将在 3 个工作日内审核您的申请。' },

    'about.breadcrumb': { zh: '关于我们' },
    'about.title': { zh: '关于 AsiaPower' },
    'about.lead': { zh: '专业 B2B 出口优质二手发动机与变速箱 — 连接亚洲汽车供应链与全球市场需求。' },
    'about.storyEyebrow': { zh: '我们的故事' },
    'about.storyTitle': { zh: '亚洲动力总成出口伙伴' },
    'about.storyP1': { zh: 'AsiaPower 的创立基于一个简单原则：全球进口商、维修厂和车队运营商应享有同等优质的二手动力总成供应 — 配备专业检验、透明定价和可靠物流。' },
    'about.valuesEyebrow': { zh: '我们的价值观' },
    'about.valuesTitle': { zh: '驱动我们的力量' },
    'about.value1Title': { zh: '质量第一' },
    'about.value1Desc': { zh: '我们优先要求可启动整车来源，适用时提供拆解前启动视频。客户确认后可按买方要求拆解部件。配件附照片及视频报告。' },
    'about.storyP2': { zh: '我们要求供应商尽可能上传整车 — 适用时可提供拆解前整车启动视频。客户确认后，可按买方要求拆解部件。' },
    'about.value2Title': { zh: '透明贸易' },
    'about.value2Desc': { zh: '清晰的 FOB/CIF 定价、诚实的状况分级，无隐藏费用。' },
    'about.value3Title': { zh: '长期合作' },
    'about.value3Desc': { zh: '我们投资于与进口商和供应商的长期关系。' },
    'about.journeyEyebrow': { zh: '发展历程' },
    'about.journeyTitle': { zh: '公司里程碑' },
    'about.officesEyebrow': { zh: '全球布局' },
    'about.officesTitle': { zh: '办公地址' },
    'about.officesLead': { zh: '两个战略据点，连接亚洲供应与全球需求。' },
    'about.capabilitiesEyebrow': { zh: '业务能力' },
    'about.capabilitiesTitle': { zh: '我们提供什么' },
    'about.ctaTitle': { zh: '与 AsiaPower 合作' },
    'about.ctaLead': { zh: '无论您是进口商、维修厂还是供应商 — 让我们建立长期贸易关系。' },
    'about.contactUs': { zh: '联系我们' },
    'about.becomeSupplier': { zh: '成为供应商' },

    'brands.platformEyebrow': { zh: 'B2B 采购' },
    'brands.platformTitle': { zh: '一个平台 · 全球车辆应用' },
    'brands.platformLead': { zh: 'AsiaPower 整合中国供应渠道，为日系、韩系、中美欧应用提供检验发动机、变速箱、底盘件及半车。' },
    'brands.platformLi1': { zh: '适用时可提供拆解前整车启动视频，附出口单证' },
    'brands.platformLi2': { zh: '自动、手动、CVT 及四驱变速箱供应' },
    'brands.platformLi3': { zh: '底盘件 — 悬架、转向、制动及车桥' },
    'brands.platformLi4': { zh: '半车用于拆解与翻新项目' },
    'brands.platformLi5': { zh: '整柜及 LCL 发运至全球目的地' },
    'brands.browseEngines': { zh: '浏览发动机' },
    'brands.browseChassis': { zh: '底盘件' },
    'brands.journeyEyebrow': { zh: '客户路径' },
    'brands.journeyTitle': { zh: '品牌 → 产品分类 → 询价' },
    'brands.journeyLead': { zh: '选择品牌（如 Toyota），浏览该品牌的发动机、变速箱、底盘件或半车。' },
    'brands.ctaTitle': { zh: '没找到您的品牌？' },
    'brands.ctaLead': { zh: '我们的供应网络覆盖更多品牌与车型。发送需求 — 我们全球采购。' },
    'brands.contactTeam': { zh: '联系采购团队' },
    'brands.featured': { zh: '重点' },
    'brands.priority': { zh: '优先' },
    'brands.viewDirectory': { zh: '查看品牌目录' },
    'brands.availableProducts': { zh: '可用产品' },
    'brands.matched': { zh: '匹配：' },
    'brands.productSummary': { zh: '发动机 · 变速箱 · 底盘件 · 半车' },
    'brands.noResults': { zh: '没有匹配的品牌。' },
    'brands.viewBrand': { zh: '查看品牌' },
    'brands.viewProducts': { zh: '查看产品' },

    'contact.labelName': { zh: '姓名' },
    'contact.labelCompany': { zh: '公司' },
    'contact.labelEmail': { zh: '邮箱' },
    'contact.labelPhone': { zh: '电话 / WhatsApp' },
    'contact.labelCountry': { zh: '所在国家' },
    'contact.labelEnquiryType': { zh: '询价类型' },
    'contact.labelVehicleDetails': { zh: '车辆 / 配件详情' },
    'contact.labelMessage': { zh: '补充说明' },
    'contact.placeholderName': { zh: '您的姓名' },
    'contact.placeholderCompany': { zh: '公司名称' },
    'contact.placeholderEmail': { zh: 'you@company.com' },
    'contact.placeholderPhone': { zh: '801 234 5678' },
    'contact.phoneRequiredHint': { zh: '先选国家。+ 已固定，请在区号后填写完整号码。' },
    'contact.selectCountry': { zh: '选择国家' },
    'contact.selectType': { zh: '选择类型' },
    'contact.typeEngine': { zh: '发动机询价' },
    'contact.typeGearbox': { zh: '变速箱询价' },
    'contact.typePowertrain': { zh: '发动机 + 变速箱套装' },
    'contact.typeBulk': { zh: '批量 / 整柜订单' },
    'contact.typePartnership': { zh: 'B2B 合作' },
    'contact.typeOther': { zh: '其他' },
    'contact.placeholderVehicle': { zh: '品牌、车型、年份、发动机代号、VIN/底盘号、变速箱类型（自动/手动，两驱/四驱）' },
    'contact.placeholderMessage': { zh: '数量、目的港、时间要求、FOB 或 CIF 偏好…' },
    'contact.submitEnquiry': { zh: '提交询价' },
    'contact.successSaved': { zh: '询价已提交' },
    'contact.successWhatsapp': { zh: '您的询价已成功提交。我们将在 24 小时内与您联系。' },
    'contact.successReceived': { zh: '询价已收到' },
    'contact.successEmail': { zh: '您的询价已提交。我们将在 24 小时内回复您的邮箱。' },

    'feedback.gotIt': { zh: '知道了' },
    'feedback.ok': { zh: '提示' },
    'feedback.formIncomplete': { zh: '请完善表单' },
    'feedback.formIncompleteMsg': { zh: '请填写所有带 * 的必填项。' },
    'feedback.enquirySaved': { zh: '询价已提交' },
    'feedback.enquirySavedEmail': { zh: '您的询价已成功提交。我们将在 24 小时内回复您的邮箱。' },
    'feedback.enquirySavedMsg': { zh: '您的询价已成功提交。我们将在 24 小时内与您联系。' },
    'feedback.enquiryFailed': { zh: '提交失败' },
    'feedback.enquiryFailedMsg': { zh: '询价未能保存到服务器。请稍后重试或通过其他方式联系我们。' },
    'feedback.saving': { zh: '正在提交…' },
    'feedback.savingMsg': { zh: '请稍候，正在保存您的询价。' },
    'feedback.halfCutSaved': { zh: '询价已记录' },
    'feedback.halfCutSavedMsg': { zh: '您的半车询价已成功提交。我们将在 24 小时内与您联系。' },
    'feedback.whatsappOpening': { zh: '正在打开 WhatsApp…' },
    'feedback.halfCutFailed': { zh: '提交失败' },
    'feedback.halfCutFailedMsg': { zh: '未能保存到服务器。请重试或使用联系表单。' },
    'feedback.halfCutListingUnavailable': { zh: '该 listing 不可用。请使用联系表单联系我们。' },
    'feedback.uploadSuccess': { zh: '上传成功' },
    'feedback.uploadFailed': { zh: '上传失败' },
    'feedback.registrationSuccess': { zh: '注册已提交' },
    'feedback.registrationSuccessMsg': { zh: '感谢您的申请。我们的供应商团队将在 3 个工作日内通过邮箱联系您。' },
    'feedback.photoUploaded': { zh: '照片已上传' },
    'feedback.videoUploaded': { zh: '视频已上传' },

    'leadContact.title': { zh: '请留下联系方式' },
    'leadContact.message': { zh: '请选择国家，然后填写电话号码或邮箱地址。' },
    'leadContact.whatsappSaveHint': { zh: '我们会先保存您的询价，再打开 WhatsApp。' },
    'leadContact.contactEitherHint': { zh: '电话或邮箱至少填写一项。若填电话，请先选择国家。' },
    'leadContact.contactRequired': { zh: '请填写电话号码或邮箱地址。' },
    'leadContact.name': { zh: '姓名' },
    'leadContact.phone': { zh: '电话 / WhatsApp' },
    'leadContact.email': { zh: '邮箱' },
    'leadContact.emailInvalid': { zh: '请输入有效的邮箱地址。' },
    'leadContact.emailPlaceholder': { zh: '请填写真实可收信的邮箱，测试邮箱（如 test@example.com）无法提交。' },
    'leadContact.emailRequired': { zh: '请填写邮箱地址，以便我们通过邮件回复。' },
    'leadContact.phoneInvalid': { zh: '请输入有效的国际电话号码（+ 后共 8–15 位数字）。' },
    'leadContact.phoneCountryMismatch': { zh: '电话号码必须与所选国家的区号一致。' },
    'leadContact.phoneNationalInvalid': { zh: '请在国家区号后填写完整的本地号码。' },
    'leadContact.phoneNoLeadingZero': { zh: '请去掉号码开头的 0，不要加本地长途前缀。' },
    'leadContact.phoneCountryCode': { zh: '电话号码必须与所选国家区号一致。' },
    'leadContact.phoneRequiredHint': { zh: '+ 已固定。先选国家，区号会自动填入。邮箱选填。' },
    'leadContact.country': { zh: '所在国家' },
    'leadContact.selectCountry': { zh: '选择国家' },
    'leadContact.countryRequired': { zh: '请选择所在国家。' },
    'leadContact.continue': { zh: '继续询价' },
    'leadContact.cancel': { zh: '取消' },
    'leadContact.phoneRequired': { zh: '请输入您的电话号码。' },

    'contact.faq1Q': { zh: '询价应包含哪些信息？' },
    'contact.faq1A': { zh: '车辆品牌、车型、年份、发动机代号或变速箱类型及目的港。如有 VIN/底盘号请附上。说明数量及是否需要 FOB 或 CIF 报价。' },
    'contact.faq2Q': { zh: '多久能收到报价？' },
    'contact.faq2A': { zh: '标准询价 24 小时内回复。现货单位可能当日报价。定制采购需 48–72 小时核查供应。' },
    'contact.faq3Q': { zh: '是否接受小订单？' },
    'contact.faq3A': { zh: '支持 — 单台 LCL 及整柜批量。复购客户享优惠价格及专属客户经理。' },

    'engine.home': { zh: '首页' },
    'engine.brands': { zh: '品牌' },
    'engine.engines': { zh: '发动机' },
    'engine.engineModel': { zh: '发动机型号' },
    'engine.exportAvailability': { zh: '出口可用性' },
    'engine.viewModel': { zh: '查看型号 →' },
    'engine.requestQuote': { zh: '获取报价' },
    'engine.modelsListed': { zh: '个发动机型号已列' },
    'engine.viewBrand': { zh: '查看' },
    'engine.categoryEngines': { zh: '发动机' },
    'engine.catalogFor': { zh: '发动机型号目录 — 支持全球出口。' },
    'engine.viewFullList': { zh: '查看完整列表' },
    'engine.browseBrand': { zh: '浏览' },
    'engine.brandEngines': { zh: '发动机' },
    'engine.brandGearboxes': { zh: '变速箱' },
    'engine.brandChassis': { zh: '底盘件' },
    'engine.brandHalfCuts': { zh: '半车' },
    'engine.productCatalog': { zh: '产品目录' },
    'engine.allEngineModels': { zh: '全部发动机型号' },
    'engine.gearboxes': { zh: '变速箱' },
    'engine.halfCuts': { zh: '半车' },
    'engine.chassisParts': { zh: '底盘件' },
    'engine.needExport': { zh: '需要出口？' },
    'engine.quoteLead': { zh: '发送您的需求 — 24 小时内 FOB/CIF 报价。' },
    'engine.contactTeam': { zh: '联系采购团队' },
    'engine.allBrandEngines': { zh: '全部' },
    'engine.displacement': { zh: '排量' },
    'engine.fuelType': { zh: '燃料类型' },
    'engine.applications': { zh: '适用车型' },
    'engine.needExportPrefix': { zh: '需要出口' },
    'engine.needExportSuffix': { zh: '？' },
    'engine.sourcedFor': { zh: '通过 AsiaPower 中国供应网络采购，支持全球出口。' },
    'engine.statusAvailable': { zh: '现货' },
    'engine.statusReadyExport': { zh: '可出口' },
    'engine.statusFob': { zh: '支持 FOB' },
    'engine.statusCif': { zh: '支持 CIF' },

    'hc.includedParts': { zh: '包含部件' },
    'hc.vehicleVideo': { zh: '车辆视频' },
    'hc.zoom': { zh: '放大' },
    'hc.supplierVerified': { zh: '供应商已验证 — 发布前由 AsiaPower 供应网络确认库存。' },
    'hc.notFound': { zh: '未找到半车' },
    'hc.notFoundLead': { zh: '该列表不可用。' },
    'hc.browseInventory': { zh: '浏览半车库存' },
    'hc.halfCutListings': { zh: '半车列表' },
    'hc.allHalfCuts': { zh: '全部半车' },
    'hc.enginePage': { zh: '发动机页面' },
    'hc.halfCut': { zh: '半车' },
    'hc.onEnquiry': { zh: '询价' },
    'hc.condition': { zh: '状况' },
    'hc.drivetrain': { zh: '驱动形式' },
    'hc.origin': { zh: '来源' },
    'hc.status': { zh: '状态' },
    'hc.catalog': { zh: '目录' },
    'hc.contactTeam': { zh: '联系采购团队' },
    'hc.requestSimilar': { zh: '索取类似车源' },
    'hc.ctaSold': { zh: '类似半车' },
    'hc.ctaExport': { zh: '出口半车' },
    'hc.ctaSoldIntro': { zh: '库存编号' },
    'hc.ctaSoldRest': { zh: '已售。索取类似车源时可引用本列表。' },
    'hc.ctaReservedRest': { zh: '为预留/在途状态。出口前请确认现货或索取类似车源。' },
    'hc.ctaAvailableRest': { zh: ' — 引用该编号获取 FOB/CIF 报价，现货以询价确认为准。' },
  };

  const NAV_ID_KEYS = {
    home: 'nav.home',
    brands: 'nav.brands',
    halfcuts: 'nav.halfcuts',
    truckheads: 'nav.truckheads',
    trucks: 'nav.trucks',
    motorcycles: 'nav.motorcycles',
    machinery: 'nav.machinery',
    supplier: 'nav.supplier',
    contact: 'nav.contact',
  };

  function getPageId() {
    const page = document.body?.dataset?.page || '';
    if (page) {
      if (page.startsWith('brand-')) return 'brands';
      if (page.startsWith('engine-')) return 'engines';
      return page;
    }
    const file = window.location.pathname.split('/').pop() || 'index.html';
    const map = {
      'index.html': 'home',
      'brands.html': 'brands',
      'supplier-portal.html': 'supplier',
    };
    return map[file] || '';
  }

  function isInternalPage() {
    const page = document.body?.dataset?.page || '';
    if (page === 'supplier-upload' || page === 'admin-review') return true;
    const path = window.location.pathname;
    return path.includes('/admin/') || path.includes('/supplier-portal/half-cut-upload');
  }

  function isSwitchablePublicPage() {
    if (isInternalPage()) return false;
    const page = document.body?.dataset?.page || '';
    const path = window.location.pathname;
    if (page === 'supplier') return true;
    if (path.endsWith('/supplier-portal.html')) return true;
    if (page === 'home') return true;
    if (page === 'brands' || page.startsWith('brand-')) return true;
    if (page === 'engines' || page === 'engine-detail') return true;
    if (page === 'gearboxes') return true;
    if (page === 'chassis') return true;
    if (page === 'halfcuts' || page === 'halfcut-detail') return true;
    if (page === 'trucks' || page === 'truckheads' || page === 'motorcycles' || page === 'machinery') return true;
    if (page === 'contact') return true;
    if (page === 'about') return true;
    if (path.endsWith('/brands.html') || /\/brands\/[^/]+\.html/.test(path)) return true;
    if (path.endsWith('/contact.html')) return true;
    if (path.endsWith('/about.html')) return true;
    if (/\/engines(\/|$)/.test(path)) return true;
    if (/\/gearboxes(\/|$)/.test(path)) return true;
    if (/\/chassis-parts(\/|$)/.test(path)) return true;
    if (/\/half-cuts(\/|$)/.test(path)) return true;
    if (/\/truck-heads(\/|$)/.test(path)) return true;
    if (/\/trucks(\/|$)/.test(path)) return true;
    if (/\/motorcycles(\/|$)/.test(path)) return true;
    if (/\/machinery(\/|$)/.test(path)) return true;
    if (path === '/' || path.endsWith('/index.html')) {
      return !path.includes('/engines/') && !path.includes('/gearboxes/')
        && !path.includes('/half-cuts/') && !path.includes('/chassis-parts/')
        && !path.includes('/truck-heads/') && !path.includes('/trucks/') && !path.includes('/motorcycles/')
        && !path.includes('/machinery/');
    }
    return false;
  }

  function normalizeLang(value) {
    return SUPPORTED_LANGS.includes(value) ? value : 'en';
  }

  function isRtl(lang) {
    return RTL_LANGS.includes(lang || getLang());
  }

  /** Export market stat display — EN/FR/AR use B/M; ZH uses 亿. */
  const MARKET_STAT_DISPLAY = {
    countries: { en: '<span>110</span>+', zh: '<span>110</span>+', fr: '<span>110</span>+', ar: '<span>110</span>+' },
    population: { en: '<span>3.5</span>B+', zh: '<span>35</span>亿+', fr: '<span>3,5</span> Md+', ar: '<span>3.5</span> مليار+' },
    vehicles: { en: '<span>700</span>M+', zh: '<span>7</span>亿+', fr: '<span>700</span> M+', ar: '<span>700</span> مليون+' },
    market: { en: '$<span>100</span>B+', zh: '<span>1000</span>亿美元+', fr: '<span>100</span> Md$+', ar: '<span>100</span> مليار دولار+' },
  };

  function applyMarketStats(root) {
    const lang = getLang();
    (root || document).querySelectorAll('[data-market-stat]').forEach((el) => {
      if (el.querySelector('.market-stat__en')) return;
      const key = el.dataset.marketStat;
      const spec = MARKET_STAT_DISPLAY[key];
      if (!spec) return;
      el.innerHTML = spec[lang] || spec.en;
    });
  }

  function getLang() {
    if (!isSwitchablePublicPage()) return DEFAULT_LANG;
    try {
      return normalizeLang(localStorage.getItem(STORAGE_KEY));
    } catch {
      return DEFAULT_LANG;
    }
  }

  function applyDirection(lang) {
    document.documentElement.lang = LANG_HTML_TAG[lang] || 'en';
    document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
    document.documentElement.classList.toggle('lang-rtl', isRtl(lang));
  }

  function setLang(lang) {
    const next = normalizeLang(lang);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    applyDirection(next);
    applyDataI18n(document.body);
    window.dispatchEvent(new CustomEvent('asiapower:langchange', { detail: { lang: next } }));
  }

  function t(key, fallback) {
    const lang = getLang();
    if (lang === 'en') return fallback || key;
    return STRINGS[key]?.[lang] || fallback || key;
  }

  function translateNavLabel(item) {
    const key = NAV_ID_KEYS[item.id];
    return key ? t(key, item.label) : item.label;
  }

  function applyDataI18n(root) {
    applyMarketStats(root);
    const lang = getLang();

    if (lang === 'en') {
      (root || document).querySelectorAll('[data-i18n]').forEach((el) => {
        if (el.dataset.i18nEn != null) {
          if (el.dataset.i18nHtml === 'true') el.innerHTML = el.dataset.i18nEn;
          else el.textContent = el.dataset.i18nEn;
        }
      });
      (root || document).querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        if (el.dataset.i18nPlaceholderEn != null) el.placeholder = el.dataset.i18nPlaceholderEn;
      });
      return;
    }

    (root || document).querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (el.dataset.i18nEn == null) {
        el.dataset.i18nEn = el.dataset.i18nHtml === 'true' ? el.innerHTML : el.textContent;
      }
      const text = STRINGS[key]?.[lang];
      if (!text) {
        if (el.dataset.i18nHtml === 'true') el.innerHTML = el.dataset.i18nEn;
        else el.textContent = el.dataset.i18nEn;
        return;
      }
      if (el.dataset.i18nHtml === 'true') el.innerHTML = text.replace(/\n/g, '<br>');
      else el.textContent = text;
    });

    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (el.dataset.i18nPlaceholderEn == null) el.dataset.i18nPlaceholderEn = el.placeholder;
      const text = STRINGS[key]?.[lang];
      el.placeholder = text || el.dataset.i18nPlaceholderEn;
    });
  }

  const LANG_BUTTON_LABEL = { en: 'EN', zh: '中文', fr: 'FR', ar: 'AR' };

  function renderLangSwitcher() {
    if (!isSwitchablePublicPage()) return '';
    const lang = getLang();
    const buttons = SUPPORTED_LANGS.map((code) => `
        <button type="button" class="lang-switcher__btn${lang === code ? ' is-active' : ''}" data-lang="${code}" aria-pressed="${lang === code}">${LANG_BUTTON_LABEL[code]}</button>`).join('');
    return `
      <div class="lang-switcher" role="group" aria-label="Language">${buttons}
      </div>`;
  }

  function bindLangSwitcher(root) {
    if (!isSwitchablePublicPage()) return;
    (root || document).querySelectorAll('.lang-switcher__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.lang;
        if (next && next !== getLang()) setLang(next);
      });
    });
  }

  function translateExportStatus(status) {
    const map = {
      Available: 'engine.statusAvailable',
      'Ready for Export': 'engine.statusReadyExport',
      'FOB Available': 'engine.statusFob',
      'CIF Available': 'engine.statusCif',
    };
    const key = map[status];
    return key ? t(key, status) : status;
  }

  function initDocumentLang() {
    if (isSwitchablePublicPage()) {
      applyDirection(getLang());
    }
  }

  function translateStatus(status) {
    const map = {
      Available: 'hc.available',
      Reserved: 'hc.reserved',
      'In Transit': 'hc.inTransit',
      Sold: 'hc.sold',
    };
    const key = map[status];
    return key ? t(key, status) : status;
  }

  function inventoryDisclaimer() {
    const trust = t('trust.block', 'Whole-vehicle startup video available before dismantling. Parts can be dismantled according to buyer requirements after confirmation.');
    const base = t('hc.inventoryDisclaimerBase', 'Inventory is subject to final confirmation. Photos, price and shipping cost are confirmed on request before export.');
    return `${trust} ${base}`;
  }

  initDocumentLang();

  window.PublicI18n = {
    getLang,
    setLang,
    t,
    translateNavLabel,
    translateStatus,
    translateExportStatus,
    inventoryDisclaimer,
    applyDataI18n,
    applyMarketStats,
    renderLangSwitcher,
    bindLangSwitcher,
    showSwitcher: isSwitchablePublicPage,
    isSwitchablePublicPage,
    isInternalPage,
    isRtl,
  };
})();
