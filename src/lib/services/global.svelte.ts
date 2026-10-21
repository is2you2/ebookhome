// src/lib/services/global.svelte.ts

// 🌟 메인과 뷰어에서 공통으로 사용할 도서 정보 인터페이스
export interface BookInfo {
    id: string;
    title: string;
    desc?: string;
    thumbnail: string;
    video_thumbnail?: string;
    epub_url: string;
    last_view?: number;
    purchase_time: number;
    author: string;
    user_read?: number;
    progress?: number;
    price?: number;
}

export type AppStatus = 'init' | 'login' | 'main';

// 🌟 앱 화면 진입 상태 (초기값: 'main')
export const status = $state<{ value: AppStatus }>({ value: 'init' });

// 🌟 3D 뷰어 읽기 모드 활성화 여부
export const isReadingMode = $state<{ value: boolean }>({ value: false });

// 🌟 현재 뷰어에서 읽기 위해 선택된 책 정보
export const currentBook = $state<{ value: BookInfo | null }>({ value: null });

/** 
 * 컴포넌트간 행동 공유용 객체 [key] = function
 * Svelte 5 객체 상태로 유지하여 동적 할당 감지 지원
 */
export const TransferAct = $state<Record<string, Function>>({});