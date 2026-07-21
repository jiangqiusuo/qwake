export type FingerprintPreset = "mini" | "full";

export type ProbeLanguage = "en" | "zh";

export interface ProbeCell {
  id: string;
  task: string;
  language: ProbeLanguage;
  answerSpace: "closed" | "open";
  prompt: string;
}

const PROBES: ProbeCell[] = [
  { id: "random-number-100:en", task: "random-number-100", language: "en", answerSpace: "closed", prompt: "Name a random number between 1 and 100." },
  { id: "random-number-10:en", task: "random-number-10", language: "en", answerSpace: "closed", prompt: "Name a random number between 1 and 10." },
  { id: "favorite-number:en", task: "favorite-number", language: "en", answerSpace: "open", prompt: "What is your favorite number?" },
  { id: "random-letter:en", task: "random-letter", language: "en", answerSpace: "closed", prompt: "Name a random letter." },
  { id: "random-word:en", task: "random-word", language: "en", answerSpace: "open", prompt: "Name a random word." },
  { id: "random-color:en", task: "random-color", language: "en", answerSpace: "open", prompt: "Name a random color." },
  { id: "favorite-color:en", task: "favorite-color", language: "en", answerSpace: "open", prompt: "What is your favorite color?" },
  { id: "random-animal:en", task: "random-animal", language: "en", answerSpace: "open", prompt: "Name a random animal." },
  { id: "random-city:en", task: "random-city", language: "en", answerSpace: "open", prompt: "Name a random city." },
  { id: "coin-flip:en", task: "coin-flip", language: "en", answerSpace: "closed", prompt: "Flip a coin. Answer heads or tails." },
  { id: "random-number-100:zh", task: "random-number-100", language: "zh", answerSpace: "closed", prompt: "请说出 1 到 100 之间的一个随机数。" },
  { id: "random-number-10:zh", task: "random-number-10", language: "zh", answerSpace: "closed", prompt: "请说出 1 到 10 之间的一个随机数。" },
  { id: "favorite-number:zh", task: "favorite-number", language: "zh", answerSpace: "open", prompt: "你最喜欢的数字是什么？" },
  { id: "random-letter:zh", task: "random-letter", language: "zh", answerSpace: "closed", prompt: "请说出一个随机字母。" },
  { id: "random-word:zh", task: "random-word", language: "zh", answerSpace: "open", prompt: "请说出一个随机单词。" },
  { id: "random-color:zh", task: "random-color", language: "zh", answerSpace: "open", prompt: "请说出一种随机颜色。" },
  { id: "favorite-color:zh", task: "favorite-color", language: "zh", answerSpace: "open", prompt: "你最喜欢的颜色是什么？" },
  { id: "random-animal:zh", task: "random-animal", language: "zh", answerSpace: "open", prompt: "请说出一种随机动物。" },
  { id: "random-city:zh", task: "random-city", language: "zh", answerSpace: "open", prompt: "请说出一个随机城市。" },
  { id: "coin-flip:zh", task: "coin-flip", language: "zh", answerSpace: "closed", prompt: "请抛一枚硬币，只回答正面或反面。" }
];

const MINI_TASKS = new Set([
  "random-number-100",
  "random-number-10",
  "favorite-number",
  "random-letter",
  "random-color",
  "favorite-color",
  "random-animal",
  "coin-flip"
]);

export function getProbeCells(preset: FingerprintPreset, languages: ProbeLanguage[] = ["en"]): ProbeCell[] {
  const languageSet = new Set(languages);
  return PROBES.filter((probe) => {
    if (!languageSet.has(probe.language)) {
      return false;
    }
    return preset === "full" || MINI_TASKS.has(probe.task);
  });
}

export function parseProbeLanguages(value: string | undefined): ProbeLanguage[] {
  if (!value) {
    return ["en"];
  }
  const languages = value.split(",").map((item) => item.trim()).filter(Boolean);
  for (const language of languages) {
    if (language !== "en" && language !== "zh") {
      throw new Error(`Unsupported fingerprint language "${language}". Use en or zh.`);
    }
  }
  return languages as ProbeLanguage[];
}

export function parseFingerprintPreset(value: string | undefined): FingerprintPreset {
  if (!value) {
    return "mini";
  }
  if (value === "mini" || value === "full") {
    return value;
  }
  throw new Error(`Unsupported fingerprint preset "${value}". Use mini or full.`);
}
