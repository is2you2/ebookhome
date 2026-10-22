// src/lib/services/global.svelte.ts

export interface BookInfo {
    id: string;
    title: string;
    desc?: string;                  // 짧은 한 줄 요약
    description_url?: string;       // 🌟 긴 본문 텍스트(.txt) 파일 경로
    thumbnail: string;
    video_thumbnail?: string;       // 비디오 표지 파일 경로 (.mp4 등)
    epub_url: string;
    author: string;
    publisher?: string;             // 출판사
    price?: number;                 // 실제 판매가
    original_price?: number;        // 🌟 도서 정가 (할인율 계산용)
    rating?: number;                // 🌟 평점 (예: 4.8)
    rating_count?: number;          // 🌟 리뷰/평점 수
    purchase_time?: number;
    last_view?: number;
    user_read?: number;
    progress?: number;
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