require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const {
    hashPassword,
    verifyPassword,
    generateToken,
    authenticateToken,
    optionalAuthenticateToken
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || '';

app.use(express.json());
app.use(cors());

const DB_PATH = path.join(process.cwd(), 'shop.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// 회원 테이블 및 결제 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    salt TEXT,
    is_active INTEGER DEFAULT 1, -- 탈퇴 시 소프트 삭제용
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS social_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    UNIQUE(provider, provider_id)
  );

  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    desc TEXT,
    thumbnail TEXT,
    video_thumbnail TEXT,
    epub_url TEXT
  );

  -- 전자상거래법 준수: 회원 탈퇴 시에도 거래 기록 보존을 위해 ON DELETE RESTRICT 적용
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE NOT NULL,
    user_id INTEGER,
    book_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'KRW',
    status TEXT NOT NULL,
    pay_method TEXT,
    receipt_url TEXT,
    raw_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books (id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS user_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id TEXT NOT NULL,
    payment_id TEXT,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    FOREIGN KEY (book_id) REFERENCES books (id),
    UNIQUE(user_id, book_id)
  );
`);

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

// ==========================================
// [인증] 일반 회원가입 (비동기 scrypt 적용)
// ==========================================
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해 주세요.' });
    }

    // 상업용 필수: 백엔드 비밀번호 정책 검증 (최소 8자 이상)
    if (password.length < 8) {
        return res.status(400).json({ error: '비밀번호는 최소 8자 이상이어야 합니다.' });
    }

    try {
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(409).json({ error: '이미 등록된 이메일 계정입니다.' });
        }

        // 🌟 비동기 해싱: CPU 부하 작업이 워커 스레드로 넘어가 이벤트 루프를 막지 않음
        const { salt, hash } = await hashPassword(password);

        const result = db.prepare(`
            INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)
        `).run(email, hash, salt);

        const userId = Number(result.lastInsertRowid);
        const token = generateToken({ id: userId, email });

        return res.status(201).json({
            success: true,
            token,
            user: { id: userId, email }
        });
    } catch (err) {
        console.error('회원가입 오류:', err);
        return res.status(500).json({ error: '서버 내부 오류' });
    }
});

// ==========================================
// [인증] 일반 로그인 (비동기 scrypt 검증 및 JWT 발급)
// ==========================================
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력해 주세요.' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
        if (!user || !user.password_hash || !user.salt) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        // 🌟 비동기 비밀번호 검증
        const isValid = await verifyPassword(password, user.salt, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        // 인증 토큰 발급
        const token = generateToken({ id: user.id, email: user.email });

        return res.status(200).json({
            success: true,
            token,
            user: { id: user.id, email: user.email }
        });
    } catch (err) {
        console.error('로그인 오류:', err);
        return res.status(500).json({ error: '로그인 처리 중 오류 발생' });
    }
});

// ==========================================
// [인증] 카카오 소셜 로그인 연동
// ==========================================
app.post('/api/auth/social', (req, res) => {
    const { provider, providerId, email } = req.body;
    if (!provider || !providerId) {
        return res.status(400).json({ error: '소셜 인증 정보가 누락되었습니다.' });
    }

    try {
        let userId;
        const socialAccount = db.prepare(`
            SELECT user_id FROM social_accounts WHERE provider = ? AND provider_id = ?
        `).get(provider, providerId);

        if (socialAccount) {
            userId = socialAccount.user_id;
        } else {
            runTransaction(() => {
                let userRecord = email ? db.prepare('SELECT id FROM users WHERE email = ?').get(email) : null;
                if (!userRecord) {
                    const result = db.prepare('INSERT INTO users (email) VALUES (?)').run(email || null);
                    userId = Number(result.lastInsertRowid);
                } else {
                    userId = userRecord.id;
                }
                db.prepare(`
                    INSERT INTO social_accounts (user_id, provider, provider_id) VALUES (?, ?, ?)
                `).run(userId, provider, providerId);
            });
        }

        const token = generateToken({ id: userId, email: email || null });
        return res.status(200).json({
            success: true,
            token,
            user: { id: userId, email: email || null }
        });
    } catch (err) {
        console.error('소셜 인증 오류:', err);
        return res.status(500).json({ error: '소셜 로그인 처리 실패' });
    }
});

// ==========================================
// 🌟 [보안 개선] 내 구매 도서 조회 (IDOR 방어)
// ==========================================
// 기존 /api/users/:userId/books 에서 URL 파라미터를 없애고 토큰 기반(/api/users/me/books)으로 전환
app.get('/api/users/me/books', authenticateToken, (req, res) => {
    try {
        // req.user.id는 authenticateToken 미들웨어에서 서명 검증을 통과한 유저 ID임이 보장됨
        const myBooks = db.prepare(`
            SELECT b.*, ub.purchased_at 
            FROM books b
            INNER JOIN user_books ub ON b.id = ub.book_id
            WHERE ub.user_id = ?
        `).all(req.user.id);

        res.status(200).json(myBooks);
    } catch (err) {
        res.status(500).json({ error: '구매 도서 목록 조회 오류' });
    }
});

// ==========================================
// 🌟 [보안 개선] 포트원 V2 결제 검증 API
// ==========================================
app.post('/api/payments/complete', optionalAuthenticateToken, async (req, res) => {
    const { paymentId, bookId } = req.body;
    // 클라이언트가 보낸 userId 파라미터를 신뢰하지 않고, 토큰이 있으면 req.user.id를 사용
    const verifiedUserId = req.user ? req.user.id : null;

    if (!paymentId || !bookId) {
        return res.status(400).json({ error: '결제 식별자(paymentId)와 도서 ID(bookId)가 필요합니다.' });
    }

    try {
        const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
        if (!book) {
            return res.status(404).json({ error: '존재하지 않는 도서입니다.' });
        }

        // 포트원 V2 REST API 단건 조회
        const portoneRes = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
            method: 'GET',
            headers: {
                'Authorization': `PortOne ${PORTONE_API_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        if (!portoneRes.ok) {
            const errData = await portoneRes.json();
            return res.status(400).json({ error: errData.message || '결제 내역 조회 실패' });
        }

        const paymentData = await portoneRes.json();

        if (paymentData.status !== 'PAID') {
            return res.status(400).json({ error: `결제 미완료 상태: ${paymentData.status}` });
        }

        // 금액 위변조 검증
        const actualPaidAmount = paymentData.amount?.total;
        if (actualPaidAmount !== book.price) {
            return res.status(400).json({
                error: `금액 위변조 감지: 실 결제액(${actualPaidAmount}원) != DB 정가(${book.price}원)`
            });
        }

        runTransaction(() => {
            db.prepare(`
                INSERT INTO payments (payment_id, user_id, book_id, amount, currency, status, pay_method, receipt_url, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                paymentId,
                verifiedUserId,
                bookId,
                actualPaidAmount,
                paymentData.currency || 'KRW',
                paymentData.status,
                paymentData.method?.type || 'CARD',
                paymentData.receiptUrl || null,
                JSON.stringify(paymentData)
            );

            if (verifiedUserId) {
                db.prepare(`
                    INSERT OR IGNORE INTO user_books (user_id, book_id, payment_id)
                    VALUES (?, ?, ?)
                `).run(verifiedUserId, bookId, paymentId);
            }
        });

        return res.status(200).json({
            success: true,
            message: '결제 검증 및 도서 등록 완료',
            book
        });
    } catch (err) {
        console.error('결제 검증 오류:', err);
        return res.status(500).json({ error: '서버 결제 검증 중 오류 발생' });
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

app.listen(PORT, () => {
    console.log(`🚀 서버 구동 완료: 포트 ${PORT} (DB: ${DB_PATH})`);
});