<div class="login-page">
  <div class="login-card">
    <h1>로그인</h1>
    <p class="sub-text">BOOKSTORE에 오신 것을 환영합니다.</p>

    <div class="input-group">
      <label>아이디</label>
      <input type="text" placeholder="아이디를 입력하세요" />
    </div>

    <div class="input-group">
      <label>비밀번호</label>
      <input type="password" placeholder="비밀번호를 입력하세요" />
    </div>

    <button class="login-btn"> 로그인 </button>

    <div class="login-options">
      <span>아이디 찾기</span>
      <span>|</span>
      <span>비밀번호 찾기</span>
      <span>|</span>
      <span>회원가입</span>
    </div>
  </div>
</div>

<style lang="scss">
  .login-page {
    width: 100%;
    min-height: 70vh;

    display: flex;
    justify-content: center;
    align-items: center;

    padding: 140px 0px 60px 0px;
  }

  .login-card {
    width: 420px;

    border: 1px solid var(--book-list-filter-border);
    border-radius: 20px;

    padding: 50px 40px;

    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    background: var(--card-bg, #fff);
  }

  .login-card h1 {
    color: var(--ion-color-primary);
    font-size: 32px;
    margin-bottom: 10px;
  }

  .sub-text {
    color: var(--ion-color-dark);
    margin-bottom: 40px;
    font-size: 14px;
  }

  .input-group {
    margin-bottom: 24px;

    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .input-group label {
    font-size: 14px;
    color: var(--ion-color-secondary);
    font-weight: 600;
  }

  .input-group input {
    height: 52px;

    border: 1px solid var(--ion-color-medium);
    border-radius: 12px;

    padding: 0 16px;

    font-size: 15px;

    transition: 0.2s;
    background: transparent;
    color: var(--text, #111);
  }

  .input-group input:focus {
    outline: none;
    border-color: var(--ion-color-primary);
    box-shadow: 0 0 0 4px rgba(var(--ion-color-primary-rgb), 0.15);
  }

  .login-btn {
    width: 100%;
    height: 54px;

    border: none;
    border-radius: 12px;

    background: var(--ion-color-primary);
    color: white;

    font-size: 16px;
    font-weight: bold;

    cursor: pointer;

    transition: 0.2s;

    margin-top: 10px;
  }

  .login-btn:hover {
    background: var(--ion-color-secondary);
  }

  .login-options {
    margin-top: 28px;

    display: flex;
    justify-content: center;
    gap: 12px;

    font-size: 13px;
    color: #777;
  }

  .login-options span {
    cursor: pointer;
    transition: 0.2s;
  }

  .login-options span:hover {
    color: var(--ion-color-primary);
  }

  @media (max-width: 768px) {
    .login-card {
      width: 100%;
      padding: 40px 24px;
      margin: 16px;
    }
  }
</style>
