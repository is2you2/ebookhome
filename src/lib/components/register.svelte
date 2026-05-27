<div class="register-page">
  <div class="register-card">
    <h1>회원가입</h1>
    <p class="sub-text">BOOKSTORE 회원이 되어 다양한 서비스를 이용해보세요.</p>

    <div class="form-grid">
      <div class="input-group">
        <label>이메일 주소</label>

        <div class="input-inline">
          <input
            type="email"
            style="min-height: 52px;"
            placeholder="example@email.com"
          />
          <button>중복확인</button>
        </div>
      </div>

      <div class="input-group">
        <label>비밀번호</label>
        <input type="password" placeholder="비밀번호를 입력하세요" />
      </div>

      <div class="input-group">
        <label>비밀번호 확인</label>
        <input type="password" placeholder="비밀번호를 다시 입력하세요" />
      </div>

      <div class="input-group">
        <label>표시명</label>
        <input type="text" placeholder="표시명을 입력하세요" />
      </div>
    </div>

    <div class="agree-box">
      <label class="checkbox-row">
        <input type="checkbox" />
        <span>이용약관에 동의합니다.</span>
      </label>

      <label class="checkbox-row">
        <input type="checkbox" />
        <span>개인정보처리방침에 동의합니다.</span>
      </label>

      <label class="checkbox-row">
        <input type="checkbox" />
        <span>마케팅 정보 수신에 동의합니다. (선택)</span>
      </label>
    </div>

    <button class="register-btn"> 회원가입 </button>
  </div>
</div>

<style lang="scss">
  .register-page {
    width: 100%;
    padding: 60px 0px;

    display: flex;
    justify-content: center;
  }

  .register-card {
    width: 720px;

    border: 1px solid var(--book-list-filter-border);
    border-radius: 20px;

    padding: 50px;

    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    background: var(--card-bg, #fff);
  }

  .register-card h1 {
    font-size: 34px;
    color: var(--ion-color-primary);
    margin-bottom: 10px;
  }

  .sub-text {
    color: #777;
    font-size: 14px;
    margin-bottom: 40px;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .input-group label {
    font-size: 14px;
    font-weight: 600;
    color: var(--ion-color-secondary);
  }

  .input-group input {
    width: 100%;
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

  .input-inline {
    display: flex;
    gap: 12px;
  }

  .input-inline input {
    flex: 1;
  }

  .input-inline button {
    width: 120px;

    border: none;
    border-radius: 12px;

    background: var(--ion-color-primary);
    color: white;

    font-weight: bold;

    cursor: pointer;
    transition: 0.2s;
  }

  .input-inline button:hover {
    background: var(--ion-color-secondary);
  }

  .agree-box {
    margin-top: 40px;
    border-top: 1px solid var(--ion-color-medium);
    padding-top: 30px;

    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 12px;

    font-size: 14px;
    color: #555;
  }

  .checkbox-row input {
    width: 18px;
    height: 18px;
    accent-color: var(--ion-color-primary);
  }

  .register-btn {
    width: 100%;
    height: 56px;

    margin-top: 40px;

    border: none;
    border-radius: 14px;

    background: var(--ion-color-primary);
    color: white;

    font-size: 16px;
    font-weight: bold;

    cursor: pointer;
    transition: 0.2s;
  }

  .register-btn:hover {
    background: var(--ion-color-secondary);
  }

  @media (max-width: 768px) {
    .register-card {
      width: 100%;
      padding: 40px 24px;
      margin: 16px;
    }

    .input-inline {
      flex-direction: column;
    }

    .input-inline button {
      width: 100%;
      height: 52px;
    }
  }
</style>
