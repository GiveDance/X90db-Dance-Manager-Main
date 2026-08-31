import type { AppLanguage } from "./LanguageProvider";
import type { DanceSection } from "@/lib/types";

export function localizeSectionName(
  section: DanceSection,
  language: AppLanguage,
  translateText: (text: string) => string,
) {
  return language === "en" && section.generatedName
    ? translateText(section.name)
    : section.name;
}
