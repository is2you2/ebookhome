import { writable, get } from 'svelte/store';

type LangText = Record<string, Record<string, string>>;
type LangOption = { value: string; display_name?: string };

export const lang = writable<string>('ko');
export const text = writable<LangText>({
    Home: {},
    Main: {},
    Viewer: {},
    P5Loading: {},
});

export const setable = writable<LangOption[]>([]);

/** 외부 콜백 (Angular의 Callback_nakama 대체) */
export let Callback_nakama: (() => void) | null = null;

/**
 * 현재 언어 설정 초기화
 */
export function initLanguage() {
    if (typeof navigator === 'undefined') return;

    const defaultLang = navigator.language.split('-')[0];
    const override = localStorage.getItem('lang');

    lang.set(override || defaultLang);
}

/**
 * CSV 로딩 (p5 제거 버전)
 */
export async function loadSelectedLang(
    url = '/assets/data/translate.csv'
) {
    try {
        const res = await fetch(url);
        const csv = await res.text();

        const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) return;

        // header parsing
        const headers = lines[0].split(',');

        let currentLang = get(lang);
        let langIndex = headers.indexOf(currentLang);

        setable.set(
            headers
                .filter(h => h !== '#')
                .map(h => ({ value: h }))
        );

        // fallback
        if (langIndex === -1) {
            langIndex = headers.indexOf('ko');
            lang.set('ko');
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

        text.set(parsed);

        localStorage.setItem('lang', get(lang));

        Callback_nakama?.();
    } catch (e) {
        console.error('language load failed:', e);
    }
}