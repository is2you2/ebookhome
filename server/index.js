const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());
app.use(cors());

// 1. SQLite 데이터베이스 연결 (shop.db 파일 생성)
const db = new Database('shop.db', { verbose: console.log });

// 동시성 성능 향상을 위한 WAL 모드 활성화
db.pragma('journal_mode = WAL');

// 1. users 테이블 (일반 & 소셜 유저 공통)
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,      -- 일반 가입 시 필수, 소셜 가입 시 선택(NULL 가능)
    password_hash TEXT,     -- 소셜 가입자는 비밀번호가 없으므로 NULL 허용
    salt TEXT,              -- 소셜 가입자는 NULL 허용
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// 2. social_accounts 테이블 (소셜 인증 정보 전용)
db.prepare(`
  CREATE TABLE IF NOT EXISTS social_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(provider, provider_id)
  )
`).run();

// 방문자 통계 테이블 생성
db.prepare(`
  CREATE TABLE IF NOT EXISTS visitor_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,  -- 방문자를 식별할 고유 ID (프론트에서 생성)
    referrer TEXT,                    -- 유입 경로 (어디서 타고 왔는지)
    entry_page TEXT,                  -- 처음 진입한 페이지 (예: /ebook/christian)
    stay_duration INTEGER DEFAULT 0,  -- 체류 시간 (초 단위)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// 비밀번호 암호화 헬퍼 함수
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

app.post('/api/signup', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: '유효한 이메일과 6자리 이상의 비밀번호를 입력해주세요.' });
    }

    try {
        const { salt, hash } = hashPassword(password);

        // 1. 해당 이메일로 가입된 유저가 있는지 확인
        const existingUser = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);

        if (existingUser) {
            // [시나리오 A] 이미 이메일/비밀번호로 가입한 상태
            if (existingUser.password_hash) {
                return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
            }

            // [시나리오 B] 카카오 등 소셜로만 가입되어 있어서 비밀번호가 없는 상태
            // -> 에러를 내지 않고 비밀번호를 업데이트하여 '계정 통합'을 해줍니다.
            db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE email = ?')
                .run(hash, salt, email);

            return res.status(200).json({
                message: '기존 소셜 계정에 비밀번호 로그인이 성공적으로 연동되었습니다.',
                userId: existingUser.id
            });
        }

        // [시나리오 C] 완전 신규 가입
        const stmt = db.prepare('INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)');
        const info = stmt.run(email, hash, salt);

        return res.status(201).json({
            message: '회원가입이 완료되었습니다.',
            userId: info.lastInsertRowid
        });

    } catch (err) {
        console.error('일반 회원가입 오류:', err);
        res.status(500).json({ error: '서버 내부 오류' });
    }
});

app.post('/api/auth/social', (req, res) => {
    const { provider, providerId, email } = req.body;

    if (!provider || !providerId) {
        return res.status(400).json({ error: '소셜 인증 정보가 부족합니다.' });
    }

    try {
        // 1. 이미 연동된 소셜 계정인지 확인 (가장 단순한 로그인 성공 케이스)
        const existingSocial = db.prepare(`
            SELECT user_id FROM social_accounts WHERE provider = ? AND provider_id = ?
        `).get(provider, providerId);

        if (existingSocial) {
            return res.status(200).json({ message: '로그인 성공', userId: existingSocial.user_id });
        }

        // 2. 신규 연동이 필요한 경우, 트랜잭션으로 안전하게 처리
        const linkSocialAccount = db.transaction(() => {
            let targetUserId;

            // 소셜에서 이메일을 제공받았다면, 혹시 기존 'users'에 이메일이 있는지 조회
            if (email) {
                const userByEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
                if (userByEmail) {
                    targetUserId = userByEmail.id; // 기존 계정 발견 -> 이 계정에 연결!
                }
            }

            // 기존 계정이 없다면(완전 신규), users 테이블에 새 유저 생성 (비번 없이)
            if (!targetUserId) {
                const userStmt = db.prepare('INSERT INTO users (email) VALUES (?)');
                const userInfo = userStmt.run(email || null);
                targetUserId = userInfo.lastInsertRowid;
            }

            // 최종적으로 알아낸 targetUserId를 기준으로 social_accounts에 정보 저장
            const socialStmt = db.prepare(`
                INSERT INTO social_accounts (user_id, provider, provider_id) VALUES (?, ?, ?)
            `);
            socialStmt.run(targetUserId, provider, providerId);

            return targetUserId;
        });

        const newUserId = linkSocialAccount();

        return res.status(201).json({
            message: '소셜 계정 연동 및 로그인 완료',
            userId: newUserId
        });

    } catch (err) {
        console.error('소셜 로그인 오류:', err);
        res.status(500).json({ error: '서버 내부 오류' });
    }
});

// ==========================================
// [통계] 1. 방문 초기 진입 기록 API
// ==========================================
app.post('/api/analytics/visit', (req, res) => {
    const { sessionId, referrer, entryPage } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: '세션 ID가 필요합니다.' });
    }

    try {
        // 이미 기록된 세션인지 확인 (새로고침 대응)
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO visitor_stats (session_id, referrer, entry_page) 
            VALUES (?, ?, ?)
        `);

        stmt.run(sessionId, referrer || 'direct', entryPage || '/');

        res.status(200).json({ message: '방문 기록이 저장되었습니다.' });
    } catch (err) {
        console.error('방문 기록 오류:', err);
        res.status(500).json({ error: '서버 내부 오류' });
    }
});

// ==========================================
// [통계] 2. 체류 시간 업데이트 API
// ==========================================
app.post('/api/analytics/duration', (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: '세션 ID가 필요합니다.' });
    }

    try {
        // SQLite의 날짜 계산 기능(strftime)을 활용하여 체류 시간을 초(seconds) 단위로 자동 계산
        // 현재 시간(now)에서 처음 들어온 시간(created_at)을 뺀 값을 stay_duration에 저장
        const stmt = db.prepare(`
            UPDATE visitor_stats
            SET 
                last_updated_at = CURRENT_TIMESTAMP,
                stay_duration = CAST(strftime('%s', 'now') - strftime('%s', created_at) AS INTEGER)
            WHERE session_id = ?
        `);

        stmt.run(sessionId);

        res.status(200).json({ message: '체류 시간이 업데이트되었습니다.' });
    } catch (err) {
        console.error('체류 시간 업데이트 오류:', err);
        res.status(500).json({ error: '서버 내부 오류' });
    }
});

// 기존에 있던 비밀번호 해싱 함수 아래에 추가합니다.
// 입력받은 비밀번호와 DB의 salt를 이용해 해시를 만든 뒤, 기존 DB의 해시와 비교합니다.
function verifyPassword(password, salt, storedHash) {
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === storedHash;
}

// ==========================================
// [인증] 일반(이메일) 로그인 API
// ==========================================
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해주세요.' });
    }

    try {
        // 1. 이메일로 유저 정보 및 보안 데이터(해시, 솔트) 조회
        const user = db.prepare('SELECT id, password_hash, salt FROM users WHERE email = ?').get(email);

        // 2. 유저가 존재하지 않는 경우
        if (!user) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        // 3. 유저는 있지만 비밀번호(password_hash)가 없는 경우 (소셜 로그인 전용 계정)
        if (!user.password_hash || !user.salt) {
            return res.status(401).json({
                error: '카카오 등 소셜 계정으로 가입된 이메일입니다. 소셜 로그인을 이용해주세요.'
            });
        }

        // 4. 비밀번호 검증
        const isValid = verifyPassword(password, user.salt, user.password_hash);

        if (!isValid) {
            // 보안을 위해 이메일이 틀렸는지 비밀번호가 틀렸는지 명확히 알려주지 않는 것이 좋습니다.
            return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        // 5. 로그인 성공 처리
        // (실제 서비스에서는 여기서 JWT 토큰을 발급하거나 세션을 생성하여 넘겨주어야 합니다.)
        return res.status(200).json({
            message: '로그인에 성공했습니다.',
            userId: user.id
        });

    } catch (err) {
        console.error('로그인 오류:', err);
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
});

// 서버 실행
app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});