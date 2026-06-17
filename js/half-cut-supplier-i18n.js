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

    stepVin: bi('Step 1 — VIN', '第1步 — VIN底盘号'),
    stepVehicle: bi('Step 2 — Vehicle Details', '第2步 — 车辆信息'),
    stepListing: bi('Step 3 — Listing Details', '第3步 — 库存信息'),
    photosLegend: bi('Photos', '照片'),

    vin: bi('VIN', 'VIN底盘号'),
    vinFullSupplier: bi('Full VIN (supplier view)', '完整VIN（供应商可见）'),
    mileage: bi('Mileage', '里程'),
    supplierName: bi('Supplier Name', '供应商名称'),
    supplierPhone: bi('Supplier Phone', '联系电话'),
    supplierWechat: bi('Supplier WeChat', '微信号'),
    supplierCity: bi('Supplier City', '所在城市'),
    brand: bi('Brand', '品牌'),
    model: bi('Model', '车型'),
    year: bi('Year', '年份'),
    engineCode: bi('Engine Code', '发动机型号'),
    transmission: bi('Transmission', '变速箱'),
    vehicleCondition: bi('Vehicle Condition', '车辆状态'),
    inventoryStatus: bi('Inventory Status', '库存状态'),
    notes: bi('Notes', '备注'),
    videoLink: bi('Video Link', '视频链接'),
    selectBrand: bi('Select brand', '选择品牌'),
    selectStatus: bi('Select status', '选择状态'),

    decodeUnavailable: bi(
      'VIN decode unavailable. Please enter vehicle details manually.',
      'VIN无法自动识别，请手动填写车辆信息。'
    ),
    decodeConfirm: bi('VIN decoded — please confirm the details below.', 'VIN识别成功，请确认以下信息。'),
    phoneOrWechat: bi('Phone or WeChat is required.', '电话或微信至少填写一项。'),
    photosMin: bi('Upload at least 3 photos. 5+ recommended.', '至少上传3张照片，建议5张以上。'),
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
      'Approve verified supplier inventory before it appears on the catalog. Local demo only.',
      '审核通过后库存才会出现在目录页。当前为本地演示模式。'
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
    submissionFailed: bi('Submission failed.', '提交失败。'),

    photoLabels: [
      bi('Vehicle Front', '车辆前脸'),
      bi('Vehicle Rear', '车辆后部'),
      bi('Engine', '发动机'),
      bi('VIN Plate', 'VIN铭牌'),
      bi('Interior', '内饰'),
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
