<script lang="ts">
  import { writable } from "svelte/store";

  const currentTab = writable("info");

  const relatedBooks = [
    { title: "비밀의 방", image: "https://placehold.co/140x200?text=BOOK" },
    {
      title: "아즈카반의 죄수",
      image: "https://placehold.co/140x200?text=BOOK",
    },
    { title: "불의 잔", image: "https://placehold.co/140x200?text=BOOK" },
    { title: "불사조 기사단", image: "https://placehold.co/140x200?text=BOOK" },
  ];
</script>

<div class="book-detail-page">
  <div class="container">
    <!-- TOP AREA -->
    <div class="book-top">
      <!-- LEFT: IMAGE -->
      <div class="book-image">
        <img
          src="https://placehold.co/420x600?text=BOOK"
          alt="book thumbnail"
        />
      </div>

      <!-- RIGHT: INFO -->
      <div class="book-info">
        <h1>해리포터와 마법사의 돌</h1>

        <div class="book-meta">J.K. 롤링 · 문학수첩</div>

        <div class="rating">
          ★★★★☆ <span>(4.5)</span>
        </div>

        <div class="price">18,000원</div>

        <div class="book-summary">
          평범한 소년 해리가 자신이 마법사라는 사실을 알게 되며 시작되는 마법
          세계의 첫 번째 이야기입니다.
        </div>

        <div class="purchase-box">
          <button class="buy-btn"> 바로 구매 </button>

          <button class="cart-btn"> 장바구니 </button>
        </div>

        <div class="info-table">
          <div>
            <span>출판사</span>
            <p>문학수첩</p>
          </div>

          <div>
            <span>출판일</span>
            <p>2000.01.01</p>
          </div>

          <div>
            <span>페이지</span>
            <p>320p</p>
          </div>

          <div>
            <span>ISBN</span>
            <p>123-4567890123</p>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB AREA -->
    <div class="book-tab">
      <div class="tab-menu">
        <button
          class:active={$currentTab === "info"}
          onclick={() => currentTab.set("info")}
        >
          상품정보
        </button>

        <button
          class:active={$currentTab === "review"}
          onclick={() => currentTab.set("review")}
        >
          리뷰
        </button>

        <button
          class:active={$currentTab === "delivery"}
          onclick={() => currentTab.set("delivery")}
        >
          배송/반품
        </button>
      </div>

      <div class="tab-content">
        {#if $currentTab === "info"}
          <div>
            <h3>책 소개</h3>

            <p>
              해리포터 시리즈의 첫 번째 이야기로, 호그와트 마법학교에서 펼쳐지는
              모험과 성장을 담고 있습니다.
            </p>

            <h3>저자 소개</h3>

            <p>
              J.K. 롤링은 세계적인 판타지 소설 작가로, 해리포터 시리즈로 전
              세계적인 인기를 얻었습니다.
            </p>
          </div>
        {/if}

        {#if $currentTab === "review"}
          <div>
            <h3>리뷰</h3>

            <p>아직 등록된 리뷰가 없습니다.</p>
          </div>
        {/if}

        {#if $currentTab === "delivery"}
          <div>
            <h3>배송/반품 안내</h3>

            <p>주문 후 평균 2~3일 내 배송됩니다.</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- RELATED -->
    <div class="related">
      <h2>이 책과 함께 본 도서</h2>

      <div class="related-grid">
        {#each relatedBooks as book}
          <button class="related-item">
            <img src={book.image} alt={book.title} />

            <p>{book.title}</p>
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .book-detail-page {
    padding: 40px 16px 80px;
  }

  .container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* =========================
     TOP LAYOUT
  ========================= */

  .book-top {
    display: grid;
    grid-template-columns: 420px 1fr;
    gap: 50px;

    margin-bottom: 60px;
  }

  /* IMAGE */

  .book-image img {
    width: 100%;
    max-width: 420px;
    height: auto;

    border-radius: 16px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
  }

  /* =========================
     INFO
  ========================= */

  .book-info h1 {
    font-size: 34px;
    color: var(--ion-color-primary);
    margin-bottom: 10px;
  }

  .book-meta {
    font-size: 15px;
    color: #777;
    margin-bottom: 10px;
  }

  .rating {
    font-size: 16px;
    color: #f5a623;
    margin-bottom: 14px;
  }

  .price {
    font-size: 28px;
    font-weight: bold;
    color: var(--ion-color-primary);
    margin-bottom: 16px;
  }

  .book-summary {
    font-size: 14px;
    color: #555;
    line-height: 1.6;
    margin-bottom: 24px;
  }

  /* =========================
     PURCHASE AREA
  ========================= */

  .purchase-box {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 20px;
  }

  .buy-btn,
  .cart-btn {
    flex: 1;
    min-height: 42px;

    border-radius: 10px;

    cursor: pointer;

    transition: 0.2s;
  }

  .buy-btn {
    border: none;

    background: var(--ion-color-primary);
    color: white;

    font-weight: bold;
  }

  .cart-btn {
    border: 1px solid var(--ion-color-primary);

    background: white;
    color: var(--ion-color-primary);
  }

  /* =========================
     INFO TABLE
  ========================= */

  .info-table {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;

    font-size: 13px;
    color: #666;
  }

  .info-table span {
    font-weight: bold;
    color: #444;
  }

  /* =========================
     TABS
  ========================= */

  .book-tab {
    margin-bottom: 60px;
  }

  .tab-menu {
    display: flex;
    gap: 20px;

    border-bottom: 1px solid #ddd;
    margin-bottom: 20px;
  }

  .tab-menu button {
    padding: 12px 0;

    background: transparent;
    border: none;

    cursor: pointer;

    color: #777;
    font-size: 15px;
  }

  .tab-menu button.active {
    color: var(--ion-color-primary);

    border-bottom: 2px solid var(--ion-color-primary);
  }

  .tab-content h3 {
    margin-top: 20px;
    color: var(--ion-color-secondary);
  }

  .tab-content p {
    font-size: 14px;
    color: #555;
    line-height: 1.7;
  }

  /* =========================
     RELATED BOOKS
  ========================= */

  .related h2 {
    margin-bottom: 20px;
    color: var(--ion-color-primary);
  }

  .related-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 18px;
  }

  .related-item {
    border: none;
    background: transparent;

    text-align: center;

    cursor: pointer;
  }

  .related-item img {
    width: 100%;

    border-radius: 10px;

    transition: 0.2s;
  }

  .related-item:hover img {
    transform: scale(1.05);
  }

  .related-item p {
    margin-top: 8px;

    font-size: 13px;
    color: #666;
  }

  /* =========================
     RESPONSIVE
  ========================= */

  @media (max-width: 1024px) {
    .book-top {
      grid-template-columns: 1fr;
      text-align: center;
    }

    .purchase-box {
      flex-direction: column;
      align-items: stretch;
    }

    .info-table {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .book-info h1 {
      font-size: 26px;
    }

    .price {
      font-size: 22px;
    }

    .related-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
