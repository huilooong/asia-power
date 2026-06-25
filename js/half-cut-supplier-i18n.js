/**
 * AsiaPower — Bilingual labels for supplier/admin half-cut workflow only.
 * Public customer catalog remains English.
 */
(function () {
  'use strict';

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
    addHalfCutInventory: bi('Add Half Cut Inventory', '上传半车库存'),
    pendingReview: bi('Pending Review', '待审核'),
    approved: bi('Approved', '已通过'),
    rejected: bi('Rejected', '已拒绝'),
    backToPortal: bi('Back to Supplier Portal', '返回供应商门户'),
    remove: bi('Remove', '删除'),

    supplierUploadTitle: bi('Submit Half-Cut Listing', '提交半车库存'),
    supplierUploadLead: bi(
      'Enter the VIN first. The system will try to detect brand, model and year automatically. If decoding fails, please enter vehicle details manually. Upload at least 3 clear photos.',
      '请先输入VIN底盘号，系统会尝试自动识别品牌、车型和年份。如果识别失败，请手动填写车辆信息。请至少上传3张清晰照片。'
    ),
    supplierWarning: bi(
      'Submission does not guarantee publication. Asia Power will verify inventory before listing.',
      '提交不代表一定上架。亚洲动力会在上架前核实库存真实性。'
    ),
    truckUploadTitle: bi('Submit Truck Listing', '提交卡车库存'),
    truckUploadLead: bi(
      'Upload light, medium or heavy-duty truck half-cuts, driver cabs and dismantled units. Choose listing type on step 2. VIN and engine are optional for driver cabs.',
      '上传轻卡、中卡、重卡半车、驾驶室及拆车件。请在第2步选择库存类型。驾驶室上传时VIN和发动机为选填。'
    ),
    passengerUploadOnlyHint: bi(
      'Trucks and driver cabs must use the Truck Upload page in the Supplier Portal.',
      '卡车和驾驶室请使用供应商门户中的「卡车库存上传」入口。'
    ),
    conditionTruckHalfCut: bi('Truck Half Cut', '卡车半车'),
    conditionDriverCab: bi('Driver Cab', '驾驶室'),
    truckPartType: bi('Listing Type', '库存类型'),
    truckPartVehicle: bi('Truck / Half Cut', '整车 / 半车'),
    truckPartCab: bi('Driver Cab', '驾驶室'),
    truckPartVehicleHint: bi(
      'Complete truck or half-cut with VIN, engine and transmission.',
      '整车或半车，需填写VIN、发动机和变速箱。'
    ),
    truckPartCabHint: bi(
      'Driver cab only — VIN and engine are optional.',
      '仅驾驶室 — VIN和发动机为选填。'
    ),
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
    fobPriceUsd: bi('FOB Price (USD)', '离岸价（美元）'),
    fobPriceHint: bi(
      'Export FOB price in US dollars — China port basis, excluding freight and import duties.',
      '出口离岸价（美元），中国港口交货，不含国际运费及进口关税。'
    ),
    fobPriceRequired: bi('FOB price (USD) is required and must be greater than zero.', '离岸价（美元）必填，且必须大于零。'),
    supplierName: bi('Supplier Name', '供应商名称'),
    supplierPhone: bi('Supplier Phone', '联系电话'),
    supplierWechat: bi('Supplier WeChat', '微信号'),
    supplierCity: bi('Supplier City', '所在城市'),
    brand: bi('Brand', '品牌'),
    model: bi('Model', '车型'),
    year: bi('Year', '年份'),
    engineCode: bi('Engine Code', '发动机型号'),
    transmission: bi('Transmission', '变速箱'),
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
    photosMin: bi('Upload at least 3 photos. 5+ recommended.', '至少上传3张照片，建议5张以上。'),
    photosCabHint: bi('Upload at least 3 photos (up to 10 for driver cabs).', '至少上传3张照片；驾驶室最多可上传10张。'),
    required: bi('Required', '必填'),
    recommended: bi('Recommended', '建议'),
    optional: bi('Optional', '选填'),

    available: bi('Available', '现货'),
    reserved: bi('Reserved', '预留'),
    inTransit: bi('In Transit', '在途'),
    sold: bi('Sold', '已售'),

    conditionRunning: bi('Running Vehicle', '可启动整车'),
    conditionHalfCut: bi('Half Cut', '半车'),
    conditionDismantled: bi('Dismantled', '已拆解'),
    conditionEngineRemoved: bi('Engine Removed', '已拆发动机'),

    adminReviewTitle: bi('Half-Cut Submission Review', '半车库存审核'),
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

    portalHalfCutBtn: bi('Submit Half-Cut Inventory', '上传半车库存'),

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

  function labelHtml(key) {
    const item = L[key];
    if (!item) return key;
    return `<span class="bi-label"><span class="bi-en">${item.en}</span><span class="bi-zh">${item.zh}</span></span>`;
  }

  function labelInline(key) {
    return L[key]?.inline || key;
  }

  function labelEn(key) {
    return L[key]?.en || key;
  }

  function labelZh(key) {
    return L[key]?.zh || '';
  }

  window.HalfCutSupplierI18n = { L, labelHtml, labelInline, labelEn, labelZh };
})();
