/**
 * 서버로 일반 회원가입(또는 기존 소셜 계정에 비밀번호 연동) 요청을 보냅니다.
 * @param {string} email - 사용자 이메일
 * @param {string} password - 사용자 비밀번호
 * @param {string} serverUrl - 백엔드 서버 기본 주소 (Vite Proxy 사용 시 빈 문자열 '')
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function registerUser(
    email: string,
    password: string,
    serverUrl: string = ''
) {
    try {
        const response = await fetch(`${serverUrl}/api/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '회원가입에 실패했습니다.');
        }

        // 백엔드에서 200(기존 소셜계정 연동) 또는 201(신규 가입)을 반환합니다.
        console.log('회원가입/연동 성공:', data.message);
        return { success: true, data };

    } catch (error: any) {
        console.error('회원가입 중 오류 발생:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 서버로 소셜 로그인 및 회원가입 요청을 보냅니다.
 * @param {string} provider - 소셜 제공자 (예: 'kakao')
 * @param {string} providerId - 소셜 플랫폼에서 발급받은 고유 유저 ID
 * @param {string} [email] - 소셜 플랫폼에서 제공받은 유저 이메일 (선택 사항)
 * @param {string} serverUrl - 백엔드 서버 주소 (Vite Proxy 사용 시 빈 문자열 '')
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function socialLogin(
    provider: string,
    providerId: string,
    email?: string,
    serverUrl: string = ''
) {
    try {
        const response = await fetch(`${serverUrl}/api/auth/social`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ provider, providerId, email }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '소셜 인증 처리에 실패했습니다.');
        }

        console.log('소셜 인증 성공:', data.message);
        return { success: true, data };

    } catch (error: any) {
        console.error('소셜 인증 중 오류 발생:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 고유한 세션 ID를 생성하거나 가져옵니다.
 * sessionStorage를 사용하여 탭을 닫기 전까지 동일한 ID를 유지합니다.
 */
export function getSessionId(): string {
    // sessionStorage 환경이 아닌 경우(SSR 등)를 방어
    if (typeof window === 'undefined') return '';

    let sessionId = sessionStorage.getItem('visitor_session_id');
    if (!sessionId) {
        // crypto.randomUUID()가 지원되는 최신 브라우저 환경 활용
        sessionId = window.crypto && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15); // 구형 브라우저 대비 폴백

        sessionStorage.setItem('visitor_session_id', sessionId);
    }
    return sessionId;
}

/**
 * 1. 사이트 처음 진입 시 방문 기록을 남깁니다.
 * @param serverUrl - 백엔드 서버 주소 (Vite Proxy 사용 시 빈 문자열 '')
 */
export async function recordVisit(serverUrl: string = '') {
    const sessionId = getSessionId();
    if (!sessionId) return;

    // 이전 페이지 주소(유입 경로)와 현재 진입한 페이지 경로를 가져옵니다.
    const referrer = document.referrer;
    const entryPage = window.location.pathname;

    try {
        await fetch(`${serverUrl}/api/analytics/visit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId, referrer, entryPage }),
        });
        console.log('📊 방문 기록 완료');
    } catch (error) {
        console.error('방문 기록 전송 실패:', error);
    }
}

/**
 * 2. 사이트를 떠날 때(또는 주기적으로) 체류 시간을 업데이트합니다.
 * @param serverUrl - 백엔드 서버 주소 (Vite Proxy 사용 시 빈 문자열 '')
 */
export function updateDuration(serverUrl: string = '') {
    const sessionId = getSessionId();
    if (!sessionId) return;

    const url = `${serverUrl}/api/analytics/duration`;
    const payload = JSON.stringify({ sessionId });

    // 브라우저가 닫히거나 페이지가 이동될 때 요청이 취소되지 않도록 sendBeacon 사용
    if (navigator.sendBeacon) {
        // sendBeacon은 JSON 전송 시 Blob 객체로 감싸서 보내야 Express가 인식합니다.
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
    } else {
        // sendBeacon을 지원하지 않는 브라우저를 위한 대체재 (keepalive 옵션)
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        }).catch(console.error);
    }
}

/**
 * 서버로 일반 이메일 로그인 요청을 보냅니다.
 * @param {string} email - 사용자 이메일
 * @param {string} password - 사용자 비밀번호
 * @param {string} serverUrl - 백엔드 서버 기본 주소 (Vite Proxy 사용 시 빈 문자열 '')
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function loginUser(
    email: string,
    password: string,
    serverUrl: string = ''
) {
    try {
        const response = await fetch(`${serverUrl}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        // 401(인증 실패), 400(잘못된 요청) 등 에러 처리
        if (!response.ok) {
            throw new Error(data.error || '로그인에 실패했습니다.');
        }

        console.log('이메일 로그인 성공:', data.message);
        return { success: true, data };

    } catch (error: any) {
        console.error('로그인 중 오류 발생:', error.message);
        return { success: false, error: error.message };
    }
}