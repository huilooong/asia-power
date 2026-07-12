/**
 * AsiaPower — Public website language (EN default; ZH, FR, AR optional).
 * Supplier portal upload pages use the same lang switcher; admin tools stay English-only.
 * Coverage: nav/footer/topbar and all public page strings include FR/AR translations.
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
    'nav.halfcuts': { zh: '乘用车' , fr: 'Demi-carcasses', ar: 'نصف مقطوعة' },
    'nav.truckheads': { zh: '卡车车头' , fr: 'Cabines de camion', ar: 'مقدمات الشاحنات' },
    'nav.trucks': { zh: '卡车' , fr: 'Camions', ar: 'شاحنات' },
    'nav.motorcycles': { zh: '摩托车' , fr: 'Motos', ar: 'دراجات نارية' },
    'nav.machinery': { zh: '工程机械' , fr: 'Engins de chantier', ar: 'معدات ثقيلة' },
    'nav.supplier': { zh: '供应商门户' , fr: 'Portail fournisseur', ar: 'بوابة المورد' },
    'nav.contact': { zh: '联系我们' , fr: 'Contact', ar: 'اتصل بنا' },
    'nav.signIn': { zh: '登录' , fr: 'Connexion', ar: 'تسجيل الدخول' },
    'nav.dashboard': { en: 'Workspace', zh: '工作台', fr: 'Espace', ar: 'مساحة العمل' },
    'nav.logout': { en: 'Sign out', zh: '退出', fr: 'Déconnexion', ar: 'تسجيل الخروج' },
    'nav.account': { en: 'Account', zh: '账户', fr: 'Compte', ar: 'الحساب' },
    'nav.about': { zh: '关于我们', fr: 'À propos', ar: 'من نحن' },
    'nav.requestQuote': { zh: '获取报价' , fr: 'Demander un devis', ar: 'طلب عرض سعر' },
    'trucks.subcatTruckHeads': { zh: '卡车车头与驾驶室 →', fr: 'Têtes et cabines de camion →', ar: 'رؤوس الشاحنات ومقصوراتها →'},
    'trucks.submoduleNav': { en: 'Truck part categories', zh: '卡车子类目', fr: 'Sous-catégories camion', ar: 'فئات قطع الشاحنات' },
    'trucks.submoduleAll': { en: 'All', zh: '全部', fr: 'Tous', ar: 'الكل' },
    'trucks.submoduleWhole': { en: 'Whole vehicle', zh: '整车', fr: 'Véhicule complet', ar: 'مركبة كاملة' },
    'trucks.submoduleEngine': { en: 'Engine', zh: '发动机', fr: 'Moteur', ar: 'محرك' },
    'trucks.submoduleAxle': { en: 'Axle', zh: '车轴', fr: 'Essieu', ar: 'محور' },
    'trucks.submoduleHead': { en: 'Truck head', zh: '车头', fr: 'Tête de camion', ar: 'رأس الشاحنة' },
    'parts.submoduleNav': { en: 'Parts categories', zh: '配件子类目', fr: 'Sous-catégories pièces', ar: 'فئات القطع' },
    'parts.submoduleEngines': { en: 'Engines', zh: '发动机', fr: 'Moteurs', ar: 'المحركات' },
    'parts.submoduleGearboxes': { en: 'Gearboxes', zh: '变速箱', fr: 'Boîtes de vitesses', ar: 'علب التروس' },
    'parts.submoduleChassis': { en: 'Chassis', zh: '底盘', fr: 'Châssis', ar: 'الشاسيه' },
    'parts.submoduleFrontCut': { en: 'Front cut', zh: '前头', fr: 'Avant / nose cut', ar: 'المقدمة' },
    'parts.watch': { en: 'Save', zh: '收藏', fr: 'Enregistrer', ar: 'حفظ' },
    'parts.watched': { en: 'Saved', zh: '已收藏', fr: 'Enregistré', ar: 'محفوظ' },
    'parts.watchSaved': { en: 'Saved to your list', zh: '已加入收藏', fr: 'Ajouté à votre liste', ar: 'تمت الإضافة إلى قائمتك' },
    'parts.watchRemoved': { en: 'Removed from your list', zh: '已从收藏移除', fr: 'Retiré de votre liste', ar: 'تمت الإزالة من قائمتك' },
    'parts.addToEnquiry': { en: 'Add to enquiry', zh: '添加询价', fr: 'Ajouter à la demande', ar: 'إضافة إلى الاستفسار' },
    'parts.add': { en: 'Add', zh: '添加', fr: 'Ajouter', ar: 'إضافة' },
    'parts.partType.engine': { en: 'Engine', zh: '发动机', fr: 'Moteur', ar: 'محرك' },
    'parts.partType.transmission': { en: 'Gearbox', zh: '变速箱', fr: 'Boîte de vitesses', ar: 'علبة التروس' },
    'parts.partType.chassis': { en: 'Chassis part', zh: '底盘件', fr: 'Pièce de châssis', ar: 'قطعة شاسيه' },
    'parts.partType.front': { en: 'Front cut', zh: '前头', fr: 'Avant / nose cut', ar: 'المقدمة' },
    'nav.openMenu': { zh: '打开菜单' , fr: 'Ouvrir le menu', ar: 'فتح القائمة' },
    'nav.closeMenu': { zh: '关闭菜单' , fr: 'Fermer le menu', ar: 'إغلاق القائمة' },
    'skipLink': { zh: '跳转到主要内容', fr: 'Aller au contenu principal', ar: 'انتقل إلى المحتوى الرئيسي'},
    'topbar.badge': { zh: '全球动力总成采购' , fr: 'Plateforme mondiale d\'approvisionnement', ar: 'منصة عالمية لتوريد مجموعة نقل الحركة' },
    'topbar.tagline': { zh: '中国供应网络 → 全球买家' , fr: 'Réseau d\'approvisionnement chinois vers acheteurs mondiaux', ar: 'شبكة توريد من الصين إلى مشترين حول العالم' },
    'footer.ctaTitle': { zh: '需要全球发运的动力总成配件？' , fr: 'Besoin de pièces de groupe motopropulseur expédiées dans le monde ?', ar: 'بحاجة لشحن قطع غيار مجموعة نقل الحركة عالميًا؟' },
    'footer.ctaLead': { zh: '发送车辆详情 — 我们将在 24 小时内回复 EXW/CIF 报价。' , fr: 'Envoyez les détails du véhicule — nous répondons sous 24 heures avec un devis EXW/CIF.', ar: 'أرسل تفاصيل المركبة - سنرد خلال 24 ساعة بعرض سعر EXW/CIF.' },
    'footer.whatsapp': { zh: 'WhatsApp 联系' , fr: 'WhatsApp', ar: 'واتساب' },
    'footer.nav': { zh: '导航' , fr: 'Navigation', ar: 'التنقل' },
    'footer.startHere': { zh: '快速入口' , fr: 'Commencer ici', ar: 'ابدأ هنا' },
    'footer.brandDirectory': { zh: '品牌目录' , fr: 'Répertoire des marques', ar: 'دليل العلامات التجارية' },
    'footer.buyerGuides': { zh: '采购指南', fr: 'Guides d\'achat', ar: 'دليل الشراء' },
    'footer.supplierPortal': { zh: '供应商门户' , fr: 'Portail fournisseur', ar: 'بوابة المورد' },
    'footer.products': { zh: '产品', fr: 'Produits', ar: 'المنتجات' },
    'footer.company': { zh: '公司', fr: 'Entreprise', ar: 'الشركة' },
    'footer.aboutLink': { zh: '关于我们', fr: 'À propos', ar: 'من نحن' },
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
    'catalog.home': { zh: '首页', fr: 'Accueil', ar: 'الرئيسية'},
    'catalog.brands': { zh: '品牌', fr: 'Marques', ar: 'العلامات التجارية'},
    'catalog.engines': { zh: '发动机', fr: 'Engines', ar: 'المحركات'},
    'catalog.gearboxes': { zh: '变速箱', fr: 'Boîtes de vitesses', ar: 'علبة سرعة'},
    'catalog.halfCuts': { zh: '乘用车', fr: ', de découpes partielles', ar: 'قصات نصفية'},
    'catalog.chassis': { zh: '底盘件', fr: 'Châssis', ar: 'أجزاء الشاسيه'},
    'catalog.internalNumber': { en: 'Stock ID', zh: '内部编号', fr: 'N° stock', ar: 'رقم المخزون' },
    'catalog.loadingInventory': { en: 'Loading inventory…', zh: '正在加载库存…', fr: 'Chargement de l\'inventaire…', ar: 'جاري تحميل المخزون…' },
    'catalog.browseByBrand': { zh: '按品牌浏览', fr: 'Parcourir par marque', ar: 'التصفح حسب العلامة التجارية'},
    'catalog.sendRequirementTitle': { en: 'Need a match today?', zh: '今天需要匹配现货？', fr: 'Besoin d\'une correspondance aujourd\'hui ?', ar: 'هل تحتاج مطابقة اليوم؟' },
    'catalog.sendRequirementLead': { en: 'Send your brand, model, year, engine code and destination port. AsiaPower will confirm the right package before quote.', zh: '发送品牌、车型、年份、发动机号和目的港。AsiaPower 会先确认匹配方案，再给您报价。', fr: 'Envoyez la marque, le modèle, l\'année, le code moteur et le port de destination. AsiaPower confirme le bon ensemble avant devis.', ar: 'أرسل العلامة والطراز والسنة ورمز المحرك وميناء الوجهة. تؤكد AsiaPower المجموعة المناسبة قبل عرض السعر.' },
    'catalog.sendRequirement': { en: 'Send Requirement', zh: '发送需求', fr: 'Envoyer la demande', ar: 'إرسال الطلب' },
    'catalog.viewAllBrands': { en: 'All Brands', zh: '全部品牌', fr: 'Toutes les marques', ar: 'جميع العلامات' },
    'ebay.browseByCategory': { zh: '按类目浏览', fr: 'Parcourir par catégorie', ar: 'التصفح حسب الفئة' },
    'ebay.modelsInStock': { en: 'Models in stock', zh: '在库车型', fr: 'Modèles en stock', ar: 'الموديلات المتوفرة' },
    'ebay.allModels': { en: 'All models', zh: '全部车型', fr: 'Tous les modèles', ar: 'جميع الموديلات' },
    'filter.make': { en: 'Make', zh: '品牌', fr: 'Marque', ar: 'العلامة' },
    'filter.year': { en: 'Year', zh: '年份', fr: 'Année', ar: 'السنة' },
    'filter.price': { en: 'Price', zh: '价格', fr: 'Prix', ar: 'السعر' },
    'filter.transmission': { en: 'Transmission', zh: '变速箱', fr: 'Transmission', ar: 'ناقل الحركة' },
    'filter.bodyType': { en: 'Body type', zh: '车身类型', fr: 'Type de carrosserie', ar: 'نوع الهيكل' },
    'filter.availability': { en: 'Availability', zh: '库存状态', fr: 'Disponibilité', ar: 'التوفر' },
    'filter.listingType': { en: 'Listing type', zh: '列表类型', fr: 'Type d\'annonce', ar: 'نوع القائمة' },
    'filter.equipmentType': { en: 'Equipment type', zh: '设备类型', fr: 'Type d\'équipement', ar: 'نوع المعدة' },
    'filter.automatic': { en: 'Automatic', zh: '自动', fr: 'Automatique', ar: 'أوتوماتيك' },
    'filter.manual': { en: 'Manual', zh: '手动', fr: 'Manuelle', ar: 'يدوي' },
    'filter.allBodyTypes': { en: 'All body types', zh: '全部车身类型', fr: 'Tous les types', ar: 'جميع أنواع الهيكل' },
    'filter.sedan': { en: 'Sedan', zh: '轿车', fr: 'Berline', ar: 'سيدان' },
    'filter.suv': { en: 'SUV', zh: 'SUV', fr: 'SUV', ar: 'SUV' },
    'filter.pickup': { en: 'Pickup', zh: '皮卡', fr: 'Pick-up', ar: 'بيك أب' },
    'filter.van': { en: 'Van', zh: '面包车', fr: 'Fourgon', ar: 'فان' },
    'filter.truckHalfCut': { en: 'Truck half-cut', zh: '卡车半切', fr: 'Demi-coupe camion', ar: 'نصف مقطوعة شاحنة' },
    'filter.driverCab': { en: 'Driver cab', zh: '车头', fr: 'Cabine', ar: 'كابينة السائق' },
    'filter.excavator': { en: 'Excavator', zh: '挖掘机', fr: 'Excavatrice', ar: 'حفارة' },
    'filter.loader': { en: 'Loader', zh: '装载机', fr: 'Chargeuse', ar: 'لودر' },
    'filter.crane': { en: 'Crane', zh: '起重机', fr: 'Grue', ar: 'رافعة' },
    'filter.roller': { en: 'Roller', zh: '压路机', fr: 'Rouleau compresseur', ar: 'مدحلة' },
    'filter.priceUnder1000': { en: 'Under $1,000', zh: '低于 $1,000', fr: 'Moins de 1 000 $', ar: 'أقل من 1,000 $' },
    'filter.price1000to5000': { en: '$1,000 – $5,000', zh: '$1,000 – $5,000', fr: '1 000 $ – 5 000 $', ar: '1,000 $ – 5,000 $' },
    'filter.price5000to10000': { en: '$5,000 – $10,000', zh: '$5,000 – $10,000', fr: '5 000 $ – 10 000 $', ar: '5,000 $ – 10,000 $' },
    'filter.price10000to20000': { en: '$10,000 – $20,000', zh: '$10,000 – $20,000', fr: '10 000 $ – 20 000 $', ar: '10,000 $ – 20,000 $' },
    'filter.price20000plus': { en: '$20,000+', zh: '$20,000 以上', fr: '20 000 $ et plus', ar: '20,000 $+' },
    'filter.bestMatch': { en: 'Best Match', zh: '最佳匹配', fr: 'Meilleure correspondance', ar: 'أفضل تطابق' },
    'filter.yearNewest': { en: 'Year: newest first', zh: '年份：从新到旧', fr: 'Année : plus récentes', ar: 'السنة: الأحدث أولاً' },
    'filter.listedNewest': { en: 'Listed: newest first', zh: '上架：最新优先', fr: 'Publié : plus récents', ar: 'الإدراج: الأحدث أولاً' },
    'filter.priceLowest': { en: 'Price: lowest first', zh: '价格：从低到高', fr: 'Prix : du moins cher', ar: 'السعر: الأقل أولاً' },
    'filter.clearFilters': { en: 'Clear filters', zh: '清除筛选', fr: 'Effacer les filtres', ar: 'مسح الفلاتر' },
    'filter.filterResults': { en: 'Filter results', zh: '筛选结果', fr: 'Filtrer les résultats', ar: 'تصفية النتائج' },
    'filter.sort': { en: 'Sort', zh: '排序', fr: 'Trier', ar: 'ترتيب' },
    'filter.sortResults': { en: 'Sort results', zh: '排序结果', fr: 'Trier les résultats', ar: 'ترتيب النتائج' },
    'filter.listView': { en: 'List View', zh: '列表视图', fr: 'Vue liste', ar: 'عرض القائمة' },
    'filter.results': { en: 'results', zh: '条结果', fr: 'résultats', ar: 'نتيجة' },
    'filter.models': { en: 'models', zh: '个型号', fr: 'modèles', ar: 'موديل' },
    'filter.fuelType': { en: 'Fuel type', zh: '燃料类型', fr: 'Type de carburant', ar: 'نوع الوقود' },
    'filter.transmissionType': { en: 'Transmission type', zh: '变速箱类型', fr: 'Type de transmission', ar: 'نوع ناقل الحركة' },
    'filter.partType': { en: 'Part type', zh: '零件类型', fr: 'Type de pièce', ar: 'نوع القطعة' },
    'filter.partCategory': { en: 'Part category', zh: '零件类目', fr: 'Catégorie de pièces', ar: 'فئة القطعة' },
    'catalog.loadMore': { en: 'Load more', zh: '加载更多', fr: 'Afficher plus', ar: 'تحميل المزيد' },
    'catalog.showingCount': { en: 'Showing {shown} of {total}', zh: '已显示 {shown} / 共 {total} 条', fr: '{shown} sur {total} affichés', ar: 'عرض {shown} من {total}' },
    'ebay.catUsedCars': { zh: '出口二手车', fr: 'Voitures d\'occasion à l\'export', ar: 'سيارات مستعملة للتصدير' },
    'ebay.catHalfCuts': { zh: '半切车', fr: 'Demi-coupes', ar: 'نصف مقطوعة' },
    'ebay.catHalfCutsSubtitle': {
      en: 'Custom dismantling · Parts on demand',
      zh: '定制拆解，按需取件',
      fr: 'Démontage sur mesure · Pièces à la demande',
      ar: 'تفكيك مخصص · قطع حسب الطلب',
    },
    'ebay.catTrucks': { zh: '卡车', fr: 'Camions', ar: 'شاحنات' },
    'ebay.catMachinery': { zh: '工程机械', fr: 'Engins de chantier', ar: 'معدات ثقيلة' },
    'ebay.catParts': { zh: '发动机与零部件', fr: 'Moteurs et pièces', ar: 'محركات وقطع غيار' },
    'ebay.searchPlaceholder': { zh: '搜索半切车、发动机、HC250160、2AZ-FE…', fr: 'Rechercher demi-coupes, moteurs, HC250160, 2AZ-FE…', ar: 'ابحث عن نصف مقطوعة ومحركات وHC250160 و2AZ-FE…' },
    'ebay.searchPlaceholderShort': { zh: 'HC250160、2AZ-FE、Camry…', fr: 'HC250160, 2AZ-FE, Camry…', ar: 'HC250160، 2AZ-FE، Camry…' },
    'ebay.searchBtn': { zh: '搜索', fr: 'Rechercher', ar: 'بحث' },
    'ebay.promoBar': {
      en: 'Every Used Asset Has Value',
      zh: '物尽其用，价值永续',
      fr: 'Chaque actif d\'occasion a de la valeur',
      ar: 'كل أصل مستعمل له قيمة',
    },
    'ebay.popular': { zh: '热门：', fr: 'Populaire :', ar: 'شائع:' },
    'home.sectionHalfCuts': { zh: '半切车', fr: 'Demi-coupes', ar: 'نصف مقطوعة' },
    'home.sectionPassengerEngines': { zh: '乘用车发动机', fr: 'Moteurs de voitures', ar: 'محركات سيارات الركاب' },
    'home.sectionTruckCabs': { zh: '卡车车头', fr: 'Cabines de camion', ar: 'مقدمات الشاحنات' },
    'home.sectionMachineryEngines': { zh: '工程机械与发动机', fr: 'Engins de chantier & moteurs', ar: 'معدات ثقيلة ومحركات' },
    'home.sectionUsedCars': { zh: '出口二手车', fr: 'Voitures d\'occasion à l\'export', ar: 'سيارات مستعملة للتصدير' },
    'home.bestSelling': { zh: '热销', fr: 'Meilleures ventes', ar: 'الأكثر مبيعاً' },
    'home.limitedDeals': { zh: '限时优惠', fr: 'Offres limitées', ar: 'عروض محدودة' },
    'home.topRated': { zh: '高评分', fr: 'Mieux notés', ar: 'الأعلى تقييماً' },
    'home.seeAll': { zh: '查看全部', fr: 'Tout voir', ar: 'عرض الكل' },
    /* v4-hybrid homepage */
    'home.v4.nav.halfCuts': { zh: '半切车', fr: 'Demi-coupes', ar: 'نصف مقطوعة' },
    'home.v4.nav.engines': { zh: '发动机', fr: 'Moteurs', ar: 'محركات' },
    'home.v4.nav.trucks': { zh: '卡车', fr: 'Camions', ar: 'شاحنات' },
    'home.v4.nav.construction': { zh: '工程机械', fr: 'Chantier', ar: 'معدات ثقيلة' },
    'home.v4.nav.usedCars': { zh: '二手车', fr: 'Occasion', ar: 'مستعملة' },
    'home.v4.hero.badge': { zh: '视频已验证 · 发往 110+ 国家', fr: 'Vidéo vérifiée · 110+ pays', ar: 'فيديو موثق · أكثر من 110 دولة' },
    'home.v4.hero.title': {
      zh: '全球二手动力总成<br><em>采购市场。</em>',
      fr: 'Le marché mondial des<br><em>groupes motopropulseurs d\'occasion.</em>',
      ar: 'السوق العالمي لـ<br><em>مجموعات نقل الحركة المستعملة.</em>',
    },
    'home.v4.hero.sub': {
      zh: '半切车、发动机与卡车配件 — 中国采购，全球交付。EXW 报价，24 小时响应。',
      fr: 'Demi-coupes, moteurs et pièces camion — sourcés en Chine, livrés dans le monde. Prix EXW, devis sous 24 h.',
      ar: 'أنصاف مقطوعة ومحركات وقطع شاحنات — من الصين إلى العالم. أسعار EXW ورد خلال 24 ساعة.',
    },
    'home.v4.search.placeholder': {
      zh: '按品牌、车型、发动机代码或 HC 编号搜索…',
      fr: 'Rechercher marque, modèle, code moteur ou n° HC…',
      ar: 'ابحث بالماركة أو الموديل أو كود المحرك أو رقم HC…',
    },
    'home.v4.search.btn': { zh: '搜索', fr: 'Rechercher', ar: 'بحث' },
    'home.v4.popular': { zh: '热门搜索', fr: 'Recherches populaires', ar: 'عمليات بحث شائعة' },
    'home.v4.loading': { zh: '正在加载实时库存…', fr: 'Chargement du stock en direct…', ar: 'جاري تحميل المخزون المباشر…' },
    'home.v4.browse': { zh: '浏览', fr: 'Parcourir', ar: 'تصفح' },
    'home.v4.lookingFor': { zh: '您在找什么？', fr: 'Que recherchez-vous ?', ar: 'ماذا تبحث عنه؟' },
    'home.v4.listings': { zh: '件库存', fr: 'annonces', ar: 'قوائم' },
    'home.v4.liveMeta': { zh: '{n} 件在售 · 更新于 {t} UTC', fr: '{n} annonces en ligne · maj {t} UTC', ar: '{n} قوائم مباشرة · تحديث {t} UTC' },
    'home.v4.stat.items': { zh: '在售库存', fr: 'Articles en stock', ar: 'قطع في المخزون' },
    'home.v4.stat.destinations': { zh: '出口目的地', fr: 'Destinations d\'export', ar: 'وجهات التصدير' },
    'home.v4.stat.quote': { zh: '报价响应', fr: 'Délai de devis', ar: 'وقت الرد على العرض' },
    'home.v4.stat.brands': { zh: '车辆品牌', fr: 'Marques', ar: 'علامات تجارية' },
    'home.v4.shelf.liveStock': { zh: '实时库存', fr: 'Stock en direct', ar: 'مخزون مباشر' },
    'home.v4.shelf.halfSub': { zh: '按需拆解 · 配件可定制', fr: 'Démontage sur mesure · Pièces à la demande', ar: 'تفكيك حسب الطلب · قطع حسب الحاجة' },
    'home.v4.shelf.fromHalf': { zh: '来自半切车', fr: 'Issus des demi-coupes', ar: 'من الأنصاف المقطوعة' },
    'home.v4.shelf.engineSub': { zh: '在售发动机代码 · EXW 参考价', fr: 'Codes moteur en stock · référence EXW', ar: 'أكواد محركات متوفرة · مرجع EXW' },
    'home.v4.shelf.commercial': { zh: '商用车', fr: 'Commercial', ar: 'تجاري' },
    'home.v4.shelf.truckSub': { zh: '出口用驾驶室', fr: 'Cabines pour l\'export', ar: 'كبائن للتصدير' },
    'home.v4.shelf.heavy': { zh: '重型', fr: 'Lourd', ar: 'ثقيل' },
    'home.v4.shelf.machSub': { zh: '工程机械与发动机', fr: 'Engins & moteurs', ar: 'معدات ومحركات' },
    'home.v4.shelf.export': { zh: '出口', fr: 'Export', ar: 'تصدير' },
    'home.v4.shelf.usedSub': { zh: '可整车发运', fr: 'Véhicules complets à expédier', ar: 'مركبات كاملة للشحن' },
    'home.v4.seeAll': { zh: '查看全部 →', fr: 'Tout voir →', ar: 'عرض الكل ←' },
    'home.v4.seeAllN': { zh: '查看全部 {n} →', fr: 'Tout voir {n} →', ar: 'عرض الكل {n} ←' },
    'home.v4.quote': { zh: '询价 →', fr: 'Devis →', ar: 'عرض سعر ←' },
    'home.v4.photo': { zh: '照片', fr: 'Photo', ar: 'صورة' },
    'home.v4.emptyShelf': { zh: '该分类暂无库存。', fr: 'Aucun article dans cette catégorie pour le moment.', ar: 'لا توجد عناصر في هذه الفئة حالياً.' },
    'home.v4.featured': { zh: '精选车源', fr: 'Annonce vedette', ar: 'إعلان مميز' },
    'home.v4.handpicked': { zh: '本周精选', fr: 'Sélection de la semaine', ar: 'مختارات هذا الأسبوع' },
    'home.v4.inStock': { zh: '✓ 现货', fr: '✓ En stock', ar: '✓ متوفر' },
    'home.v4.videoVerifiedBadge': { zh: '✓ 视频已验证', fr: '✓ Vidéo vérifiée', ar: '✓ فيديو موثق' },
    'home.v4.watchVideo': { zh: '观看视频', fr: 'Voir la vidéo', ar: 'شاهد الفيديو' },
    'home.v4.productPhoto': { zh: '产品照片', fr: 'Photo produit', ar: 'صورة المنتج' },
    'home.v4.spec.engine': { zh: '发动机', fr: 'Moteur', ar: 'محرك' },
    'home.v4.spec.transmission': { zh: '变速箱', fr: 'Boîte', ar: 'ناقل الحركة' },
    'home.v4.spec.drivetrain': { zh: '驱动', fr: 'Transmission', ar: 'نظام الدفع' },
    'home.v4.spec.stockId': { zh: '库存编号', fr: 'N° stock', ar: 'رقم المخزون' },
    'home.v4.liveNote': { zh: '实时库存 · asia-power.com', fr: 'Stock en direct · asia-power.com', ar: 'مخزون مباشر · asia-power.com' },
    'home.v4.viewDetails': { zh: '查看详情 →', fr: 'Voir détails →', ar: 'عرض التفاصيل ←' },
    'home.v4.engineNote': { zh: '发动机 EXW 参考价（约 65%）', fr: 'Réf. EXW moteur (~65%)', ar: 'مرجع EXW للمحرك (~65%)' },
    'home.v4.footer.blurb': {
      zh: '全球动力总成交易平台 — 半切车、发动机、卡车与工程机械出口。',
      fr: 'Marketplace mondiale de groupes motopropulseurs — demi-coupes, moteurs, camions et engins à l\'export.',
      ar: 'سوق عالمي لمجموعات نقل الحركة — أنصاف مقطوعة ومحركات وشاحنات ومعدات للتصدير.',
    },
    'home.v4.footer.products': { zh: '产品', fr: 'Produits', ar: 'المنتجات' },
    'home.v4.footer.company': { zh: '公司', fr: 'Entreprise', ar: 'الشركة' },
    'home.v4.footer.getQuote': { zh: '获取报价', fr: 'Obtenir un devis', ar: 'احصل على عرض سعر' },
    'home.v4.footer.reply': { zh: '24 小时内回复 · EXW 与 CIF', fr: 'Réponse sous 24 h · EXW & CIF', ar: 'رد خلال 24 ساعة · EXW و CIF' },
    'home.v4.footer.wa': { zh: '立即 WhatsApp', fr: 'WhatsApp maintenant', ar: 'واتساب الآن' },
    'home.v4.footer.ships': { zh: 'EXW 郑州 · 全球发运', fr: 'EXW Zhengzhou · Expédition mondiale', ar: 'EXW تشنغتشو · شحن عالمي' },
    'home.v4.unavailable': { zh: '库存暂时不可用', fr: 'Inventaire temporairement indisponible', ar: 'المخزون غير متاح مؤقتاً' },
    'home.v4.cat.engines': { zh: '发动机', fr: 'Moteurs', ar: 'محركات' },
    'home.v4.cat.construction': { zh: '工程机械', fr: 'Chantier', ar: 'معدات ثقيلة' },
    'home.v4.halfCutSuffix': { zh: '半切车', fr: 'Demi-coupe', ar: 'نصف مقطوعة' },
    'home.v4.cabSuffix': { zh: '驾驶室', fr: 'Cabine', ar: 'كابينة' },
    'home.v4.engineSuffix': { zh: '发动机', fr: 'Moteur', ar: 'محرك' },
    'home.v4.quoteOnly': { zh: '询价', fr: 'Sur devis', ar: 'عرض سعر' },
    'home.missionEyebrow': { zh: '循环经济 · 全球出口', fr: 'Économie circulaire · Export mondial', ar: 'اقتصاد دائري · تصدير عالمي' },
    'home.missionTitle': { zh: '让每一件可循环利用的资产，都拥有第二次生命。', fr: 'Donner une seconde vie à chaque actif réutilisable.', ar: 'امنح كل أصل قابل لإعادة الاستخدام حياة ثانية.' },
    'home.missionLead': { zh: 'AsiaPower 正在从汽车零部件贸易出发，建设连接全球供应商、采购商、数据与人工智能的行业基础设施。我们欢迎客户、供应商和合作伙伴，与我们一起推动更高效、更透明、更可信的循环经济。', fr: 'AsiaPower part du commerce de pièces automobiles pour construire une infrastructure reliant fournisseurs, acheteurs, données et IA à l\'échelle mondiale. Clients, fournisseurs et partenaires sont les bienvenus pour une économie circulaire plus efficace, transparente et fiable.', ar: 'تبدأ AsiaPower من تجارة قطع السيارات لبناء بنية تحتية صناعية تربط الموردين والمشترين والبيانات والذكاء الاصطناعي عالمياً. نرحب بالعملاء والموردين والشركاء لاقتصاد دائري أكثر كفاءة وشفافية وثقة.' },
    'home.newListing': { zh: '新上架', fr: 'Nouvelle annonce', ar: 'إعلان جديد' },
    'home.videoVerified': { zh: '视频已验证', fr: 'Vidéo vérifiée', ar: 'فيديو موثق' },
    'home.exportReady': { zh: '可出口', fr: 'Prêt à l\'export', ar: 'جاهز للتصدير' },
    'home.agreeRecommend': { zh: '100% 推荐', fr: '100% recommandé', ar: '100% موصى به' },
    'home.fromQuote': { zh: '询价', fr: 'Sur devis', ar: 'عرض سعر' },
    'home.video': { zh: '视频', fr: 'Vidéo', ar: 'فيديو' },
    'home.noListings': { zh: '暂无库存', fr: 'Aucune annonce pour le moment.', ar: 'لا توجد قوائم متاحة حالياً.' },
    'catalog.viewBrands': { zh: '查看品牌', fr: 'Voir les marques', ar: 'عرض العلامات التجارية'},
    'home.eyebrow': { zh: '全球动力总成采购平台' , fr: 'Plateforme mondiale d\'approvisionnement en groupes motopropulseurs', ar: 'منصة عالمية لتوريد مجموعة نقل الحركة' },
    'home.title': { zh: '动力总成配件<br><em>快速采购</em>' , fr: 'Pièces de groupe motopropulseur<br><em>Prêtes à sourcer</em>', ar: 'قطع مجموعة نقل الحركة<br><em>جاهزة للتوريد</em>' },
    'home.lead': {
      zh: 'AsiaPower 为全球进口商、维修厂和车队运营商对接中国供应网络 — 提供发动机、变速箱、底盘件及定制拆解乘用车，覆盖乘用车、卡车、摩托车与工程机械。',
      fr: 'AsiaPower connecte les importateurs, ateliers et opérateurs de flottes du monde entier à un réseau d\'approvisionnement basé en Chine couvrant moteurs, boîtes de vitesses, pièces de châssis et demi-carcasses sur mesure — pour voitures particulières, camions, motos et engins de chantier.',
      ar: 'تربط AsiaPower المستوردين وورش العمل ومشغلي الأساطيل حول العالم بشبكة توريد مقرها الصين تشمل المحركات وعلب التروس وقطع الشاسيه والتفكيك المخصص (نصف مقطوعة) - للسيارات الخاصة والشاحنات والدراجات النارية والمعدات الثقيلة.',
    },
    'home.productLines': { zh: '产品线' , fr: 'Lignes de produits', ar: 'خطوط المنتجات' },
    'home.truckHeadsAvail': { zh: '卡车车头 / 驾驶室' , fr: 'Cabines de camion', ar: 'مقدمات/كبائن الشاحنات' },
    'home.truckHeadQuote': { zh: '索取卡车车头报价' , fr: 'Demander un devis pour cabine de camion', ar: 'طلب عرض سعر لمقدمة شاحنة' },
    'home.whatsappTruck': { zh: 'WhatsApp 发送卡车需求' , fr: 'Envoyer une demande de camion sur WhatsApp', ar: 'إرسال طلب شاحنة عبر واتساب' },
    'home.requestQuoteCta': { zh: '索取报价' , fr: 'Demander un devis', ar: 'طلب عرض سعر' },
    'home.whatsappGeneral': { zh: 'WhatsApp 联系我们' , fr: 'Discuter avec nous sur WhatsApp', ar: 'تحدث معنا عبر واتساب' },
    'home.viewProductsCta': { zh: '查看产品' , fr: 'Voir les produits', ar: 'عرض المنتجات' },
    'home.downloadAppCta': { zh: '下载 APP' , fr: 'Télécharger l’APP', ar: 'تنزيل التطبيق' },
    'home.requestQuote': { zh: '索取报价' , fr: 'Demander un devis', ar: 'طلب عرض سعر' },
    'trust.block': { zh: '适用时可提供拆解前整车启动视频。客户确认后可按买方要求拆解部件。', fr: 'Vidéo de démarrage du véhicule complet disponible avant démontage. Les pièces peuvent être démontées selon les exigences de l\'acheteur après confirmation.', ar: 'فيديو تشغيل المركبة الكاملة متاح قبل التفكيك. يمكن تفكيك القطع حسب متطلبات المشتري بعد التأكيد.' },
    'trust.startupVideo': { zh: '适用时可提供拆解前整车启动视频。' , fr: 'Vidéo de démarrage du véhicule complet disponible avant démontage.', ar: 'فيديو تشغيل المركبة الكاملة متاح قبل التفكيك.' },
    'trust.buyerDismantle': { zh: '客户确认后可按买方要求拆解部件。' , fr: 'Les pièces peuvent être démontées selon les exigences de l\'acheteur après confirmation.', ar: 'يمكن تفكيك القطع حسب متطلبات المشتري بعد التأكيد.' },
    'ebay.trust.aria': { en: 'AsiaPower export assurance', zh: 'AsiaPower 出口保障', fr: 'Garanties export AsiaPower', ar: 'ضمانات تصدير AsiaPower' },
    'ebay.trust.shipping.label': { en: 'Global export', zh: '全球出口', fr: 'Export mondial', ar: 'تصدير عالمي' },
    'ebay.trust.shipping.sub': { en: '110+ destinations · EXW & CIF quotes', zh: '110+ 目的国 · EXW/CIF 报价', fr: '110+ destinations · devis EXW et CIF', ar: '110+ وجهة · عروض EXW و CIF' },
    'ebay.trust.quality.label': { en: 'Verified condition', zh: '车况可验证', fr: 'État vérifié', ar: 'حالة موثّقة' },
    'ebay.trust.quality.sub': { en: 'Pre-dismantle startup video on request', zh: '可按需提供拆解前启动视频', fr: 'Vidéo de démarrage avant démontage sur demande', ar: 'فيديو تشغيل قبل التفكيك عند الطلب' },
    'ebay.trust.pricing.label': { en: 'Transparent EXW pricing', zh: '透明 EXW 定价', fr: 'Tarifs EXW transparents', ar: 'تسعير EXW شفاف' },
    'ebay.trust.pricing.sub': { en: 'Quoted direct from live inventory', zh: '基于实时库存报价', fr: 'Devis basés sur le stock en direct', ar: 'عروض من المخزون المباشر' },
    'ebay.trust.suppliers.label': { en: '200+ supplier network', zh: '200+ 供应商网络', fr: 'Réseau de 200+ fournisseurs', ar: 'شبكة 200+ مورّد' },
    'ebay.trust.suppliers.sub': { en: 'Zhengzhou hub · passenger · truck · machinery', zh: '郑州枢纽 · 乘用车 · 卡车 · 工程机械', fr: 'Hub Zhengzhou · VP · camions · engins', ar: 'مركز Zhengzhou · ركاب · شاحنات · معدات' },
    'home.capabilityTitle': { zh: '规模化全球采购' , fr: 'Approvisionnement mondial à grande échelle', ar: 'توريد عالمي على نطاق واسع' },
    'home.enginesAvail': { zh: '可用发动机', fr: 'Moteurs disponibles', ar: 'محركات متوفرة' },
    'home.gearboxesAvail': { zh: '可用变速箱' , fr: 'Boîtes de vitesses disponibles', ar: 'علب تروس متوفرة' },
    'home.halfCutsAvail': { zh: '可用乘用车' , fr: 'Demi-carcasses disponibles', ar: 'نصف مقطوعة متوفرة' },
    'home.exportNetwork': { zh: '全球出口网络' , fr: 'Réseau d\'exportation mondial', ar: 'شبكة تصدير عالمية' },
    'home.marketsLabel': { zh: '目标市场' , fr: 'Marchés cibles', ar: 'الأسواق المستهدفة' },
    'home.whatsappQuote': { zh: 'WhatsApp 获取报价' , fr: 'Devis sur WhatsApp', ar: 'عرض سعر عبر واتساب' },
    'inquiryCta.whatsapp': { en: 'WhatsApp Us for Price', zh: 'WhatsApp 询价', fr: 'WhatsApp pour le prix', ar: 'واتساب للسعر' },
    'inquiryCta.contact': { en: 'Inquire Now', zh: '立即询盘', fr: 'Demander maintenant', ar: 'استفسر الآن' },
    'inquiryCta.hint': { en: 'Fast reply Mon–Sat · EXW & CIF quotes', zh: '周一至六快速回复 · 支持 EXW/CIF 报价', fr: 'Réponse rapide lun–sam · devis EXW & CIF', ar: 'رد سريع الإثنين–السبت · عروض EXW و CIF' },
    'home.browseBrands': { zh: '浏览品牌' , fr: 'Parcourir les marques', ar: 'تصفح العلامات التجارية' },
    'brands.label': { zh: '主要入口', fr: 'Point d\'entrée principal', ar: 'نقطة الدخول الرئيسية'},
    'brands.title': { zh: '品牌目录', fr: 'Répertoire des marques', ar: 'دليل العلامة التجارية'},
    'brands.lead': {
      zh: '选择当前有公开库存信号的车辆品牌，查看发动机、变速箱、底盘件及乘用车。该目录会随库存自动更新。', fr: 'Sélectionnez une marque actuellement présente dans les signaux d\'inventaire publics pour accéder aux moteurs, boîtes de vitesses, pièces de châssis et demi-coupes. Ce répertoire se met à jour avec le stock.', ar: 'اختر علامة مركبة لديها إشارات مخزون عامة حالية للوصول إلى المحركات وعلب التروس وقطع الشاسيه وأنصاف القطع. يتحدث هذا الدليل مع المخزون.'},
    'brands.vehicleBrands': { zh: '有库存品牌', fr: 'MARQUES EN STOCK', ar: 'علامات متوفرة'},
    'brands.productLines': { zh: '产品线', fr: 'Lignes de produits', ar: 'خطوط انتاج'},
    'brands.globalExport': { zh: '全球出口', fr: 'Exportation globale', ar: 'تصدير عالمي'},
    'engines.title': { zh: '发动机型号目录', fr: 'Catalogue de modèles de moteur', ar: 'كتالوج طراز المحرك'},
    'engines.lead': { zh: '按品牌分组的公开发动机型号目录。适用时可提供拆解前整车启动视频。可索取 EXW/CIF 报价。', fr: 'Annuaire public des modèles de moteurs pris en charge regroupés par marque. Vidéo de démarrage du véhicule entier disponible avant le démontage, le cas échéant. Demandez une tarification EXW/CIF.', ar: 'دليل عام لنماذج المحركات المدعومة مجمعة حسب العلامة التجارية. يتوفر فيديو بدء تشغيل السيارة بالكامل قبل التفكيك عند الاقتضاء. اطلب أسعار التسليم على ظهر السفينة/التكلفة والتأمين والشحن.'},
    'engines.countLabel': { zh: '个发动机型号', fr: 'modèles de moteur répertoriés', ar: 'موديلات المحركات المدرجة'},
    'engines.allBrands': { zh: '全部品牌', fr: 'Toutes les marques', ar: 'جميع العلامات التجارية'},
    'engines.petrol': { zh: '汽油', fr: 'Bleu pétrole', ar: 'البنزين'},
    'engines.diesel': { zh: '柴油', fr: 'super', ar: 'ديزل'},
    'engines.hybrid': { zh: '混动', fr: 'Hybride', ar: 'مختلطة'},
    'catalog.popularBrands': { zh: '热门品牌', fr: 'Marques populaires', ar: 'العلامات التجارية المميّزة'},
    'catalog.searchEngines': { zh: '搜索发动机代号、品牌或适用车型…', fr: 'Code moteur de recherche, marque ou application…', ar: 'رمز محرك البحث أو علامته التجارية أو تطبيقه...'},
    'catalog.searchGearboxes': { zh: '搜索变速箱代号、品牌或车型…', fr: 'Rechercher le code de transmission, la marque ou le modèle…', ar: 'البحث عن رمز الإرسال أو العلامة التجارية أو الطراز...'},
    'catalog.searchChassis': { zh: '搜索底盘平台、品牌或适用车型…', fr: 'Plateforme de recherche, marque ou application…', ar: 'البحث عن منصة أو علامة تجارية أو تطبيق...'},
    'catalog.noMatch': { zh: '没有符合搜索条件的条目。', fr: 'Aucune concordance n’a été trouvée ', ar: 'لا توجد تطابقات لبحثك.'},
    'gearboxes.title': { zh: '变速箱目录', fr: 'Catalogue de la boîte de vitesses', ar: 'كتالوج علبة التروس'},
    'gearboxes.lead': { zh: '自动、手动、CVT 及四驱变速箱，支持全球出口。按品牌浏览或索取 EXW/CIF 报价。', fr: 'Transmissions automatiques, manuelles, CVT et 4WD pour l\'exportation globale. Parcourez par marque ou demandez une tarification EXW/CIF.', ar: 'ناقل حركة أوتوماتيكي ويدوي وناقل حركة متغير السرعة وناقل حركة رباعي الدفع للتصدير العالمي. تصفح حسب العلامة التجارية أو اطلب أسعار التسليم على ظهر السفينة/التكلفة والتأمين والشحن.'},
    'gearboxes.catalogLabel': { zh: '公开变速箱目录', fr: 'Catalogue de boîtes de vitesses publiques', ar: 'كتالوج صندوق التروس العام'},
    'gearboxes.all': { zh: '全部', fr: 'Tous', ar: 'الكل'},
    'gearboxes.automatic': { zh: '自动', fr: 'Automatique', ar: 'أوتوماتيك'},
    'gearboxes.manual': { zh: '手动', fr: 'Manuel', ar: 'العمل اليدوي'},
    'gearboxes.cvt': { zh: 'CVT', fr: 'CVT', ar: 'ناقل متعدد السرعات CVT'},
    'gearboxes.4wd': { zh: '四驱', fr: '4 roues motrices', ar: 'سيارة رباعية الدفع'},
    'gearboxes.countLabel': { zh: '个变速箱型号', fr: 'boîtes de vitesses répertoriées', ar: 'علب التروس المدرجة'},
    'gearboxes.countUnit': { zh: '变速箱型号', fr: 'boîtes de vitesses répertoriées', ar: 'علب التروس المدرجة'},
    'gearboxes.inventorySection': { zh: '乘用车库存参考', fr: 'Référence des stocks de demi-coupures', ar: 'مرجع المخزون نصف المقطوع'},
    'chassis.title': { zh: '底盘件目录', fr: 'Catalogue des pièces du châssis', ar: 'كتالوج قطع غيار الشاسيه'},
    'chassis.lead': { zh: '悬架、转向、制动、车桥及差速器 — 按品牌采购，支持全球出口。', fr: 'Suspension, direction, composants de freins, essieux et différentiels — approvisionnés par marque pour l\'exportation mondiale.', ar: 'التعليق والتوجيه ومكونات الفرامل والمحاور والفروق — مصدرها العلامة التجارية للتصدير العالمي.'},
    'chassis.catalogLabel': { zh: '公开底盘件目录', fr: 'Catalogue de châssis public', ar: 'كتالوج الشاسيه العام'},
    'chassis.suspension': { zh: '悬架', fr: 'suspension', ar: 'نظام التعليق'},
    'chassis.steering': { zh: '转向', fr: 'Direction', ar: 'التوجيه'},
    'chassis.brakes': { zh: '制动', fr: 'Freins', ar: 'الفرامل'},
    'chassis.drivetrain': { zh: '传动系统', fr: 'Transmission secondaire', ar: 'نظام الدفع'},
    'chassis.countLabel': { zh: '个底盘平台', fr: 'plateformes de châssis répertoriées', ar: 'منصات الشاسيه المدرجة'},
    'chassis.countUnit': { zh: '底盘平台', fr: 'plateformes de châssis répertoriées', ar: 'منصات الشاسيه المدرجة'},
    'chassis.inventorySection': { zh: '乘用车库存参考', fr: 'Référence inventaire demi-coupures', ar: 'مرجع مخزون نصف المقطوعة'},
    'chassis.browseLead': { zh: '查看该品牌全部底盘件分类。', fr: 'Voir toutes les catégories de châssis disponibles pour votre marque de véhicule.', ar: 'اطَّلِع على جميع فئات الشاسيه المتاحة للشركة المُصنِّعة لسيارتك.'},
    'halfcuts.title': { zh: '乘用车目录', fr: 'Catalogue des demi-coupes', ar: 'كتالوج القطع النصفي'},
    'halfcuts.lead': {
      zh: '按品牌、车型、发动机代号、变速箱代号或库存编号搜索乘用车。适用时可提供拆解前整车启动视频；客户确认后可按买方要求拆解部件。', fr: 'Recherchez l\'inventaire demi-coupures par marque, modèle, code moteur, code transmission ou n° stock. Vidéo de démarrage du véhicule complet disponible avant démontage le cas échéant. Les pièces peuvent être démontées selon les exigences de l\'acheteur après confirmation.', ar: 'ابحث في مخزون نصف المقطوعة حسب العلامة التجارية والطراز ورمز المحرك ورمز ناقل الحركة أو رقم المخزون. فيديو تشغيل المركبة الكاملة متاح قبل التفكيك عند الإمكان. يمكن تفكيك القطع حسب متطلبات المشتري بعد التأكيد.'},
    'halfcuts.browseLead': { zh: '查看该品牌全部乘用车选项。', fr: 'Consultez toutes les options de demi-coupe pour votre marque de véhicule.', ar: 'اطَّلِع على جميع الخيارات النصف مقطوعة للعلامة التجارية لسيارتك.'},
    'trucks.title': { zh: '卡车', fr: 'Tracteurs', ar: 'الشاحنات'},
    'trucks.lead': { zh: '轻中重卡车头、驾驶室及拆车件 — 亚洲及欧洲品牌。适用时可提供拆解前整车启动视频。支持 EXW/CIF 全球出口。', fr: 'Têtes de camions légers, moyens et lourds, cabines de conduite et pièces démontées de marques asiatiques et européennes. Vidéo de démarrage du véhicule entier disponible avant le démontage. exportation EXW/CIF dans le monde entier.', ar: 'رؤوس الشاحنات الخفيفة والمتوسطة والثقيلة، ومقصورات السائق والأجزاء المفككة من العلامات التجارية الآسيوية والأوروبية. يتوفر فيديو بدء تشغيل السيارة بالكامل قبل التفكيك. تصدير EXW/CIF في جميع أنحاء العالم.'},
    'trucks.ctaTitle': { zh: '需要卡车库存？', fr: 'Besoin d\'un inventaire de camions ?', ar: 'هل تحتاج إلى مخزون من الشاحنات ؟'},
    'trucks.ctaLead': { zh: '发送品牌、车型及数量需求，24 小时内回复 EXW/CIF 报价。', fr: 'Envoyer les exigences de marque, de modèle et de quantité — devis EXW/CIF dans les 24 heures.', ar: 'إرسال متطلبات العلامة التجارية والطراز والكمية — عرض سعر التسليم على ظهر السفينة/التكلفة والتأمين والشحن في غضون 24 ساعة.'},
    'trucks.searchPlaceholder': { zh: '搜索库存编号、品牌、车型、发动机或变速箱…', fr: 'Rechercher un ID de stock, une marque, un modèle, un moteur ou une transmission…', ar: 'البحث عن معرف المخزون أو العلامة التجارية أو الطراز أو المحرك أو ناقل الحركة...'},
    'trucks.units': { zh: '台卡车', fr: 'élévateurs', ar: 'إسعاف'},
    'trucks.noMatch': { zh: '没有符合搜索条件的卡车。', fr: 'Aucun camion ne correspond à votre recherche.', ar: 'لا توجد شاحنات تطابق بحثك.'},
    'trucks.empty': { zh: '暂无卡车库存，请联系我们采购。', fr: 'Aucune annonce de camion pour le moment. Contactez-nous pour l\'approvisionnement.', ar: 'لا توجد إعلانات لشاحنات حتى الآن. اتصل بنا للحصول على المصادر.'},
    'trucks.halfCut': { zh: '卡车乘用车', fr: 'Demi-coupe de camion', ar: 'شاحنة نصف مقطوعة'},
    'trucks.allTrucks': { zh: '全部卡车', fr: 'Tous les camions', ar: 'جميع الشاحنات'},
    'trucks.truckHeadUnits': { zh: '车头 / 乘用车', fr: 'Tête de camion/ Demi-coupe', ar: 'رأس الشاحنة/ نصف المقطوعة'},
    'trucks.truckCabUnits': { zh: '驾驶室', fr: 'CABINE DE CONDUITE', ar: 'مقصورة الشاحنة'},
    'trucks.driverCab': { zh: '驾驶室', fr: 'Cabine du conducteur', ar: 'كابينة السائق'},
    'trucks.supplierUpload': { en: 'Supplier: Upload Truck Parts', zh: '供应商上传卡车配件', fr: 'Fournisseur : Téléverser pièces camion', ar: 'المورد: تحميل قطع الشاحنة' },
    'trucks.supplierUploadHint': { zh: '合作供应商？上传卡车配件照片与车辆信息，提交 AsiaPower 审核。', fr: 'Fournisseur partenaire ? Téléversez photos de pièces camion et détails pour examen AsiaPower.', ar: 'مورد شريك؟ ارفع صور قطع الشاحنة وتفاصيل المركبة لمراجعة AsiaPower.'},
    'truckheads.title': { zh: '二手卡车车头及驾驶室出口', fr: 'Têtes de camion et cabines de camion d\'occasion pour l\'exportation', ar: 'رؤوس الشاحنات المستعملة ومقصورات الشاحنات للتصدير'},
    'truckheads.lead': { zh: '日野、五十铃、扶桑、UD、豪沃、重汽等商用车车头及驾驶室。适用时提供拆解前整车启动视频，确认后可按客户要求拆解。', fr: 'Hino, Isuzu, Mitsubishi Fuso, UD, HOWO, Sinotruk et autres têtes de camions commerciaux et assemblages de cabine. Vidéo de démarrage du véhicule entier disponible avant le démontage. Les pièces peuvent être démontées selon les exigences de l\'acheteur après confirmation.', ar: 'HINO، ISUZU، MITSUBISHI FUSO، UD، HOWO، SINOTRUK وغيرها من رؤوس الشاحنات التجارية وتجميعات الكابينة. يتوفر فيديو بدء تشغيل السيارة بالكامل قبل التفكيك. يمكن تفكيك الأجزاء وفقًا لمتطلبات المشتري بعد التأكيد.'},
    'truckheads.brandsEyebrow': { zh: '商用车品牌', fr: 'Marques commerciales', ar: 'العلامات التجارية'},
    'truckheads.brandsTitle': { zh: '卡车车头与驾驶室采购', fr: 'Sourcing de la tête de camion et de la cabine', ar: 'مصادر رأس الشاحنة والكابينة'},
    'truckheads.brandsLead': { zh: '请提供品牌、型号、年份、发动机号、驾驶室类型、底盘号、目的国及数量，以便 EXW/CIF 报价。', fr: 'Envoyer la marque, le modèle, l\'année, le code moteur, le type de cabine, le numéro de châssis, le pays de destination et la quantité pour le devis EXW/CIF.', ar: 'إرسال العلامة التجارية والطراز والسنة ورمز المحرك ونوع الكابينة ورقم الشاسيه وبلد الوجهة والكمية لعرض أسعار التسليم على ظهر السفينة/التكلفة والتأمين والشحن.'},
    'truckheads.ctaTitle': { zh: '需要二手卡车车头或驾驶室？', fr: 'Vous recherchez des têtes de camion ou des cabines de camion usagées ?', ar: 'هل تبحث عن رؤوس شاحنات مستعملة أو سيارات أجرة شاحنات ؟'},
    'truckheads.ctaLead': { zh: 'AsiaPower 从中国供应渠道采购商用车车头及驾驶室。发送需求 — 24 小时内回复。', fr: 'AsiaPower s\'approvisionne en têtes et en cabines de véhicules commerciaux auprès de canaux d\'approvisionnement basés en Chine. Envoyez votre demande — nous vous répondons dans les 24 heures.', ar: 'تحصل AsiaPower على رؤوس المركبات التجارية وسيارات الأجرة من قنوات التوريد في الصين. أرسل طلبك — نرد عليك في غضون 24 ساعة.'},
    'motorcycles.title': { zh: '摩托车', fr: 'Motos', ar: 'الدراجات النارية'},
    'motorcycles.lead': { zh: '日系及中国品牌摩托车乘用车、发动机及配件 — 面向非洲、东南亚及中东出口。', fr: 'Demi-coupes, moteurs et pièces de moto japonais et chinois — exportation vers l\'Afrique, l\'Asie du Sud-Est et le Moyen-Orient.', ar: 'نصف قطع للدراجات النارية اليابانية والصينية والمحركات وقطع الغيار — التصدير إلى أفريقيا وجنوب شرق آسيا والشرق الأوسط.'},
    'motorcycles.ctaTitle': { zh: '需要摩托车库存？', fr: 'Besoin d\'inventaire moto ?', ar: 'هل تحتاج مخزون دراجات نارية؟'},
    'motorcycles.ctaLead': { zh: '发送品牌、排量及数量需求，24 小时内回复报价。', fr: 'Envoyez marque, cylindrée et quantité — devis sous 24 heures.', ar: 'أرسل العلامة والسعة والكمية — عرض سعر خلال 24 ساعة.'},
    'machinery.title': { zh: '工程机械', fr: 'des engins de chantier', ar: 'آلات البناء'},
    'machinery.lead': { zh: '装载机、挖掘机、推土机等工程机械 — 出口现货，部分库存含发动机启动视频。龙工、徐工、三一、临工、柳工及国际品牌。', fr: 'Chargeuses sur pneus, pelles, bulldozers et équipements lourds — stock prêt à l\'exportation avec photos et vidéo du moteur sur les unités sélectionnées. Lonking, XCMG, Sany, SDLG, LiuGong et des marques mondiales.', ar: 'اللوادر ذات العجلات والحفارات والجرافات والمعدات الثقيلة — مخزون جاهز للتصدير مع صور وفيديو المحرك على وحدات مختارة. Lonking و XCMG و Sany و SDLG و LiuGong والعلامات التجارية العالمية.'},
    'machinery.ctaTitle': { zh: '需要工程机械库存？', fr: 'Besoin d\'inventaire d\'engins de chantier ?', ar: 'هل تحتاج مخزون معدات ثقيلة؟'},
    'machinery.ctaLead': { zh: '发送设备类型、品牌及数量需求，24 小时内回复 EXW/CIF 报价。', fr: 'Envoyer le type d\'équipement, la marque et la quantité — devis EXW/CIF dans les 24 heures.', ar: 'إرسال نوع المعدات والعلامة التجارية والكمية — عرض سعر التسليم على ظهر السفينة/التكلفة والتأمين والشحن في غضون 24 ساعة.'},
    'machinery.searchPlaceholder': { zh: '搜索库存编号、龙工、装载机、挖掘机、发动机号…', fr: 'Recherche ID stock, Lonking, chargeuse sur pneus, excavatrice, code moteur…', ar: 'معرّف مخزون البحث، لونكينج، لودر بعجل، حفارة، رمز المحرك...'},
    'machinery.listings': { zh: '条工程机械', fr: 'annonces', ar: 'القوائم'},
    'machinery.empty': { zh: '该分类暂无工程机械库存，请联系我们采购。', fr: 'Aucune liste de machines dans cette catégorie pour le moment. Contactez-nous pour l\'approvisionnement.', ar: 'لا توجد قوائم للآلات في هذه الفئة حتى الآن. اتصل بنا للحصول على المصادر.'},
    'machinery.allTypes': { zh: '全部类型', fr: 'Tous les types', ar: 'جميع الأنواع '},
    'machinery.allMachinery': { zh: '全部工程机械', fr: 'Toutes les machines', ar: 'جميع الآلات'},
    'machinery.equipment': { zh: '工程机械', fr: 'Équipement de construction', ar: 'معدات التشييد'},
    'machinery.equipmentType': { zh: '设备类型', fr: 'Équipement', ar: 'المعدات'},
    'machinery.hours': { zh: '工时 / 里程', fr: 'Heures d\'utilisation', ar: 'مدة الاستخدام بالساعة:'},
    'machinery.popularBrands': { zh: '热门品牌', fr: 'Marques populaires', ar: 'العلامات التجارية المميّزة'},
    'machinery.noMatch': { zh: '没有符合搜索条件的工程机械。', fr: 'Aucune machine ne correspond à votre recherche.', ar: 'لا توجد آلات تطابق بحثك.'},
    'catalog.comingSoonEyebrow': { zh: '即将上线', fr: 'Prochainement', ar: 'قريباً'},
    'catalog.comingSoonTitle': { zh: '敬请期待', fr: 'Rester à l\'écoute', ar: 'ترقّبوا'},
    'catalog.comingSoonLead': { zh: '该栏目正在筹备中，即将开放。您可先浏览乘用车库存，或通过 WhatsApp 联系我们。', fr: 'Ce catalogue est en cours de préparation. Revenez bientôt — ou parcourez notre inventaire demi-coupé en attendant.', ar: 'يتم إعداد هذا الكتالوج. تحقق مرة أخرى قريبًا — أو تصفح مخزوننا نصف المقطوع في هذه الأثناء.'},
    'catalog.or': { zh: '或', fr: 'ou', ar: 'أو'},
    'hc.searchPlaceholder': { zh: '搜索库存编号、品牌、车型、发动机或变速箱…', fr: 'Rechercher un ID de stock, une marque, un modèle, un moteur ou une transmission…', ar: 'البحث عن معرف المخزون أو العلامة التجارية أو الطراز أو المحرك أو ناقل الحركة...'},
    'hc.brand': { zh: '品牌', fr: 'Marque', ar: 'العلامة التجارية'},
    'hc.allBrands': { zh: '全部品牌', fr: 'Toutes les marques', ar: 'جميع العلامات التجارية'},
    'hc.all': { zh: '全部', fr: 'Tous', ar: 'الكل'},
    'hc.available': { zh: '现货', fr: 'Disponible', ar: 'متاح'},
    'hc.reserved': { zh: '预留', fr: 'Réservé', ar: 'محجوز'},
    'hc.inTransit': { zh: '在途', fr: 'En transit', ar: 'في العبور'},
    'hc.sold': { zh: '已售', fr: 'Vendu', ar: 'المباعة'},
    'hc.showing': { zh: '显示', fr: 'Affichage', ar: '[ترجمة المصطلح: Showing]'},
    'hc.of': { zh: '共', fr: 'sur', ar: 'لــ'},
    'hc.halfCuts': { zh: '台乘用车', fr: ', de découpes partielles', ar: 'أنصاف الجروح'},
    'hc.photosOnRequest': { zh: '照片备索', fr: 'Photos sur demande.', ar: 'الصور عند الطلب'},
    'hc.noMatch': { zh: '没有匹配的乘用车。', fr: 'Aucune demi-coupe ne correspond à votre recherche.', ar: 'لا توجد قصات نصفية تتطابق مع بحثك.'},
    'hc.sendRequest': { zh: '发送您的需求', fr: 'Envoyez-nous votre demande', ar: 'إرسال طلبك'},
    'spec.brand': { zh: '品牌', fr: 'Marque', ar: 'العلامة التجارية'},
    'spec.model': { zh: '车型', fr: 'Modèle', ar: 'النموذج'},
    'spec.year': { zh: '年份', fr: 'Année /plage d\'années', ar: 'نطاق السنة / السنة'},
    'spec.engine': { zh: '发动机', fr: 'Moteur', ar: 'محرك'},
    'spec.transmission': { zh: '变速箱', fr: 'Type de Boite vitesse', ar: 'النقل'},
    'spec.mileage': { zh: '里程', fr: 'N° BON', ar: 'إجمالي الأميال المقطوعة'},
    'spec.vin': { zh: 'VIN', fr: 'VIN', ar: 'رقم تعريف المركبة:'},
    'hc.inventoryDisclaimer': { zh: '适用时可提供拆解前整车启动视频。客户确认后可按买方要求拆解部件。库存以最终确认为准。照片、价格及运费均在询价后确认。', fr: 'Vidéo de démarrage du véhicule complet disponible avant démontage. Les pièces peuvent être démontées selon les exigences de l\'acheteur après confirmation. L\'inventaire est soumis à confirmation finale. Photos, prix et frais d\'expédition confirmés sur demande avant export.', ar: 'فيديو تشغيل المركبة الكاملة متاح قبل التفكيك. يمكن تفكيك القطع حسب متطلبات المشتري بعد التأكيد. المخزون خاضع للتأكيد النهائي. الصور والسعر وتكلفة الشحن تُؤكَّد عند الطلب قبل التصدير.'},
    'hc.inventoryDisclaimerBase': { zh: '库存以最终确认为准。照片、价格及运费均在询价后确认。', fr: 'L\'inventaire est soumis à confirmation finale. Les photos, le prix et les frais d\'expédition sont confirmés sur demande avant l\'exportation.', ar: 'يخضع المخزون للتأكيد النهائي. يتم تأكيد الصور والسعر وتكلفة الشحن عند الطلب قبل التصدير.'},
    'hc.viewDetails': { zh: '查看详情', fr: 'Voir les détails', ar: 'عرض التفاصيل'},
    'hc.requestPrice': { zh: '索取价格', fr: 'Demande de prix', ar: 'طلب سعر'},
    'hc.exwBadge': { en: 'EXW', zh: '出厂价', fr: 'EXW', ar: 'EXW' },
    'hc.customDismantleShort': { en: 'Custom dismantling', zh: '全新拆卸', fr: 'Démontage sur mesure', ar: 'تفكيك مخصص' },
    'hc.requestPhotos': { zh: '索取照片', fr: 'Demander des photos', ar: 'طلب صور'},
    'hc.shareFacebook': { zh: '分享到 Facebook', fr: 'Partager sur Facebook', ar: 'مشاركة على Facebook'},
    'hc.checkAvailability': { zh: '确认现货', fr: 'Vérifier la disponibilité', ar: 'التحقق من الصلاحية'},
    'hc.requestSimilar': { zh: '索取类似车源', fr: 'Demander une unité similaire', ar: 'طلب وحدة مماثلة'},
    'hc.photos': { zh: '照片', fr: 'Photos', ar: 'الصور'},
    'hc.video': { zh: '视频', fr: 'Vidéos', ar: 'مقطع الفيديو'},
    'hc.videoMovFallback': { zh: 'QuickTime (.mov) 视频可能无法在本浏览器内播放。', fr: 'QuickTime (.mov) peut ne pas être lu dans ce navigateur.', ar: 'قد لا يُشغَّل QuickTime (.mov) في هذا المتصفح.'},
    'hc.videoDownload': { zh: '下载视频', fr: 'Télécharger la vidéo', ar: 'تنزيل الفيديو'},
    'hc.videoMp4Hint': { zh: '建议供应商上传 MP4 格式以获得最佳兼容性。', fr: 'Fournisseurs : téléversez en MP4 pour une meilleure compatibilité.', ar: 'الموردون: ارفع MP4 لأفضل توافق.'},
    'hc.fobPrice': { zh: 'EXW价', fr: 'Prix EXW', ar: 'سعر EXW'},
    'hc.priceOnEnquiry': { zh: 'EXW价询价', fr: 'Prix obtenus sur demande', ar: 'سعر EXW عند الاستفسار'},
    'spec.fobPrice': { zh: 'EXW价（美元）', fr: 'Prix EXW (USD)', ar: 'سعر EXW (دولار أمريكي)'},
    'home.whyEyebrow': { zh: '为什么选择 AsiaPower' , fr: 'Pourquoi AsiaPower', ar: 'لماذا AsiaPower' },
    'home.whyTitle': { zh: '为专业全球贸易而生' , fr: 'Conçu pour le commerce mondial professionnel', ar: 'مصمم للتجارة العالمية المتخصصة' },
    'home.pillar1Title': { zh: '可信赖' , fr: 'Confiance', ar: 'الثقة' },
    'home.pillar1Desc': { zh: '适用时可提供拆解前整车启动视频，附照片及出口单证。客户确认后可按买方要求拆解部件。', fr: 'Vidéo de démarrage du véhicule complet disponible avant démontage, ainsi que photos et documentation d\'exportation. Les pièces peuvent être démontées selon les exigences de l\'acheteur après confirmation.', ar: 'فيديو تشغيل المركبة الكاملة متاح قبل التفكيك، إلى جانب الصور ووثائق التصدير. يمكن تفكيك القطع حسب متطلبات المشتري بعد التأكيد.' },
    'home.pillar2Title': { zh: '规模' , fr: 'Échelle', ar: 'النطاق' },
    'home.pillar2Desc': { zh: '已向 110+ 国家出口 6,000+ 台套。支持单台 LCL 与整柜批量采购。' , fr: 'Plus de 6 000 unités exportées dans plus de 110 pays. Programmes conteneur et LCL pour acheteurs à l\'unité ou en volume.', ar: 'تم تصدير أكثر من 6000 وحدة إلى أكثر من 110 دولة. برامج الحاويات وLCL للمشترين بالوحدة أو بالجملة.' },
    'home.pillar3Title': { zh: '供应网络' , fr: 'Réseau de fournisseurs', ar: 'شبكة الموردين' },
    'home.pillar3Desc': { zh: '200+ 验证供应商覆盖日本、韩国及中国 — 经郑州出口渠道整合。' , fr: 'Plus de 200 fournisseurs vérifiés au Japon, en Corée et en Chine — regroupés via des canaux d\'exportation basés à Zhengzhou.', ar: 'أكثر من 200 مورد موثّق في اليابان وكوريا والصين - مجمّعة عبر قنوات تصدير مقرها تشنغتشو.' },
    'home.pillar4Title': { zh: '全球出口' , fr: 'Exportation mondiale', ar: 'تصدير عالمي' },
    'home.pillar4Desc': { zh: 'EXW/CIF 发运至非洲、美洲、加勒比、中东、东南亚及澳洲。专业出口包装与物流。' , fr: 'Expédition EXW et CIF vers l\'Afrique, les Amériques, les Caraïbes, le Moyen-Orient, l\'Asie du Sud-Est et l\'Australie. Emballage et logistique d\'exportation complets.', ar: 'شحن EXW وCIF إلى أفريقيا والأمريكتين والكاريبي والشرق الأوسط وجنوب شرق آسيا وأستراليا. تعبئة وخدمات لوجستية تصدير كاملة.' },
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
    'home.catHalfCuts': { zh: '定制拆解（乘用车）' , fr: 'Démontage sur mesure (demi-carcasses)', ar: 'تفكيك مخصص (نصف مقطوعة)' },
    'home.catHalfCutsDesc': { zh: '按买家要求拆解的前切、后切、鼻切及完整乘用车，用于翻新与拆解项目。' , fr: 'Coupes avant, arrière, avant complet et carcasses entières démontées selon les spécifications de l\'acheteur pour la reconstruction et l\'extraction.', ar: 'قطع أمامية وخلفية وكاملة مفككة حسب مواصفات المشتري لمشاريع إعادة البناء والاستخراج.' },
    'home.viewCategory': { zh: '查看目录 →' , fr: 'Voir la catégorie →', ar: 'عرض الفئة ←' },
    'home.brandsEyebrow': { zh: '从这里开始' , fr: 'Commencez ici', ar: 'ابدأ من هنا' },
    'home.brandsTitle': { zh: '支持品牌' , fr: 'Marques prises en charge', ar: 'العلامات التجارية المدعومة' },
    'home.brandsLead': { zh: '品牌是主要入口。选择车辆品牌，查看该品牌的发动机、变速箱、底盘件及乘用车。' , fr: 'La marque est le point d\'entrée principal. Choisissez la marque du véhicule pour voir ses moteurs, boîtes de vitesses, pièces de châssis et demi-carcasses.', ar: 'العلامة التجارية هي نقطة الدخول الرئيسية. اختر علامة المركبة لعرض محركاتها وعلب تروسها وقطع شاسيها ونصف مقطوعاتها.' },
    'home.viewAllBrands': { zh: '查看有库存品牌' , fr: 'Voir les marques en stock', ar: 'عرض العلامات المتوفرة' },
    'home.processEyebrow': { zh: '采购流程' , fr: 'Processus d\'approvisionnement', ar: 'عملية التوريد' },
    'home.processTitle': { zh: '从询价到全球交付' , fr: 'De la demande à la livraison mondiale', ar: 'من الاستعلام إلى التسليم العالمي' },
    'home.process1Title': { zh: '选择品牌与产品' , fr: 'Choisir la marque et le produit', ar: 'اختيار العلامة التجارية والمنتج' },
    'home.process1Desc': { zh: '浏览品牌目录，或发送车辆品牌、车型、年份及发动机代号。' , fr: 'Parcourez le répertoire des marques ou envoyez la marque, le modèle, l\'année et le code moteur du véhicule.', ar: 'تصفح دليل العلامات التجارية أو أرسل العلامة التجارية والموديل والسنة ورمز المحرك.' },
    'home.process2Title': { zh: '获取报价' , fr: 'Obtenir un devis', ar: 'الحصول على عرض سعر' },
    'home.process2Desc': { zh: '24 小时内 EXW/CIF 报价。适用时可提供拆解前整车启动视频。' , fr: 'Devis EXW/CIF sous 24 heures. Vidéo de démarrage du véhicule complet disponible avant démontage le cas échéant.', ar: 'عرض سعر EXW/CIF خلال 24 ساعة. فيديو تشغيل المركبة الكاملة متاح قبل التفكيك عند الإمكان.' },
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
    'home.faq2A': { zh: '从品牌页开始。选择车辆品牌（例如 Toyota），浏览该品牌的发动机、变速箱、底盘件及乘用车。发送报价请求并附上发动机代号或 VIN 以便精准采购。' , fr: 'Commencez par notre page Marques. Sélectionnez la marque de votre véhicule — par exemple Toyota — puis parcourez les moteurs, boîtes de vitesses, pièces de châssis et demi-carcasses pour cette marque. Envoyez une demande de devis avec votre code moteur ou VIN pour un approvisionnement précis.', ar: 'ابدأ من صفحة العلامات التجارية. اختر علامة مركبتك - مثل Toyota - ثم تصفح المحركات وعلب التروس وقطع الشاسيه ونصف المقطوعة لهذه العلامة. أرسل طلب عرض سعر مع رمز المحرك أو رقم الهيكل (VIN) للحصول على توريد دقيق.' },
    'home.faq3Q': { zh: '是否支持国际运输？' , fr: 'Expédiez-vous à l\'international ?', ar: 'هل تشحنون دوليًا؟' },
    'home.faq3A': { zh: '支持。我们提供 EXW/CIF 发运至全球港口，包括非洲、美洲、加勒比、中东、东南亚及澳洲。所有订单规模均支持整柜及 LCL。' , fr: 'Oui. Nous proposons une expédition EXW et CIF vers des ports du monde entier, y compris l\'Afrique, les Amériques, les Caraïbes, le Moyen-Orient, l\'Asie du Sud-Est et l\'Australie. Options conteneur et LCL disponibles pour toutes les tailles de commande.', ar: 'نعم. نقدم شحن EXW وCIF إلى موانئ حول العالم بما في ذلك أفريقيا والأمريكتين والكاريبي والشرق الأوسط وجنوب شرق آسيا وأستراليا. خيارات الحاويات وLCL متاحة لجميع أحجام الطلبات.' },
    'home.ctaTitle': { zh: '准备采购动力总成配件？' , fr: 'Prêt à vous approvisionner en pièces de groupe motopropulseur ?', ar: 'هل أنت مستعد لتوريد قطع مجموعة نقل الحركة؟' },
    'home.ctaLead': { zh: '发送您的需求 — 24 小时内提供有竞争力的 EXW/CIF 报价。' , fr: 'Envoyez vos besoins — devis EXW/CIF compétitif sous 24 heures.', ar: 'أرسل متطلباتك - عرض سعر EXW/CIF تنافسي خلال 24 ساعة.' },
    'home.contactTeam': { zh: '联系采购团队' , fr: 'Contacter l\'équipe d\'approvisionnement', ar: 'التواصل مع فريق التوريد' },
    'home.enginesAvail': { zh: '发动机库存', fr: 'Moteurs disponibles', ar: 'محركات متوفرة' },
    'home.gearboxesAvail': { zh: '变速箱库存' , fr: 'Boîtes de vitesses disponibles', ar: 'علب تروس متوفرة' },
    'home.halfCutsAvail': { zh: '乘用车资源' , fr: 'Demi-carcasses disponibles', ar: 'نصف مقطوعة متوفرة' },
    'brands.searchPlaceholder': { zh: '搜索品牌或发动机型号（如 G4KD、2TR、K24A）…', fr: 'Rechercher marques ou modèles moteur (ex. G4KD, 2TR, K24A)…', ar: 'ابحث عن العلامات أو طرازات المحرك (مثل G4KD، 2TR، K24A)…'},
    'brands.showing': { zh: '显示', fr: 'Affichage', ar: '[ترجمة المصطلح: Showing]'},
    'brands.of': { zh: '共', fr: 'sur', ar: 'لــ'},
    'brands.brandsWord': { zh: '个品牌', fr: 'd\'une', ar: 'علامة تجارية'},
    'brands.featuredEyebrow': { zh: '重点渠道', fr: 'Canaux prioritaires', ar: 'القنوات ذات الأولوية'},
    'brands.featuredTitle': { zh: '重点品牌', fr: 'Marques vedettes', ar: 'متميز <br> العلامات التجارية <br>'},
    'brands.featuredLead': { zh: '高出货量且当前有库存信号的采购渠道，专属供应商对接、更快报价及出口方案。', fr: 'Canaux en stock à volume élevé avec accès fournisseur dédié, devis plus rapides et programmes export.', ar: 'قنوات متوفرة عالية الحجم مع وصول مخصص للموردين وتسعير أسرع وبرامج تصدير.'},
    'brands.allEyebrow': { zh: '当前库存', fr: 'Stock actuel', ar: 'المخزون الحالي'},
    'brands.allTitle': { zh: '有库存品牌', fr: 'Marques en stock', ar: 'العلامات المتوفرة'},
    'brands.allLead': { zh: '根据公开库存信号自动生成的品牌索引。新增库存带来新品牌时，这里会自动变化。', fr: 'Index de marques généré depuis les signaux d\'inventaire publics. Lorsqu\'un nouveau stock ajoute une marque, cette liste évolue automatiquement.', ar: 'فهرس علامات يتولد من إشارات المخزون العامة. عندما يضيف المخزون الجديد علامة، تتغير هذه القائمة تلقائياً.'},
    'catalog.browseLeadEngines': { zh: '从品牌目录开始，浏览发动机、变速箱、底盘件及乘用车。', fr: 'Commencez à partir de notre répertoire de marques pour les moteurs, les boîtes de vitesses, les pièces de châssis et les demi-coupes.', ar: 'ابدأ من دليل علامتنا التجارية للمحركات وعلب التروس وقطع الشاسيه وأنصاف القطع.'},
    'catalog.browseLeadGearboxes': { zh: '从品牌目录开始，按车辆品牌查看变速箱列表。', fr: 'Commencez à partir de notre répertoire de marques pour obtenir des listes complètes de boîtes de vitesses par marque de véhicule.', ar: 'ابدأ من دليل علامتنا التجارية للحصول على قوائم علبة التروس الكاملة حسب الشركة المصنعة للمركبة.'},
    'contact.title': { zh: '联系我们', fr: 'Nous joindre&#10;', ar: 'تواصل معنا'},
    'contact.leadShort': {
      zh: 'WhatsApp、邮件或下方表单 — B2B 询价 24 小时内回复。',
      fr: 'WhatsApp, e-mail ou formulaire ci-dessous — devis B2B sous 24 h.',
      ar: 'واتساب أو بريد أو النموذج أدناه — عروض B2B خلال 24 ساعة.',
    },
    'contact.offices': { zh: '办公室', fr: 'Bureaux', ar: 'المكاتب' },
    'contact.officesShort': {
      zh: '郑州 · 加纳阿克拉',
      fr: 'Zhengzhou · Accra, Ghana',
      ar: 'تشنغتشou · أكرا، غانا',
    },
    'contact.formNote': {
      zh: 'EXW/CIF 报价以库存确认为准；目的港关税及当地费用除非另有说明均不含。',
      fr: 'Devis EXW/CIF sous réserve de confirmation stock. Droits et frais locaux non inclus sauf mention.',
      ar: 'عروض EXW/CIF خاضعة لتأكيد المخزون. الرسوم المحلية غير مشمولة ما لم يُذكر.',
    },
    'contact.lead': { zh: '发送发动机或变速箱询价。所有 B2B 请求 24 小时内回复 EXW/CIF 报价。', fr: 'Envoyez votre demande de moteur ou de boîte de vitesses. Toutes les demandes B2B ont reçu une réponse dans les 24 heures avec une tarification EXW/CIF.', ar: 'أرسل استفسارك عن المحرك أو علبة التروس. يتم الرد على جميع طلبات B2B في غضون 24 ساعة مع تسعير التسليم على ظهر السفينة/التكلفة والتأمين والشحن.'},
    'contact.eyebrow': { zh: '取得联系', fr: 'Contactez-nous', ar: 'تحدَّث إلينا'},
    'contact.sectionTitle': { zh: '我们随时为您服务', fr: 'Nous sommes là pour vous aider', ar: 'نحن هنا لمساعدتك!'},
    'contact.sectionLead': { zh: '通过 WhatsApp、邮件或询价表联系我们。中国办公室负责采购与出口；加纳办公室服务西非客户。', fr: 'Contactez-nous via WhatsApp, par e-mail ou via le formulaire de demande. Notre bureau en Chine s\'occupe de l\'approvisionnement et de l\'exportation ; notre bureau au Ghana soutient les clients ouest-africains.', ar: 'تواصل معنا عبر WhatsApp أو البريد الإلكتروني أو نموذج الاستفسار. يتعامل مكتبنا في الصين مع المصادر والتصدير ؛ ويدعم مكتبنا في غانا عملاء غرب إفريقيا.'},
    'contact.whatsapp': { zh: 'WhatsApp', fr: 'Whatsapp', ar: 'واتساب'},
    'contact.whatsappOpen': { zh: 'WhatsApp 联系', fr: 'Donnez-moi votre numéro whatsaap', ar: 'Muhammad  Golomah'},
    'contact.whatsappNote': { zh: '最快回复 — 周一至周六', fr: 'Réponse la plus rapide — disponible du lundi au samedi', ar: 'أسرع استجابة — متاح من الاثنين إلى السبت'},
    'contact.email': { zh: '邮箱', fr: 'E-mail', ar: 'البريد الإلكتروني:'},
    'contact.emailNote': { zh: '报价、合作及一般咨询', fr: 'Pour les devis, les partenariats et les demandes générales', ar: 'للاقتباسات والشراكات والاستفسارات العامة'},
    'contact.chinaOffice': { zh: '🇨🇳 中国办公室', fr: 'Bureau en Chine', ar: 'مكتب الصين'},
    'contact.ghanaOffice': { zh: '🇬🇭 加纳办公室', fr: 'Bureau 🇬🇭 du Ghana', ar: 'مكتب 🇬🇭 غانا'},
    'contact.formTitle': { zh: '发送询价', fr: 'Envoyer une demande', ar: 'إرسال استفسار'},
    'contact.formLead': { zh: '填写车辆详情和邮箱。我们将在 24 小时内回复。', fr: 'Renseignez les détails du véhicule et votre e-mail. Nous répondons sous 24 heures.', ar: 'أدخل تفاصيل المركبة وبريدك الإلكتروني. نرد خلال 24 ساعة.'},
    'contact.labelPhoneOptional': { zh: '电话 / WhatsApp（选填）', fr: 'Téléphone / WhatsApp (facultatif)', ar: 'الهاتف / واتساب (اختياري)'},
    'contact.phoneOptionalHint': { zh: '选填。请先选择国家，区号会自动填入。', fr: 'Sélectionnez d\'abord le pays. + est fixe — saisissez le numéro complet après l\'indicatif.', ar: 'اختر البلد أولاً. + ثابت — أدخل الرقم الكامل بعد رمز البلد.'},
    'contact.emailUs': { zh: '邮件联系', fr: 'Envoyez-nous un email', ar: 'راسلنا عبر البريد الإلكتروني'},
    'footer.emailUs': { zh: '邮件联系' , fr: 'Envoyez-nous un e-mail', ar: 'راسلنا عبر البريد الإلكتروني' },
    'contact.faqEyebrow': { zh: '常见问题', fr: 'FAQ', ar: 'الأسئلة الشائعة'},
    'contact.faqTitle': { zh: '联系前须知', fr: 'Avant de nous contacter', ar: 'قبل الاتصال بنا'},
    'quote.catHalfCuts': { zh: '乘用车', fr: 'Demi-carcasses', ar: 'نصف مقطوعة' },
    'quote.catHalfCutsSub': { zh: '前切 · 后切 · 鼻切', fr: 'Coupes avant · arrière · avant complet', ar: 'قطع أمامية · خلفية · أمام كامل' },
    'quote.boundary': { zh: '正式报价应分项列明产品成本、验证费、国内运费、港杂费、装箱、报关及运费（如适用）。CIF 报价含至目的港海运及保险；EXW 为郑州工厂交货价，不含国际运费及出口清关。所有库存、价格及运费在付款前须最终确认。目的港关税、税费及当地港杂费除非另有说明，否则不含在内。', fr: 'Les devis officiels détaillent le coût du produit, la vérification, le camionnage national, les frais portuaires, le rembourrage, la déclaration en douane et le fret, le cas échéant. Les devis CIF comprennent le fret maritime et l\'assurance jusqu\'au port de destination désigné. EXW couvre les marchandises départ usine à Zhengzhou, hors fret international et formalités export. Tous les stocks, prix et frais d\'expédition sont soumis à confirmation finale avant le paiement. Les droits de douane à destination, les taxes et les frais portuaires locaux ne sont pas inclus, sauf indication contraire.', ar: 'تحدد عروض الأسعار الرسمية تكلفة المنتج والتحقق والشاحنات المحلية ورسوم الميناء والحشو والإقرار الجمركي والشحن عند الاقتضاء. تشمل عروض أسعار CIF الشحن البحري والتأمين إلى ميناء الوجهة المحدد. EXW يغطي البضائع من مصنع تشنغتشو، دون الشحن الدولي أو التخليص الجمركي للتصدير. تخضع جميع تكاليف المخزون والسعر والشحن للتأكيد النهائي قبل الدفع. لا يتم تضمين الرسوم الجمركية للوجهة والضرائب ورسوم الميناء المحلية ما لم تكن محددة'},
    'quote.cifHint': { zh: 'CIF 报价含至目的港海运及保险。目的港关税、税费及当地港杂费除非另有说明，另计。', fr: 'Le devis CIF comprend le fret maritime et l\'assurance jusqu\'à votre port de destination. Les douanes de destination, les taxes et les frais portuaires locaux sont indiqués séparément, sauf indication contraire.', ar: 'يشمل عرض سعر التكلفة والتأمين والشحن (CIF) الشحن البحري والتأمين إلى ميناء وجهتك. يتم تسعير جمارك الوجهة والضرائب ورسوم الميناء المحلية بشكل منفصل ما لم يذكر ذلك.'},
    'quote.cifBothHint': { zh: '可同时报 EXW（郑州工厂交货）及 CIF（含至目的港运费与保险）。目的港关税及当地费用另计。', fr: 'Nous pouvons citer EXW (départ usine à Zhengzhou) et CIF (fret + assurance jusqu\'à votre port de destination). Les frais de douane à destination et les frais locaux sont indiqués séparément.', ar: 'يمكننا أن نقتبس EXW (من مصنع تشنغتشو) و CIF (الشحن + التأمين إلى ميناء وجهتك). يتم تسعير جمارك الوجهة والرسوم المحلية بشكل منفصل.'},
    'quote.fobHint': { zh: 'EXW 为郑州工厂交货价，不含国际运费及出口清关。如需可另报海运费及保险。', fr: 'EXW couvre les marchandises départ usine à Zhengzhou, hors fret international. Le fret maritime et l\'assurance peuvent être cotés séparément si nécessaire.', ar: 'EXW يغطي البضائع من مصنع تشنغتشو، دون الشحن الدولي. يمكن تحديد أسعار الشحن البحري والتأمين بشكل منفصل إذا لزم الأمر.'},
    'quote.trustGhana': { zh: '加纳办公室支持', fr: 'Soutien de bureau au Ghana', ar: 'دعم مكتب غانا'},
    'quote.trustZhengzhou': { zh: '郑州供应网络', fr: 'Réseau d\'approvisionnement de Zhengzhou', ar: 'شبكة إمدادات تشنغتشو'},
    'quote.trustVideo': { zh: '拆解前整车启动视频', fr: 'Vidéo de démarrage du véhicule entier disponible avant le démontage', ar: 'يتوفر فيديو بدء تشغيل السيارة بالكامل قبل التفكيك'},
    'quote.trustLcl': { zh: 'LCL 或整柜采购', fr: 'Approvisionnement LCL ou conteneur', ar: 'LCL أو مصادر الحاويات'},
    'quote.trustDismantle': { zh: '客户确认后按需拆解', fr: 'Démontage spécifique à l\'acheteur après confirmation', ar: 'التفكيك الخاص بالمشتري بعد التأكيد'},
    'quote.proofVideoDesc': { zh: '适用时可提供拆解前整车启动视频。', fr: 'Vidéo de démarrage du véhicule entier disponible avant le démontage, le cas échéant.', ar: 'يتوفر فيديو بدء تشغيل السيارة بالكامل قبل التفكيك عند الاقتضاء.'},
    'quote.proofDismantle': { zh: '拆解照片', fr: 'Démontage des photos', ar: 'تفكيك الصور'},
    'quote.proofDismantleDesc': { zh: '按您的部件清单拆解时拍照。', fr: 'Photos lors du démontage selon votre liste de pièces.', ar: 'الصور أثناء التفكيك حسب قائمة قطع الغيار الخاصة بك.'},
    'quote.proofThirdParty': { zh: '第三方检测', fr: 'Inspection par une tierce partie. ', ar: 'فحص الطرف الثالث'},
    'quote.proofThirdPartyDesc': { zh: '独立检测，费用另计。', fr: 'Inspection indépendante au prix coûtant — cotée séparément.', ar: 'الفحص المستقل بسعر التكلفة — معروض بشكل منفصل.'},
    'quote.proofInspectDesc': { zh: '铭牌、发动机号、漏油及破损等检查项（如适用）。', fr: 'Plaque signalétique, code moteur, champs de fuite et de dommages, le cas échéant.', ar: 'لوحة الاسم ورمز المحرك وحقول التسرب والتلف عند توفرها.'},
    'brand.navOverview': { zh: '概览', fr: 'Présentation', ar: 'نظرة عامة'},
    'brand.navCategories': { zh: '分类', fr: 'Catégories', ar: 'الفئات'},
    'brand.navEngines': { zh: '发动机', fr: 'Engines', ar: 'المحركات'},
    'brand.navGearboxes': { zh: '变速箱', fr: 'Boîtes de vitesses', ar: 'علبة سرعة'},
    'brand.navChassis': { zh: '底盘件', fr: 'Châssis', ar: 'الهيكل'},
    'brand.navHalfCuts': { zh: '乘用车', fr: ', de découpes partielles', ar: 'نصف جروح'},
    'brand.gearboxInventorySuffix': { zh: '变速箱', fr: 'Type de Boite vitesse', ar: 'النقل'},
    'brand.chassisInventorySuffix': { zh: '全套底盘', fr: 'Ensemble de châssis complet', ar: 'مجموعة الشاسيه الكاملة'},
    'brand.inventoryGearboxLead': { zh: '来自已审核乘用车库存的变速箱参考条目；若无工厂代号，则按年份与车型命名。', fr: 'Unités de transmission référencées à partir de l\'inventaire demi-coupe approuvé — nommées par année de modèle lorsqu\'aucun code d\'usine n\'est répertorié.', ar: 'وحدات النقل المشار إليها من المخزون نصف المقطوع المعتمد — المسماة حسب سنة الطراز عند عدم إدراج رمز المصنع.'},
    'brand.inventoryChassisLead': { zh: '来自已审核乘用车库存的全套底盘参考条目；按年份与车型列出。', fr: 'Ensembles de châssis complets référencés à partir de l\'inventaire demi-coupé approuvé — répertoriés par année de modèle et nom du véhicule.', ar: 'مجموعات الشاسيه الكاملة المشار إليها من المخزون نصف المقطوع المعتمد — مدرجة حسب سنة الطراز واسم السيارة.'},
    'brand.navQuote': { zh: '获取报价', fr: 'Citation requise', ar: 'اطلب اقتباس'},
    'brand.allBrands': { zh: '全部品牌', fr: 'Toutes les marques', ar: 'جميع العلامات التجارية'},
    'brand.whatsappInquiry': { zh: 'WhatsApp 咨询', fr: 'Demande WhatsApp', ar: 'الاستفسار عن WhatsApp'},
    'brand.requestQuote': { zh: '获取报价', fr: 'Citation requise', ar: 'اطلب اقتباس'},
    'brand.browseCatalog': { zh: '查看目录 →', fr: 'E-catalogue', ar: 'تصفح الكتالوج'},
    'brand.overviewEyebrow': { zh: '品牌概览', fr: 'APERÇU DE LA MARQUE ', ar: 'نظرة عامة على العلامة التجارية'},
    'brand.powertrainSourcing': { zh: '动力总成采购', fr: 'Sourcing du groupe motopropulseur', ar: 'مصادر مجموعة نقل الحركة'},
    'brand.point1': { zh: '发动机、变速箱、底盘件及乘用车', fr: 'Moteurs, boîtes de vitesses, pièces de châssis et demi-coupes', ar: 'المحركات وعلب التروس وقطع الشاسيه وأنصاف القطع'},
    'brand.point2': { zh: 'EXW/CIF 出口至全球目的地', fr: 'Exportation EXW et CIF vers des destinations mondiales', ar: 'تصدير EXW و CIF إلى وجهات عالمية'},
    'brand.point3': { zh: '可按需提供检验单证', fr: 'Documentation d\'inspection sur demande', ar: 'وثائق الفحص عند الطلب'},
    'brand.point4': { zh: '现货取决于供应网络及当前库存', fr: 'La disponibilité dépend du réseau de fournisseurs et du stock actuel', ar: 'يعتمد التوافر على شبكة الموردين والمخزون الحالي'},
    'brand.engineModelsListed': { zh: '已列发动机型号', fr: 'Modèles de moteur répertoriés', ar: 'نماذج المحرك المدرجة'},
    'brand.productCategories': { zh: '产品分类', fr: 'Catégories de Produits', ar: 'فئات المنتجات'},
    'brand.vehicleOrigin': { zh: '车辆来源', fr: 'Origine du véhicule', ar: 'أصل وسيلة التنقُّل'},
    'brand.categoriesEyebrow': { zh: '产品线', fr: 'Lignes de produits', ar: 'خطوط انتاج'},
    'brand.categoriesTitle': { zh: '可用产品分类', fr: 'Catégories de produits PoS disponibles', ar: 'فئات منتجات نقاط البيع المتاحة'},
    'brand.categoriesLead': { zh: '四大采购分类 — 选择产品线索取 EXW/CIF 报价。', fr: 'Quatre catégories d\'approvisionnement — sélectionnez une gamme pour demander un devis EXW/CIF.', ar: 'أربع فئات توريد — اختر خط منتج لطلب تسعير EXW/CIF.'},
    'brand.categoriesLeadStart': { zh: '四大采购分类：', fr: 'Quatre catégories d\'approvisionnement pour', ar: 'أربع فئات مصادر لـ'},
    'brand.categoriesLeadEnd': { zh: '选择产品线索取 EXW/CIF 报价。', fr: 'sélectionnez une gamme de produits pour demander une tarification EXW/CIF.', ar: 'حدد سطر منتج لطلب تسعير التسليم على ظهر السفينة/التكلفة والتأمين والشحن.'},
    'brand.enginesTitle': { zh: '发动机', fr: 'Engines', ar: 'المحركات'},
    'brand.gearboxesTitle': { zh: '变速箱', fr: 'Boîtes de vitesses', ar: 'علبة سرعة'},
    'brand.chassisTitle': { zh: '底盘件', fr: 'Châssis', ar: 'أجزاء الشاسيه'},
    'brand.halfCutsTitle': { zh: '乘用车', fr: ', de découpes partielles', ar: 'قصات نصفية'},
    'brand.availableOnRequest': { zh: '可按需供应', fr: 'Disponible sur demande', ar: 'متاحة عند الطلب'},
    'brand.availabilityNote': { zh: '现货取决于供应网络及当前库存。', fr: 'La disponibilité dépend du réseau de fournisseurs et du stock actuel.', ar: 'يعتمد التوافر على شبكة الموردين والمخزون الحالي.'},
    'brand.engineCatalogEyebrow': { zh: '发动机目录', fr: 'Catalogue des moteurs', ar: 'كتالوج المحرك'},
    'brand.popularEnginesTitle': { zh: '热门发动机型号', fr: 'Modèles de moteur populaires', ar: 'موديلات المحركات الشائعة'},
    'brand.popularEnginesLead': { zh: '全球出口常询发动机代号。所有型号均可按需供应 — 发送代号获取 EXW/CIF 报价。', fr: 'Codes de moteur couramment demandés pour l\'exportation mondiale. Toutes les unités sont disponibles sur demande — envoyez votre code pour le devis EXW/CIF.', ar: 'رموز المحركات المطلوبة بشكل شائع للتصدير العالمي. جميع الوحدات متاحة عند الطلب — أرسل الرمز الخاص بك لعرض أسعار التسليم على ظهر السفينة/التكلفة والتأمين والشحن.'},
    'brand.halfCutEyebrow': { zh: '乘用车库存', fr: 'Inventaire demi-coupé', ar: 'مخزون نصف مقطوع'},
    'brand.halfCutListings': { zh: '乘用车列表', fr: 'Annonces demi-coupées', ar: 'مساكن نصف مقطوعة'},
    'brand.halfCutLead': { zh: '乘用车出口参考列表 — 报价前需确认现货。', fr: 'Annonces de référence pour l\'exportation en demi-coupe — la disponibilité est confirmée sur demande avant le devis.', ar: 'قوائم مرجعية للتصدير نصف المقطوع — يتم تأكيد التوافر عند الاستفسار قبل عرض الأسعار.'},
    'brand.halfCutEmpty': { zh: '暂无乘用车列表。请发送您的需求。', fr: 'Pas encore de demi-coupes répertoriées. Envoyez-nous votre demande.', ar: 'لا توجد قصات نصف مدرجة حتى الآن. أرسل لنا طلبك.'},
    'brand.requestHalfCut': { zh: '索取乘用车', fr: 'Demander une demi-coupe', ar: 'طلب قطع نصفي'},
    'brand.viewAllHalfCuts': { zh: '查看全部乘用车库存 →', fr: 'Voir tout l\'inventaire demi-coupe →', ar: 'عرض جميع المخزون نصف المقطوع →'},
    'brand.quoteEyebrow': { zh: '立即开始', fr: 'Commencer', ar: 'ابدأ الآن'},
    'brand.quoteTitle': { zh: '索取采购报价', fr: 'Demander un devis d\'approvisionnement', ar: 'طلب عرض أسعار الاستعانة بالمصادر'},
    'brand.quoteLead': { zh: '发送发动机代号、VIN、车型或整柜需求。采购团队 24 小时内回复 EXW/CIF 报价。', fr: 'Envoyez votre code moteur, votre NIV, le modèle de véhicule ou les exigences du conteneur. Notre équipe d\'approvisionnement répond dans les 24 heures avec une tarification EXW/CIF.', ar: 'أرسل رمز المحرك أو رقم تعريف وسيلة التنقُّل أو طراز وسيلة التنقُّل أو متطلبات الحاوية. يستجيب فريق التوريد لدينا في غضون 24 ساعة بتسعير التسليم على ظهر السفينة/التكلفة والتأمين والشحن.'},
    'brand.globalSourcing': { zh: '全球动力总成采购', fr: 'Approvisionnement mondial en groupes motopropulseurs', ar: 'مصادر مجموعة نقل الحركة العالمية'},

    'supplier.title': { zh: '供应商门户', fr: 'Portail Fournisseurs', ar: 'بوابة الموردين'},
    'supplier.lead': { zh: '加入我们的供应商网络。对接非洲各国及美洲、加勒比、中东、东南亚与澳洲的出口需求。', fr: 'Rejoignez notre réseau de fournisseurs. Connectez votre inventaire à la demande d\'exportation en Afrique, aux Amériques, aux Caraïbes, au Moyen-Orient, en Asie du Sud-Est et en Australie.', ar: 'انضم إلى شبكة موردينا. اربط مخزونك بالطلب على التصدير عبر إفريقيا والأمريكتين ومنطقة البحر الكاريبي والشرق الأوسط وجنوب شرق آسيا وأستراليا.'},
    'supplier.marketScope': { zh: '六大出口区域 — 覆盖非洲各国及美洲、加勒比、中东、东南亚与澳洲 — 构成全球最大的汽车再制造与进口采购市场之一。', fr: 'Six régions d\'export — chaque pays africain plus les Amériques, les Caraïbes, le Moyen-Orient, l\'Asie du Sud-Est et l\'Australie — formant l\'un des plus grands réseaux d\'acheteurs d\'importation et de reconstruction au monde.', ar: 'ست مناطق تصدير — كل دولة أفريقية بالإضافة إلى الأمريكتين ومنطقة البحر الكاريبي والشرق الأوسط وجنوب شرق آسيا وأستراليا — تشكل واحدة من أكبر شبكات مشتري الاستيراد وإعادة البناء في العالم.'},
    'supplier.marketIntro': { zh: 'AsiaPower 所服务的买家网络规模：', fr: 'Le réseau d\'acheteurs qu\'AsiaPower dessert couvre :', ar: 'شبكة المشترين التي تخدمها AsiaPower تشمل:'},
    'supplier.statCountries': { zh: '国家及地区', fr: 'Pays et territoires', ar: 'الدول والأقاليم'},
    'supplier.statPopulation': { zh: '合计人口', fr: 'Population combinée', ar: 'إجمالي السكان'},
    'supplier.statVehicles': { zh: '机动车保有量', fr: 'Véhicules motorisés immatriculés', ar: 'المركبات المسجلة'},
    'supplier.statMarket': { zh: '估算年度售后市场规模', fr: 'Demande annuelle estimée — pièces détachées', ar: 'الطلب السنوي المقدر — قطع ما بعد البيع'},
    'supplier.marketNote': { zh: '数据为基于公开人口、车辆登记及汽车售后行业资料的近似区域合计。需求涵盖再制造、车队更新所需的二手发动机、变速箱、底盘件及乘用车。', fr: 'Totaux régionaux approximatifs basés sur des données publiques de population, d\'immatriculation et de l\'industrie de la pièce automobile. La demande couvre moteurs, boîtes de vitesses, pièces de châssis et demi-coupures pour programmes de reconstruction et de renouvellement de flotte.', ar: 'إجماليات إقليمية تقريبية من بيانات عامة عن السكان وتسجيل المركبات وصناعة قطع الغيار. يغطي الطلب محركات وعلب تروس وقطع شassis ونصف مقطوعة لبرامج إعادة البناء واستبدال الأساطيل.'},
    'supplier.submitHalfCut': { zh: '上传乘用车库存', fr: 'Téléverser inventaire demi-coupures', ar: 'رفع مخزون نصف المقطوعة'},
    'supplier.uploadTitle': { zh: '上传库存', fr: 'Téléverser l\'inventaire', ar: 'رفع المخزون' },
    'supplier.uploadEyebrow': { zh: '供应商操作', fr: 'Action fournisseur', ar: 'إجراء المورد' },
    'supplier.uploadHint': { zh: '已注册？选择库存类型，上传照片与车辆信息，提交 AsiaPower 审核。', fr: 'Déjà inscrit ? Choisissez le type d\'inventaire et téléversez les photos pour examen AsiaPower.', ar: 'مسجّل بالفعل؟ اختر نوع المخزون وارفع الصور لمراجعة AsiaPower.' },
    'supplier.uploadHalfCuts': { zh: '半切车', fr: 'Demi-coupes', ar: 'نصف مقطوعة' },
    'supplier.uploadHalfCutsDesc': { zh: '乘用车、SUV、面包车', fr: 'Voitures, SUV et fourgonnettes', ar: 'سيارات وSUV وفانات' },
    'supplier.uploadHalfCutsDesc': { zh: '乘用车、SUV、面包车', fr: 'Voitures, SUV et fourgonnettes', ar: 'سيارات وSUV وفانات' },
    'supplier.uploadTruckVehicle': { en: 'Commercial Vehicles', zh: '商用车整车', fr: 'Véhicules utilitaires', ar: 'مركبات تجارية' },
    'supplier.uploadTruckVehicleDesc': { en: 'Whole truck / commercial vehicle — scrap or used car', zh: '卡车/商用车整车 — 报废车或二手车', fr: 'Camion ou véhicule utilitaire complet — casse ou occasion', ar: 'شاحنة أو مركبة تجارية كاملة — خردة أو مستعملة' },
    'supplier.uploadPassengerVehicle': { en: 'Passenger Vehicles', zh: '乘用车整车', fr: 'Véhicules particuliers', ar: 'مركبات الركاب' },
    'supplier.uploadPassengerVehicleDesc': { en: 'Whole passenger car / SUV / van — scrap or used car', zh: '乘用车/SUV/面包车整车 — 报废车或二手车', fr: 'Voiture, SUV ou fourgonnette complète — casse ou occasion', ar: 'سيارة أو SUV أو فان كامل — خردة أو مستعمل' },
    'supplier.uploadPassengerParts': { en: 'Passenger Parts', zh: '乘用车配件', fr: 'Pièces véhicules particuliers', ar: 'قطع سيارات الركاب' },
    'supplier.uploadPassengerPartsDesc': { en: 'Front cut, engine, transmission, chassis & other', zh: '前头、发动机、变速箱、底盘及其他', fr: 'Avant, moteur, boîte, châssis et autres', ar: 'مقدمة ومحرك وعلبة تروس وهيكل وقطع أخرى' },
    'supplier.uploadScrap': { en: 'Scrap vehicle', zh: '报废车', fr: 'Véhicule casse', ar: 'مركبة خردة' },
    'supplier.uploadUsedCar': { en: 'Used car', zh: '二手车', fr: 'Occasion', ar: 'سيارة مستعملة' },
    'supplier.uploadVinRequired': { en: 'VIN required', zh: '须填 VIN', fr: 'VIN obligatoire', ar: 'VIN مطلوب' },
    'supplier.uploadNoVin': { en: 'No VIN — select part category', zh: '无需 VIN — 请选择配件类型', fr: 'Sans VIN — choisir la catégorie', ar: 'بدون VIN — اختر فئة القطعة' },
    'supplier.uploadStart': { en: 'Start upload →', zh: '开始上传 →', fr: 'Commencer →', ar: 'بدء الرفع →' },
    'supplier.uploadTruckParts': { en: 'Commercial Parts', zh: '商用车配件', fr: 'Pièces utilitaires', ar: 'قطع المركبات التجارية' },
    'supplier.uploadTruckPartsDesc': { en: 'Driver cab, axle, engine & transmission, other', zh: '卡车驾驶室、车轴、发动机及变速箱、其他', fr: 'Cabine, essieu, moteur et boîte, autres', ar: 'مقصورة، محور، محرك وعلبة تروس، أخرى' },
    'supplier.uploadTruckPartsBadge': { en: 'Parts', zh: '配件', fr: 'Pièces', ar: 'قطع' },
    'supplier.uploadLinksTitle': { zh: '已有账号？直接上传', fr: 'Déjà inscrit ? Téléverser', ar: 'مسجّل بالفعل؟ ارفع المخزون' },
    'supplier.eyebrow': { zh: '合作伙伴计划', fr: 'Programme partenaire', ar: 'برنامج الشركاء'},
    'supplier.whyTitle': { zh: '为何通过 AsiaPower 供货？', fr: 'Pourquoi approvisionner via AsiaPower ?', ar: 'لماذا التوريد عبر AsiaPower؟'},
    'supplier.marketsTitle': { zh: '全球出口市场', fr: 'Marchés d\'export mondiaux', ar: 'أسواق التصدير العالمية'},
    'supplier.marketsLead': { zh: '非洲各国及美洲、加勒比、中东、东南亚与澳洲的进口商、维修厂与车队采购需求。', fr: 'Demande d\'acheteurs — importateurs, ateliers et opérateurs de flottes — dans chaque pays africain, plus les Amériques, les Caraïbes, le Moyen-Orient, l\'Asie du Sud-Est et l\'Australie.', ar: 'طلب المشترين — المستوردين وورش العمل ومشغلي الأساطيل — في كل دولة أفريقية، بالإضافة إلى الأمريكتين ومنطقة البحر الكاريبي والشرق الأوسط وجنوب شرق آسيا وأستراليا.'},
    'supplier.ordersTitle': { zh: '稳定订单', fr: 'Commandes régulières', ar: 'طلبات منتظمة'},
    'supplier.ordersLead': { zh: '维修厂、车队运营商及整柜进口商的持续采购量。', fr: 'Volumes réguliers d\'ateliers, d\'opérateurs de flottes et d\'importateurs conteneur.', ar: 'حجم منتظم من الورش ومشغلي الأساطيل ومستوردي الحاويات.'},
    'supplier.networkTitle': { zh: '验证网络', fr: 'Réseau vérifié', ar: 'شبكة موثقة'},
    'supplier.networkLead': { zh: '质量标准保护每位合作伙伴。仅列出已批准供应商。', fr: 'Des standards qualité protègent chaque partenaire. Seuls les fournisseurs approuvés sont répertoriés.', ar: 'معايير الجودة تحمي كل شريك. يُدرج الموردون المعتمدون فقط.'},
    'supplier.logisticsTitle': { zh: '物流托管', fr: 'Logistique prise en charge', ar: 'اللوجستيات مُدارة'},
    'supplier.logisticsLead': { zh: '我们负责包装、出口单证、清关及全球港口海运。', fr: 'Nous gérons l\'emballage, la documentation export, le dédouanement et le fret maritime vers les ports du monde entier.', ar: 'ندير التعبئة ووثائق التصدير والتخليص الجمركي والشحن البحري إلى الموانئ حول العالم.'},
    'supplier.regEyebrow': { zh: '注册', fr: 'Inscription', ar: 'التسجيل'},
    'supplier.regTitle': { zh: '成为 AsiaPower 供应商', fr: 'Devenir fournisseur AsiaPower', ar: 'كن مورداً لدى AsiaPower'},
    'supplier.regLead': { zh: '用手机验证码完成注册并填写公司资料。我们可能会跟进合作审核。', fr: 'Inscrivez-vous par OTP téléphone et profil société. Notre équipe peut suivre pour un examen partenariat.', ar: 'سجّل برمز الهاتف وبيانات الشركة. قد يتابع فريقنا مراجعة الشراكة.'},

    'supplier.uploadPage.truckVehicleTitle': { en: 'Commercial Vehicle Upload', zh: '商用车整车上传', fr: 'Téléversement véhicule utilitaire', ar: 'رفع مركبة تجارية' },
    'supplier.uploadPage.truckVehicleLead': { en: 'Upload whole commercial vehicles — scrap or export used car. Enter the VIN first; the system will try to detect brand, model and year. Upload at least 3 clear photos.', zh: '上传商用车整车（报废车或二手车）。请先输入 VIN 底盘号，系统会尝试自动识别品牌、车型和年份。请至少上传 3 张清晰照片。', fr: 'Téléversez des véhicules utilitaires complets — casse ou occasion export. Saisissez d\'abord le VIN ; le système tente de détecter marque, modèle et année. Au moins 3 photos nettes.', ar: 'ارفع مركبات تجارية كاملة — خردة أو مستعملة للتصدير. أدخل VIN أولاً؛ يحاول النظام تحديد العلامة والطراز والسنة. 3 صور واضحة على الأقل.' },
    'supplier.uploadPage.truckVehicleCrumb': { en: 'Commercial Vehicle Upload', zh: '商用车整车上传', fr: 'Téléversement véhicule utilitaire', ar: 'رفع مركبة تجارية' },
    'supplier.uploadPage.passengerVehicleTitle': { en: 'Passenger Vehicle Upload', zh: '乘用车整车上传', fr: 'Téléversement véhicule particulier', ar: 'رفع مركبة ركاب' },
    'supplier.uploadPage.passengerVehicleLead': { en: 'Upload whole passenger vehicles — scrap or export used car. Enter the VIN first; the system will try to detect brand, model and year. Upload at least 3 clear photos.', zh: '上传乘用车整车（报废车或二手车）。请先输入 VIN 底盘号，系统会尝试自动识别品牌、车型和年份。请至少上传 3 张清晰照片。', fr: 'Téléversez des véhicules particuliers complets — casse ou occasion export. Saisissez d\'abord le VIN. Au moins 3 photos nettes.', ar: 'ارفع مركبات ركاب كاملة — خردة أو مستعملة للتصدير. أدخل VIN أولاً. 3 صور واضحة على الأقل.' },
    'supplier.uploadPage.passengerVehicleCrumb': { en: 'Passenger Vehicle Upload', zh: '乘用车整车上传', fr: 'Téléversement véhicule particulier', ar: 'رفع مركبة ركاب' },
    'supplier.uploadPage.truckPartsTitle': { en: 'Truck Parts Upload', zh: '卡车配件上传', fr: 'Téléversement pièces camion', ar: 'رفع قطع الشاحنة' },
    'supplier.uploadPage.truckPartsLead': { en: 'Upload truck driver cabs, axles, engines & transmissions and other parts. Choose part type on step 1 — VIN is optional; engine code required for engine listings. Upload at least 3 clear photos.', zh: '上传卡车驾驶室、车轴、发动机及变速箱及其他配件。请在第 1 步选择配件类型；单件配件 VIN 可留空，上传发动机须填发动机型号。请至少上传 3 张清晰照片。', fr: 'Téléversez cabines, essieux, moteurs et boîtes et autres pièces. Étape 1 : type de pièce — VIN optionnel ; code moteur obligatoire pour les moteurs. Au moins 3 photos.', ar: 'ارفع مقصورات ومحاور ومحركات وعلب تروس وقطع أخرى. الخطوة 1: نوع القطعة — VIN اختياري؛ رمز المحرك مطلوب للمحركات. 3 صور على الأقل.' },
    'supplier.uploadPage.truckPartsCrumb': { en: 'Truck Parts Upload', zh: '卡车配件上传', fr: 'Téléversement pièces camion', ar: 'رفع قطع الشاحنة' },
    'supplier.uploadPage.passengerPartsTitle': { en: 'Passenger Parts Upload', zh: '乘用车配件上传', fr: 'Téléversement pièces véhicule particulier', ar: 'رفع قطع سيارات الركاب' },
    'supplier.uploadPage.passengerPartsLead': { en: 'Upload passenger front cuts, engines, transmissions, chassis parts and other components. Choose part type on step 1 — no VIN required. Upload at least 3 clear photos.', zh: '上传乘用车前头、发动机、变速箱、底盘及其他配件。请在第 1 步选择配件类型；无需 VIN。请至少上传 3 张清晰照片。', fr: 'Téléversez avant, moteurs, boîtes, châssis et autres pièces. Étape 1 : type de pièce — sans VIN. Au moins 3 photos.', ar: 'ارفع مقدمة ومحركات وعلب تروس وهيكل وقطع أخرى. الخطوة 1: نوع القطعة — بدون VIN. 3 صور على الأقل.' },
    'supplier.uploadPage.passengerPartsCrumb': { en: 'Passenger Parts Upload', zh: '乘用车配件上传', fr: 'Téléversement pièces véhicule particulier', ar: 'رفع قطع سيارات الركاب' },
    'supplier.uploadPage.halfCutCrumb': { en: 'Half-Cut Upload', zh: '乘用车上传', fr: 'Téléversement demi-coupure', ar: 'رفع نصف مقطوعة' },
    'supplier.form.important': { en: 'Important', zh: '重要提示', fr: 'Important', ar: 'مهم' },

    'about.breadcrumb': { zh: '关于我们', fr: 'À propos', ar: 'من نحن'},
    'about.eyebrow': { zh: 'AI 驱动的全球循环经济数字化平台', fr: 'Plateforme numérique mondiale de l\'économie circulaire pilotée par l\'IA', ar: 'منصة رقمية عالمية للاقتصاد الدائري مدعومة بالذكاء الاصطناعي'},
    'about.heroTitle': { zh: '构建全球循环经济的 AI 操作系统。', fr: 'Construire le système d\'exploitation IA de l\'économie circulaire mondiale.', ar: 'بناء نظام التشغيل بالذكاء الاصطناعي للاقتصاد الدائري العالمي.'},
    'about.heroLead': { zh: '我们相信，每一件可循环利用的车辆、零部件和工业设备，都值得拥有第二次生命；每一次可信交易，都应该由真实数据、人工智能和全球协作共同驱动。', fr: 'Nous croyons que chaque véhicule, pièce et équipement industriel réutilisable mérite une seconde vie — et que chaque transaction de confiance doit être portée par des données réelles, l\'intelligence artificielle et la collaboration mondiale.', ar: 'نؤمن أن كل مركبة وقطعة ومعدات صناعية قابلة لإعادة الاستخدام تستحق حياة ثانية — وأن كل معاملة موثوقة يجب أن تُقاد ببيانات حقيقية وذكاء اصطناعي وتعاون عالمي.'},
    'about.heroBtnBuild': { zh: '了解我们正在建设什么', fr: 'Découvrir ce que nous construisons', ar: 'اطلع على ما نبنيه'},
    'about.becomeSupplier': { zh: '成为供应商', fr: 'Devenir fournisseur', ar: 'كن مورداً'},
    'about.heroQuote': { zh: '科技的价值，不在于替代人，而在于帮助更多普通人获得<span class="ebay-about-highlight">更可靠的机会</span>。', fr: 'La valeur de la technologie n\'est pas de remplacer les gens, mais d\'aider davantage de personnes ordinaires à obtenir <span class="ebay-about-highlight">des opportunités plus fiables</span>.', ar: 'قيمة التكنولوجيا ليست في استبدال الناس، بل في مساعدة المزيد من الناس العاديين على الحصول على <span class="ebay-about-highlight">فرص أكثر موثوقية</span>.'},
    'about.heroCardDesc': { zh: '从街边修理厂到全球供应商，从出租车司机到跨境采购商，AsiaPower 希望让可信零部件交易变得更简单、更透明、更有温度。', fr: 'Des ateliers de quartier aux fournisseurs mondiaux, des chauffeurs de taxi aux acheteurs transfrontaliers — AsiaPower rend le commerce de pièces de confiance plus simple, plus transparent et plus humain.', ar: 'من ورش الحي إلى الموردين العالميين، ومن سائقي التاكسي إلى المشترين عبر الحدود — AsiaPower تجعل تجارة القطع الموثوقة أبسط وأكثر شفافية وإنسانية.'},
    'about.miniTruth': { zh: 'Truth', fr: 'Truth', ar: 'Truth'},
    'about.miniTruthDesc': { zh: '真实数据与真实货源', fr: 'Données et stocks réels', ar: 'بيانات ومخزون حقيقي'},
    'about.miniTrust': { zh: 'Trust', fr: 'Trust', ar: 'Trust'},
    'about.miniTrustDesc': { zh: '透明流程与长期合作', fr: 'Processus transparent et partenariat durable', ar: 'عملية شفافة وشراكة طويلة الأمد'},
    'about.miniAi': { zh: 'AI', fr: 'AI', ar: 'AI'},
    'about.miniAiDesc': { zh: '智能识别、匹配与服务', fr: 'Identification, correspondance et service intelligents', ar: 'تعرف ومطابقة وخدمة ذكية'},
    'about.miniCircularity': { zh: 'Circularity', fr: 'Circularity', ar: 'Circularity'},
    'about.miniCircularityDesc': { zh: '让资源创造更久价值', fr: 'Des ressources qui créent une valeur durable', ar: 'موارد تخلق قيمة دائمة'},
    'about.whyTitle': { zh: '每一辆车，都承载着一个家庭的生活。', fr: 'Chaque véhicule porte le quotidien d\'une famille.', ar: 'كل مركبة تحمل معيشة عائلة.'},
    'about.whyLead': { zh: '在世界许多地方，一辆汽车不仅仅是一种交通工具。它可能是一位出租车司机一家人的收入来源，可能是一家物流公司的生产工具，也可能是一位年轻人创业的第一辆车。', fr: 'Dans de nombreuses régions du monde, une voiture n\'est pas qu\'un moyen de transport. Elle peut être le revenu d\'une famille de chauffeur de taxi, l\'outil de production d\'une entreprise logistique, ou la première voiture d\'un jeune entrepreneur.', ar: 'في أجزاء كثيرة من العالم، السيارة ليست مجرد وسيلة نقل. قد تكون دخل عائلة سائق تاكسي، أو أداة إنتاج لشركة لوجستية، أو أول سيارة لشاب يبدأ مشروعه.'},
    'about.whyPanel1': { zh: '当车辆因为缺少一个零部件而停驶，受到影响的往往不仅仅是一辆车，而是一个家庭、一份工作，甚至一种生活。', fr: 'Quand un véhicule s\'arrête faute d\'une pièce, l\'impact dépasse souvent la voiture — c\'est une famille, un emploi, parfois un mode de vie.', ar: 'عندما تتوقف مركبة لنقص قطعة واحدة، التأثير غالباً ليس على السيارة فقط — بل على عائلة ووظيفة وحتى أسلوب حياة.'},
    'about.whyPanel2': { zh: '我们相信，每一件仍然可以使用的发动机、变速箱和零部件，都值得拥有第二次生命。而每一次可靠的交易，都应该建立在真实、透明和信任之上。', fr: 'Nous croyons que chaque moteur, boîte de vitesses et pièce encore utilisable mérite une seconde vie — et que chaque transaction fiable doit reposer sur la vérité, la transparence et la confiance.', ar: 'نؤمن أن كل محرك وعلبة تروس وقطعة ما زالت صالحة تستحق حياة ثانية — وأن كل معاملة موثوقة يجب أن تُبنى على الحقيقة والشفافية والثقة.'},
    'about.foundedTitle': { zh: '我们为什么创立 AsiaPower', fr: 'Pourquoi nous avons fondé AsiaPower', ar: 'لماذا أسسنا AsiaPower'},
    'about.foundedLead': { zh: '过去十几年，我们一直工作在汽车后市场。我们见过优质零部件因为信息不透明而被低价处理，也见过采购商因为缺乏可靠信息而承担高昂风险。', fr: 'Depuis plus d\'une décennie, nous travaillons dans le marché secondaire automobile. Nous avons vu des pièces de qualité vendues à bas prix par manque de transparence — et des acheteurs assumer de lourds risques faute d\'informations fiables.', ar: 'منذ أكثر من عقد نعمل في سوق ما بعد البيع للسيارات. رأينا قطعاً جيدة تُباع بسعر منخفض لعدم شفافية المعلومات — ومشترين يتحملون مخاطر كبيرة لغياب بيانات موثوقة.'},
    'about.problem1': { zh: '供应商难以找到全球客户，库存价值无法充分释放。', fr: 'Les fournisseurs peinent à atteindre des clients mondiaux ; la valeur du stock reste bloquée.', ar: 'يواجه الموردون صعوبة في الوصول لعملاء عالميين؛ قيمة المخزون تبقى محبوسة.'},
    'about.problem2': { zh: '采购商难以判断车型、货源、质量和适配风险。', fr: 'Les acheteurs peinent à évaluer modèle, source, qualité et risque de compatibilité.', ar: 'يواجه المشترون صعوبة في تقييم الطراز والمصدر والجودة ومخاطر التوافق.'},
    'about.problem3': { zh: '行业长期依赖经验、关系和反复沟通完成交易。', fr: 'Le secteur s\'appuie encore sur l\'expérience, les relations et des échanges répétés pour conclure.', ar: 'لا يزال القطاع يعتمد على الخبرة والعلاقات والتواصل المتكرر لإتمام الصفقات.'},
    'about.foundedClosing': { zh: '我们意识到，真正缺少的不是零部件，而是一套能够连接全球供应商、采购商、数据与信任的数字化平台。因此，AsiaPower 诞生了。', fr: 'Nous avons compris que ce qui manquait n\'était pas les pièces — mais une plateforme numérique reliant fournisseurs, acheteurs, données et confiance. C\'est pour cela qu\'AsiaPower existe.', ar: 'أدركنا أن الناقص ليس القطع — بل منصة رقمية تربط الموردين والمشترين والبيانات والثقة. لذلك وُجدت AsiaPower.'},
    'about.buildTitle': { zh: '我们正在建设什么', fr: 'Ce que nous construisons', ar: 'ما نبنيه'},
    'about.buildP1': { zh: 'AsiaPower 不只是销售发动机或变速箱。我们正在建设一个 AI 驱动的全球循环经济数字化平台。', fr: 'AsiaPower ne se limite pas à vendre des moteurs ou des boîtes de vitesses. Nous construisons une plateforme numérique mondiale de l\'économie circulaire pilotée par l\'IA.', ar: 'AsiaPower لا تبيع المحركات وعلب التروس فقط. نحن نبني منصة رقمية عالمية للاقتصاد الدائري مدعومة بالذكاء الاصطناعي.'},
    'about.buildP2': { zh: '我们希望借助人工智能、VIN 数据、数字化库存、标准化质检、全球物流和可信交易体系，让每一件可循环利用的车辆、零部件和工业设备，都能够被精准识别、高效流通、放心交易。', fr: 'Avec l\'IA, les données VIN, l\'inventaire numérique, l\'inspection standardisée, la logistique mondiale et un commerce de confiance, nous voulons que chaque véhicule, pièce et équipement réutilisable soit identifié avec précision, circule efficacement et se négocie en toute confiance.', ar: 'بالذكاء الاصطناعي وبيانات VIN والمخزون الرقمي والفحص الموحد واللوجستيات العالمية والتجارة الموثوقة، نريد أن تُعرَف كل مركبة وقطعة ومعدات قابلة لإعادة الاستخدام بدقة، وتُتداول بكفاءة، وتُتبادل بثقة.'},
    'about.step1Title': { zh: '数字身份', fr: 'Identité numérique', ar: 'الهوية الرقمية'},
    'about.step1Desc': { zh: '通过 VIN、发动机号、库存编号和结构化数据，让车辆与零部件被准确识别。', fr: 'VIN, numéros moteur, IDs stock et données structurées pour identifier correctement véhicules et pièces.', ar: 'VIN وأرقام المحرك ومعرفات المخزون وبيانات منظمة للتعرف الصحيح على المركبات والقطع.'},
    'about.step2Title': { zh: '可信库存', fr: 'Stock de confiance', ar: 'مخزون موثوق'},
    'about.step2Desc': { zh: '通过照片、检测、状态、来源和供应商信息，提高交易透明度。', fr: 'Photos, inspection, état, provenance et informations fournisseur pour plus de transparence.', ar: 'صور وفحص وحالة ومصدر ومعلومات المورد لمزيد من الشفافية.'},
    'about.step3Title': { zh: 'AI 协作', fr: 'Collaboration IA', ar: 'تعاون الذكاء الاصطناعي'},
    'about.step3Desc': { zh: '让 AI 帮助客户询价、匹配、翻译、追踪、售后与决策。', fr: 'L\'IA aide à coter, faire correspondre, traduire, suivre, assurer le SAV et décider.', ar: 'يساعد الذكاء الاصطناعي في التسعير والمطابقة والترجمة والتتبع وما بعد البيع واتخاذ القرار.'},
    'about.step4Title': { zh: '全球流通', fr: 'Circulation mondiale', ar: 'التداول العالمي'},
    'about.step4Desc': { zh: '连接供应商、采购商、物流、保修与售后，形成可复制的平台化流程。', fr: 'Relier fournisseurs, acheteurs, logistique, garantie et SAV en flux plateforme reproductibles.', ar: 'ربط الموردين والمشترين واللوجستيات والضمان وما بعد البيع في سير عمل منصة قابل للتكرار.'},
    'about.peopleTitle': { zh: '我们服务每一位参与者', fr: 'Nous servons chaque acteur', ar: 'نخدم كل مشارك'},
    'about.peopleLead': { zh: '循环经济不是冷冰冰的概念。它最终服务的是每一个依靠车辆、零部件、库存和交易生活的人。', fr: 'L\'économie circulaire n\'est pas un concept froid. Elle sert finalement tous ceux qui vivent des véhicules, des pièces, des stocks et du commerce.', ar: 'الاقتصاد الدائري ليس مفهوماً بارداً. في النهاية يخدم كل من يعيش من المركبات والقطع والمخزون والتجارة.'},
    'about.human1Title': { zh: '为终端用户节省成本', fr: 'Réduire les coûts pour les utilisateurs finaux', ar: 'توفير التكاليف للمستخدمين النهائيين'},
    'about.human1Desc': { zh: '让司机、家庭和小生意人以更合理的成本，让车辆重新回到路上。', fr: 'Permettre aux chauffeurs, familles et petites entreprises de remettre les véhicules sur la route à un coût raisonnable.', ar: 'مساعدة السائقين والعائلات والأعمال الصغيرة على إعادة المركبات للطريق بتكلفة معقولة.'},
    'about.human2Title': { zh: '为修理厂提高效率', fr: 'Efficacité pour les ateliers', ar: 'كفاءة لورش الإصلاح'},
    'about.human2Desc': { zh: '更快找到合适的发动机、变速箱和零部件，减少等待与沟通成本。', fr: 'Trouver plus vite le bon moteur, boîte ou pièce — moins d\'attente et moins d\'allers-retours.', ar: 'إيجاد المحرك أو علبة التروس أو القطعة المناسبة أسرع — أقل انتظاراً وأقل مراسلة.'},
    'about.human3Title': { zh: '为供应商释放库存价值', fr: 'Libérer la valeur du stock pour les fournisseurs', ar: 'إطلاق قيمة المخزون للموردين'},
    'about.human3Desc': { zh: '帮助拆车厂和零部件供应商数字化库存，连接更大的全球市场。', fr: 'Aider casseurs et fournisseurs à numériser le stock et toucher un marché mondial plus large.', ar: 'مساعدة التشليح والموردين على رقمنة المخزون والوصول لسوق عالمي أوسع.'},
    'about.human4Title': { zh: '为行业建立可信标准', fr: 'Des standards de confiance pour le secteur', ar: 'معايير موثوقة للصناعة'},
    'about.human4Desc': { zh: '推动数据、质检、保修、索赔和交易流程标准化，让合作更长期。', fr: 'Standardiser données, contrôle qualité, garantie, réclamations et flux commerciaux pour des partenariats durables.', ar: 'توحيد البيانات والفحص والضمان والمطالبات وسير التجارة لشراكات أطول.'},
    'about.audiencesTitle': { zh: '不同角色的平台价值', fr: 'Valeur de la plateforme par profil', ar: 'قيمة المنصة حسب الدور'},
    'about.audiencesLead': { zh: '无论您是采购商、供应商还是投资人——AsiaPower 都致力于降低跨境配件贸易的摩擦、提升信任。', fr: 'Que vous achetiez, fournissiez ou investissiez — AsiaPower réduit les frictions et renforce la confiance dans le commerce transfrontalier de pièces.', ar: 'سواء كنت مشترياً أو مورداً أو مستثمراً — AsiaPower تقلل الاحتكاك وتعزز الثقة في تجارة القطع عبر الحدود.'},
    'about.audBuyersTitle': { zh: '对于采购商', fr: 'Pour les acheteurs', ar: 'للمشترين'},
    'about.audBuyers1': { zh: '更清晰的产品信息', fr: 'Informations produit plus claires', ar: 'معلومات منتج أوضح'},
    'about.audBuyers2': { zh: '更可信的来源与照片', fr: 'Sources et photos plus fiables', ar: 'مصادر وصور أكثر موثوقية'},
    'about.audBuyers3': { zh: '更标准的询价与售后流程', fr: 'Processus de devis et SAV plus standardisés', ar: 'سير استفسار وما بعد بيع أكثر توحيداً'},
    'about.audBuyers4': { zh: '更低的跨境采购风险', fr: 'Risque d\'achat transfrontalier réduit', ar: 'مخاطر أقل في الشراء عبر الحدود'},
    'about.audSuppliersTitle': { zh: '对于供应商', fr: 'Pour les fournisseurs', ar: 'للموردين'},
    'about.audSuppliers1': { zh: '数字化展示库存', fr: 'Présentation numérique du stock', ar: 'عرض رقمي للمخزون'},
    'about.audSuppliers2': { zh: '获得全球采购需求', fr: 'Accès à la demande d\'achat mondiale', ar: 'الوصول لطلب الشراء العالمي'},
    'about.audSuppliers3': { zh: '提高库存周转率', fr: 'Meilleure rotation des stocks', ar: 'دوران مخزون أعلى'},
    'about.audSuppliers4': { zh: '接入未来 AI 与 ERP 系统', fr: 'Intégration future IA et ERP', ar: 'تكامل مستقبلي مع الذكاء الاصطناعي وERP'},
    'about.audInvestorsTitle': { zh: '对于投资人', fr: 'Pour les investisseurs', ar: 'للمستثمرين'},
    'about.audInvestors1': { zh: '从贸易切入平台', fr: 'Du commerce à la plateforme', ar: 'من التجارة إلى المنصة'},
    'about.audInvestors2': { zh: '从汽车后市场切入循环经济', fr: 'Du marché secondaire auto à l\'économie circulaire', ar: 'من سوق ما بعد البيع إلى الاقتصاد الدائري'},
    'about.audInvestors3': { zh: '从非洲需求切入全球供应链', fr: 'De la demande africaine à la chaîne mondiale', ar: 'من الطلب الأفريقي إلى سلسلة التوريد العالمية'},
    'about.audInvestors4': { zh: '用 AI 建立长期基础设施', fr: 'Infrastructure durable construite avec l\'IA', ar: 'بنية تحتية طويلة الأمد بالذكاء الاصطناعي'},
    'about.valuesBelieveTitle': { zh: '我们相信', fr: 'Ce en quoi nous croyons', ar: 'ما نؤمن به'},
    'about.valuesBelieveLead': { zh: 'AI 不应该只是服务少数大型企业。它同样应该帮助街边修理厂、拆车厂、采购商和终端用户获得更好的机会。', fr: 'L\'IA ne doit pas servir uniquement les grandes entreprises. Elle doit aussi aider ateliers de quartier, casseurs, acheteurs et utilisateurs finaux à de meilleures opportunités.', ar: 'الذكاء الاصطناعي لا يجب أن يخدم الشركات الكبرى فقط. يجب أن يساعد ورش الحي والتشليح والمشترين والمستخدمين النهائيين على فرص أفضل.'},
    'about.valueTruth': { zh: '真实', fr: 'Vérité', ar: 'الحقيقة'},
    'about.valueTruthDesc': { zh: '数据真实、货源真实、交易真实。', fr: 'Données, stocks et transactions réels.', ar: 'بيانات ومخزون ومعاملات حقيقية.'},
    'about.valueTrust': { zh: '信任', fr: 'Confiance', ar: 'الثقة'},
    'about.valueTrustDesc': { zh: '透明流程、长期合作、标准化服务。', fr: 'Processus transparent, partenariat durable, service standardisé.', ar: 'عملية شفافة وشراكة طويلة وخدمة موحدة.'},
    'about.valueSmart': { zh: '智能', fr: 'Intelligence', ar: 'الذكاء'},
    'about.valueSmartDesc': { zh: '让 AI 成为每一位客户和合作伙伴的助手。', fr: 'L\'IA comme assistant pour chaque client et partenaire.', ar: 'الذكاء الاصطناعي مساعداً لكل عميل وشريك.'},
    'about.valueCircular': { zh: '循环', fr: 'Circularité', ar: 'الدائرية'},
    'about.valueCircularDesc': { zh: '让每一件资源创造更长久的价值。', fr: 'Chaque ressource crée une valeur plus durable.', ar: 'كل مورد يخلق قيمة أطول.'},
    'about.officeChinaTitle': { zh: '中国 — 总部与采购', fr: 'Chine — siège et sourcing', ar: 'الصين — المقر والتوريد'},
    'about.officeChinaDesc': { zh: '郑州 · 日、韩、中供应商网络', fr: 'Zhengzhou · réseau fournisseurs Japon, Corée, Chine', ar: 'تشنغتشو · شبكة موردين يابان وكوريا والصين'},
    'about.officeGhanaTitle': { zh: '加纳 — 西非运营', fr: 'Ghana — opérations Afrique de l\'Ouest', ar: 'غانا — عمليات غرب أفريقيا'},
    'about.officeGhanaDesc': { zh: '阿克拉 · 服务区域进口商', fr: 'Accra · support local pour importateurs régionaux', ar: 'أكرا · دعم محلي للمستوردين الإقليميين'},
    'about.officeEmail': { zh: 'weylonhui@gmail.com', fr: 'weylonhui@gmail.com', ar: 'weylonhui@gmail.com'},
    'about.officeWhatsapp': { zh: 'WhatsApp', fr: 'WhatsApp', ar: 'واتساب'},
    'about.finalTitle': { zh: '让每一件可循环利用的资产，都拥有第二次生命。', fr: 'Donner une seconde vie à chaque actif réutilisable.', ar: 'امنح كل أصل قابل لإعادة الاستخدام حياة ثانية.'},
    'about.finalLead': { zh: 'AsiaPower 正在从汽车零部件贸易出发，建设连接全球供应商、采购商、数据与人工智能的行业基础设施。我们欢迎客户、供应商、合作伙伴和投资人，与我们一起推动更高效、更透明、更可信的循环经济。', fr: 'AsiaPower part du commerce de pièces automobiles pour construire une infrastructure sectorielle reliant fournisseurs, acheteurs, données et IA mondiaux. Clients, fournisseurs, partenaires et investisseurs sont les bienvenus pour une économie circulaire plus efficace, transparente et fiable.', ar: 'تبدأ AsiaPower من تجارة قطع السيارات لبناء بنية تحتية صناعية تربط الموردين والمشترين والبيانات والذكاء الاصطناعي عالمياً. نرحب بالعملاء والموردين والشركاء والمستثمرين لاقتصاد دائري أكثر كفاءة وشفافية وثقة.'},
    'about.contactUs': { zh: '联系我们', fr: 'Nous joindre', ar: 'تواصل معنا'},

    'brands.platformEyebrow': { zh: 'B2B 采购', fr: 'Approvisionnement B2B', ar: 'توريد B2B'},
    'brands.platformTitle': { zh: '一个平台 · 全球车辆应用', fr: 'Une plateforme. Applications véhicules mondiales.', ar: 'منصة واحدة. تطبيقات مركبات عالمية.'},
    'brands.platformLead': { zh: 'AsiaPower 整合中国供应渠道，为日系、韩系、中美欧应用提供检验发动机、变速箱、底盘件及乘用车。', fr: 'AsiaPower consolide des canaux d\'approvisionnement basés en Chine pour applications japonaises, coréennes, chinoises, américaines et européennes — livrant moteurs, boîtes de vitesses, pièces de châssis et demi-coupures inspectés aux importateurs, ateliers et opérateurs de flottes du monde entier.', ar: 'تجمع AsiaPower قنوات توريد مقرها الصين للتطبيقات اليابانية والكورية والصينية والأمريكية والأوروبية — وتسلم محركات وعلب تروس وقطع شassis ونصف مقطوعة مفحوصة للمستوردين وورش العمل ومشغلي الأساطيل حول العالم.'},
    'brands.platformLi1': { zh: '适用时可提供拆解前整车启动视频，附出口单证', fr: 'Vidéo de démarrage du véhicule complet avant démontage, avec documentation export', ar: 'فيديو تشغيل المركبة الكاملة قبل التفكيك، مع وثائق التصدير'},
    'brands.platformLi2': { zh: '自动、手动、CVT 及四驱变速箱供应', fr: 'Boîtes automatiques, manuelles, CVT et 4WD', ar: 'علب تروس أوتوماتيكية ويدوية وCVT و4WD'},
    'brands.platformLi3': { zh: '底盘件 — 悬架、转向、制动及车桥', fr: 'Pièces de châssis — suspension, direction, freinage et essieux', ar: 'قطع الشاسيه — تعليق وتوجيه وفرامل ومحاور'},
    'brands.platformLi4': { zh: '乘用车用于拆解与翻新项目', fr: 'Véhicules demi-coupés pour extraction de pièces et programmes de reconstruction', ar: 'مركبات نصف مقطوعة لاستخراج القطع وبرامج إعادة البناء'},
    'brands.platformLi5': { zh: '整柜及 LCL 发运至全球目的地', fr: 'Expédition conteneur et LCL vers destinations mondiales', ar: 'شحن بالحاويات وLCL إلى وجهات عالمية'},
    'brands.browseEngines': { zh: '浏览发动机', fr: 'Parcourir les moteurs', ar: 'تصفح المحركات'},
    'brands.browseChassis': { zh: '底盘件', fr: 'Châssis', ar: 'أجزاء الشاسيه'},
    'brands.journeyEyebrow': { zh: '客户路径', fr: 'Parcours client', ar: 'رحلة العميل'},
    'brands.journeyTitle': { zh: '品牌 → 产品分类 → 询价', fr: 'Marque → Catégorie produit → Devis', ar: 'العلامة → فئة المنتج → عرض السعر'},
    'brands.journeyLead': { zh: '选择品牌（如 Toyota），浏览该品牌的发动机、变速箱、底盘件或乘用车。', fr: 'Sélectionnez une marque comme Toyota, puis parcourez moteurs, boîtes de vitesses, pièces de châssis ou demi-coupures pour cette marque. Les marques avec page dédiée mènent directement à leur répertoire complet.', ar: 'اختر علامة مثل Toyota، ثم تصفح المحركات وعلب التروس وقطع الشاسيه أو نصف المقطوعة لتلك العلامة. العلامات ذات الصفحة المخصصة ترتبط مباشرة بكتalogها الكامل.'},
    'brands.ctaTitle': { zh: '没找到您的品牌？', fr: 'Vous ne voyez pas votre marque ?', ar: 'لا تجد علامتك؟'},
    'brands.ctaLead': { zh: '我们的供应网络覆盖更多品牌与车型。发送需求 — 我们全球采购。', fr: 'Notre réseau de fournisseurs couvre d\'autres marques et modèles. Envoyez vos besoins — nous approvisionnons mondialement.', ar: 'شبكة موردينا تغطي علامات وطرازات إضافية. أرسل متطلباتك — نتورّد عالمياً.'},
    'brands.contactTeam': { zh: '联系采购团队', fr: 'Contacter l\'équipe sourcing', ar: 'اتصل بفريق التوريد'},
    'brands.featured': { zh: '重点', fr: 'En vedette', ar: 'مميز'},
    'brands.priority': { zh: '优先', fr: 'Prioritaire', ar: 'أولوية'},
    'brands.viewDirectory': { zh: '查看品牌目录', fr: 'Voir le répertoire des marques', ar: 'عرض دليل العلامات'},
    'brands.availableProducts': { zh: '可用产品', fr: 'Produits disponibles', ar: 'المنتجات المتوفرة'},
    'brands.matched': { zh: '匹配：', fr: 'Correspondance :', ar: 'مطابقة:'},
    'brands.productSummary': { zh: '发动机 · 变速箱 · 底盘件 · 乘用车', fr: 'Moteurs · Boîtes de vitesses · Pièces châssis · Demi-coupures', ar: 'محركات · علب تروس · قطع شاسيه · نصف مقطوعة'},
    'brands.noResults': { zh: '没有匹配的品牌。', fr: 'Aucune marque ou modèle de moteur correspondant.', ar: 'لم يُعثر على علامة أو طراز محرك مطابق.'},
    'brands.viewBrand': { zh: '查看品牌', fr: 'Voir la marque', ar: 'عرض العلامة'},
    'brands.viewProducts': { zh: '查看产品', fr: 'Voir les produits', ar: 'عرض المنتجات'},

    'contact.labelName': { zh: '姓名', fr: 'Nom complet', ar: 'الاسم الكامل'},
    'contact.labelCompany': { zh: '公司', fr: 'Entreprise', ar: 'الشركة'},
    'contact.labelEmail': { zh: '邮箱', fr: 'E-mail', ar: 'البريد الإلكتروني:'},
    'contact.labelPhone': { zh: '电话 / WhatsApp', fr: 'Téléphone / WhatsApp', ar: 'الهاتف / واتساب'},
    'contact.labelCountry': { zh: '所在国家', fr: 'Pays de destination', ar: 'بلد الوجهة'},
    'contact.labelEnquiryType': { zh: '询价类型', fr: 'Type de demande', ar: 'نوع الاستفسار'},
    'contact.labelVehicleDetails': { zh: '车辆 / 配件详情', fr: 'Détails du véhicule', ar: 'تفاصيل المركبة'},
    'contact.labelMessage': { zh: '补充说明', fr: 'Notes supplémentaires', ar: 'ملاحظات إضافية'},
    'contact.placeholderName': { zh: '您的姓名', fr: 'Votre nom', ar: 'اسمك'},
    'contact.placeholderCompany': { zh: '公司名称', fr: 'Nom de l\'entreprise', ar: 'اسم الشركة'},
    'contact.placeholderEmail': { zh: 'you@company.com', fr: 'vous@entreprise.com', ar: 'you@company.com'},
    'contact.placeholderPhone': { zh: '801 234 5678', fr: '+234 801 234 5678', ar: '+234 801 234 5678'},
    'contact.phoneRequiredHint': { zh: '先选国家。+ 已固定，请在区号后填写完整号码。', fr: 'Sélectionnez d\'abord le pays. + est fixe — saisissez le numéro complet après l\'indicatif.', ar: 'اختر البلد أولاً. + ثابت — أدخل الرقم الكامل بعد رمز البلد.'},
    'contact.selectCountry': { zh: '选择国家', fr: 'Sélectionner le pays', ar: 'اختر البلد'},
    'contact.selectType': { zh: '选择类型', fr: 'Sélectionner le type de demande', ar: 'اختر نوع الاستفسار'},
    'contact.typeEngine': { zh: '发动机询价', fr: 'Engines', ar: 'المحركات'},
    'contact.typeGearbox': { zh: '变速箱询价', fr: 'Boîtes de vitesses', ar: 'علبة سرعة'},
    'contact.typePowertrain': { zh: '发动机 + 变速箱套装', fr: 'Pièces groupe motopropulseur', ar: 'قطع مجموعة نقل الحركة'},
    'contact.typeBulk': { zh: '批量 / 整柜订单', fr: 'Commande en gros / conteneur', ar: 'طلب بالجملة / حاوية'},
    'contact.typePartnership': { zh: 'B2B 合作', fr: 'Partenariat fournisseur', ar: 'شراكة مورد'},
    'contact.typeOther': { zh: '其他', fr: 'Autre', ar: 'أخرى'},
    'contact.placeholderVehicle': { zh: '品牌、车型、年份、发动机代号、VIN/底盘号、变速箱类型（自动/手动，两驱/四驱）', fr: 'Marque, modèle, année, code moteur/boîte, quantité…', ar: 'العلامة، الطراز، السنة، رمز المحرك/علبة التروس، الكمية…'},
    'contact.placeholderMessage': { zh: '数量、目的港、时间要求、EXW 或 CIF 偏好…', fr: 'Port de destination, préférence EXW/CIF, délai…', ar: 'ميناء الوجهة، تفضيل EXW/CIF، الجدول الزمني…'},
    'contact.submitEnquiry': { zh: '提交询价', fr: 'Envoyer la demande', ar: 'إرسال الاستفسار'},
    'contact.successSaved': { zh: '询价已提交', fr: 'Demande enregistrée', ar: 'تم حفظ الاستفسار'},
    'contact.successWhatsapp': { zh: '您的询价已成功提交。我们将在 24 小时内与您联系。', fr: 'Votre demande a été envoyée avec succès. Nous vous contacterons sous 24 heures.', ar: 'تم إرسال استفسارك بنجاح. سنتواصل معك خلال 24 ساعة.'},
    'contact.successReceived': { zh: '询价已收到', fr: 'Demande reçue', ar: 'تم استلام الاستفسار'},
    'contact.successEmail': { zh: '您的询价已提交。我们将在 24 小时内回复您的邮箱。', fr: 'Votre demande est enregistrée. Nous répondrons à votre e-mail sous 24 heures — WhatsApp non requis.', ar: 'تم حفظ استفسارك. سنرد على بريدك الإلكتروني خلال 24 ساعة — لا حاجة لواتساب.'},

    'feedback.gotIt': { zh: '知道了', fr: 'Compris', ar: 'حسناً'},
    'feedback.ok': { zh: '提示', fr: 'Avis', ar: 'تنبيه'},
    'feedback.formIncomplete': { zh: '请完善表单', fr: 'Veuillez compléter le formulaire', ar: 'يرجى إكمال النموذج'},
    'feedback.formIncompleteMsg': { zh: '请填写所有带 * 的必填项。', fr: 'Veuillez remplir tous les champs obligatoires marqués *.', ar: 'يرجى ملء جميع الحقول المطلوبة المعلّمة بـ *.'},
    'feedback.enquirySaved': { zh: '询价已提交', fr: 'Demande enregistrée', ar: 'تم حفظ الاستفسار'},
    'feedback.enquirySavedEmail': { zh: '您的询价已成功提交。我们将在 24 小时内回复您的邮箱。', fr: 'Votre demande a été envoyée avec succès. Nous répondrons à votre e-mail sous 24 heures.', ar: 'تم إرسال استفسارك بنجاح. سنرد على بريدك الإلكتروني خلال 24 ساعة.'},
    'feedback.enquirySavedMsg': { zh: '您的询价已成功提交。我们将在 24 小时内与您联系。', fr: 'Votre demande a été envoyée avec succès. Nous vous contacterons sous 24 heures.', ar: 'تم إرسال استفسارك بنجاح. سنتواصل معك خلال 24 ساعة.'},
    'feedback.enquiryFailed': { zh: '提交失败', fr: 'Impossible d\'enregistrer la demande', ar: 'تعذّر حفظ الاستفسار'},
    'feedback.enquiryFailedMsg': { zh: '询价未能保存到服务器。请稍后重试或通过其他方式联系我们。', fr: 'Nous n\'avons pas pu enregistrer votre demande sur le serveur. Réessayez plus tard ou contactez-nous directement.', ar: 'تعذّر حفظ استفسارك على الخادم. حاول لاحقاً أو تواصل معنا مباشرة.'},
    'feedback.saving': { zh: '正在提交…', fr: 'Enregistrement en cours…', ar: 'جاري حفظ الاستفسار…'},
    'feedback.savingMsg': { zh: '请稍候，正在保存您的询价。', fr: 'Veuillez patienter pendant l\'envoi de votre demande.', ar: 'يرجى الانتظار أثناء إرسال استفسارك.'},
    'feedback.halfCutSaved': { zh: '询价已记录', fr: 'Demande enregistrée', ar: 'تم تسجيل الاستفسار'},
    'feedback.halfCutSavedMsg': { zh: '您的乘用车询价已成功提交。我们将在 24 小时内与您联系。', fr: 'Votre demande demi-coupure a été envoyée avec succès. Nous vous contacterons sous 24 heures.', ar: 'تم إرسال استفسار نصف المقطوعة بنجاح. سنتواصل معك خلال 24 ساعة.'},
    'feedback.partsEnquirySaved': { en: 'Enquiry recorded', zh: '询价已记录', fr: 'Demande enregistrée', ar: 'تم تسجيل الاستفسار' },
    'feedback.partsEnquirySavedMsg': { en: 'Your parts enquiry was submitted successfully. We will contact you within 24 hours.', zh: '您的配件询价已成功提交。我们将在 24 小时内与您联系。', fr: 'Votre demande de pièces a été envoyée avec succès. Nous vous contacterons sous 24 heures.', ar: 'تم إرسال استفسار القطع بنجاح. سنتواصل معك خلال 24 ساعة.' },
    'feedback.whatsappOpening': { zh: '正在打开 WhatsApp…', fr: 'Ouverture de WhatsApp…', ar: 'جاري فتح واتساب…'},
    'feedback.halfCutFailed': { zh: '提交失败', fr: 'Impossible d\'enregistrer la demande', ar: 'تعذّر حفظ الاستفسار'},
    'feedback.halfCutFailedMsg': { zh: '未能保存到服务器。请重试或使用联系表单。', fr: 'Nous n\'avons pas pu enregistrer votre demande sur le serveur. Réessayez ou utilisez le formulaire de contact.', ar: 'تعذّر حفظ استفسارك على الخادم. حاول مرة أخرى أو استخدم نموذج الاتصال.'},
    'feedback.halfCutListingUnavailable': { zh: '该 listing 不可用。请使用联系表单联系我们。', fr: 'Annonce indisponible. Utilisez le formulaire de contact pour nous joindre.', ar: 'الإعلان غير متاح. استخدم نموذج الاتصال للتواصل معنا.'},
    'feedback.uploadSuccess': { zh: '上传成功', fr: 'Téléversement réussi', ar: 'تم الرفع بنجاح'},
    'feedback.uploadFailed': { zh: '上传失败', fr: 'Échec du téléversement', ar: 'فشل الرفع'},
    'feedback.registrationSuccess': { zh: '注册已提交', fr: 'Inscription envoyée', ar: 'تم إرسال التسجيل'},
    'feedback.registrationSuccessMsg': { zh: '感谢您的申请。我们的供应商团队将在 3 个工作日内通过邮箱联系您。', fr: 'Merci pour votre candidature. Notre équipe relations fournisseurs vous contactera à l\'e-mail indiqué sous 3 jours ouvrés.', ar: 'شكراً لتقديمك. سيتواصل فريق علاقات الموردين على البريد المقدم خلال 3 أيام عمل.'},
    'feedback.photoUploaded': { zh: '照片已上传', fr: 'Photo téléversée', ar: 'تم رفع الصورة'},
    'feedback.videoUploaded': { zh: '视频已上传', fr: 'Vidéo téléversée', ar: 'تم رفع الفيديو'},

    'leadContact.title': { zh: '请留下联系方式', fr: 'Vos coordonnées', ar: 'بيانات الاتصال الخاصة بك'},
    'leadContact.message': { zh: '请选择国家，然后填写电话号码或邮箱地址。', fr: 'Sélectionnez votre pays, puis saisissez votre téléphone ou e-mail.', ar: 'اختر بلدك، ثم أدخل رقم هاتفك أو بريدك الإلكتروني.'},
    'leadContact.whatsappSaveHint': { zh: '我们会先保存您的询价，再打开 WhatsApp。', fr: 'Nous enregistrons votre demande avant d\'ouvrir WhatsApp.', ar: 'سنحفظ استفسارك قبل فتح واتساب.'},
    'leadContact.contactEitherHint': { zh: '电话或邮箱至少填写一项。若填电话，请先选择国家。', fr: 'Saisissez téléphone ou e-mail — au moins l\'un est requis. Sélectionnez d\'abord le pays si vous entrez un numéro.', ar: 'أدخل الهاتف أو البريد — أحدهما مطلوب على الأقل. اختر البلد أولاً عند إدخال رقم الهاتف.'},
    'leadContact.contactRequired': { zh: '请填写电话号码或邮箱地址。', fr: 'Veuillez saisir votre numéro de téléphone ou adresse e-mail.', ar: 'يرجى إدخال رقم هاتفك أو بريدك الإلكتروني.'},
    'leadContact.name': { zh: '姓名', fr: 'Votre nom', ar: 'اسمك'},
    'leadContact.phone': { zh: '电话 / WhatsApp', fr: 'Téléphone / WhatsApp', ar: 'الهاتف / واتساب'},
    'leadContact.email': { zh: '邮箱', fr: 'E-mail', ar: 'البريد الإلكتروني:'},
    'leadContact.emailInvalid': { zh: '请输入有效的邮箱地址。', fr: 'Veuillez saisir une adresse e-mail valide.', ar: 'يرجى إدخال بريد إلكتروني صالح.'},
    'leadContact.emailPlaceholder': { zh: '请填写真实可收信的邮箱，测试邮箱（如 test@example.com）无法提交。', fr: 'Utilisez une adresse e-mail réelle où vous pouvez recevoir du courrier.', ar: 'استخدم بريداً إلكترونياً حقيقياً يمكنك استقبال الرسائل عليه.'},
    'leadContact.emailRequired': { zh: '请填写邮箱地址，以便我们通过邮件回复。', fr: 'Veuillez saisir votre e-mail pour que nous puissions répondre.', ar: 'يرجى إدخال بريدك الإلكتروني حتى نتمكن من الرد.'},
    'leadContact.phoneInvalid': { zh: '请输入有效的国际电话号码（+ 后共 8–15 位数字）。', fr: 'Saisissez un numéro de téléphone international valide.', ar: 'أدخل رقم هاتف دولي صالح.'},
    'leadContact.phoneCountryMismatch': { zh: '电话号码必须与所选国家的区号一致。', fr: 'Le numéro doit correspondre à l\'indicatif du pays sélectionné.', ar: 'يجب أن يطابق رقم الهاتف رمز البلد المختار.'},
    'leadContact.phoneNationalInvalid': { zh: '请在国家区号后填写完整的本地号码。', fr: 'Saisissez le numéro local complet après l\'indicatif pays.', ar: 'أدخل الرقم المحلي الكامل بعد رمز البلد.'},
    'leadContact.phoneNoLeadingZero': { zh: '请去掉号码开头的 0，不要加本地长途前缀。', fr: 'Supprimez le 0 initial — saisissez le numéro sans préfixe local.', ar: 'أزل الصفر البادئ — أدخل الرقم بدون بادئة محلية.'},
    'leadContact.phoneCountryCode': { zh: '电话号码必须与所选国家区号一致。', fr: 'Le numéro doit correspondre à l\'indicatif téléphonique du pays sélectionné.', ar: 'يجب أن يطابق رقم الهاتف رمز الاتصال للبلد المختار.'},
    'leadContact.phoneRequiredHint': { zh: '+ 已固定。先选国家，区号会自动填入。邮箱选填。', fr: '+ est fixe. Sélectionnez d\'abord le pays — l\'indicatif se remplit automatiquement. E-mail facultatif.', ar: '+ ثابت. اختر البلد أولاً — يُملأ رمز الاتصال تلقائياً. البريد اختياري.'},
    'leadContact.country': { zh: '所在国家', fr: 'Votre pays', ar: 'بلدك'},
    'leadContact.selectCountry': { zh: '选择国家', fr: 'Sélectionner le pays', ar: 'اختر البلد'},
    'leadContact.countryRequired': { zh: '请选择所在国家。', fr: 'Veuillez sélectionner votre pays.', ar: 'يرجى اختيار بلدك.'},
    'leadContact.continue': { zh: '继续询价', fr: 'Continuer', ar: 'متابعة'},
    'leadContact.cancel': { zh: '取消', fr: 'Annuler', ar: 'إلغاء'},
    'leadContact.phoneRequired': { zh: '请输入您的电话号码。', fr: 'Numéro de téléphone requis. Incluez l\'indicatif pays, ex. +234 801 234 5678.', ar: 'رقم الهاتف مطلوب. ضمّن رمز البلد، مثل +234 801 234 5678.'},

    'contact.faq1Q': { zh: '询价应包含哪些信息？', fr: 'Que dois-je inclure dans ma demande ?', ar: 'ماذا يجب أن أذكر في استفساري؟'},
    'contact.faq1A': { zh: '车辆品牌、车型、年份、发动机代号或变速箱类型及目的港。如有 VIN/底盘号请附上。说明数量及是否需要 EXW 或 CIF 报价。', fr: 'Marque, modèle, année, code moteur ou type de boîte, et port de destination. Indiquez le NIV/châssis si disponible. Précisez la quantité et si vous souhaitez un prix EXW ou CIF.', ar: 'العلامة والطراز والسنة ورمز المحرك أو نوع علبة التروس وميناء الوجهة. أرفق رقم VIN/الشاسيه إن وُجد. حدّد الكمية وما إذا كنت تحتاج تسعير EXW أو CIF.'},
    'contact.faq2Q': { zh: '多久能收到报价？', fr: 'En combien de temps recevrai-je un devis ?', ar: 'متى سأحصل على عرض السعر؟'},
    'contact.faq2A': { zh: '标准询价 24 小时内回复。现货单位可能当日报价。定制采购需 48–72 小时核查供应。', fr: 'Demandes standard sous 24 heures. Unités en stock le jour même si possible. Approvisionnement sur mesure : 48–72 h le temps de vérifier la disponibilité fournisseur.', ar: 'الاستفسارات القياسية خلال 24 ساعة. الوحدات المتوفرة قد تُسعَّر في نفس اليوم. التوريد المخصص 48–72 ساعة أثناء التحقق من توفر المورد.'},
    'contact.faq3Q': { zh: '是否接受小订单？', fr: 'Acceptez-vous les petites commandes ?', ar: 'هل تتعاملون مع الطلبات الصغيرة؟'},
    'contact.faq3A': { zh: '支持 — 单台 LCL 及整柜批量。复购客户享优惠价格及专属客户经理。', fr: 'Oui — unités isolées en LCL et conteneurs complets pour gros acheteurs. Les clients réguliers bénéficient de tarifs préférentiels et d\'un gestionnaire de compte dédié.', ar: 'نعم — وحدات فردية عبر LCL وحاويات كاملة للمشترين بالجملة. يحصل العملاء المتكررون على أسعار تفضيلية ومدير حساب مخصص.'},

    'engine.home': { zh: '首页', fr: 'Accueil', ar: 'المنزل '},
    'engine.brands': { zh: '品牌', fr: 'Marques', ar: 'العلامات التجارية'},
    'engine.engines': { zh: '发动机', fr: 'Engines', ar: 'المحركات'},
    'engine.engineModel': { zh: '发动机型号', fr: 'Modèle moteur', ar: 'طراز المحرك'},
    'engine.exportAvailability': { zh: '出口可用性', fr: 'Disponibilité export', ar: 'توفر التصدير'},
    'engine.viewModel': { zh: '查看型号 →', fr: 'Voir le modèle →', ar: 'عرض الطراز →'},
    'engine.requestQuote': { zh: '获取报价', fr: 'Citation requise', ar: 'اطلب اقتباس'},
    'engine.modelsListed': { zh: '个发动机型号已列', fr: 'modèles de moteur répertoriés', ar: 'موديلات المحركات المدرجة'},
    'engine.viewBrand': { zh: '查看', fr: 'Voir', ar: 'عرض'},
    'engine.categoryEngines': { zh: '发动机', fr: 'Engines', ar: 'المحركات'},
    'engine.catalogFor': { zh: '发动机型号目录 — 支持全球出口。', fr: 'Catalogue modèles moteur — disponible pour export mondial.', ar: 'كتalog طرازات المحرك — متاح للتصدير العالمي.'},
    'engine.viewFullList': { zh: '查看完整列表', fr: 'Voir la liste complète', ar: 'عرض القائمة الكاملة'},
    'engine.browseBrand': { zh: '浏览', fr: 'Parcourir', ar: 'تصفح'},
    'engine.brandEngines': { zh: '发动机', fr: 'Engines', ar: 'المحركات'},
    'engine.brandGearboxes': { zh: '变速箱', fr: 'Boîtes de vitesses', ar: 'علبة سرعة'},
    'engine.brandChassis': { zh: '底盘件', fr: 'Châssis', ar: 'أجزاء الشاسيه'},
    'engine.brandHalfCuts': { zh: '乘用车', fr: ', de découpes partielles', ar: 'قصات نصفية'},
    'engine.productCatalog': { zh: '产品目录', fr: 'Catalogue produits', ar: 'كتalog المنتجات'},
    'engine.allEngineModels': { zh: '全部发动机型号', fr: 'Tous les modèles moteur', ar: 'جميع طرازات المحرك'},
    'engine.gearboxes': { zh: '变速箱', fr: 'Boîtes de vitesses', ar: 'علبة سرعة'},
    'engine.halfCuts': { zh: '乘用车', fr: ', de découpes partielles', ar: 'قصات نصفية'},
    'engine.chassisParts': { zh: '底盘件', fr: 'Châssis', ar: 'أجزاء الشاسيه'},
    'engine.needExport': { zh: '需要出口？', fr: 'Besoin pour l\'export ?', ar: 'هل تحتاج للتصدير؟'},
    'engine.quoteLead': { zh: '发送您的需求 — 24 小时内 EXW/CIF 报价。', fr: 'Envoyez vos besoins — devis EXW/CIF sous 24 heures.', ar: 'أرسل متطلباتك — عرض EXW/CIF خلال 24 ساعة.'},
    'engine.contactTeam': { zh: '联系采购团队', fr: 'Contacter l\'équipe sourcing', ar: 'اتصل بفريق التوريد'},
    'engine.allBrandEngines': { zh: '全部', fr: 'Tous', ar: 'الكل'},
    'engine.displacement': { zh: '排量', fr: 'Cylindrée', ar: 'سعة المحرك'},
    'engine.fuelType': { zh: '燃料类型', fr: 'Type de carburant', ar: 'نوع الوقود'},
    'engine.applications': { zh: '适用车型', fr: 'Applications', ar: 'التطبيقات'},
    'engine.needExportPrefix': { zh: '需要出口', fr: 'Besoin', ar: 'هل تحتاج'},
    'engine.needExportSuffix': { zh: '？', fr: 'pour l\'export ?', ar: 'للتصدير؟'},
    'engine.sourcedFor': { zh: '通过 AsiaPower 中国供应网络采购，支持全球出口。', fr: 'Approvisionné pour export mondial via AsiaPower', ar: 'مُورَّد للتصدير العالمي عبر AsiaPower'},
    'engine.statusAvailable': { zh: '现货', fr: 'Disponible', ar: 'متوفر'},
    'engine.statusReadyExport': { zh: '可出口', fr: 'Prêt pour export', ar: 'جاهز للتصدير'},
    'engine.statusFob': { zh: '支持 EXW', fr: 'EXW disponible', ar: 'EXW متاح'},
    'engine.statusCif': { zh: '支持 CIF', fr: 'CIF disponible', ar: 'CIF متاح'},

    'hc.includedParts': { zh: '包含部件', fr: 'Pièces incluses', ar: 'القطع المُضمَّنة'},
    'hc.vehicleVideo': { zh: '车辆视频', fr: 'Vidéo véhicule', ar: 'فيديو المركبة'},
    'hc.zoom': { zh: '放大', fr: 'Agrandir', ar: 'تكبير'},
    'hc.supplierVerified': { zh: '供应商已验证 — 发布前由 AsiaPower 供应网络确认库存。', fr: 'Annonce fournisseur vérifiée — inventaire confirmé par le réseau AsiaPower avant publication.', ar: 'إعلان مورد موثق — تم تأكيد المخزون من شبكة موردي AsiaPower قبل النشر.'},
    'hc.notFound': { zh: '未找到乘用车', fr: 'Demi-coupure introuvable', ar: 'نصف المقطوعة غير موجودة'},
    'hc.notFoundLead': { zh: '该列表不可用。', fr: 'Cette annonce n\'est pas disponible.', ar: 'هذا الإعلان غير متاح.'},
    'hc.browseInventory': { zh: '浏览乘用车库存', fr: 'Parcourir l\'inventaire demi-coupures', ar: 'تصفح مخزون نصف المقطوعة'},
    'hc.halfCutListings': { zh: '乘用车列表', fr: 'Annonces demi-coupées', ar: 'مساكن نصف مقطوعة'},
    'hc.allHalfCuts': { zh: '全部乘用车', fr: 'Toutes les demi-coupures', ar: 'جميع نصف المقطوعة'},
    'hc.enginePage': { zh: '发动机页面', fr: 'Page moteur', ar: 'صفحة المحرك'},
    'hc.halfCut': { zh: '乘用车', fr: 'Demi-coupure', ar: 'نصف مقطوعة'},
    'hc.onEnquiry': { zh: '询价', fr: 'Sur demande', ar: 'عند الاستفسار'},
    'hc.condition': { zh: '状况', fr: 'État', ar: 'الحالة'},
    'hc.drivetrain': { zh: '驱动形式', fr: 'Transmission secondaire', ar: 'نظام الدفع'},
    'hc.mileage': { en: 'Mileage', zh: '里程', fr: 'Kilométrage', ar: 'المسافة المقطوعة' },
    'hc.chassisVin': { en: 'Chassis VIN', zh: '底盘号', fr: 'N° de châssis', ar: 'رقم الهيكل' },
    'hc.customDismantleNote': {
      en: 'Custom Dismantling — Parts on Demand',
      zh: '定制拆解，按需取件',
      fr: 'Démontage sur mesure, pièces à la demande',
      ar: 'تفكيك مخصص، قطع حسب الطلب',
    },
    'hc.origin': { zh: '来源', fr: 'Origine', ar: 'المنشأ'},
    'hc.status': { zh: '状态', fr: 'Statut', ar: 'الحالة'},
    'hc.catalog': { zh: '目录', fr: 'Catalogue', ar: 'الفهرس'},
    'hc.contactTeam': { zh: '联系采购团队', fr: 'Contacter l\'équipe sourcing', ar: 'اتصل بفريق التوريد'},
    'hc.ctaSold': { zh: '类似乘用车', fr: 'Similaire', ar: 'مماثل'},
    'hc.ctaExport': { zh: '出口乘用车', fr: 'Exporter', ar: 'تصدير'},
    'hc.ctaSoldIntro': { zh: '库存编号', fr: 'N° stock', ar: 'رقم المخزون'},
    'hc.ctaSoldRest': { zh: '已售。索取类似车源时可引用本列表。', fr: 'est vendu. Référez-vous à cette annonce pour demander une unité similaire.', ar: 'مباع. أشر إلى هذا الإعلان عند طلب وحدة مماثلة.'},
    'hc.ctaReservedRest': { zh: '为预留/在途状态。出口前请确认现货或索取类似车源。', fr: 'est réservé/en transit. Confirmez la disponibilité ou demandez une unité similaire avant export.', ar: 'محجوز/في transit. أكّد التوفر أو اطلب وحدة مماثلة قبل التصدير.'},
    'hc.ctaAvailableRest': { zh: ' — 引用该编号获取 EXW/CIF 报价，现货以询价确认为准。', fr: ' — référence pour devis EXW/CIF ; disponibilité confirmée sur demande.', ar: ' — مرجع لعرض EXW/CIF؛ يُؤكَّد التوفر عند الاستفسار.'},
    'hc.detailVerifiedExport': { en: 'Verified export listing', zh: '已验证出口库存', fr: 'Annonce export vérifiée', ar: 'إعلان تصدير موثق' },
    'hc.itemSpecifics': { en: 'Item specifics', zh: '商品详情', fr: 'Caractéristiques', ar: 'مواصفات المنتج' },
    'hc.aboutThisItem': { en: 'About this item', zh: '关于本商品', fr: 'À propos de cet article', ar: 'حول هذا المنتج' },
    'hc.similarProducts': { en: 'Similar products', zh: '相似产品', fr: 'Produits similaires', ar: 'منتجات مشابهة' },
    'hc.viewAllBrand': { en: 'View all {brand}', zh: '查看全部 {brand}', fr: 'Voir tout {brand}', ar: 'عرض كل {brand}' },
    'hc.cifCalculator': { en: 'CIF Calculator', zh: 'CIF 试算', fr: 'Calculateur CIF', ar: 'حاسبة CIF' },
    'hc.cifCalculatorLead': { en: 'Quick estimate of ocean freight & marine insurance to your port.', zh: '快速估算至目的港的海运费与保险费。', fr: 'Estimation rapide du fret maritime et de l\'assurance vers votre port.', ar: 'تقدير سريع للشحن البحري والتأمين إلى مينائك.' },
    'hc.cifDestPort': { en: 'Destination port', zh: '目的港', fr: 'Port de destination', ar: 'ميناء الوجهة' },
    'hc.cifLoadingPorts': { en: 'Loading ports…', zh: '加载港口…', fr: 'Chargement des ports…', ar: 'جاري تحميل الموانئ…' },
    'hc.cifSelectPort': { en: 'Select destination port', zh: '选择目的港', fr: 'Sélectionner le port', ar: 'اختر ميناء الوجهة' },
    'hc.cifExwUnit': { en: 'EXW (this unit)', zh: 'EXW（本车）', fr: 'EXW (cette unité)', ar: 'EXW (هذه الوحدة)' },
    'hc.cifExwPlaceholder': { en: 'Enter EXW quote', zh: '输入 EXW 报价', fr: 'Saisir le devis EXW', ar: 'أدخل عرض EXW' },
    'hc.cifOceanFreight': { en: 'Ocean freight', zh: '海运费', fr: 'Fret maritime', ar: 'الشحن البحري' },
    'hc.cifInsurance': { en: 'Marine insurance', zh: '保险费', fr: 'Assurance maritime', ar: 'التأمين البحري' },
    'hc.cifTotal': { en: 'Est. CIF total', zh: '预估 CIF 合计', fr: 'Total CIF estimé', ar: 'إجمالي CIF التقديري' },
    'hc.cifDisclaimer': {
      en: 'For reference only. Actual price is based on the freight forwarder’s real quote at purchase. Destination duties & local port charges not included.',
      zh: '仅供参考。实际价格以购买时货代真实报价为准。不含目的港关税及当地港杂费。',
      fr: 'À titre indicatif uniquement. Le prix réel est celui du devis du transitaire au moment de l’achat. Droits et frais portuaires locaux non inclus.',
      ar: 'للمرجع فقط. السعر الفعلي وفق عرض وكيل الشحن الحقيقي عند الشراء. لا يشمل رسوم الجمارك والميناء المحلية.',
    },
    'hc.cifDisclaimerBadge': { en: 'Reference only', zh: '仅供参考', fr: 'Indicatif', ar: 'مرجع فقط' },
    'hc.cifNeedExw': { en: 'Enter EXW price to calculate CIF.', zh: '请输入 EXW 价格以计算 CIF。', fr: 'Saisissez le prix EXW pour calculer le CIF.', ar: 'أدخل سعر EXW لحساب CIF.' },
    'hc.cifFetching': { en: 'Fetching freight & insurance…', zh: '正在获取运费与保险…', fr: 'Récupération fret et assurance…', ar: 'جاري جلب الشحن والتأمين…' },
    'hc.cifFetchFailed': { en: 'Could not load rates. Try again or contact us.', zh: '无法加载费率，请重试或联系我们。', fr: 'Impossible de charger les tarifs. Réessayez ou contactez-nous.', ar: 'تعذّر تحميل الأسعار. أعد المحاولة أو اتصل بنا.' },
    'hc.cifDetected': { en: 'Suggested port for {country}', zh: '已为 {country} 推荐目的港', fr: 'Port suggéré pour {country}', ar: 'ميناء مقترح لـ {country}' },
    'hc.cifToPort': { en: 'To', zh: '至', fr: 'Vers', ar: 'إلى' },
    'hc.cifFromChina': { en: 'from China', zh: '中国起运', fr: 'depuis la Chine', ar: 'من الصين' },
    'hc.shipsFromChina': { en: 'Ships from China · EXW Zhengzhou · CIF on request', zh: '中国发货 · EXW 郑州 · 可报 CIF', fr: 'Expédition depuis la Chine · EXW Zhengzhou · CIF sur demande', ar: 'شحن من الصين · EXW تشنغتشو · CIF عند الطلب' },
    'hc.detailSellerName': { en: 'AsiaPower Sourcing', zh: 'AsiaPower 采购团队', fr: 'Sourcing AsiaPower', ar: 'توريد AsiaPower' },
    'hc.detailSellerMeta': { en: 'China export network · B2B only', zh: '中国出口网络 · 仅 B2B', fr: 'Réseau export Chine · B2B uniquement', ar: 'شبكة تصدير الصين · B2B فقط' },
    'hc.messageSeller': { en: 'Message', zh: '联系', fr: 'Message', ar: 'رسالة' },
    'hc.readMore': { en: 'Read more', zh: '展开', fr: 'Lire la suite', ar: 'اقرأ المزيد' },
    'hc.whyBuy': { en: 'Why buy from AsiaPower', zh: '为何选择 AsiaPower', fr: 'Pourquoi AsiaPower', ar: 'لماذا AsiaPower' },
    'hc.trustPhotos': { en: 'Real inventory photos', zh: '真实库存照片', fr: 'Photos réelles du stock', ar: 'صور مخزون حقيقية' },
    'hc.trustVideo': { en: 'Real inventory video', zh: '真实库存视频', fr: 'Vidéo réelle du stock', ar: 'فيديو مخزون حقيقي' },
    'hc.trustPrice': { en: 'Transparent EXW price', zh: '透明 EXW 报价', fr: 'Prix EXW transparent', ar: 'سعر EXW شفاف' },
    'hc.trustVin': { en: 'VIN / chassis verifiable', zh: '底盘号可核验', fr: 'VIN / châssis vérifiable', ar: 'رقم الهيكل قابل للتحقق' },
    'hc.trustCif': { en: 'EXW + CIF to your port', zh: 'EXW + CIF 至目的港', fr: 'EXW + CIF vers votre port', ar: 'EXW + CIF إلى مينائك' },

    'guides.breadcrumb': { zh: '采购指南', fr: 'Guides acheteurs', ar: 'دليل المشتري' },
    'guides.title': { zh: 'AsiaPower 采购指南', fr: 'Guides acheteurs AsiaPower', ar: 'دليل مشتري AsiaPower' },
    'guides.lead': { zh: '为从中国采购发动机、变速箱、乘用车及卡车车头的进口商、维修厂和车队运营商提供实用建议。', fr: 'Conseils pratiques pour importateurs, ateliers et opérateurs de flottes qui approvisionnent moteurs, boîtes de vitesses, demi-coupures et têtes de camion depuis la Chine.', ar: 'نصائح عملية للمستوردين وورش العمل ومشغلي الأساطيل الذين يتورّدون محركات وعلب تروس ونصف مقطوعة ومقدمات شاحنات من الصين.' },
    'guides.engineTitle': { zh: '如何从中国购买二手发动机 — 采购指南', fr: 'Comment acheter un moteur d\'occasion en Chine — Guide acheteur', ar: 'كيف تشتري محركاً مستعملاً من الصين — دليل المشتري' },
    'guides.engineLead': { zh: '下单前需核查的事项、发动机代号说明、「整车启动视频」的含义，以及如何避免常见进口错误。', fr: 'Ce qu\'il faut vérifier avant commande, le fonctionnement des codes moteur, la « vidéo de démarrage du véhicule complet », et comment éviter les erreurs d\'import courantes.', ar: 'ما يجب التحقق منه قبل الطلب، وكيف تعمل رموز المحرك، ومعنى «فيديو تشغيل المركبة الكاملة»، وكيف تتجنب أخطاء الاستيراد الشائعة.' },
    'guides.fobTitle': { zh: 'EXW 与 CIF：应选择哪种运输条款？', fr: 'EXW vs CIF : quel terme d\'expédition choisir ?', ar: 'EXW مقابل CIF: أي شرط شحن تختار؟' },
    'guides.fobLead': { zh: '面向首次进口商的 EXW/CIF 通俗解读 — 谁承担哪些费用、风险何时转移，以及如何根据货量选择合适条款。', fr: 'Explication claire du EXW et du CIF pour les nouveaux importateurs — qui paie quoi, quand le risque est transféré, et comment choisir le bon terme selon la taille de l\'expédition.', ar: 'شرح واضح لـ EXW وCIF للمستوردين الجدد — من يدفع ماذا، ومتى ينتقل الخطر، وكيف تختار الشرط المناسب لحجم الشحنة.' },
    'guides.ctaTitle': { zh: '有具体问题？', fr: 'Une question précise ?', ar: 'لديك سؤال محدد؟' },
    'guides.ctaLead': { zh: '发送车辆品牌、型号及需求 — 采购团队 24 小时内回复。', fr: 'Envoyez marque, modèle et besoin — notre équipe sourcing répond sous 24 heures.', ar: 'أرسل العلامة والطراز والمتطلب — يرد فريق التوريد خلال 24 ساعة.' },
    'guides.contactUs': { zh: '联系我们', fr: 'Contactez-nous', ar: 'اتصل بنا' },

    'meta.home.title': { zh: 'AsiaPower | 乘用车、卡车、摩托车与工程机械配件', fr: 'AsiaPower | Pièces voitures, camions, motos et engins', ar: 'AsiaPower | قطع سيارات وشاحنات ودراجات ومعدات' },
    'meta.halfcuts.title': { zh: '乘用车目录 | AsiaPower', fr: 'Catalogue demi-coupes | AsiaPower', ar: 'كتالوج القطع النصفي | AsiaPower' },
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
    if (page === 'admin-review' || page === 'admin-inventory'
      || page === 'admin-leads' || page === 'admin-analytics') {
      return true;
    }
    return window.location.pathname.includes('/admin/');
  }

  function isSwitchablePublicPage() {
    return !isInternalPage();
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

  function isSupplierPage() {
    const page = document.body?.dataset?.page || '';
    if (page === 'supplier') return true;
    const path = window.location.pathname || '';
    if (path.includes('/supplier-portal/')) return true;
    const file = path.split('/').pop() || '';
    return file === 'supplier-portal.html';
  }

  function getLang() {
    if (!isSwitchablePublicPage()) return DEFAULT_LANG;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
    } catch {
      // ignore
    }
    if (isSupplierPage()) {
      const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (nav.startsWith('zh')) return 'zh';
    }
    return DEFAULT_LANG;
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

  function applyDocumentTitle() {
    if (!isSwitchablePublicPage()) return;
    const titleEl = document.querySelector('title[data-i18n-title]');
    if (!titleEl) return;
    const key = titleEl.dataset.i18nTitle;
    if (titleEl.dataset.i18nTitleEn == null) titleEl.dataset.i18nTitleEn = titleEl.textContent;
    const lang = getLang();
    document.title = lang === 'en'
      ? titleEl.dataset.i18nTitleEn
      : (STRINGS[key]?.[lang] || titleEl.dataset.i18nTitleEn);
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
      applyDocumentTitle();
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
    applyDocumentTitle();
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
      'EXW Available': 'engine.statusFob',
      'CIF Available': 'engine.statusCif',
    };
    const key = map[status];
    return key ? t(key, status) : status;
  }

  function bootI18n() {
    if (!isSwitchablePublicPage()) return;
    const lang = getLang();
    applyDirection(lang);
    applyDocumentTitle();
    applyDataI18n(document.body);
  }

  function initDocumentLang() {
    if (!isSwitchablePublicPage()) return;
    if (document.body) {
      bootI18n();
    } else {
      document.addEventListener('DOMContentLoaded', bootI18n, { once: true });
    }
  }

  window.addEventListener('asiapower:layoutrefresh', () => {
    if (isSwitchablePublicPage()) applyDataI18n(document.body);
  });

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

  function registerStrings(entries) {
    if (!entries || typeof entries !== 'object') return;
    Object.keys(entries).forEach((key) => {
      if (!STRINGS[key]) STRINGS[key] = {};
      Object.assign(STRINGS[key], entries[key]);
    });
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
    registerStrings,
    showSwitcher: isSwitchablePublicPage,
    isSwitchablePublicPage,
    isInternalPage,
    isRtl,
    SUPPORTED_LANGS,
  };
})();
