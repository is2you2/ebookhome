<!-- src/lib/components/admin/TabBooks.svelte -->
<script lang="ts">
    let { adminToken }: { adminToken: string } = $props();

    interface BookRecord {
        id: string;
        title: string;
        author: string;
        price: number;
        epub_url: string;
        preview_epub_url?: string;
        is_active: number;
        created_at: string;
    }

    let books = $state<BookRecord[]>([]);
    let isLoading = $state(false);

    let id = $state("");
    let title = $state("");
    let author = $state("");
    let publisher = $state("");
    let price = $state<number>(10000);
    let originalPrice = $state<number>(13000);
    let desc = $state("");

    let thumbnailFile: File | null = null;
    let videoFile: File | null = null;
    let descFile: File | null = null;
    let epubFile: File | null = null;
    let previewEpubFile: File | null = null;

    async function loadBooks() {
        isLoading = true;
        try {
            const res = await fetch("http://localhost:3000/api/admin/books", {
                headers: { Authorization: `Bearer ${adminToken}` },
            });
            books = await res.json();
        } finally {
            isLoading = false;
        }
    }

    $effect(() => {
        loadBooks();
    });

    async function handleSubmit() {
        const formData = new FormData();
        formData.append("id", id);
        formData.append("title", title);
        formData.append("author", author);
        formData.append("publisher", publisher);
        formData.append("price", String(price));
        formData.append("original_price", String(originalPrice));
        formData.append("desc", desc);

        if (thumbnailFile) formData.append("thumbnail", thumbnailFile);
        if (videoFile) formData.append("video_thumbnail", videoFile);
        if (descFile) formData.append("desc_file", descFile);
        if (epubFile) formData.append("epub_file", epubFile);
        if (previewEpubFile)
            formData.append("preview_epub_file", previewEpubFile);

        try {
            const res = await fetch("http://localhost:3000/api/admin/books", {
                method: "POST",
                headers: { Authorization: `Bearer ${adminToken}` },
                body: formData,
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            alert("도서가 성공적으로 업로드 및 등록되었습니다.");
            id = "";
            title = "";
            author = "";
            publisher = "";
            desc = "";
            loadBooks();
        } catch (err: any) {
            alert(`등록 실패: ${err.message}`);
        }
    }

    async function toggleActive(bookId: string) {
        await fetch(`http://localhost:3000/api/admin/books/${bookId}/toggle`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        loadBooks();
    }

    async function deleteBook(bookId: string) {
        if (!confirm("정말 이 도서와 모든 관련 파일을 삭제하시겠습니까?"))
            return;
        await fetch(`http://localhost:3000/api/admin/books/${bookId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        loadBooks();
    }
</script>

<div class="tab-books">
    <section class="card upload-section">
        <h3>새 전자책 업로드 및 메타데이터 등록</h3>
        <form
            onsubmit={(e) => {
                e.preventDefault();
                handleSubmit();
            }}
        >
            <div class="form-grid">
                <input
                    type="text"
                    placeholder="도서 식별자 ID (예: book_01)"
                    bind:value={id}
                    required
                />
                <input
                    type="text"
                    placeholder="도서명"
                    bind:value={title}
                    required
                />
                <input
                    type="text"
                    placeholder="저자명"
                    bind:value={author}
                    required
                />
                <input
                    type="text"
                    placeholder="출판사"
                    bind:value={publisher}
                />
                <input
                    type="number"
                    placeholder="판매가 (원)"
                    bind:value={price}
                    required
                />
                <input
                    type="number"
                    placeholder="정가 (원)"
                    bind:value={originalPrice}
                />
                <input
                    type="text"
                    placeholder="한 줄 소개"
                    bind:value={desc}
                    class="span-full"
                />
            </div>

            <div class="file-uploads-grid">
                <label>
                    <span>표지 이미지 (.jpg/.png)*</span>
                    <input
                        type="file"
                        accept="image/*"
                        onchange={(e) =>
                            (thumbnailFile =
                                e.currentTarget.files?.[0] || null)}
                    />
                </label>
                <label>
                    <span>영상 표지 (.mp4, 선택)</span>
                    <input
                        type="file"
                        accept="video/mp4"
                        onchange={(e) =>
                            (videoFile = e.currentTarget.files?.[0] || null)}
                    />
                </label>
                <label>
                    <span>상세 소개 본문 (.txt, 선택)</span>
                    <input
                        type="file"
                        accept=".txt"
                        onchange={(e) =>
                            (descFile = e.currentTarget.files?.[0] || null)}
                    />
                </label>
                <label class="highlight">
                    <span>🌟 정식 원본 EPUB (.epub)*</span>
                    <input
                        type="file"
                        accept=".epub"
                        onchange={(e) =>
                            (epubFile = e.currentTarget.files?.[0] || null)}
                    />
                </label>
                <label class="highlight">
                    <span>🌟 5페이지 맛보기 EPUB (.epub, 선택)</span>
                    <input
                        type="file"
                        accept=".epub"
                        onchange={(e) =>
                            (previewEpubFile =
                                e.currentTarget.files?.[0] || null)}
                    />
                </label>
            </div>

            <button type="submit" class="btn-submit"
                >도서 등록 및 파일 업로드 시작</button
            >
        </form>
    </section>

    <section class="card list-section">
        <h3>등록된 도서 목록 ({books.length}권)</h3>
        <div class="table-scroll-wrap">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>제목</th>
                        <th>저자</th>
                        <th>가격</th>
                        <th>맛보기 파일</th>
                        <th>노출 상태</th>
                        <th>관리</th>
                    </tr>
                </thead>
                <tbody>
                    {#if books.length === 0}
                        <tr
                            ><td colspan="7" class="empty"
                                >등록된 도서가 없습니다.</td
                            ></tr
                        >
                    {/if}
                    {#each books as b}
                        <tr>
                            <td><code>{b.id}</code></td>
                            <td><strong>{b.title}</strong></td>
                            <td>{b.author}</td>
                            <td>{b.price.toLocaleString()}원</td>
                            <td>
                                {#if b.preview_epub_url}
                                    <span class="badge green">5p 준비됨</span>
                                {:else}
                                    <span class="badge gray">미등록</span>
                                {/if}
                            </td>
                            <td>
                                <button
                                    class="status-badge {b.is_active
                                        ? 'active'
                                        : 'hidden'}"
                                    onclick={() => toggleActive(b.id)}
                                >
                                    {b.is_active ? "판매 중" : "숨김"}
                                </button>
                            </td>
                            <td>
                                <button
                                    class="btn-del"
                                    onclick={() => deleteBook(b.id)}
                                    >삭제</button
                                >
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </section>
</div>

<style>
    .tab-books {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
    }
    .card {
        background: #16161a;
        border: 1px solid #282834;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        box-sizing: border-box;
    }
    h3 {
        margin: 0 0 16px 0;
        font-size: 15px;
        color: #e1e1e8;
    }

    .form-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 14px;
    }
    .span-full {
        grid-column: span 4;
    }

    input[type="text"],
    input[type="number"] {
        width: 100%;
        padding: 10px 12px;
        background: #22222a;
        border: 1px solid #343444;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        box-sizing: border-box;
    }

    .file-uploads-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px;
        margin-bottom: 18px;
    }
    label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 12px;
        color: #aaa;
        background: #1e1e26;
        padding: 10px;
        border-radius: 8px;
        border: 1px dashed #3a3a4c;
        box-sizing: border-box;
    }
    label.highlight {
        border-color: #0a84ff;
        background: rgba(10, 132, 255, 0.08);
        color: #fff;
    }
    input[type="file"] {
        font-size: 11px;
        color: #888;
        width: 100%;
    }

    .btn-submit {
        width: 100%;
        padding: 13px;
        background: #0a84ff;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
    }

    /* 🌟 반응형 테이블 가로 스크롤 컨테이너 */
    .table-scroll-wrap {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
    .admin-table {
        width: 100%;
        min-width: 640px;
        border-collapse: collapse;
        font-size: 13px;
        text-align: left;
    }
    .admin-table th,
    .admin-table td {
        padding: 12px 14px;
        border-bottom: 1px solid #242430;
        white-space: nowrap;
    }
    .admin-table th {
        color: #888;
        font-weight: 500;
    }
    .badge {
        padding: 3px 6px;
        border-radius: 4px;
        font-size: 11px;
    }
    .badge.green {
        background: rgba(48, 209, 88, 0.15);
        color: #30d158;
    }
    .badge.gray {
        background: #262630;
        color: #777;
    }
    .status-badge {
        padding: 4px 10px;
        border-radius: 12px;
        border: none;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
    }
    .status-badge.active {
        background: #30d158;
        color: #000;
    }
    .status-badge.hidden {
        background: #3a3a48;
        color: #aaa;
    }
    .btn-del {
        padding: 5px 10px;
        background: rgba(255, 59, 48, 0.15);
        border: none;
        color: #ff453a;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }
    .empty {
        text-align: center;
        color: #777;
        padding: 28px !important;
    }

    @media (max-width: 900px) {
        .form-grid {
            grid-template-columns: repeat(2, 1fr);
        }
        .span-full {
            grid-column: span 2;
        }
    }

    @media (max-width: 580px) {
        .card {
            padding: 14px;
        }
        .form-grid {
            grid-template-columns: 1fr;
        }
        .span-full {
            grid-column: span 1;
        }
        .file-uploads-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
