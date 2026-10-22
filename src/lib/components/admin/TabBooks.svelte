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
    let isSubmitting = $state(false);

    let id = $state("");
    let title = $state("");
    let author = $state("");
    let publisher = $state("");
    let price = $state<number>(10000);
    let originalPrice = $state<number>(13000);
    let desc = $state("");

    let videoFile: File | null = null;
    let descFile: File | null = null;
    let epubFile: File | null = null;

    // 🌟 안전한 도서 목록 수신 함수
    async function loadBooks() {
        if (!adminToken) return;
        isLoading = true;
        try {
            const res = await fetch("http://localhost:3000/api/admin/books", {
                headers: { Authorization: `Bearer ${adminToken}` },
            });
            const data = await res.json();

            if (!res.ok) {
                console.error(
                    "도서 목록 로드 실패 (HTTP " + res.status + "):",
                    data,
                );
                books = [];
                return;
            }

            // 배열 형태 응답만 안전하게 바인딩
            books = Array.isArray(data) ? data : [];
        } catch (e) {
            console.error("도서 목록 통신 에러:", e);
            books = [];
        } finally {
            isLoading = false;
        }
    }

    $effect(() => {
        loadBooks();
    });

    async function handleSubmit() {
        if (!epubFile) {
            alert("정식 원본 EPUB 파일을 선택해 주세요.");
            return;
        }

        isSubmitting = true;
        const formData = new FormData();
        formData.append("id", id);
        formData.append("title", title);
        formData.append("author", author);
        formData.append("publisher", publisher);
        formData.append("price", String(price));
        formData.append("original_price", String(originalPrice));
        formData.append("desc", desc);

        formData.append("epub_file", epubFile);
        if (videoFile) formData.append("video_thumbnail", videoFile);
        if (descFile) formData.append("desc_file", descFile);

        try {
            const res = await fetch("http://localhost:3000/api/admin/books", {
                method: "POST",
                headers: { Authorization: `Bearer ${adminToken}` },
                body: formData,
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            alert(
                "도서가 등록되었습니다.\n(첫 장 표지 추출 및 5페이지 맛보기 파일이 자동 생성되었습니다)",
            );
            id = "";
            title = "";
            author = "";
            publisher = "";
            desc = "";
            videoFile = null;
            descFile = null;
            epubFile = null;

            // 🌟 등록 즉시 목록 비동기 동기화
            await loadBooks();
        } catch (err: any) {
            alert(`등록 실패: ${err.message}`);
        } finally {
            isSubmitting = false;
        }
    }

    async function toggleActive(bookId: string) {
        await fetch(`http://localhost:3000/api/admin/books/${bookId}/toggle`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        await loadBooks();
    }

    async function deleteBook(bookId: string) {
        if (!confirm("정말 이 도서와 모든 관련 파일을 삭제하시겠습니까?"))
            return;
        await fetch(`http://localhost:3000/api/admin/books/${bookId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        await loadBooks();
    }
</script>

<div class="tab-books">
    <section class="card upload-section">
        <h3>도서 등록 (원본 EPUB 1개로 자동 가공)</h3>
        <p class="guide-desc">
            정식 원본 EPUB 1개만 업로드하면, <strong
                >첫 번째 장을 표지 이미지로 자동 추출</strong
            >하고
            <strong>5페이지 이후를 백지화한 맛보기 파일이 자동 생성</strong
            >됩니다.
        </p>

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
                <label class="highlight">
                    <span>🌟 정식 원본 EPUB (.epub)* [필수]</span>
                    <input
                        type="file"
                        accept=".epub"
                        onchange={(e) =>
                            (epubFile = e.currentTarget.files?.[0] || null)}
                        required
                    />
                </label>
                <label>
                    <span>영상 표지 (.mp4, 선택 옵션)</span>
                    <input
                        type="file"
                        accept="video/mp4"
                        onchange={(e) =>
                            (videoFile = e.currentTarget.files?.[0] || null)}
                    />
                </label>
                <label>
                    <span>작품 상세 소개글 (.txt, 선택 옵션)</span>
                    <input
                        type="file"
                        accept=".txt"
                        onchange={(e) =>
                            (descFile = e.currentTarget.files?.[0] || null)}
                    />
                </label>
            </div>

            <button type="submit" class="btn-submit" disabled={isSubmitting}>
                {isSubmitting
                    ? "EPUB 분석 및 자동 생성 중..."
                    : "도서 등록 및 자동 가공 실행"}
            </button>
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
                        <tr>
                            <td colspan="7" class="empty">
                                {isLoading
                                    ? "도서 목록을 불러오는 중입니다..."
                                    : "등록된 도서가 없습니다."}
                            </td>
                        </tr>
                    {:else}
                        {#each books as b}
                            <tr>
                                <td><code>{b.id}</code></td>
                                <td><strong>{b.title}</strong></td>
                                <td>{b.author}</td>
                                <td
                                    >{b.price
                                        ? b.price.toLocaleString()
                                        : "0"}원</td
                                >
                                <td>
                                    {#if b.preview_epub_url}
                                        <span class="badge green"
                                            >자동 생성 완료</span
                                        >
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
                    {/if}
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
        margin: 0 0 6px 0;
        font-size: 15px;
        color: #e1e1e8;
    }
    .guide-desc {
        margin: 0 0 16px 0;
        font-size: 13px;
        color: #8e8e9a;
        line-height: 1.5;
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
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
        padding: 12px;
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
    .btn-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

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
