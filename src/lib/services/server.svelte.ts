export interface AuthUser {
    id: number;
    email?: string;
}

const TOKEN_KEY = "auth_token";

// 🌟 { value: _val } Svelte 5 반응형 상태
export const authToken = $state<{ value: string }>({ value: "" });
export const currentUser = $state<{ value: AuthUser | null }>({ value: null });
export const isServerLoading = $state<{ value: boolean }>({ value: false });
export const currentSessionId = $state<{ value: string }>({ value: "" });

/**
 * 브라우저 내장 API만으로 JWT 페이로드를 안전하게 디코딩
 */
function parseJwtPayload(token: string): { id: number; email?: string; exp?: number } | null {
    try {
        const base64Url = token.split(".")[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

/**
 * 🌟 토큰 저장 및 유저 상태 동기화
 */
export function setToken(token: string) {
    const payload = parseJwtPayload(token);
    if (!payload || !payload.id) {
        clearToken();
        return false;
    }

    authToken.value = token;
    currentUser.value = {
        id: payload.id,
        email: payload.email,
    };

    if (typeof localStorage !== "undefined") {
        localStorage.setItem(TOKEN_KEY, token);
    }
    return true;
}

/**
 * 🌟 로그아웃 및 인증 상태 초기화
 */
export function clearToken() {
    authToken.value = "";
    currentUser.value = null;
    if (typeof localStorage !== "undefined") {
        localStorage.removeItem(TOKEN_KEY);
    }
}

/**
 * 🌟 앱 기동 시 로컬스토리지 토큰을 확인하여 세션을 복원
 */
export function initAuth() {
    if (typeof localStorage === "undefined") return;

    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) return;

    const payload = parseJwtPayload(savedToken);
    if (!payload || !payload.id) {
        clearToken();
        return;
    }

    // 만료 시간(초 단위) 체크
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        console.warn("🔐 로그인 세션이 만료되어 로그아웃 처리되었습니다.");
        clearToken();
        return;
    }

    authToken.value = savedToken;
    currentUser.value = {
        id: payload.id,
        email: payload.email,
    };
}

/**
 * 일반 회원가입 요청 (성공 시 즉시 자동 로그인 처리)
 */
export async function registerUser(email: string, password: string, serverUrl: string = "http://localhost:3000") {
    isServerLoading.value = true;
    try {
        const response = await fetch(`${serverUrl}/api/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "회원가입에 실패했습니다.");

        if (data.token) {
            setToken(data.token);
        }

        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    } finally {
        isServerLoading.value = false;
    }
}

/**
 * 일반 이메일 로그인 요청
 */
export async function loginUser(email: string, password: string, serverUrl: string = "http://localhost:3000") {
    isServerLoading.value = true;
    try {
        const response = await fetch(`${serverUrl}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "로그인에 실패했습니다.");

        if (data.token) {
            setToken(data.token);
        }

        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    } finally {
        isServerLoading.value = false;
    }
}

/**
 * 카카오 소셜 로그인 요청
 */
export async function socialLogin(provider: string, providerId: string, email?: string, serverUrl: string = "http://localhost:3000") {
    isServerLoading.value = true;
    try {
        const response = await fetch(`${serverUrl}/api/auth/social`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider, providerId, email }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "소셜 인증 처리에 실패했습니다.");

        if (data.token) {
            setToken(data.token);
        }

        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    } finally {
        isServerLoading.value = false;
    }
}

/**
 * 🌟 내 서재 구매 도서 목록 조회 (Bearer 토큰 검증)
 */
export async function fetchMyBooks(serverUrl: string = "http://localhost:3000") {
    if (!authToken.value) return [];

    try {
        const res = await fetch(`${serverUrl}/api/users/me/books`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${authToken.value}`,
            },
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                clearToken();
            }
            return [];
        }

        return await res.json();
    } catch (err) {
        console.error("구매 도서 목록 로드 오류:", err);
        return [];
    }
}

/**
 * 세션 및 통계 관련 함수들 유지
 */
export function getSessionId(): string {
    if (typeof window === "undefined") return "";
    let sessionId = sessionStorage.getItem("visitor_session_id");
    if (!sessionId) {
        sessionId = window.crypto && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem("visitor_session_id", sessionId);
    }
    currentSessionId.value = sessionId;
    return sessionId;
}

export async function recordVisit(serverUrl: string = "") {
    const sessionId = getSessionId();
    if (!sessionId) return;
    try {
        await fetch(`${serverUrl}/api/analytics/visit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, referrer: document.referrer, entryPage: window.location.pathname }),
        });
    } catch (error) {
        console.error("방문 기록 실패:", error);
    }
}

export function updateDuration(serverUrl: string = "") {
    const sessionId = getSessionId();
    if (!sessionId) return;
    const url = `${serverUrl}/api/analytics/duration`;
    const payload = JSON.stringify({ sessionId });
    if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(console.error);
    }
}