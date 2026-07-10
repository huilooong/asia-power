/**
 * AsiaPower — Supplier/admin half-cut workflow labels.
 * Uses PublicI18n when available (en/zh/fr/ar); registers supplier.form.* keys at load.
 */
(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bi(en, zh) {
    return { en, zh, html: `${en}<span class="bi-zh">${zh}</span>`, inline: `${en} / ${zh}` };
  }

  const L = {
    submitListing: bi('Submit for Review', '提交审核'),
    submitListingShort: bi('Submit Listing', '提交库存'),
    decodeVin: bi('Decode VIN', '识别VIN'),
    uploadPhotos: bi('Upload Photos', '上传照片'),
    approve: bi('Approve', '审核通过'),
    reject: bi('Reject', '拒绝'),
    requestReview: bi('Request Review', '提交审核'),
    checkAvailability: bi('Check Availability', '确认库存'),
    addHalfCutInventory: bi('Add Half Cut Inventory', '上传乘用车库存'),
    pendingReview: bi('Pending Review', '待审核'),
    approved: bi('Approved', '已通过'),
    rejected: bi('Rejected', '已拒绝'),
    backToPortal: bi('Back to Supplier Portal', '返回供应商门户'),
    remove: bi('Remove', '删除'),

    supplierUploadTitle: bi('Submit Half-Cut Listing', '提交乘用车库存'),
    supplierUploadLead: bi(
      'Enter the VIN first. The system will try to detect brand, model and year automatically. If decoding fails, please enter vehicle details manually. Upload at least 3 clear photos.',
      '请先输入VIN底盘号，系统会尝试自动识别品牌、车型和年份。如果识别失败，请手动填写车辆信息。请至少上传3张清晰照片。'
    ),
    supplierWarning: bi(
      'Submission does not guarantee publication. Asia Power will verify inventory before listing.',
      '提交不代表一定上架。亚洲动力会在上架前核实库存真实性。'
    ),
    truckUploadTitle: bi('Submit Truck Parts Listing', '提交卡车配件'),
    truckUploadLead: bi(
      'Upload truck cabs, engines, axles and other parts. Choose part type on step 1. VIN is optional for individual parts; engine code is required for engine listings.',
      '上传卡车车头、发动机、车轴及其他配件。请在第1步选择配件类型。单件配件VIN可留空；上传发动机时须填写发动机型号。'
    ),
    passengerUploadOnlyHint: bi(
      'Truck parts must use the Truck Parts Upload page in the Supplier Portal.',
      '卡车配件请使用供应商门户中的「卡车配件上传」入口。'
    ),
    conditionTruckHalfCut: bi('Truck Half Cut', '卡车乘用车'),
    conditionDriverCab: bi('Driver Cab', '驾驶室'),
    truckPartType: bi('Part Type', '配件类型'),
    truckPartCab: bi('Driver Cab', '卡车驾驶室'),
    truckPartEngine: bi('Engine & Transmission', '发动机及变速箱'),
    truckPartAxle: bi('Axle', '车轴'),
    truckPartOther: bi('Other', '其他'),
    truckPartVehicle: bi('Truck / Half Cut', '整车 / 乘用车'),
    truckPartCabHint: bi(
      'Driver cab only — VIN and engine are optional.',
      '仅驾驶室 — VIN和发动机为选填。'
    ),
    truckPartEngineHint: bi(
      'Engine assembly — engine code required; VIN optional.',
      '发动机总成 — 须填发动机型号；VIN可留空。'
    ),
    truckPartAxleHint: bi(
      'Axle assembly — VIN and engine are optional.',
      '车轴总成 — VIN和发动机为选填。'
    ),
    truckPartOtherHint: bi(
      'Other truck parts — VIN and engine are optional.',
      '其他卡车配件 — VIN和发动机为选填。'
    ),
    truckPartVehicleHint: bi(
      'Complete truck or half-cut with VIN, engine and transmission.',
      '整车或乘用车，需填写VIN、发动机和变速箱。'
    ),
    truckVehicleUploadTitle: bi('Submit Commercial Vehicle Listing', '提交商用车整车'),
    truckVehicleUploadLead: bi(
      'Upload whole commercial vehicles — scrap or export used car. Enter the VIN first, then confirm vehicle details and photos.',
      '上传商用车整车（报废车或二手车）。请先输入VIN，再确认车辆信息与照片。'
    ),
    passengerVehicleUploadTitle: bi('Submit Passenger Vehicle Listing', '提交乘用车整车'),
    passengerVehicleUploadLead: bi(
      'Upload whole passenger vehicles — scrap or export used car. Enter the VIN first, then confirm vehicle details and photos.',
      '上传乘用车整车（报废车或二手车）。请先输入VIN，再确认车辆信息与照片。'
    ),
    passengerPartsUploadTitle: bi('Submit Passenger Parts Listing', '提交乘用车配件'),
    passengerPartsUploadLead: bi(
      'Upload passenger front cuts, engines, transmissions, chassis parts and other components. Choose part type on step 1 — no VIN required.',
      '上传乘用车前头、发动机、变速箱、底盘及其他配件。请在第1步选择配件类型；无需VIN。'
    ),
    vehicleListingType: bi('Listing Type', '库存类型'),
    listingTypeScrap: bi('Scrap vehicle', '报废车'),
    listingTypeUsed: bi('Used car (export)', '二手车（出口）'),
    listingTypeScrapHint: bi(
      'Dismantled or half-cut scrap vehicle for parts export.',
      '已拆解或半切的报废车，用于配件出口。'
    ),
    listingTypeUsedHint: bi(
      'Running or repairable whole vehicle for export — export paperwork required.',
      '可启动或可修复的整车出口 — 需具备出口手续。'
    ),
    passengerPartType: bi('Part Type', '配件类型'),
    passengerPartFront: bi('Front cut / nose', '前头'),
    passengerPartEngine: bi('Engine', '发动机'),
    passengerPartTransmission: bi('Transmission', '变速箱'),
    passengerPartChassis: bi('Chassis', '底盘'),
    passengerPartOther: bi('Other parts', '其他'),
    passengerPartFrontHint: bi(
      'Front clip / nose cut — VIN optional.',
      '前头/半切前部 — VIN可留空。'
    ),
    passengerPartEngineHint: bi(
      'Engine assembly — engine code required; VIN optional.',
      '发动机总成 — 须填发动机型号；VIN可留空。'
    ),
    passengerPartTransmissionHint: bi(
      'Transmission / gearbox — transmission code recommended; VIN optional.',
      '变速箱总成 — 建议填写变速箱型号；VIN可留空。'
    ),
    passengerPartChassisHint: bi(
      'Chassis / suspension parts — VIN optional.',
      '底盘/悬挂件 — VIN可留空。'
    ),
    passengerPartOtherHint: bi(
      'Other passenger parts — VIN optional.',
      '其他乘用车配件 — VIN可留空。'
    ),
    conditionFrontCut: bi('Front Cut', '前头'),
    conditionTransmissionAssembly: bi('Transmission Assembly', '变速箱总成'),
    conditionChassisPart: bi('Chassis Part', '底盘件'),
    conditionPart: bi('Part', '配件'),
    vinPartsSkipHint: bi(
      'No VIN for this part? Tap Next — enter brand, model and photos on the following steps.',
      '没有底盘号？直接点「下一步」，在后续步骤填写品牌、车型和照片即可。'
    ),
    conditionEngineAssembly: bi('Engine Assembly', '发动机总成'),
    conditionAxleAssembly: bi('Axle Assembly', '车轴总成'),
    conditionTruckPart: bi('Truck Part', '卡车配件'),
    stepVinOptional: bi('Step 1 — VIN (optional)', '第1步 — VIN（选填）'),
    stepTruckStart: bi('Step 1 — Listing Type', '第1步 — 选择库存类型'),
    vinCabSkipHint: bi(
      'No VIN for this cab? Tap Next — you will enter brand, model and photos on the following steps.',
      '没有底盘号？直接点「下一步」，在后续步骤填写品牌、车型和照片即可。'
    ),

    stepVin: bi('Step 1 — VIN', '第1步 — VIN底盘号'),
    stepVehicle: bi('Step 2 — Vehicle Details', '第2步 — 车辆信息'),
    stepListing: bi('Step 3 — Listing Details', '第3步 — 库存信息'),
    stepPhotos: bi('Step 4 — Photos', '第4步 — 上传照片'),
    nextStep: bi('Next', '下一步'),
    prevStep: bi('Back', '上一步'),
    stepProgressLabel: bi('Upload progress', '上传进度'),
    photosLegend: bi('Photos', '照片'),

    vin: bi('VIN', 'VIN底盘号'),
    vinFullSupplier: bi('Full VIN (supplier view)', '完整VIN（供应商可见）'),
    mileage: bi('Mileage', '里程'),
    fobPriceUsd: bi('EXW Price (USD)', 'EXW价（美元）'),
    fobPriceHint: bi(
      'Export EXW price in US dollars — ex-works Zhengzhou, excluding freight and import duties.',
      '出口EXW价（美元），郑州工厂交货，不含国际运费及进口关税。'
    ),
    fobPriceRequired: bi('EXW price (USD) is required and must be greater than zero.', 'EXW价（美元）必填，且必须大于零。'),
    supplierName: bi('Supplier Name', '供应商名称'),
    supplierPhone: bi('Supplier Phone', '联系电话'),
    supplierWechat: bi('Supplier WeChat', '微信号'),
    supplierCity: bi('Supplier City', '所在城市'),
    brand: bi('Brand', '品牌'),
    model: bi('Model', '车型'),
    year: bi('Year', '年份'),
    engineCode: bi('Engine Code', '发动机型号'),
    transmission: bi('Transmission', '变速箱'),
    fuelType: bi('Fuel Type', '燃油类型'),
    selectFuelType: bi('Select fuel type', '选择燃油类型'),
    fuelPetrol: bi('Petrol', '汽油'),
    fuelDiesel: bi('Diesel', '柴油'),
    fuelHybrid: bi('Hybrid', '混合动力'),
    fuelPlugInHybrid: bi('Plug-in Hybrid', '插电式混合动力'),
    fuelElectric: bi('Electric', '纯电动'),
    drivetrain: bi('Drivetrain', '驱动形式'),
    vehicleCondition: bi('Vehicle Condition', '车辆状态'),
    vehicleCategory: bi('Vehicle Type', '车辆类型'),
    categoryPassenger: bi('Passenger vehicle', '乘用车'),
    categoryTruck: bi('Truck / commercial', '卡车 / 商用车'),
    inventoryStatus: bi('Inventory Status', '库存状态'),
    notes: bi('Notes', '备注'),
    videoLink: bi('Video Link', '视频链接'),
    videoUpload: bi('Upload Video', '上传视频'),
    videoOptional: bi('Optional — MP4 recommended for web playback (WebM also OK). MOV may not play in all browsers. Max 50 MB.', '选填 — 建议上传 MP4（WebM 亦可）；MOV 在部分浏览器无法播放。最大 50 MB。'),
    videoOnly: bi('Please upload a video file (MP4, WebM, or MOV).', '请上传视频文件（MP4、WebM 或 MOV）。'),
    videoTooLarge: bi('Video must be 50 MB or smaller.', '视频文件不能超过 50 MB。'),
    removeVideo: bi('Remove Video', '删除视频'),
    noVideo: bi('No video attached.', '未上传视频。'),
    selectBrand: bi('Select brand', '选择品牌'),
    selectModel: bi('Select model', '选择车型'),
    modelOther: bi('Other model (type below)', '其他车型（下方填写）'),
    modelOtherPlaceholder: bi('Enter model name', '请输入车型名称'),
    selectStatus: bi('Select status', '选择状态'),

    decodeUnavailable: bi(
      'VIN decode unavailable. Please enter vehicle details manually.',
      'VIN无法自动识别，请手动填写车辆信息。'
    ),
    decodeConfirm: bi('VIN decoded — please confirm the details below.', 'VIN识别成功，请确认以下信息。'),
    confidenceFull: bi('Full decode', '完整识别'),
    confidencePartial: bi('Partial decode', '部分识别'),
    confidenceManual: bi('Manual entry', '手动填写'),
    confidenceFullHint: bi(
      'All key vehicle fields were detected. Review and continue.',
      '已识别全部关键车辆信息，请确认后继续。'
    ),
    confidencePartialHint: bi(
      'Some fields were detected. Only fill in what is missing below.',
      '已识别部分信息，请仅补充缺失字段。'
    ),
    confidenceManualHint: bi(
      'VIN could not be decoded. Please enter vehicle details manually.',
      'VIN无法自动识别，请手动填写车辆信息。'
    ),
    vinCounter: bi('characters', '字符'),
    vinReady: bi('Ready to decode', '可以识别'),
    decodePreviewTitle: bi('Detected from VIN', 'VIN识别结果'),
    autoFilled: bi('Auto-filled', '自动填写'),
    needsInput: bi('Needs input', '需手动填写'),
    editField: bi('Edit', '修改'),
    fieldsAutoFilled: bi('fields auto-filled', '个字段已自动填写'),
    onlyFillMissing: bi('Only complete the highlighted fields.', '只需填写高亮字段。'),
    phoneOrWechat: bi('Phone or WeChat is required.', '电话或微信至少填写一项。'),
    photosMin: bi('Upload at least 3 photos (up to 15).', '至少上传3张照片，最多15张。'),
    extraPhoto: bi('Additional Photo', '补充照片'),
    photosCabHint: bi('Upload at least 3 cab photos (up to 15).', '至少上传3张驾驶室照片，最多15张。'),
    photoCompressHint: bi(
      'Photos are compressed automatically to save storage (quality kept).',
      '照片会自动压缩以节省空间（尽量保持清晰）。'
    ),
    required: bi('Required', '必填'),
    recommended: bi('Recommended', '建议'),
    optional: bi('Optional', '选填'),

    available: bi('Available', '现货'),
    reserved: bi('Reserved', '预留'),
    inTransit: bi('In Transit', '在途'),
    sold: bi('Sold', '已售'),

    conditionRunning: bi('Running Vehicle', '可启动整车'),
    conditionHalfCut: bi('Half Cut', '乘用车'),
    conditionDismantled: bi('Dismantled', '已拆解'),
    conditionEngineRemoved: bi('Engine Removed', '已拆发动机'),

    adminReviewTitle: bi('Half-Cut Submission Review', '乘用车库存审核'),
    adminPending: bi('Pending', '待审核'),
    adminApproved: bi('Approved', '已通过'),
    adminRejected: bi('Rejected', '已拒绝'),
    editBeforeApprove: bi('Edit before approval', '审核前编辑'),
    fullVin: bi('Full VIN', '完整VIN'),
    decodeMethod: bi('Decode Method', '识别方式'),
    autoDecoded: bi('Auto Decoded', '自动识别'),
    partialDecoded: bi('Partial Decode', '部分识别'),
    manualEntry: bi('Manual Entry', '手动填写'),
    supplier: bi('Supplier', '供应商'),
    submittedVehicle: bi('Submitted Vehicle', '提交车辆信息'),
    autoDecodedSnapshot: bi('Auto-Decoded Snapshot', '自动识别结果'),
    photos: bi('Photos', '照片'),

    name: bi('Name', '姓名'),
    phone: bi('Phone', '电话'),
    wechat: bi('WeChat', '微信'),
    city: bi('City', '城市'),
    notesLabel: bi('Notes', '备注'),
    videoLabel: bi('Video', '视频'),
    stockId: bi('Stock ID', '库存编号'),
    slug: bi('Slug', '链接标识'),
    noPhotos: bi('No photos attached.', '未上传照片。'),
    noSubmissions: bi('No submissions in this tab.', '此分类暂无提交。'),
    approvalSuccess: bi('Approved — now listed as stock', '审核通过 — 已生成库存'),
    approvalFailed: bi('Approval failed.', '审核失败。'),
    rejectSuccess: bi('Submission rejected.', '已拒绝该提交。'),
    adminReviewLead: bi(
      'Approve verified supplier inventory before it appears on the catalog.',
      '审核通过后库存才会出现在目录页。'
    ),

    portalHalfCutBtn: bi('Submit Half-Cut Inventory', '上传乘用车库存'),

    partialDecode: bi(
      'Partial decode — confirm brand/year and enter model and engine details.',
      '部分识别成功，请确认品牌和年份，并填写车型和发动机信息。'
    ),
    decodeSuccessMsg: bi(
      'VIN decoded successfully. Confirm details before submitting.',
      'VIN识别成功，提交前请确认信息。'
    ),
    imagesOnly: bi('Please upload image files only.', '请仅上传图片文件。'),
    heicNotSupported: bi(
      'HEIC/HEIF photos are not supported. On iPhone: Settings → Camera → Formats → Most Compatible, then take new photos as JPG.',
      '不支持 HEIC/HEIF 格式。iPhone 用户请前往：设置 → 相机 → 格式 → 最兼容，然后重新拍摄 JPG 照片。'
    ),
    photoTooLarge: bi('Photo must be 8 MB or smaller. Try a lower resolution or JPG format.', '单张照片不能超过 8 MB，请降低分辨率或使用 JPG 格式。'),
    uploadingMedia: bi('Uploading…', '正在上传…'),
    uploadFailed: bi('Upload failed.', '上传失败。'),
    uploadSuccess: bi('Upload successful', '上传成功'),
    photoUploaded: bi('Photo uploaded', '照片已上传'),
    videoUploaded: bi('Video uploaded', '视频已上传'),
    submissionFailed: bi('Submission failed.', '提交失败。'),

    photoLabels: [
      bi('Vehicle Front', '车辆前脸'),
      bi('Vehicle Rear', '车辆后部'),
      bi('Engine', '发动机'),
      bi('VIN Plate', 'VIN铭牌'),
      bi('Interior', '内饰'),
    ],
    cabPhotoLabels: [
      bi('Cab Front', '驾驶室正面'),
      bi('Cab Rear', '驾驶室后部'),
      bi('Left Side', '左侧外观'),
      bi('Right Side', '右侧外观'),
      bi('Dashboard', '仪表盘'),
      bi('Driver Seat', '驾驶座椅'),
      bi('Door Interior', '车门内饰'),
      bi('VIN Plate', 'VIN铭牌'),
      bi('Cab Overview', '驾驶室全景'),
      bi('Detail', '细节特写'),
    ],
  };

  function publicKey(key) {
    return `supplier.form.${key}`;
  }

  function labelText(key) {
    const item = L[key];
    const en = item?.en || key;
    const pub = window.PublicI18n;
    if (pub?.t && pub?.getLang) {
      return pub.t(publicKey(key), en);
    }
    return en;
  }

  function labelHtml(key) {
    return escapeHtml(labelText(key));
  }

  function labelInline(key) {
    return labelText(key);
  }

  function labelEn(key) {
    return labelText(key);
  }

  function labelZh(key) {
    return L[key]?.zh || labelText(key);
  }

  function registerFormStrings() {
    const pub = window.PublicI18n;
    if (!pub?.registerStrings) return;
    const entries = {};
    Object.keys(L).forEach((key) => {
      const item = L[key];
      if (!item?.en) return;
      entries[publicKey(key)] = { zh: item.zh || item.en };
    });
    pub.registerStrings(entries);
  }

  function labelFromBi(biItem) {
    if (!biItem) return '';
    const lang = window.PublicI18n?.getLang?.() || 'en';
    if (lang === 'zh' && biItem.zh) return biItem.zh;
    return biItem.en || '';
  }

  registerFormStrings();

  window.HalfCutSupplierI18n = { L, labelHtml, labelInline, labelEn, labelZh, labelText, labelFromBi, registerFormStrings };
})();
