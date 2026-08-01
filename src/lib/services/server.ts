/**
 * 서버로 회원가입 요청을 보냅니다.
 * @param {string} email - 사용자 이메일
 * @param {string} password - 사용자 비밀번호
 * @param {string} serverUrl - 백엔드 서버 기본 주소 (기본값: http://localhost:3000)
 * @returns {Promise<Object>} - 성공 또는 실패 결과 객체
 */
export async function registerUser(email, password, serverUrl = 'http://localhost:3000') {
    try {
        const response = await fetch(`${serverUrl}/api/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        // 응답 상태 코드가 200번대가 아닐 경우 에러 처리
        if (!response.ok) {
            throw new Error(data.error || '회원가입에 실패했습니다.');
        }

        console.log('회원가입 성공:', data);
        return { success: true, data };

    } catch (error) {
        console.error('회원가입 중 오류 발생:', error.message);
        return { success: false, error: error.message };
    }
}