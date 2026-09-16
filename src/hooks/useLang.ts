// One language for the whole app, remembered on the device. Every screen that
// shows words uses this, so a switch in one place is a switch everywhere.

import { useEffect, useState } from "react";
import { dirOf, initialLang, saveLang, type Lang } from "@/lib/i18n";

export function useLang() {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => setLangState(initialLang()), []);
  useEffect(() => {
    document.documentElement.setAttribute("dir", dirOf(lang));
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    saveLang(l);
  };
  return { lang, setLang, dir: dirOf(lang) };
}
