// src/lib/services/server.svelte.ts

export interface AuthUser {
    id: number;
    email?: string;
}

// 🌟 { value: _val } 형태의 세션 및 유저 상태
export const currentSessionId = $state<{ value: string }>({ value: '' });
export const currentUser = $state<{ value: AuthUser | null }>({ value: null });
export const isServerLoading = $state<{ value: boolean }>({ value: false });

/**
 * 고유한 세션 ID를 생성하거나 가져옵니다.
 */
export function getSessionId(): string {
    if (typeof window === 'undefined') return '';

    let sessionId = sessionStorage.getItem('visitor_session_id');
    if (!sessionId) {
        sessionId = window.crypto && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15);

        sessionStorage.setItem('visitor_session_id', sessionId);
    }
    currentSessionId.value = sessionId;
    return sessionId;
}

/**
 * 1. 사이트 처음 진입 시 방문 기록을 남깁니다.
 */
export async function recordVisit(serverUrl: string = '') {
    const sessionId = getSessionId();
    if (!sessionId) return;

    const referrer = document.referrer;
    const entryPage = window.location.pathname;

    try {
        await fetch(`${serverUrl}/api/analytics/visit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, referrer, entryPage }),
        });
        console.log('📊 방문 기록 완료');
    } catch (error) {
        console.error('방문 기록 전송 실패:', error);
    }
}

/**
 * 2. 사이트를 떠날 때 체류 시간을 업데이트합니다.
 */
export function updateDuration(serverUrl: string = '') {
    const sessionId = getSessionId();
    if (!sessionId) return;

    const url = `${serverUrl}/api/analytics/duration`;
    const payload = JSON.stringify({ sessionId });

    if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
    } else {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        }).catch(console.error);
    }
}

/**
 * 서버로 일반 회원가입 요청
 */
export async function registerUser(email: string, password: string, serverUrl: string = '') {
    isServerLoading.value = true;
    try {
        const response = await fetch(`${serverUrl}/api/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '회원가입에 실패했습니다.');

        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    } finally {
        isServerLoading.value = false;
    }
}

/**
 * 서버로 일반 이메일 로그인 요청
 */
export async function loginUser(email: string, password: string, serverUrl: string = '') {
    isServerLoading.value = true;
    try {
        const response = await fetch(`${serverUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '로그인에 실패했습니다.');

        // 🌟 성공 시 현재 유저 상태 갱신
        currentUser.value = { id: data.userId, email };

        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    } finally {
        isServerLoading.value = false;
    }
}

/**
 * 서버로 소셜 로그인 요청
 */
export async function socialLogin(provider: string, providerId: string, email?: string, serverUrl: string = '') {
    isServerLoading.value = true;
    try {
        const response = await fetch(`${serverUrl}/api/auth/social`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, providerId, email }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '소셜 인증 처리에 실패했습니다.');

        // 🌟 성공 시 현재 유저 상태 갱신
        currentUser.value = { id: data.userId, email };

        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    } finally {
        isServerLoading.value = false;
    }
}