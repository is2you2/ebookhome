require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || '';

app.use(express.json());
app.use(cors());

// 🌟 실행 파일 위치에 shop.db 생성 유지
const DB_PATH = path.join(process.cwd(), 'shop.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// 🌟 기존 회원/통계 테이블 + 결제 및 도서 관리 테이블 생성
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

  -- [도서 마스터] 가격 위변조 검증의 기준이 되는 테이블
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

  -- [결제 영수증] 포트원 거래 내역 기록
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE NOT NULL, -- 가맹점 주문 번호
    user_id INTEGER,
    book_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'KRW',
    status TEXT NOT NULL,           -- PAID, CANCELLED 등
    pay_method TEXT,
    receipt_url TEXT,
    raw_data TEXT,                   -- 포트원 응답 JSON 원본
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books (id)
  );

  -- [소유권] 사용자가 구매한 책 매핑
  CREATE TABLE IF NOT EXISTS user_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id TEXT NOT NULL,
    payment_id TEXT,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books (id),
    UNIQUE(user_id, book_id)
  );
`);

// 🌟 테스트용 기본 도서 데이터 시딩 (DB가 비어있을 때 삽입)
const bookCount = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
if (bookCount === 0) {
    const insertBook = db.prepare(`
        INSERT INTO books (id, title, author, price, desc, thumbnail, video_thumbnail, epub_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertBook.run(
        'test_book_id_0',
        '바이블일러스트큐티',
        '최정훈',
        10000,
        '말풍선 글짓기 QT',
        'assets/books/00/thumbnail.jpg',
        'assets/books/00/cover.mp4',
        'assets/books/00/book.epub'
    );
    insertBook.run(
        'store_book_id_0',
        '새로운 비디오 책 샘플',
        '작자미상',
        15000,
        '영상 표지가 포함된 샘플 전자책',
        'assets/thumbnail2.jpg',
        'assets/vid_cover_sample2.mp4',
        'assets/02.epub'
    );
}

// 🌟 트랜잭션 래퍼 도우미 함수
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

// 비밀번호 암호화 헬퍼 함수
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
// [도서] 전체 도서 목록 조회 API (스토어 탭용)
// ==========================================
app.get('/api/books', (req, res) => {
    try {
        const books = db.prepare('SELECT * FROM books').all();
        res.status(200).json(books);
    } catch (err) {
        res.status(500).json({ error: '도서 목록 조회 오류' });
    }
});

// ==========================================
// [도서] 사용자별 구매 도서 목록 조회 API (내 서재 탭용)
// ==========================================
app.get('/api/users/:userId/books', (req, res) => {
    const { userId } = req.params;
    try {
        const myBooks = db.prepare(`
            SELECT b.*, ub.purchased_at 
            FROM books b
            INNER JOIN user_books ub ON b.id = ub.book_id
            WHERE ub.user_id = ?
        `).all(userId);

        res.status(200).json(myBooks);
    } catch (err) {
        res.status(500).json({ error: '구매 도서 목록 조회 오류' });
    }
});

// ==========================================
// 🌟 [결제] 포트원 V2 결제 검증 및 도서 권한 부여 API
// ==========================================
app.post('/api/payments/complete', async (req, res) => {
    const { paymentId, bookId, userId } = req.body;

    if (!paymentId || !bookId) {
        return res.status(400).json({ error: '결제 정보(paymentId, bookId)가 누락되었습니다.' });
    }

    try {
        // 1. 서버 DB에서 해당 도서의 실제 가격 확인
        const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
        if (!book) {
            return res.status(404).json({ error: '존재하지 않는 도서입니다.' });
        }

        // 2. 포트원 V2 REST API 단건 조회 호출 (Node 내장 fetch 사용)
        const portoneRes = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
            method: 'GET',
            headers: {
                'Authorization': `PortOne ${PORTONE_API_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        if (!portoneRes.ok) {
            const errData = await portoneRes.json();
            return res.status(400).json({ error: errData.message || '포트원 결제 내역 조회 실패' });
        }

        const paymentData = await portoneRes.json();

        // 3. 결제 상태 검증
        if (paymentData.status !== 'PAID') {
            return res.status(400).json({ error: `결제가 완료되지 않았습니다. (현재 상태: ${paymentData.status})` });
        }

        // 4. [핵심] 금액 위변조 검증 (포트원에서 실제로 결제된 금액 == DB의 책 정가)
        const actualPaidAmount = paymentData.amount?.total;
        if (actualPaidAmount !== book.price) {
            return res.status(400).json({
                error: `결제 금액 위변조 감지: 실 결제액(${actualPaidAmount}원) != 도서 정가(${book.price}원)`
            });
        }

        // 5. 결제 영수증 저장 및 사용자 소유권 부여 (트랜잭션)
        runTransaction(() => {
            // 영수증 삽입
            db.prepare(`
                INSERT INTO payments (payment_id, user_id, book_id, amount, currency, status, pay_method, receipt_url, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                paymentId,
                userId || null,
                bookId,
                actualPaidAmount,
                paymentData.currency || 'KRW',
                paymentData.status,
                paymentData.method?.type || 'CARD',
                paymentData.receiptUrl || null,
                JSON.stringify(paymentData)
            );

            // 로그인 사용자인 경우 내 서재(user_books)에 등록
            if (userId) {
                db.prepare(`
                    INSERT OR IGNORE INTO user_books (user_id, book_id, payment_id)
                    VALUES (?, ?, ?)
                `).run(userId, bookId, paymentId);
            }
        });

        return res.status(200).json({
            success: true,
            message: '결제 검증 및 도서 구매가 완료되었습니다.',
            book: book
        });

    } catch (err) {
        console.error('결제 검증 오류:', err);
        return res.status(500).json({ error: '서버 내부 결제 처리 오류가 발생했습니다.' });
    }
});

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

app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다. (DB: ${DB_PATH})`);
});