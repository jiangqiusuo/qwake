const CHINESE_DIGITS: Record<string, string> = {
  零: "0",
  一: "1",
  二: "2",
  两: "2",
  三: "3",
  四: "4",
  五: "5",
  六: "6",
  七: "7",
  八: "8",
  九: "9",
  十: "10"
};

const COLOR_ALIASES: Record<string, string> = {
  black: "black",
  blue: "blue",
  brown: "brown",
  gray: "gray",
  grey: "gray",
  green: "green",
  orange: "orange",
  pink: "pink",
  purple: "purple",
  red: "red",
  white: "white",
  yellow: "yellow",
  黑: "black",
  黑色: "black",
  蓝: "blue",
  蓝色: "blue",
  棕: "brown",
  棕色: "brown",
  灰: "gray",
  灰色: "gray",
  绿: "green",
  绿色: "green",
  橙: "orange",
  橙色: "orange",
  粉: "pink",
  粉色: "pink",
  紫: "purple",
  紫色: "purple",
  红: "red",
  红色: "red",
  白: "white",
  白色: "white",
  黄: "yellow",
  黄色: "yellow"
};

const COIN_ALIASES: Record<string, string> = {
  head: "heads",
  heads: "heads",
  tail: "tails",
  tails: "tails",
  正面: "heads",
  反面: "tails"
};

export interface NormalizedAnswer {
  value: string;
  valid: boolean;
  reason?: "empty" | "refusal" | "multi-word";
}

export function normalizeAnswer(raw: string, task?: string): NormalizedAnswer {
  let value = raw.normalize("NFC").trim();
  value = value.replace(/^["'“”‘’`]+|["'“”‘’`。！？!?,，、:：;；.]+$/g, "");
  value = value.replace(/\s+/g, " ").trim().toLowerCase();
  value = normalizeChineseNumber(value);

  if (!value) {
    return { value: "", valid: false, reason: "empty" };
  }
  if (/^(i cannot|i can't|sorry|无法|不能|抱歉)/i.test(value)) {
    return { value, valid: false, reason: "refusal" };
  }

  const first = value.split(" ")[0] || value;
  const canonical = canonicalize(first, task);
  if (!canonical) {
    return { value, valid: false, reason: "empty" };
  }
  return { value: canonical, valid: true };
}

function canonicalize(value: string, task?: string): string {
  if (task?.includes("color") && COLOR_ALIASES[value]) {
    return COLOR_ALIASES[value];
  }
  if (task === "coin-flip" && COIN_ALIASES[value]) {
    return COIN_ALIASES[value];
  }
  return value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function normalizeChineseNumber(value: string): string {
  if (CHINESE_DIGITS[value]) {
    return CHINESE_DIGITS[value];
  }
  const match = value.match(/^十([一二三四五六七八九])$/);
  if (match?.[1]) {
    return `1${CHINESE_DIGITS[match[1]]}`;
  }
  const tens = value.match(/^([二两三四五六七八九])十([一二三四五六七八九])?$/);
  if (tens?.[1]) {
    return `${CHINESE_DIGITS[tens[1]]}${tens[2] ? CHINESE_DIGITS[tens[2]] : "0"}`;
  }
  return value;
}
