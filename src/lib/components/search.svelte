<script>
  import { changeTabStatus } from "$lib/services/global";
</script>

<div class="search-page">
  <div class="container">
    <!-- HEADER -->
    <div class="search-header">
      <h1>검색 결과</h1>
      <p>"해리포터" 에 대한 검색 결과 5건</p>
    </div>

    <!-- TOOLBAR -->
    <div class="search-toolbar">
      <div class="result-count">총 5개의 도서</div>

      <div class="sort-box">
        <select>
          <option>정확도순</option>
          <option>인기순</option>
          <option>최신순</option>
          <option>가격 낮은순</option>
          <option>가격 높은순</option>
        </select>
      </div>
    </div>

    <!-- LIST -->
    <div class="book-grid">
      <button
        class="element-button book-card"
        onclick={() => changeTabStatus("book-detail")}
      >
        <img src="https://placehold.co/100x140?text=BOOK" alt="" />

        <div class="book-info">
          <h2>해리포터와 마법사의 돌</h2>
          <div class="book-meta">J.K. 롤링 · 문학수첩</div>
          <p class="book-desc">
            평범한 소년 해리가 자신이 마법사라는 사실을 알게 되며 펼쳐지는
            이야기.
          </p>
          <div class="book-bottom">
            <div class="price">18,000원</div>
          </div>
        </div>
      </button>

      <button
        class="element-button book-card"
        onclick={() => changeTabStatus("book-detail")}
      >
        <img src="https://placehold.co/100x140?text=BOOK" alt="" />

        <div class="book-info">
          <h2>해리포터와 비밀의 방</h2>
          <div class="book-meta">J.K. 롤링 · 문학수첩</div>
          <p class="book-desc">
            호그와트에 숨겨진 비밀의 방과 의문의 사건들을 파헤치는 이야기.
          </p>
          <div class="book-bottom">
            <div class="price">19,500원</div>
          </div>
        </div>
      </button>

      <button
        class="element-button book-card"
        onclick={() => changeTabStatus("book-detail")}
      >
        <img src="https://placehold.co/100x140?text=BOOK" alt="" />

        <div class="book-info">
          <h2>해리포터와 아즈카반의 죄수</h2>
          <div class="book-meta">J.K. 롤링 · 문학수첩</div>
          <p class="book-desc">
            탈옥수 시리우스 블랙과 관련된 마법 세계의 긴장감 있는 이야기.
          </p>
          <div class="book-bottom">
            <div class="price">20,000원</div>
          </div>
        </div>
      </button>

      <button
        class="element-button book-card"
        onclick={() => changeTabStatus("book-detail")}
      >
        <img src="https://placehold.co/100x140?text=BOOK" alt="" />

        <div class="book-info">
          <h2>해리포터와 불의 잔</h2>
          <div class="book-meta">J.K. 롤링 · 문학수첩</div>
          <p class="book-desc">
            트리위저드 시합에 참가하게 된 해리에게 닥쳐오는 위험한 사건들.
          </p>
          <div class="book-bottom">
            <div class="price">22,000원</div>
          </div>
        </div>
      </button>

      <button
        class="element-button book-card"
        onclick={() => changeTabStatus("book-detail")}
      >
        <img src="https://placehold.co/100x140?text=BOOK" alt="" />

        <div class="book-info">
          <h2>해리포터와 불사조 기사단</h2>
          <div class="book-meta">J.K. 롤링 · 문학수첩</div>
          <p class="book-desc">
            어둠의 세력이 다시 움직이기 시작하며 해리와 친구들이 맞서 싸우는
            이야기.
          </p>
          <div class="book-bottom">
            <div class="price">24,000원</div>
          </div>
        </div>
      </button>
    </div>

    <!-- PAGINATION -->
    <div class="pagination">
      <button class="page-btn">‹</button>

      <button class="page-btn active">1</button>
      <button class="page-btn">2</button>
      <button class="page-btn">3</button>
      <button class="page-btn">4</button>
      <button class="page-btn">5</button>

      <button class="page-btn">›</button>
    </div>
  </div>
</div>

<style lang="scss">
  .search-page {
    padding: 40px 0 60px;
    margin: 16px;

    display: flex;
    justify-content: center;
  }

  .container {
    width: 100%;
    max-width: 1200px;
  }

  /* HEADER */
  .search-header {
    margin-bottom: 28px;
  }

  .search-header h1 {
    font-size: 32px;
    color: var(--ion-color-primary);
    margin-bottom: 6px;
  }

  .search-header p {
    font-size: 14px;
    color: #777;
  }

  /* TOOLBAR */
  .search-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .result-count {
    font-size: 13px;
    color: #666;
  }

  .sort-box select {
    width: 160px;
    height: 40px;

    border: 1px solid var(--ion-color-medium);
    border-radius: 10px;

    padding: 0 10px;
    font-size: 13px;
  }

  /* GRID */
  .book-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
  }

  /* CARD */
  .book-card {
    display: flex;
    gap: 14px;

    padding: 14px;

    border: 1px solid var(--book-list-filter-border);
    border-radius: 14px;

    cursor: pointer;
    transition: 0.2s;

    min-height: 150px;
  }

  .book-card:hover {
    transform: translateY(-2px);
    border-color: var(--ion-color-primary);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
  }

  .book-card img {
    width: 80px;
    height: 110px;

    object-fit: cover;
    border-radius: 8px;

    flex-shrink: 0;
  }

  .book-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .book-info h2 {
    font-size: 15px;
    font-weight: bold;
    color: var(--ion-color-secondary);
    margin-bottom: 6px;

    line-height: 1.3;

    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;

    overflow: hidden;
  }

  .book-meta {
    font-size: 12px;
    color: #888;
    margin-bottom: 8px;
  }

  .book-desc {
    font-size: 12px;
    color: #666;
    line-height: 1.4;

    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;

    overflow: hidden;

    margin-bottom: auto;
  }

  .book-bottom {
    margin-top: 10px;
  }

  .price {
    font-size: 15px;
    font-weight: bold;
    color: var(--ion-color-primary);
  }

  /* PAGINATION */
  .pagination {
    margin-top: 40px;

    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
  }

  .page-btn {
    min-width: 36px;
    height: 36px;

    border: 1px solid var(--ion-color-medium);
    background: transparent;

    border-radius: 8px;

    cursor: pointer;
    transition: 0.2s;
  }

  .page-btn:hover {
    border-color: var(--ion-color-primary);
    color: var(--ion-color-primary);
  }

  .page-btn.active {
    background: var(--ion-color-primary);
    border-color: var(--ion-color-primary);
    color: white;
  }

  /* RESPONSIVE */
  @media (max-width: 1280px) {
    .book-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 768px) {
    .book-grid {
      grid-template-columns: 1fr;
    }

    .page-btn {
      min-width: 32px;
      height: 32px;
      font-size: 13px;
    }
  }
</style>
