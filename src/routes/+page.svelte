<script lang="ts">
  import Login from "$lib/components/login.svelte";
  import Main from "$lib/components/main.svelte";
  import Register from "$lib/components/register.svelte";
  import Search from "$lib/components/search.svelte";
  import Viewer from "$lib/components/viewer.svelte";
  import BookDetail from "$lib/components/book-detail.svelte";

  import { tabStatus, changeTabStatus } from "$lib/services/global";
</script>

<!-- TOP BAR -->
<div class="top-bar">
  <div class="container">
    <button
      class="element-button text-button"
      onclick={() => changeTabStatus("login")}>로그인</button
    >
    <button
      class="element-button text-button"
      onclick={() => changeTabStatus("register")}>회원가입</button
    >
    <button class="element-button text-button">고객센터</button>
  </div>
</div>

<!-- HEADER -->
<header>
  <div class="container">
    <button
      class="element-button text-button logo"
      onclick={() => changeTabStatus("home")}>BOOKSTORE</button
    >

    <div class="search-box">
      <input type="text" placeholder="책 제목 / 저자 / 출판사 검색" />
      <button onclick={() => changeTabStatus("search")}>검색</button>
    </div>

    <div class="header-icons">
      <span>마이페이지</span>
      <span>장바구니</span>
    </div>
  </div>
</header>

<!-- NAV -->
<nav>
  <div class="container">
    <ul class="nav-menu">
      <li>
        <button
          class="element-button text-button"
          onclick={() => changeTabStatus("search")}
        >
          베스트셀러
        </button>
      </li>
      <li>
        <button
          class="element-button text-button"
          onclick={() => changeTabStatus("search")}
        >
          신상품
        </button>
      </li>
      <li>
        <button
          class="element-button text-button"
          onclick={() => changeTabStatus("viewer")}
        >
          eBook 뷰어
        </button>
      </li>
      <li><button class="element-button text-button"> POD 주문 </button></li>
      <li><button class="element-button text-button"> 이벤트 </button></li>
    </ul>
  </div>
</nav>

<!-- 표시 콘텐츠 자리 -->

{#if $tabStatus == "login"}
  <Login />
{/if}

{#if $tabStatus == "home"}
  <Main />
{/if}

{#if $tabStatus == "register"}
  <Register />
{/if}

{#if $tabStatus == "search"}
  <Search />
{/if}

{#if $tabStatus == "viewer"}
  <Viewer />
{/if}

{#if $tabStatus == "book-detail"}
  <BookDetail />
{/if}
<!-- FOOTER -->
<footer>
  <div class="container">
    <div>
      <h3>BOOKSTORE</h3>
      <p>서울특별시 어딘가 123</p>
      <p>사업자등록번호 123-45-67890</p>
    </div>

    <div>
      <p>이용약관</p>
      <p>개인정보처리방침</p>
      <p>고객센터</p>
    </div>
  </div>
</footer>

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

  /* TOP BAR */
  .top-bar {
    border-bottom: 1px solid var(--ion-color-primary);
    font-size: 13px;
  }

  .top-bar .container {
    display: flex;
    justify-content: flex-end;
    gap: 20px;
    padding: 10px 0;
  }

  /* HEADER */
  header {
    border-bottom: 2px solid var(--ion-color-primary);
  }

  header .container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 25px 0;
  }

  .logo {
    font-size: 32px;
    font-weight: bold;
    color: var(--ion-color-primary);
    cursor: pointer;
  }

  .search-box {
    width: 500px;
    display: flex;
    border: 2px solid var(--ion-color-primary);
    border-radius: 50px;
    overflow: hidden;
  }

  .search-box input {
    flex: 1;
    padding: 14px;
    border: none;
    outline: none;
    font-size: 15px;
  }

  .search-box button {
    width: 80px;
    border: none;
    background: var(--ion-color-primary);
    color: white;
    cursor: pointer;
    font-weight: bold;
  }

  .header-icons {
    display: flex;
    gap: 20px;
    font-size: 14px;
  }

  /* NAV */
  nav {
    background: var(--ion-color-primary-bg);
    border-bottom: 1px solid var(--ion-color-primary);
  }

  nav .container {
    display: flex;
    align-items: center;
    gap: 40px;
    padding: 16px 0;
    flex-direction: column;
  }

  .nav-menu {
    display: flex;
    gap: 30px;
  }

  .nav-menu li {
    color: var(--ion-color-secondary);
    transition: 0.2s;
    cursor: pointer;
  }

  .nav-menu li:hover {
    color: var(--ion-color-primary);
  }

  /* FOOTER */
  footer {
    margin-top: 80px;
    background: #222;
    color: #aaa;
    padding: 50px 0;
    font-size: 14px;
  }

  footer .container {
    display: flex;
    justify-content: space-between;
  }

  /* RESPONSIVE */
  @media (max-width: 1280px) {
    .container {
      width: 95%;
    }
  }

  @media (max-width: 768px) {
    header .container,
    nav .container,
    footer .container {
      flex-direction: column;
    }

    .search-box {
      width: 100%;
      margin: 20px 0;
    }

    .search-box button:hover {
      color: var(--ion-color-secondary);
    }

    .nav-menu {
      flex-wrap: wrap;
      gap: 14px;
    }
  }
</style>
