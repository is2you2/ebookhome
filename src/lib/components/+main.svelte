<!-- src/lib/components/+main.svelte -->
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
        authToken,
    } from "$lib/services/server.svelte";
    import Login from "./+login.svelte";
    import { fade } from "svelte/transition";
    import * as PortOne from "@portone/browser-sdk/v2";
    import BookDetail from "./+BookDetail.svelte";

    type TabType = "store" | "myBooks" | "profile";
    let activeTab = $state<TabType>("store");

    type ModalType = "business" | "terms" | "privacy" | "license" | null;
    let openModal = $state<ModalType>(null);

    let selectedBook = $state<BookInfo | null>(null);
    let isProcessingPayment = $state<boolean>(false);
    let searchQuery = $state<string>("");

    // 구매한 도서 목록
    let BookList = $state<BookInfo[]>([]);

    // 스토어 판매 도서 목록
    let StoreList = $state<BookInfo[]>([
        {
            id: "test_book_id_0",
            title: "바이블일러스트큐티",
            desc: "말풍선 글짓기 QT",
            description_url: "assets/books/00/desc.txt",
            thumbnail: "assets/books/00/thumbnail.jpg",
            video_thumbnail: "assets/books/00/cover.mp4",
            epub_url: "assets/books/00/book.epub",
            purchase_time: 0,
            author: "최정훈",
            publisher: "윗샘과아랫샘",
            price: 10000,
            original_price: 13000,
            rating: 4.9,
            rating_count: 42,
        },
        {
            id: "store_book_id_0",
            title: "새로운 비디오 책 샘플",
            desc: "영상 표지가 포함된 샘플 전자책",
            description_url: "assets/books/01/desc.txt",
            thumbnail: "assets/thumbnail2.jpg",
            video_thumbnail: "assets/vid_cover_sample2.mp4",
            epub_url: "assets/02.epub",
            purchase_time: 0,
            author: "작자미상",
            publisher: "디지털북스",
            price: 15000,
            original_price: 15000,
            rating: 4.5,
            rating_count: 12,
        },
    ]);

    // 검색 필터링 목록
    let filteredStoreList = $derived(
        StoreList.filter(
            (b) =>
                b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.author.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    );

    let filteredBookList = $derived(
        BookList.filter(
            (b) =>
                b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.author.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    );

    // 로그인 상태이거나 '내 서재' 탭 활성화 시 구매 도서 자동 갱신
    $effect(() => {
        if (currentUser.value && activeTab === "myBooks") {
            fetchMyBooks().then((books) => {
                if (books) {
                    BookList = books;
                }
            });
        }
    });

    const readBook = (book: BookInfo) => {
        selectedBook = null;
        currentBook.value = book;
        isReadingMode.value = true;
    };

    function handleOpenDetail(book: BookInfo) {
        selectedBook = book;
    }

    // src/lib/components/+main.svelte 내부 handleBuy 함수 수정

    async function handleBuy(book: BookInfo) {
        if (!currentUser.value) {
            alert("도서를 구매하시려면 먼저 로그인이 필요합니다.");
            selectedBook = null;
            activeTab = "myBooks";
            return;
        }

        if (isProcessingPayment) return;
        isProcessingPayment = true;

        try {
            const paymentId = `order_${book.id}_${Date.now()}`;

            // 🌟 customer 객체(이메일 필수)를 추가하여 결제창 호출
            const response = await PortOne.requestPayment({
                storeId: "store-9352c37c-53cf-4a35-a7cc-6659cf12a5cb",
                channelKey: "channel-key-ad3a06df-a43f-43c3-9713-237ea248c7a0",
                paymentId: paymentId,
                orderName: book.title,
                totalAmount: book.price || 0,
                currency: "CURRENCY_KRW",
                payMethod: "CARD",
                customer: {
                    email: currentUser.value.email,
                    fullName: "구매자",
                },
            });

            if (response?.code != null) {
                alert(`결제가 취소되었습니다: ${response.message}`);
                return;
            }

            // 2. 서버로 결제 위변조 검증 요청
            const verifyRes = await fetch(
                "http://localhost:3000/api/payments/complete",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authToken.value}`,
                    },
                    body: JSON.stringify({
                        paymentId: response.paymentId,
                        bookId: book.id,
                    }),
                },
            );

            const result = await verifyRes.json();
            if (!verifyRes.ok) {
                throw new Error(result.error || "결제 검증에 실패했습니다.");
            }

            alert(`'${book.title}' 도서 결제가 완료되었습니다!`);
            selectedBook = null;

            // 내 서재 목록 갱신 후 내 서재 탭으로 이동
            const updatedBooks = await fetchMyBooks();
            if (updatedBooks) BookList = updatedBooks;
            activeTab = "myBooks";
        } catch (err: any) {
            console.error("결제 처리 에러:", err);
            alert(`결제 처리 중 오류가 발생했습니다: ${err.message}`);
        } finally {
            isProcessingPayment = false;
        }
    }

    function handleLogout() {
        if (confirm("로그아웃 하시겠습니까?")) {
            clearToken();
            BookList = [];
            activeTab = "store";
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
                    class="tab-btn {activeTab === 'store' ? 'active' : ''}"
                    onclick={() => {
                        activeTab = "store";
                        searchQuery = "";
                    }}>전체 도서</button
                >
                <button
                    class="tab-btn {activeTab === 'myBooks' ? 'active' : ''}"
                    onclick={() => {
                        activeTab = "myBooks";
                        searchQuery = "";
                    }}>내 서재</button
                >
                <button
                    class="tab-btn {activeTab === 'profile' ? 'active' : ''}"
                    onclick={() => {
                        activeTab = "profile";
                        searchQuery = "";
                    }}>내 정보</button
                >
            </header>

            <section class="tab-content">
                <!-- [탭 1] 전체 도서 (비로그인 기본 노출) -->
                {#if activeTab === "store"}
                    <div class="content-header">
                        <h2>새로운 도서 탐색</h2>
                        <div class="search-bar">
                            <input
                                type="text"
                                placeholder="도서명 또는 저자 검색..."
                                bind:value={searchQuery}
                            />
                        </div>
                    </div>

                    <div class="book-grid">
                        {#each filteredStoreList as book}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="book-card store-card"
                                onclick={() => handleOpenDetail(book)}
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
                                    <p class="author">{book.author}</p>
                                    <div class="price-row">
                                        {#if book.price}
                                            <span class="price-val"
                                                >{book.price.toLocaleString()}원</span
                                            >
                                            {#if book.original_price && book.original_price > book.price}
                                                <span class="discount-tag"
                                                    >{Math.round(
                                                        ((book.original_price -
                                                            book.price) /
                                                            book.original_price) *
                                                            100,
                                                    )}%</span
                                                >
                                            {/if}
                                        {:else}
                                            <span class="price-val free"
                                                >무료</span
                                            >
                                        {/if}
                                    </div>
                                </div>
                                <button
                                    class="buy-action-btn"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleBuy(book);
                                    }}
                                >
                                    구매하기
                                </button>
                            </div>
                        {/each}
                    </div>

                    <!-- [탭 2] 내 서재 -->
                {:else if activeTab === "myBooks"}
                    {#if !currentUser.value}
                        <Login
                            title="내 서재"
                            description="구매한 책을 확인하고 3D 뷰어로 읽으시려면 로그인해 주세요."
                        />
                    {:else}
                        <div class="content-header">
                            <h2>보유 중인 도서</h2>
                            <div class="search-bar">
                                <input
                                    type="text"
                                    placeholder="내 서재 검색..."
                                    bind:value={searchQuery}
                                />
                            </div>
                        </div>

                        {#if filteredBookList.length === 0}
                            <div class="empty-state">
                                <p>보유 중인 도서가 없습니다.</p>
                                <button
                                    class="text-link-btn"
                                    onclick={() => (activeTab = "store")}
                                    >스토어에서 새로운 책 둘러보기 →</button
                                >
                            </div>
                        {:else}
                            <div class="book-grid">
                                {#each filteredBookList as book}
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
                                            <p class="progress-text">
                                                진행률 {book.progress || 0}%
                                            </p>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    {/if}

                    <!-- [탭 3] 내 정보 -->
                {:else if activeTab === "profile"}
                    {#if !currentUser.value}
                        <Login
                            title="계정 정보"
                            description="구매 내역 및 계정 설정을 확인하려면 로그인해 주세요."
                        />
                    {:else}
                        <div class="profile-container">
                            <div class="profile-header">
                                <div class="avatar"></div>
                                <div class="user-info">
                                    <h2>
                                        {currentUser.value.email ||
                                            "사용자 계정"}
                                    </h2>
                                    <p>인증된 회원</p>
                                </div>
                            </div>

                            <h3 class="section-title">계정 관리</h3>
                            <ul class="settings-list">
                                <li>
                                    <span>계정 고유 식별자</span>
                                    <span class="text-muted"
                                        >UID #{currentUser.value.id}</span
                                    >
                                </li>
                                <li>
                                    <span>비밀번호 관리</span>
                                    <button class="action-btn">변경</button>
                                </li>
                            </ul>

                            <h3 class="section-title">서비스 정보</h3>
                            <ul class="settings-list legal-list">
                                <li>
                                    <span>사업자 정보 확인</span>
                                    <button
                                        class="text-btn"
                                        onclick={() => (openModal = "business")}
                                        >보기</button
                                    >
                                </li>
                                <li>
                                    <span>이용약관 및 운영정책</span>
                                    <button
                                        class="text-btn"
                                        onclick={() => (openModal = "terms")}
                                        >보기</button
                                    >
                                </li>
                                <li>
                                    <span>개인정보 처리방침</span>
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
                                    onclick={handleLogout}>로그아웃</button
                                >
                                <button class="delete-account-btn"
                                    >회원 탈퇴 요청</button
                                >
                            </div>
                        </div>
                    {/if}
                {/if}
            </section>

            <!-- 도서 상세 정보 모달 레이어 -->
            {#if selectedBook !== null}
                <BookDetail
                    book={selectedBook}
                    isPurchased={BookList.some(
                        (b) => b.id === selectedBook?.id,
                    )}
                    onclose={() => (selectedBook = null)}
                    onbuy={handleBuy}
                    onread={readBook}
                />
            {/if}

            <!-- 법적 정보 모달 레이어 -->
            {#if openModal !== null}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="modal-backdrop"
                    transition:fade={{ duration: 150 }}
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
                                    <strong>고객센터:</strong> support@oobooks.com
                                </p>
                            {:else if openModal === "license"}
                                <p>
                                    본 소프트웨어는 다음의 오픈소스 패키지를
                                    활용하여 개발되었습니다.
                                </p>
                                <ul>
                                    <li>Svelte 5 (MIT License)</li>
                                    <li>Three.js (MIT License)</li>
                                    <li>node:sqlite (Node.js Foundation)</li>
                                    <li>PortOne Browser SDK (Apache-2.0)</li>
                                </ul>
                            {:else}
                                <p>
                                    제 1조 (목적) 본 약관은 서비스 제공자와
                                    이용자 간의 권리 및 의무를 규정합니다...
                                </p>
                            {/if}
                        </div>
                    </article>
                </div>
            {/if}
        </main>
    </div>
{/if}

<style>
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
            BlinkMacSystemFont,
            system-ui,
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
        background: rgba(0, 0, 0, 0.65);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 30px;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        cursor: pointer;
        font-weight: 600;
        pointer-events: all;
        transition: background 0.2s;
    }
    .back-to-ui-btn:hover {
        background: rgba(0, 0, 0, 0.85);
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
        max-width: 920px;
        height: 85vh;
        display: flex;
        flex-direction: column;
        background: rgba(22, 22, 22, 0.65);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 24px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
        overflow: hidden;
    }

    .tab-header {
        display: flex;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .tab-btn {
        flex: 1;
        padding: 18px 0;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.45);
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
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

    /* 🌟 Flex 기반 컨테이너로 미로그인 시 로그인 폼 수직 정중앙 정렬 지원 */
    .tab-content {
        flex: 1;
        padding: 28px 32px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }

    .content-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 22px;
    }
    .content-header h2 {
        font-size: 20px;
        margin: 0;
        font-weight: 700;
    }
    .search-bar input {
        padding: 10px 18px;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.05);
        color: white;
        outline: none;
        font-size: 13px;
        width: 220px;
        transition: border-color 0.2s;
    }
    .search-bar input:focus {
        border-color: rgba(255, 255, 255, 0.5);
    }

    .book-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 22px;
    }

    .book-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 14px;
        padding: 12px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        transition:
            transform 0.2s,
            background 0.2s,
            border-color 0.2s;
    }
    .book-card:hover {
        transform: translateY(-4px);
        background: rgba(255, 255, 255, 0.07);
        border-color: rgba(255, 255, 255, 0.18);
    }

    .book-cover {
        width: 100%;
        aspect-ratio: 2/3;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 12px;
    }
    .cover-media {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .book-info {
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    .book-info h3 {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 4px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .book-info .author {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        margin: 0 0 6px 0;
    }
    .progress-text {
        font-size: 12px;
        color: #4facfe;
        margin: 0;
        font-weight: 500;
    }

    .price-row {
        margin-top: auto;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .price-val {
        font-size: 14px;
        font-weight: 700;
    }
    .price-val.free {
        color: #30d158;
    }
    .discount-tag {
        font-size: 12px;
        font-weight: 700;
        color: #ff453a;
    }

    .buy-action-btn {
        width: 100%;
        padding: 8px;
        margin-top: 10px;
        border-radius: 8px;
        border: none;
        background: #ffffff;
        color: #000;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }
    .buy-action-btn:hover {
        background: #e6e6e6;
    }

    .empty-state {
        margin: auto;
        text-align: center;
        color: rgba(255, 255, 255, 0.4);
        padding: 40px 0;
    }
    .text-link-btn {
        background: none;
        border: none;
        color: #4facfe;
        margin-top: 10px;
        cursor: pointer;
        font-size: 14px;
    }

    .profile-container {
        max-width: 580px;
        width: 100%;
        margin: 0 auto;
    }
    .profile-header {
        display: flex;
        align-items: center;
        gap: 18px;
        margin-bottom: 32px;
        padding-bottom: 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: linear-gradient(135deg, #007aff 0%, #00f2fe 100%);
    }
    .user-info h2 {
        font-size: 18px;
        margin: 0 0 4px 0;
    }
    .user-info p {
        margin: 0;
        color: #007aff;
        font-weight: 600;
        font-size: 13px;
    }

    .section-title {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.45);
        margin: 0 0 10px 8px;
        font-weight: 600;
    }
    .settings-list {
        list-style: none;
        padding: 0;
        margin: 0 0 32px 0;
    }
    .settings-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        font-size: 14px;
    }
    .text-muted {
        color: rgba(255, 255, 255, 0.4);
        font-size: 13px;
    }
    .action-btn {
        padding: 5px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.06);
        color: white;
        cursor: pointer;
        font-size: 13px;
    }
    .text-btn {
        background: none;
        border: none;
        color: #007aff;
        font-size: 13px;
        cursor: pointer;
        padding: 4px 8px;
    }

    .danger-zone {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 10px;
    }
    .logout-btn,
    .delete-account-btn {
        width: 100%;
        padding: 12px;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        font-size: 14px;
        transition: background 0.2s;
    }
    .logout-btn {
        background: rgba(255, 255, 255, 0.08);
        color: white;
    }
    .logout-btn:hover {
        background: rgba(255, 255, 255, 0.15);
    }
    .delete-account-btn {
        background: rgba(255, 59, 48, 0.1);
        color: #ff3b30;
    }
    .delete-account-btn:hover {
        background: rgba(255, 59, 48, 0.18);
    }

    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.65);
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 150;
    }
    .modal-box {
        width: 90%;
        max-width: 480px;
        max-height: 80vh;
        background: rgba(28, 28, 28, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        color: #fff;
    }
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 18px 22px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .modal-header h3 {
        margin: 0;
        font-size: 17px;
    }
    .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        opacity: 0.6;
    }
    .close-btn:hover {
        opacity: 1;
    }
    .modal-body {
        padding: 22px;
        overflow-y: auto;
        font-size: 14px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.8);
    }
</style>
