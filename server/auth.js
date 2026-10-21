// server/auth.js
const crypto = require('node:crypto');
const util = require('node:util');

// 🌟 Node.js 내장 scrypt를 비동기 Promise 형태로 래핑 (libuv 워커 풀 활용 -> 메인 이벤트 루프 차단 없음)
const scryptAsync = util.promisify(crypto.scrypt);

const JWT_SECRET = process.env.JWT_SECRET || 'ebook_default_secret_key_change_in_env_2026';

// Base64Url 인코딩/디코딩 헬퍼
function base64UrlEncode(str) {
    return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str) {
    return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * 1. 비동기 scrypt 비밀번호 해싱 (메인 스레드 블로킹 방지)
 */
async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    // N=16384, r=8, p=1 표준 비용으로 64바이트 키 유도
    const derivedKey = await scryptAsync(password, salt, 64);
    return { salt, hash: derivedKey.toString('hex') };
}

/**
 * 2. 비동기 scrypt 비밀번호 검증 (타이밍 공격 방어)
 */
async function verifyPassword(password, salt, storedHash) {
    try {
        const derivedKey = await scryptAsync(password, salt, 64);
        const storedKeyBuffer = Buffer.from(storedHash, 'hex');

        if (derivedKey.length !== storedKeyBuffer.length) {
            return false;
        }
        return crypto.timingSafeEqual(derivedKey, storedKeyBuffer);
    } catch (err) {
        return false;
    }
}

/**
 * 3. 경량 JWT 토큰 생성 (순수 node:crypto HMAC-SHA256)
 * @param {object} payload 사용자 식별 정보 (예: { id: 1, email: 'user@example.com' })
 * @param {number} expiresIn 초 단위 유효 기간 (기본 7일)
 */
function generateToken(payload, expiresIn = 7 * 24 * 60 * 60) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    const body = { ...payload, exp };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedBody = base64UrlEncode(JSON.stringify(body));
    const data = `${encodedHeader}.${encodedBody}`;

    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(data)
        .digest('base64url');

    return `${data}.${signature}`;
}

/**
 * 4. JWT 토큰 검증 및 파싱
 */
function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedBody, signature] = parts;
    const data = `${encodedHeader}.${encodedBody}`;

    // 서명 위변조 검증 (타이밍 안전 비교)
    const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(data)
        .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expSigBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
        return null; // 서명 불일치
    }

    try {
        const payload = JSON.parse(base64UrlDecode(encodedBody));

        // 만료 시간 검사
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null; // 토큰 만료
        }

        return payload;
    } catch {
        return null;
    }
}

/**
 * 5. Express 필수 인증 미들웨어 (IDOR 공격 방어)
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({ error: '로그인이 필요한 요청입니다.' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({ error: '유효하지 않거나 만료된 세션입니다. 다시 로그인해 주세요.' });
    }

    // 🌟 클라이언트가 보낸 파라미터 대신 검증된 토큰의 유저 정보를 주입
    req.user = decoded;
    next();
}

/**
 * 6. 선택적 인증 미들웨어 (비회원/회원 겸용 API용)
 */
function optionalAuthenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        req.user = verifyToken(token);
    }
    next();
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    authenticateToken,
    optionalAuthenticateToken
};