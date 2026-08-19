import { writable } from "svelte/store";

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

const statusString = 'init' as 'init' | 'login' | 'main';
export const status = writable(statusString);

// 🌟 현재 뷰어에서 읽기 위해 선택된 책 정보를 관리하는 전역 상태
export const currentBook = writable<BookInfo | null>(null);