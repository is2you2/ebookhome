// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const multer = require('multer');
const {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    authenticateToken
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(process.cwd(), 'shop.db');
const db = new DatabaseSync(DB_PATH);

app.use(express.json());
app.use(cors());

// 정적 자산 및 업로드 디렉토리 서빙
const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'assets', 'books');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
app.use('/assets', express.static(path.join(process.cwd(), 'public', 'assets')));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

app.use('/assets', express.static(path.join(process.cwd(), 'public', 'assets')));

// -------------------------------------------------------------
// 데이터베이스 스키마 정의
// -------------------------------------------------------------
db.exec(`
  -- 관리자 테이블 (일반 회원과 완전 격리)
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login_id TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 일반 회원 테이블
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    salt TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 도서 테이블 (정식 EPUB 및 5페이지 맛보기 파일 분리 지원)
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    publisher TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    original_price INTEGER,
    desc TEXT,
    description_url TEXT,
    thumbnail TEXT NOT NULL,
    video_thumbnail TEXT,
    epub_url TEXT NOT NULL,
    preview_epub_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

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
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
    UNIQUE(user_id, book_id)
  );
`);

// 기본 관리자 계정 시딩 (admin / admin1234!)
(async () => {
    const adminCheck = db.prepare('SELECT id FROM admins LIMIT 1').get();
    if (!adminCheck) {
        const { salt, hash } = await hashPassword('admin1234!');
        db.prepare('INSERT INTO admins (login_id, password_hash, salt, name) VALUES (?, ?, ?, ?)')
            .run('admin', hash, salt, '최고관리자');
        console.log('초기 관리자 계정이 생성되었습니다: admin / admin1234!');
    }
})();

// -------------------------------------------------------------
// 관리자 인가 미들웨어
// -------------------------------------------------------------
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: '관리자 권한이 필요합니다.' });

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
        return res.status(403).json({ error: '관리자 세션이 만료되었거나 접근 권한이 없습니다.' });
    }
    req.admin = decoded;
    next();
}

// -------------------------------------------------------------
// Multer 도서 파일 업로드 스토리지 설정
// -------------------------------------------------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const bookId = req.body.id || `book_${Date.now()}`;
        req.uploadedBookId = bookId;
        const bookDir = path.join(UPLOAD_ROOT, bookId);
        if (!fs.existsSync(bookDir)) fs.mkdirSync(bookDir, { recursive: true });
        cb(null, bookDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        let fileName = file.fieldname;
        if (file.fieldname === 'thumbnail') fileName = `thumbnail${ext}`;
        else if (file.fieldname === 'video_thumbnail') fileName = `cover${ext}`;
        else if (file.fieldname === 'desc_file') fileName = `desc.txt`;
        else if (file.fieldname === 'epub_file') fileName = `book.epub`;
        else if (file.fieldname === 'preview_epub_file') fileName = `preview.epub`;
        else fileName = `${file.fieldname}_${Date.now()}${ext}`;
        cb(null, fileName);
    }
});

// -------------------------------------------------------------
// [관리자 API] 1. 인증 및 세션
// -------------------------------------------------------------
app.post('/api/admin/login', async (req, res) => {
    const { loginId, password } = req.body;
    if (!loginId || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력해 주세요.' });

    try {
        const admin = db.prepare('SELECT * FROM admins WHERE login_id = ?').get(loginId);
        if (!admin) return res.status(401).json({ error: '관리자 계정 정보가 일치하지 않습니다.' });

        const isValid = await verifyPassword(password, admin.salt, admin.password_hash);
        if (!isValid) return res.status(401).json({ error: '관리자 계정 정보가 일치하지 않습니다.' });

        // 관리자 전용 세션 (8시간)
        const token = generateToken({ id: admin.id, loginId: admin.login_id, name: admin.name, role: 'admin' }, 8 * 3600);
        res.json({ success: true, token, admin: { id: admin.id, loginId: admin.login_id, name: admin.name } });
    } catch (err) {
        res.status(500).json({ error: '관리자 로그인 처리 중 서버 오류' });
    }
});

app.post('/api/admin/change-password', authenticateAdmin, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: '새 비밀번호는 8자 이상이어야 합니다.' });
    }

    try {
        const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
        const isValid = await verifyPassword(currentPassword, admin.salt, admin.password_hash);
        if (!isValid) return res.status(400).json({ error: '현재 비밀번호가 일치하지 않습니다.' });

        const { salt, hash } = await hashPassword(newPassword);
        db.prepare('UPDATE admins SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, req.admin.id);
        res.json({ success: true, message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: '비밀번호 변경 처리 실패' });
    }
});

// server/index.js 내부 도서 업로드 라우트 수정

const JSZip = require('jszip');

// 1x1 크기의 초소형 백색 JPEG 바이너리 (5페이지 이후 치환용 더미)
const BLANK_DUMMY_IMAGE = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
);

// 🌟 Multer 필드 단순화: 표지/맛보기 제거 -> EPUB 원본, 비디오(선택), 소개글(선택)만 수신
const uploadBookFiles = multer({
    storage,
    limits: { fileSize: 300 * 1024 * 1024 }
}).fields([
    { name: 'epub_file', maxCount: 1 },
    { name: 'video_thumbnail', maxCount: 1 },
    { name: 'desc_file', maxCount: 1 }
]);

app.post('/api/admin/books', authenticateAdmin, (req, res) => {
    uploadBookFiles(req, res, async (err) => {
        if (err) return res.status(400).json({ error: `파일 업로드 실패: ${err.message}` });

        const { id, title, author, publisher, price, original_price, desc } = req.body;
        const bookId = req.uploadedBookId || id;

        if (!bookId || !title || !author) {
            return res.status(400).json({ error: '도서 식별자, 제목, 저자는 필수 항목입니다.' });
        }

        const files = req.files || {};
        const epubFileObj = files['epub_file'] ? files['epub_file'][0] : null;

        if (!epubFileObj && !req.body.epub_url) {
            return res.status(400).json({ error: '원본 EPUB 파일이 필요합니다.' });
        }

        const bookDir = path.join(UPLOAD_ROOT, bookId);
        let thumbnailRel = `assets/books/${bookId}/thumbnail.jpg`;
        const videoRel = files['video_thumbnail'] ? `assets/books/${bookId}/${files['video_thumbnail'][0].filename}` : null;
        const descRel = files['desc_file'] ? `assets/books/${bookId}/${files['desc_file'][0].filename}` : null;
        let epubRel = `assets/books/${bookId}/book.epub`;
        let previewRel = `assets/books/${bookId}/preview.epub`;

        try {
            // 🌟 원본 EPUB이 새로 업로드된 경우 자동 가공 파이프라인 수행
            if (epubFileObj) {
                const epubBuffer = fs.readFileSync(epubFileObj.path);
                const zip = await JSZip.loadAsync(epubBuffer);

                // 이미지 파일 추출 및 정렬
                const imagePaths = Object.keys(zip.files)
                    .filter((p) => !zip.files[p].dir && /\.(jpg|jpeg|png|webp)$/i.test(p))
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

                if (imagePaths.length === 0) {
                    throw new Error('EPUB 내부에 이미지 파일이 존재하지 않습니다.');
                }

                // 1. [표지 자동 생성] 첫 번째 페이지 이미지를 추출하여 thumbnail.jpg로 저장
                const firstImageBuffer = await zip.file(imagePaths[0]).async('nodebuffer');
                fs.writeFileSync(path.join(bookDir, 'thumbnail.jpg'), firstImageBuffer);

                // 2. [5페이지 맛보기 자동 생성] 5페이지(인덱스 5) 이후 이미지를 1x1 백색 더미로 치환
                const previewZip = await JSZip.loadAsync(epubBuffer);
                for (let i = 5; i < imagePaths.length; i++) {
                    previewZip.file(imagePaths[i], BLANK_DUMMY_IMAGE);
                }

                const previewBuffer = await previewZip.generateAsync({
                    type: 'nodebuffer',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 6 }
                });
                fs.writeFileSync(path.join(bookDir, 'preview.epub'), previewBuffer);
            }

            // DB 등록 및 갱신
            db.prepare(`
                INSERT INTO books (id, title, author, publisher, price, original_price, desc, description_url, thumbnail, video_thumbnail, epub_url, preview_epub_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title, author=excluded.author, publisher=excluded.publisher,
                    price=excluded.price, original_price=excluded.original_price, desc=excluded.desc,
                    description_url=COALESCE(excluded.description_url, books.description_url),
                    thumbnail=excluded.thumbnail,
                    video_thumbnail=COALESCE(excluded.video_thumbnail, books.video_thumbnail),
                    epub_url=excluded.epub_url,
                    preview_epub_url=excluded.preview_epub_url
            `).run(
                bookId, title, author, publisher || '', Number(price) || 0,
                original_price ? Number(original_price) : null, desc || '', descRel,
                thumbnailRel, videoRel, epubRel, previewRel
            );

            res.json({
                success: true,
                message: '도서 등록, 첫 장 표지 추출 및 5페이지 맛보기 파일 생성이 완료되었습니다.',
                bookId
            });
        } catch (processErr) {
            console.error('EPUB 처리 중 에러:', processErr);
            res.status(500).json({ error: `EPUB 가공 처리 실패: ${processErr.message}` });
        }
    });
});

app.post('/api/admin/books', authenticateAdmin, (req, res) => {
    uploadBookFiles(req, res, async (err) => {
        if (err) return res.status(400).json({ error: `파일 업로드 실패: ${err.message}` });

        const { id, title, author, publisher, price, original_price, desc } = req.body;
        const bookId = req.uploadedBookId || id;

        if (!bookId || !title || !author) {
            return res.status(400).json({ error: '도서 식별자, 제목, 저자는 필수 항목입니다.' });
        }

        const files = req.files || {};
        const thumbnailRel = files['thumbnail'] ? `assets/books/${bookId}/${files['thumbnail'][0].filename}` : req.body.thumbnail || '';
        const videoRel = files['video_thumbnail'] ? `assets/books/${bookId}/${files['video_thumbnail'][0].filename}` : null;
        const descRel = files['desc_file'] ? `assets/books/${bookId}/${files['desc_file'][0].filename}` : null;
        const epubRel = files['epub_file'] ? `assets/books/${bookId}/${files['epub_file'][0].filename}` : req.body.epub_url || '';
        const previewRel = files['preview_epub_file'] ? `assets/books/${bookId}/${files['preview_epub_file'][0].filename}` : null;

        try {
            db.prepare(`
                INSERT INTO books (id, title, author, publisher, price, original_price, desc, description_url, thumbnail, video_thumbnail, epub_url, preview_epub_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title, author=excluded.author, publisher=excluded.publisher,
                    price=excluded.price, original_price=excluded.original_price, desc=excluded.desc,
                    description_url=COALESCE(excluded.description_url, books.description_url),
                    thumbnail=COALESCE(excluded.thumbnail, books.thumbnail),
                    video_thumbnail=COALESCE(excluded.video_thumbnail, books.video_thumbnail),
                    epub_url=COALESCE(excluded.epub_url, books.epub_url),
                    preview_epub_url=COALESCE(excluded.preview_epub_url, books.preview_epub_url)
            `).run(
                bookId, title, author, publisher || '', Number(price) || 0,
                original_price ? Number(original_price) : null, desc || '', descRel,
                thumbnailRel, videoRel, epubRel, previewRel
            );

            res.json({ success: true, message: '도서가 등록/갱신되었습니다.', bookId });
        } catch (dbErr) {
            res.status(500).json({ error: `도서 저장 오류: ${dbErr.message}` });
        }
    });
});

// 🌟 1. 관리자 전용 전체 도서 목록 (비공개/숨김 도서 포함)
app.get('/api/admin/books', authenticateAdmin, (req, res) => {
    try {
        const books = db.prepare('SELECT * FROM books ORDER BY created_at DESC').all();
        res.json(books);
    } catch (err) {
        console.error('관리자 도서 목록 조회 에러:', err);
        res.status(500).json({ error: '도서 목록 조회 중 데이터베이스 오류가 발생했습니다.' });
    }
});

// 🌟 2. 스토어 공개용 도서 목록 (판매 중인 도서만 반환)
app.get('/api/books', (req, res) => {
    try {
        const books = db.prepare(`
            SELECT id, title, author, publisher, price, original_price, desc,
                   description_url, thumbnail, video_thumbnail, epub_url, preview_epub_url
            FROM books
            WHERE is_active = 1
            ORDER BY created_at DESC
        `).all();
        res.json(books);
    } catch (err) {
        console.error('스토어 도서 목록 조회 에러:', err);
        res.status(500).json({ error: '스토어 도서 목록 조회 실패' });
    }
});

app.patch('/api/admin/books/:id/toggle', authenticateAdmin, (req, res) => {
    try {
        const book = db.prepare('SELECT is_active FROM books WHERE id = ?').get(req.params.id);
        if (!book) return res.status(404).json({ error: '도서를 찾을 수 없습니다.' });
        const nextState = book.is_active === 1 ? 0 : 1;
        db.prepare('UPDATE books SET is_active = ? WHERE id = ?').run(nextState, req.params.id);
        res.json({ success: true, is_active: nextState });
    } catch (err) {
        res.status(500).json({ error: '상태 변경 오류' });
    }
});

app.delete('/api/admin/books/:id', authenticateAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
        const bookDir = path.join(UPLOAD_ROOT, req.params.id);
        if (fs.existsSync(bookDir)) fs.rmSync(bookDir, { recursive: true, force: true });
        res.json({ success: true, message: '도서가 삭제되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: '도서 삭제 처리 실패' });
    }
});

// -------------------------------------------------------------
// [관리자 API] 3. 결제 내역 조회
// -------------------------------------------------------------
app.get('/api/admin/payments', authenticateAdmin, (req, res) => {
    try {
        const payments = db.prepare(`
            SELECT p.*, u.email as user_email, b.title as book_title
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN books b ON p.book_id = b.id
            ORDER BY p.created_at DESC
            LIMIT 200
        `).all();
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: '결제 내역 조회 오류' });
    }
});

// -------------------------------------------------------------
// [관리자 API] 4. 회원 관리 및 서재 수동 지급/회수
// -------------------------------------------------------------
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.id, u.email, u.is_active, u.created_at,
                   COUNT(ub.id) as owned_book_count
            FROM users u
            LEFT JOIN user_books ub ON u.id = ub.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `).all();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: '회원 목록 조회 오류' });
    }
});

app.get('/api/admin/users/:userId/books', authenticateAdmin, (req, res) => {
    try {
        const books = db.prepare(`
            SELECT b.id, b.title, ub.purchased_at
            FROM books b
            INNER JOIN user_books ub ON b.id = ub.book_id
            WHERE ub.user_id = ?
        `).all(req.params.userId);
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: '사용자 소장 도서 조회 오류' });
    }
});

app.post('/api/admin/users/:userId/books', authenticateAdmin, (req, res) => {
    const { bookId } = req.body;
    try {
        db.prepare('INSERT OR IGNORE INTO user_books (user_id, book_id, payment_id) VALUES (?, ?, ?)')
            .run(req.params.userId, bookId, `manual_grant_${Date.now()}`);
        res.json({ success: true, message: '도서가 수동 지급되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: '도서 수동 지급 실패' });
    }
});

app.delete('/api/admin/users/:userId/books/:bookId', authenticateAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM user_books WHERE user_id = ? AND book_id = ?')
            .run(req.params.userId, req.params.bookId);
        res.json({ success: true, message: '도서가 회수되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: '도서 회수 실패' });
    }
});

// -------------------------------------------------------------
// [관리자 API] 5. 통계 요약
// -------------------------------------------------------------
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    try {
        const totalSales = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'PAID'").get().total;
        const totalUsers = db.prepare("SELECT COUNT(id) as count FROM users").get().count;
        const totalBooks = db.prepare("SELECT COUNT(id) as count FROM books").get().count;
        const recentPayments = db.prepare("SELECT COUNT(id) as count FROM payments WHERE created_at >= date('now', '-7 days')").get().count;
        res.json({ totalSales, totalUsers, totalBooks, recentPayments });
    } catch (err) {
        res.status(500).json({ error: '통계 집계 오류' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 서버 구동 완료: 포트 ${PORT}`);
});