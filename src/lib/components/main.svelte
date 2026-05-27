<script>
  import { changeTabStatus } from "$lib/services/global";
</script>

<!-- HERO -->
<section class="hero">
  <div class="container">
    <div class="main-banner">
      <h1>2026 상반기 베스트셀러</h1>
      <p>지금 가장 많이 읽히는 책들을 만나보세요</p>
    </div>

    <div class="side-banner">
      <div class="mini-banner">
        <h3>오늘의 특가</h3>
        <p>최대 70% 할인</p>
      </div>

      <div class="mini-banner">
        <h3>신간 추천</h3>
        <p>이번 주 새로 나온 책</p>
      </div>
    </div>
  </div>
</section>

<!-- BESTSELLER -->
<section>
  <div class="container">
    <div class="section-title">베스트셀러</div>

    <div class="book-grid">
      <button
        class="element-button book-card"
        onclick={() => changeTabStatus("book-detail")}
      >
        <div class="book-image"></div>
        <div class="book-title">소년이 온다</div>
        <div class="book-author">한강</div>
        <div class="book-price">15,300원</div>
      </button>

      <button
        class="element-button book-card"
        onclick={() => changeTabStatus("book-detail")}
      >
        <div class="book-image"></div>
        <div class="book-title">불편한 편의점</div>
        <div class="book-author">김호연</div>
        <div class="book-price">14,000원</div>
      </button>

      <button
        class="element-button book-card"
        onclick={() => changeTabStatus("book-detail")}
      >
        <div class="book-image"></div>
        <div class="book-title">세이노의 가르침</div>
        <div class="book-author">세이노</div>
        <div class="book-price">6,480원</div>
      </button>

      <button
        class="element-button book-card"
        onclick={() => changeTabStatus("book-detail")}
      >
        <div class="book-image"></div>
        <div class="book-title">도둑맞은 집중력</div>
        <div class="book-author">요한 하리</div>
        <div class="book-price">18,000원</div>
      </button>

      <button
        class="element-button book-card"
        onclick={() => changeTabStatus("book-detail")}
      >
        <div class="book-image"></div>
        <div class="book-title">역행자</div>
        <div class="book-author">자청</div>
        <div class="book-price">17,500원</div>
      </button>
    </div>
  </div>
</section>

<!-- EVENT -->
<section>
  <div class="container">
    <div class="event-banner">
      <h2>회원가입 이벤트</h2>
      <p>신규 회원 5,000원 쿠폰 증정</p>
    </div>
  </div>
</section>

<style lang="scss">
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  ul {
    list-style: none;
  }

  .container {
    width: 1200px;
    margin: 0 auto;
  }

  /* HERO */
  .hero {
    margin-top: 20px;
  }

  .hero .container {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
  }

  .main-banner {
    height: 360px;
    background: linear-gradient(
      135deg,
      var(--ion-color-primary),
      var(--ion-color-tertiary)
    );
    border-radius: 16px;
    color: white;
    padding: 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    cursor: pointer;
  }

  .main-banner h1 {
    font-size: 42px;
    margin-bottom: 10px;
  }

  .main-banner p {
    font-size: 18px;
    opacity: 0.9;
  }

  .side-banner {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .mini-banner {
    flex: 1;
    background: var(--ion-color-primary);
    border-radius: 16px;
    padding: 24px;
    color: white;
    cursor: pointer;
  }

  /* SECTION */
  section {
    margin-top: 40px;
  }

  .section-title {
    color: var(--ion-color-primary);
    font-size: 28px;
    font-weight: bold;
    margin-bottom: 20px;
  }

  /* BOOK GRID */
  .book-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 20px;
  }

  .book-card {
    background: var(--ion-color-medium-tnspbg);
    border-radius: 12px;
    padding: 16px;
    transition: 0.2s;
    cursor: pointer;
  }

  .book-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
  }

  .book-image {
    width: 100%;
    aspect-ratio: 2/3;
    background: #ddd;
    border-radius: 8px;
    margin-bottom: 14px;
  }

  .book-title {
    font-size: 15px;
    font-weight: bold;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  .book-author {
    color: var(--ion-color-primary);
    font-size: 13px;
    margin-bottom: 10px;
  }

  .book-price {
    font-weight: bold;
  }

  /* EVENT */
  .event-banner {
    background: var(--ion-color-primary);
    color: white;
    border-radius: 20px;
    padding: 50px;
    text-align: center;
    cursor: pointer;
  }

  .event-banner h2 {
    font-size: 36px;
    margin-bottom: 10px;
  }

  /* RESPONSIVE */
  @media (max-width: 1280px) {
    .container {
      width: 95%;
    }

    .book-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (max-width: 768px) {
    .hero .container {
      grid-template-columns: 1fr;
    }

    .book-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
