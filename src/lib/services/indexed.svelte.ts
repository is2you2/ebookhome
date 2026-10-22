// src/lib/services/indexed.svelte.ts

const DB_NAME = "OOB_SECURE_STORAGE";
const STORE_NAME = "encrypted_books";

function getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export const indexed = {
    /**
     * 🌟 암호화된 ArrayBuffer 1개만 IndexedDB에 저장 (낱개 이미지 유출 차단)
     */
    async saveEncryptedBook(bookId: string, encryptedBuffer: ArrayBuffer): Promise<void> {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(encryptedBuffer, bookId);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    /**
     * 암호화된 ArrayBuffer 조회
     */
    async loadEncryptedBook(bookId: string): Promise<ArrayBuffer | null> {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(bookId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },

    /**
     * 도서 캐시 삭제
     */
    async removeEncryptedBook(bookId: string): Promise<void> {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(bookId);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async clearAll(): Promise<void> {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
};