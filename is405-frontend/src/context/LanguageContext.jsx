import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸', label: 'English (US)' },
  { code: 'km', name: 'ភាសាខ្មែរ', flag: '🇰🇭', label: 'Khmer (Cambodia)' }
];

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem('is405_language') || 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = (newLang) => {
    const valid = SUPPORTED_LANGUAGES.some(l => l.code === newLang) ? newLang : 'en';
    setLangState(valid);
    try {
      localStorage.setItem('is405_language', valid);
      window.dispatchEvent(new CustomEvent('language_changed', { detail: valid }));
    } catch {}
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (en, km) => {
    if (lang === 'km' && km) return km;
    return en;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, isKhmer: lang === 'km', t, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      lang: 'en',
      setLang: () => {},
      isKhmer: false,
      t: (en) => en,
      supportedLanguages: SUPPORTED_LANGUAGES
    };
  }
  return context;
};

