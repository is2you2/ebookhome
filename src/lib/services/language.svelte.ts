// src/lib/services/language.svelte.ts

type LangText = Record<string, Record<string, string>>;
export type LangOption = { value: string; display_name?: string };

// 🌟 { value: _val } 형식의 다국어 반응형 상태
export const lang = $state<{ value: string }>({ value: 'ko' });

export const text = $state<{ value: LangText }>({
    value: {
        Home: {},
        Main: {},
        Viewer: {},
        P5Loading: {},
    }
});

export const setable = $state<{ value: LangOption[] }>({ value: [] });

/** 외부 콜백 */
export const Callback_nakama = $state<{ value: (() => void) | null }>({ value: null });

/**
 * 현재 언어 설정 초기화
 */
export function initLanguage() {
    if (typeof navigator === 'undefined') return;

    const defaultLang = navigator.language.split('-')[0];
    const override = localStorage.getItem('lang');

    lang.value = override || defaultLang;
}

/**
 * CSV 로딩 (p5 제거 버전)
 */
export async function loadSelectedLang(url = '/assets/data/translate.csv') {
    try {
        const res = await fetch(url);
        const csv = await res.text();

        const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) return;

        // header parsing
        const headers = lines[0].split(',');

        let currentLang = lang.value;
        let langIndex = headers.indexOf(currentLang);

        setable.value = headers
            .filter(h => h !== '#')
            .map(h => ({ value: h }));

        // fallback
        if (langIndex === -1) {
            langIndex = headers.indexOf('ko');
            lang.value = 'ko';
        }

        const parsed: LangText = {};
        let currentSection = '';

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',');
            const key = row[0];
            if (!key) continue;

            // section marker (#Home, #Main ...)
            if (key.startsWith('#')) {
                currentSection = key.replace('#', '').trim();
                if (!parsed[currentSection]) parsed[currentSection] = {};
                continue;
            }

            if (!currentSection) continue;

            parsed[currentSection][key] = row[langIndex] ?? '';
        }

        text.value = parsed;
        localStorage.setItem('lang', lang.value);

        Callback_nakama.value?.();
    } catch (e) {
        console.error('language load failed:', e);
    }
}