const HARD_SECTIONS = ["禁止随意甩人工电话号码", "永远不要"];
const INTENT_SECTIONS = Object.freeze({
  greeting: ["整体销售思路", "声音"],
  quotation: ["三段式信息收集", "回复顺序", "价格与单位", "货况与附件", "库存与地点"],
  closing: ["成交推进", "价格与单位", "货况与附件"],
  shipping: ["库存与地点", "成交推进"],
  availability: ["回复顺序", "库存与地点", "货况与附件"],
  negotiation: ["价格与单位", "成交推进"],
  complaint: ["声音", "成交推进"],
  product_enquiry: ["三段式信息收集", "回复顺序", "货况与附件", "身份与 VIN"],
  unknown: ["声音", "回复顺序"],
});

function headingName(line) {
  return line.replace(/^#{2,4}\s+/, "").replace(/（.*$/, "").trim();
}

function parseSections(markdown) {
  const lines = String(markdown || "").split("\n");
  const sections = new Map();
  let current = "";
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      current = headingName(line);
      sections.set(current, [line]);
    } else if (current) sections.get(current).push(line);
  }
  return sections;
}

function findSection(sections, name) {
  for (const [heading, lines] of sections) {
    if (heading.startsWith(name)) return lines.join("\n").trim();
  }
  return "";
}

export function buildLiveRulesPrompt(markdown, intent = "unknown") {
  const sections = parseSections(markdown);
  const hardRedlines = HARD_SECTIONS.map((name) => findSection(sections, name)).filter(Boolean).join("\n\n");
  const referenceSections = (INTENT_SECTIONS[intent] || INTENT_SECTIONS.unknown)
    .map((name) => findSection(sections, name))
    .filter(Boolean)
    .join("\n\n");
  return {
    intent,
    hardRedlines,
    referenceSections,
    prompt: [
      hardRedlines ? `CEO HARD REDLINES (always apply):\n${hardRedlines}` : "",
      referenceSections ? `CEO REFERENCE RULES for ${intent}:\n${referenceSections}` : "",
    ].filter(Boolean).join("\n\n"),
  };
}
