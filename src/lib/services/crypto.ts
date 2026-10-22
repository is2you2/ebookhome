// src/lib/services/crypto.ts

/**
 * 임의의 문자열(세션 키 또는 책 ID 기반 키)로부터 256비트 AES-GCM CryptoKey 유도
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.digest("SHA-256", enc.encode(secret));
    return await crypto.subtle.importKey(
        "raw",
        keyMaterial,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * EPUB 원본 ArrayBuffer를 AES-GCM으로 암호화 [12바이트 IV + 암호문]
 */
export async function encryptBuffer(buffer: ArrayBuffer, secretKey: string): Promise<ArrayBuffer> {
    const key = await deriveKey(secretKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        buffer
    );

    // [IV 12바이트] + [Ciphertext] 결합
    const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.byteLength);
    return combined.buffer;
}

/**
 * 암호화된 ArrayBuffer를 복호화하여 원본 EPUB ArrayBuffer로 복원 (RAM 상에서만 수행)
 */
export async function decryptBuffer(combinedBuffer: ArrayBuffer, secretKey: string): Promise<ArrayBuffer> {
    const key = await deriveKey(secretKey);
    const combinedView = new Uint8Array(combinedBuffer);
    const iv = combinedView.slice(0, 12);
    const ciphertext = combinedView.slice(12);

    return await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
    );
}