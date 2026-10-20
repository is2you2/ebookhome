const express = require('express');
const cors = require('cors');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());
app.use(cors());

// 🌟 caxa 패키징 대응: 실행 파일이 실행된 현재 작업 디렉터리에 shop.db 생성
const DB_PATH = path.join(process.cwd(), 'shop.db');
const db = new DatabaseSync(DB_PATH);

// 동시성 성능 및 외래키 제약조건 활성화
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// 🌟 테이블 초기화 (DDL 다중 실행)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    salt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS social_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(provider, provider_id)
  );

  CREATE TABLE IF NOT EXISTS visitor_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    referrer TEXT,
    entry_page TEXT,
    stay_duration INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 🌟 node:sqlite 트랜잭션 래퍼 도우미 함수
function runTransaction(callback) {
    db.exec('BEGIN IMMEDIATE');
    try {
        const result = callback();
        db.exec('COMMIT');
        return result;
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
}

// 🌟 Node.js 내장 node:crypto를 활용한 메모리-하드 scrypt 암호화
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
    } catch {
        return false;
    }
}

// ==========================================
// [인증] 일반 회원가입 API
// ==========================================
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
            if (existingUser.password_hash) {
                return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
            }

            // 소셜 가입자에게 비밀번호 설정 (계정 통합)
            db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE email = ?')
                .run(hash, salt, email);

            return res.status(200).json({
                message: '기존 소셜 계정에 비밀번호 로그인이 성공적으로 연동되었습니다.',
                userId: existingUser.id
            });
        }

        // 완전 신규 가입
        const insertStmt = db.prepare('INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)');
        const info = insertStmt.run(email, hash, salt);

        return res.status(201).json({
            message: '회원가입이 완료되었습니다.',
            userId: Number(info.lastInsertRowid)
        });

    } catch (err) {
        console.error('일반 회원가입 오류:', err);
        res.status(500).json({ error: '서버 내부 오류' });
    }
});

// ==========================================
// [인증] 소셜 로그인 API
// ==========================================
app.post('/api/auth/social', (req, res) => {
    const { provider, providerId, email } = req.body;

    if (!provider || !providerId) {
        return res.status(400).json({ error: '소셜 인증 정보가 부족합니다.' });
    }

    try {
        // 이미 연동된 소셜 계정인지 조회
        const existingSocial = db.prepare(`
            SELECT user_id FROM social_accounts WHERE provider = ? AND provider_id = ?
        `).get(provider, providerId);

        if (existingSocial) {
            return res.status(200).json({ message: '로그인 성공', userId: existingSocial.user_id });
        }

        // 트랜잭션을 통한 신규 생성 및 계정 통합
        const newUserId = runTransaction(() => {
            let targetUserId;

            if (email) {
                const userByEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
                if (userByEmail) {
                    targetUserId = userByEmail.id;
                }
            }

            if (!targetUserId) {
                const userStmt = db.prepare('INSERT INTO users (email) VALUES (?)');
                const userInfo = userStmt.run(email || null);
                targetUserId = Number(userInfo.lastInsertRowid);
            }

            db.prepare(`
                INSERT INTO social_accounts (user_id, provider, provider_id) VALUES (?, ?, ?)
            `).run(targetUserId, provider, providerId);

            return targetUserId;
        });

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
// [통계] 방문 및 체류 시간 API
// ==========================================
app.post('/api/analytics/visit', (req, res) => {
    const { sessionId, referrer, entryPage } = req.body;
    if (!sessionId) return res.status(400).json({ error: '세션 ID가 필요합니다.' });

    try {
        db.prepare(`
            INSERT OR IGNORE INTO visitor_stats (session_id, referrer, entry_page) 
            VALUES (?, ?, ?)
        `).run(sessionId, referrer || 'direct', entryPage || '/');

        res.status(200).json({ message: '방문 기록이 저장되었습니다.' });
    } catch (err) {
        console.error('방문 기록 오류:', err);
        res.status(500).json({ error: '서버 내부 오류' });
    }
});

app.post('/api/analytics/duration', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: '세션 ID가 필요합니다.' });

    try {
        db.prepare(`
            UPDATE visitor_stats
            SET 
                last_updated_at = CURRENT_TIMESTAMP,
                stay_duration = CAST(strftime('%s', 'now') - strftime('%s', created_at) AS INTEGER)
            WHERE session_id = ?
        `).run(sessionId);

        res.status(200).json({ message: '체류 시간이 업데이트되었습니다.' });
    } catch (err) {
        console.error('체류 시간 업데이트 오류:', err);
        res.status(500).json({ error: '서버 내부 오류' });
    }
});

// ==========================================
// [인증] 일반(이메일) 로그인 API
// ==========================================
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해주세요.' });
    }

    try {
        const user = db.prepare('SELECT id, password_hash, salt FROM users WHERE email = ?').get(email);

        if (!user) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        if (!user.password_hash || !user.salt) {
            return res.status(401).json({
                error: '카카오 등 소셜 계정으로 가입된 이메일입니다. 소셜 로그인을 이용해주세요.'
            });
        }

        const isValid = verifyPassword(password, user.salt, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

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
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다. (DB: ${DB_PATH})`);
});