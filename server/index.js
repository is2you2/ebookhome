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

// 2. 테이블 생성 (회원 정보 테이블)
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,      -- 이메일 제공을 거부할 수 있으므로 NULL 허용
    password_hash TEXT,     -- 소셜 가입자는 비밀번호가 없으므로 NULL 허용
    salt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// 비밀번호 암호화 헬퍼 함수 (PBKDF2 방식)
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

// 3. 회원가입 API
app.post('/api/signup', (req, res) => {
    const { email, password } = req.body;

    // 간단한 입력값 검증
    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해주세요.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    try {
        // 이메일 중복 확인
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(409).json({ error: '이미 가입된 아이디입니다.' });
        }

        // 비밀번호 해싱
        const { salt, hash } = hashPassword(password);

        // 데이터베이스에 회원 정보 저장
        const stmt = db.prepare('INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)');
        const info = stmt.run(email, hash, salt);

        return res.status(201).json({
            message: '회원가입이 성공적으로 완료되었습니다.',
            userId: info.lastInsertRowid,
            email: email
        });

    } catch (err) {
        console.error('회원가입 오류:', err);
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
});

// 서버 실행
app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});