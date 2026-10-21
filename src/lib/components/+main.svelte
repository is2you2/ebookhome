<script lang="ts">
    import {
        currentBook,
        isReadingMode,
        TransferAct,
        type BookInfo,
    } from "$lib/services/global.svelte";
    import {
        currentUser,
        clearToken,
        fetchMyBooks,
    } from "$lib/services/server.svelte";
    import Login from "./+login.svelte";
    import { fade } from "svelte/transition";

    type TabType = "myBooks" | "store" | "profile";
    let activeTab = $state<TabType>("store");

    type ModalType = "business" | "terms" | "privacy" | "license" | null;
    let openModal = $state<ModalType>(null);

    let BookList = $state<BookInfo[]>([]);

    let StoreList = $state<BookInfo[]>([
        {
            id: "test_book_id_0",
            title: "바이블일러스트큐티",
            desc: "말풍선 글짓기 QT",
            thumbnail: "assets/books/00/thumbnail.jpg",
            video_thumbnail: "assets/books/00/cover.mp4",
            epub_url: "assets/books/00/book.epub",
            purchase_time: 0,
            author: "최정훈",
            price: 10000,
        },
        {
            id: "store_book_id_0",
            title: "새로운 비디오 책 샘플",
            thumbnail: "assets/thumbnail2.jpg",
            video_thumbnail: "assets/vid_cover_sample2.mp4",
            epub_url: "assets/02.epub",
            purchase_time: 0,
            author: "작자미상",
            price: 15000,
        },
    ]);

    $effect(() => {
        if (currentUser.value && activeTab === "myBooks") {
            fetchMyBooks().then((books) => {
                if (books && books.length > 0) {
                    BookList = books;
                }
            });
        }
    });

    const readBook = (book: BookInfo) => {
        currentBook.value = book;
        isReadingMode.value = true;
    };

    function handleLogout() {
        if (confirm("로그아웃 하시겠습니까?")) {
            clearToken();
            activeTab = "store"; // 로그아웃 후 스토어 둘러보기로 안전 전환
        }
    }
</script>

<div id="canvas-container">
    {#if isReadingMode.value}
        <button
            class="back-to-ui-btn"
            onclick={() => {
                isReadingMode.value = false;
                TransferAct["OpenBookList"]?.();
            }}
        >
            ← 내 서재로 돌아가기
        </button>
    {/if}
</div>

{#if !isReadingMode.value}
    <div class="ui-overlay" transition:fade>
        <main class="dashboard-box">
            <header class="tab-header">
                <button
                    class="tab-btn {activeTab === 'myBooks' ? 'active' : ''}"
                    onclick={() => (activeTab = "myBooks")}>내 서재</button
                >
                <button
                    class="tab-btn {activeTab === 'store' ? 'active' : ''}"
                    onclick={() => (activeTab = "store")}>전체 도서</button
                >
                <button
                    class="tab-btn {activeTab === 'profile' ? 'active' : ''}"
                    onclick={() => (activeTab = "profile")}>내 정보</button
                >
            </header>

            <section class="tab-content">
                <!-- [탭 1] 내 서재 -->
                {#if activeTab === "myBooks"}
                    {#if !currentUser.value}
                        <!-- 🌟 미로그인 시 탭 안에 자연스럽게 배치되는 로그인 카드 -->
                        <Login
                            title="내 서재"
                            description="구매한 책을 확인하고 이어서 읽으려면 로그인해 주세요."
                        />
                    {:else}
                        <div class="content-header">
                            <h2>읽고 있는 책</h2>
                            <div class="search-bar">
                                <input
                                    type="text"
                                    placeholder="내 서재 검색..."
                                />
                            </div>
                        </div>
                        <div class="book-grid">
                            {#each BookList as book}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div
                                    class="book-card"
                                    onclick={() => readBook(book)}
                                >
                                    <div class="book-cover">
                                        {#if book.video_thumbnail}
                                            <video
                                                src={book.video_thumbnail}
                                                autoplay
                                                loop
                                                muted
                                                playsinline
                                                class="cover-media"
                                            ></video>
                                        {:else}
                                            <img
                                                src={book.thumbnail}
                                                alt={book.title}
                                                class="cover-media"
                                            />
                                        {/if}
                                    </div>
                                    <div class="book-info">
                                        <h3>{book.title}</h3>
                                        <p>읽음 {book.progress || 0}%</p>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}

                    <!-- [탭 2] 전체 도서 (로그인 없이 항상 둘러보기 가능) -->
                {:else if activeTab === "store"}
                    <div class="content-header">
                        <h2>새로운 도서 탐색</h2>
                        <div class="search-bar">
                            <input type="text" placeholder="스토어 검색..." />
                        </div>
                    </div>
                    <div class="book-grid">
                        {#each StoreList as book}
                            <div class="book-card store-card">
                                <div class="book-cover">
                                    {#if book.video_thumbnail}
                                        <video
                                            src={book.video_thumbnail}
                                            autoplay
                                            loop
                                            muted
                                            playsinline
                                            class="cover-media"
                                        ></video>
                                    {:else}
                                        <img
                                            src={book.thumbnail}
                                            alt={book.title}
                                            class="cover-media"
                                        />
                                    {/if}
                                </div>
                                <div class="book-info">
                                    <h3>{book.title}</h3>
                                    <p>
                                        {book.price
                                            ? `${book.price.toLocaleString()}원`
                                            : "무료"}
                                    </p>
                                </div>
                                <button class="buy-btn">구매하기</button>
                            </div>
                        {/each}
                    </div>

                    <!-- [탭 3] 내 정보 -->
                {:else if activeTab === "profile"}
                    {#if !currentUser.value}
                        <!-- 🌟 미로그인 시 탭 안에 자연스럽게 배치되는 로그인 카드 -->
                        <Login
                            title="계정 정보"
                            description="계정 설정 및 구매 내역을 관리하려면 로그인해 주세요."
                        />
                    {:else}
                        <div class="profile-container">
                            <div class="profile-header">
                                <div class="avatar"></div>
                                <div class="user-info">
                                    <h2>
                                        {currentUser.value.email ||
                                            "user@email.com"}
                                    </h2>
                                    <p>인증된 계정</p>
                                </div>
                            </div>

                            <h3 class="section-title">계정 설정</h3>
                            <ul class="settings-list">
                                <li>
                                    <span>계정 연동 관리</span>
                                    <button class="action-btn">관리</button>
                                </li>
                                <li>
                                    <span>비밀번호 변경</span>
                                    <button class="action-btn">변경</button>
                                </li>
                            </ul>

                            <h3 class="section-title">앱 정보</h3>
                            <ul class="settings-list legal-list">
                                <li>
                                    <span>사업자 정보</span>
                                    <button
                                        class="text-btn"
                                        onclick={() => (openModal = "business")}
                                        >보기</button
                                    >
                                </li>
                                <li>
                                    <span>이용약관 및 정책</span>
                                    <button
                                        class="text-btn"
                                        onclick={() => (openModal = "terms")}
                                        >보기</button
                                    >
                                </li>
                                <li>
                                    <span>개인정보처리방침</span>
                                    <button
                                        class="text-btn"
                                        onclick={() => (openModal = "privacy")}
                                        >보기</button
                                    >
                                </li>
                                <li>
                                    <span>오픈소스 라이선스</span>
                                    <button
                                        class="text-btn"
                                        onclick={() => (openModal = "license")}
                                        >보기</button
                                    >
                                </li>
                            </ul>

                            <div class="danger-zone">
                                <button
                                    class="logout-btn"
                                    onclick={handleLogout}
                                >
                                    로그아웃
                                </button>
                                <button class="delete-account-btn"
                                    >회원 탈퇴</button
                                >
                            </div>
                        </div>
                    {/if}
                {/if}
            </section>

            <!-- 법적 정보 모달 레이어 -->
            {#if openModal !== null}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="modal-backdrop"
                    transition:fade
                    onclick={() => (openModal = null)}
                >
                    <article
                        class="modal-box"
                        onclick={(e) => e.stopPropagation()}
                    >
                        <div class="modal-header">
                            <h3>
                                {#if openModal === "business"}사업자 정보
                                {:else if openModal === "terms"}이용약관
                                {:else if openModal === "privacy"}개인정보처리방침
                                {:else if openModal === "license"}오픈소스
                                    라이선스{/if}
                            </h3>
                            <button
                                class="close-btn"
                                onclick={() => (openModal = null)}>✕</button
                            >
                        </div>
                        <div class="modal-body">
                            {#if openModal === "business"}
                                <p><strong>상호:</strong> 윗샘과아랫샘</p>
                                <p><strong>대표자:</strong> 최정훈</p>
                                <p>
                                    <strong>사업자등록번호:</strong> 123-45-67890
                                </p>
                                <p>
                                    <strong>통신판매업신고:</strong> 2026-서울강남-0000
                                </p>
                                <p>
                                    <strong>이메일:</strong> support@oobooks.com
                                </p>
                            {:else if openModal === "license"}
                                <p>
                                    본 애플리케이션은 아래의 오픈소스
                                    소프트웨어를 사용합니다.
                                </p>
                                <ul>
                                    <li>Svelte (MIT License)</li>
                                    <li>Three.js (MIT License)</li>
                                    <li>node:sqlite (Node.js Native)</li>
                                </ul>
                            {:else}
                                <p>제 1조 (목적)...</p>
                            {/if}
                        </div>
                    </article>
                </div>
            {/if}
        </main>
    </div>
{/if}

<style>
    /* 기존 스타일 그대로 유지 */
    :global(body),
    :global(html) {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        font-family:
            "Pretendard",
            -apple-system,
            sans-serif;
        background-color: #000;
        color: #fff;
    }
    :global(*) {
        box-sizing: border-box;
    }

    #canvas-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .back-to-ui-btn {
        position: absolute;
        top: 20px;
        left: 20px;
        padding: 12px 20px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 30px;
        backdrop-filter: blur(4px);
        cursor: pointer;
        font-weight: 600;
        pointer-events: all;
    }
    .back-to-ui-btn:hover {
        background: rgba(0, 0, 0, 0.8);
    }

    .ui-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
    }

    .dashboard-box {
        width: 100%;
        max-width: 900px;
        height: 85vh;
        display: flex;
        flex-direction: column;
        background: rgba(25, 25, 25, 0.4);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 24px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        overflow: hidden;
    }

    .tab-header {
        display: flex;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .tab-btn {
        flex: 1;
        padding: 20px 0;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
    }
    .tab-btn:hover {
        color: rgba(255, 255, 255, 0.8);
        background: rgba(255, 255, 255, 0.02);
    }
    .tab-btn.active {
        color: #fff;
        border-bottom: 2px solid #fff;
        background: rgba(255, 255, 255, 0.05);
    }

    .tab-content {
        flex: 1;
        padding: 30px;
        overflow-y: auto;
    }

    .content-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
    }
    .content-header h2 {
        font-size: 22px;
        margin: 0;
    }
    .search-bar input {
        padding: 10px 16px;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
        color: white;
        outline: none;
    }
    .search-bar input:focus {
        border-color: rgba(255, 255, 255, 0.5);
    }

    .book-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 24px;
    }
    .book-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 12px;
        cursor: pointer;
        transition:
            transform 0.2s,
            background 0.2s;
    }
    .book-card:hover {
        transform: translateY(-5px);
        background: rgba(255, 255, 255, 0.08);
    }

    .book-cover {
        width: 100%;
        aspect-ratio: 2/3;
        background: rgba(25, 25, 25, 0.4);
        border-radius: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 12px;
        overflow: hidden;
        position: relative;
    }

    .cover-media {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .book-info h3 {
        font-size: 15px;
        margin: 0 0 4px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .book-info p {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
        margin: 0;
    }

    .buy-btn {
        width: 100%;
        padding: 8px;
        margin-top: 12px;
        border-radius: 6px;
        border: none;
        background: #fff;
        color: #000;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }
    .buy-btn:hover {
        background: #e0e0e0;
    }

    .profile-container {
        max-width: 600px;
        margin: 0 auto;
    }
    .profile-header {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 40px;
        padding-bottom: 30px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    .user-info h2 {
        margin: 0 0 8px 0;
    }
    .user-info p {
        margin: 0;
        color: #4facfe;
        font-weight: 600;
        font-size: 14px;
    }

    .settings-list {
        list-style: none;
        padding: 0;
        margin: 0 0 40px 0;
    }
    .settings-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .action-btn {
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
        color: white;
        cursor: pointer;
    }
    .action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .danger-zone {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .logout-btn,
    .delete-account-btn {
        width: 100%;
        padding: 14px;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        border: none;
    }
    .logout-btn {
        background: rgba(255, 255, 255, 0.1);
        color: white;
    }
    .delete-account-btn {
        background: rgba(255, 59, 48, 0.1);
        color: #ff3b30;
    }
    .logout-btn:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    .delete-account-btn:hover {
        background: rgba(255, 59, 48, 0.2);
    }

    .section-title {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.5);
        margin: 0 0 10px 10px;
        font-weight: 600;
    }

    .legal-list {
        margin-bottom: 40px;
    }

    .text-btn {
        background: none;
        border: none;
        color: #4facfe;
        font-size: 14px;
        cursor: pointer;
        padding: 4px 8px;
    }
    .text-btn:hover {
        text-decoration: underline;
    }

    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
    }

    .modal-box {
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        background: rgba(30, 30, 30, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        color: #fff;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .modal-header h3 {
        margin: 0;
        font-size: 18px;
    }
    .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.6;
    }
    .close-btn:hover {
        opacity: 1;
    }

    .modal-body {
        padding: 20px;
        overflow-y: auto;
        font-size: 14px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.8);
    }
</style>
