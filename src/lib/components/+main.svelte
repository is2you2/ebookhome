<script lang="ts">
    import { fade } from "svelte/transition";

    // Svelte 5 탭 상태 관리
    type TabType = "myBooks" | "store" | "profile";
    let activeTab = $state<TabType>("myBooks");

    // 🌟 약관 및 라이선스 모달 상태 관리
    type ModalType = "business" | "terms" | "privacy" | "license" | null;
    let openModal = $state<ModalType>(null);

    // UI 숨김 상태 (책을 클릭해서 3D 배경의 리더기로 진입할 때 사용)
    let isReadingMode = $state<boolean>(false);

    // 향후 DB에서 불러올 목업 데이터
    const mockBooks = [1, 2, 3, 4, 5, 6];

    // 책 읽기 실행 (UI를 숨기고 3D 배경을 보여줌)
    const readBook = (bookId: number) => {
        console.log(`${bookId}번 책을 3D 리더기로 엽니다.`);
        isReadingMode = true;
    };
</script>

<!-- 1. 3D 캔버스 배경 레이어 (항상 뒤에 존재하며, 이북 리더기 역할을 함) -->
<div id="canvas-container">
    <!-- 독서 모드일 때 다시 UI로 돌아오는 버튼 -->
    {#if isReadingMode}
        <button class="back-to-ui-btn" onclick={() => (isReadingMode = false)}>
            ← 내 서재로 돌아가기
        </button>
    {/if}
</div>

<!-- 2. UI 오버레이 레이어 (독서 모드일 때는 숨김 처리) -->
{#if !isReadingMode}
    <div class="ui-overlay" transition:fade>
        <main class="dashboard-box">
            <!-- 상단 탭 내비게이션 -->
            <header class="tab-header">
                <button
                    class="tab-btn {activeTab === 'myBooks' ? 'active' : ''}"
                    onclick={() => (activeTab = "myBooks")}
                >
                    내 서재
                </button>
                <button
                    class="tab-btn {activeTab === 'store' ? 'active' : ''}"
                    onclick={() => (activeTab = "store")}
                >
                    전체 도서
                </button>
                <button
                    class="tab-btn {activeTab === 'profile' ? 'active' : ''}"
                    onclick={() => (activeTab = "profile")}
                >
                    내 정보
                </button>
            </header>

            <!-- 탭 콘텐츠 영역 -->
            <section class="tab-content">
                <!-- [탭 1] 내가 구매한 책 (내 서재) -->
                {#if activeTab === "myBooks"}
                    <div class="content-header">
                        <h2>읽고 있는 책</h2>
                        <div class="search-bar">
                            <input type="text" placeholder="내 서재 검색..." />
                        </div>
                    </div>
                    <div class="book-grid">
                        {#each mockBooks as book}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="book-card"
                                onclick={() => readBook(book)}
                            >
                                <div class="book-cover">표지 {book}</div>
                                <div class="book-info">
                                    <h3>전자책 제목 {book}</h3>
                                    <p>읽음 45%</p>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <!-- [탭 2] 책 목록 (스토어) -->
                {:else if activeTab === "store"}
                    <div class="content-header">
                        <h2>새로운 도서 탐색</h2>
                        <div class="search-bar">
                            <input type="text" placeholder="스토어 검색..." />
                        </div>
                    </div>
                    <div class="book-grid">
                        {#each mockBooks as book}
                            <div class="book-card store-card">
                                <div class="book-cover">표지 {book}</div>
                                <div class="book-info">
                                    <h3>새로운 도서 {book}</h3>
                                    <p>15,000원</p>
                                </div>
                                <button class="buy-btn">구매하기</button>
                            </div>
                        {/each}
                    </div>

                    <!-- [탭 3] 내 정보 -->
                {:else if activeTab === "profile"}
                    <div class="profile-container">
                        <div class="profile-header">
                            <div class="avatar"></div>
                            <div class="user-info">
                                <h2>user@email.com</h2>
                                <p>카카오 계정 연동됨</p>
                            </div>
                        </div>

                        <!-- 계정 설정 영역 -->
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

                        <!-- 🌟 앱 정보 및 법적 고지 영역 -->
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

                        <!-- 위험 영역 -->
                        <div class="danger-zone">
                            <button class="logout-btn">로그아웃</button>
                            <button class="delete-account-btn">회원 탈퇴</button
                            >
                        </div>
                    </div>
                {/if}
            </section>

            <!-- 🌟 법적 정보 모달 (팝업) 레이어 -->
            {#if openModal !== null}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="modal-backdrop"
                    transition:fade
                    onclick={() => (openModal = null)}
                >
                    <!-- 모달 내부를 클릭해도 닫히지 않도록 이벤트 전파 차단 -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
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
                                    <li>better-sqlite3 (MIT License)</li>
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
        z-index: 0;
    }

    .back-to-ui-btn {
        position: absolute;
        top: 20px;
        left: 20px;
        z-index: 20;
        padding: 12px 20px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 30px;
        backdrop-filter: blur(4px);
        cursor: pointer;
        font-weight: 600;
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
        z-index: 10;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
    }

    /* 대시보드는 로그인 박스보다 훨씬 넓게 설정 */
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

    /* 탭 헤더 */
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

    /* 콘텐츠 영역 */
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

    /* 책 그리드 레이아웃 */
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
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 12px;
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

    /* 스토어 카드 전용 구매 버튼 */
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

    /* 내 정보(Profile) 탭 스타일 */
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

    /* 내 정보 탭의 섹션 타이틀 */
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

    /* 🌟 모달(Modal) 백드롭 및 박스 스타일 */
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        z-index: 100;
        display: flex;
        justify-content: center;
        align-items: center;
        /* 모달이 뜰 때 배경을 더 흐리게 */
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
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
