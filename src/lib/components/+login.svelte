<script lang="ts">
    import { registerUser } from "$lib/services/server";

    // Svelte 5 Rune을 이용한 상태 관리
    let email = $state<string>("");
    let password = $state<string>("");

    // 폼 제출 핸들러
    function handleLogin(e: Event) {
        e.preventDefault();

        // 향후 여기에 로그인 API 호출 로직을 연결합니다.
        registerUser(email, password, "http://localhost:4000");
    }
</script>

<!-- 1. 3D 캔버스 배경 레이어 -->
<div id="canvas-container">
    <!-- 여기에 Three.js 또는 Threlte(Svelte용 3D 라이브러리) 캔버스가 들어갑니다 -->
    <canvas id="bg-3d"></canvas>
</div>

<!-- 2. UI 오버레이 레이어 -->
<div class="ui-overlay">
    <main class="login-box">
        <h2>로그인</h2>

        <!-- Svelte 5의 이벤트 핸들러 방식: on:submit -> onsubmit -->
        <form onsubmit={handleLogin}>
            <div class="input-group">
                <label for="email">ID</label>
                <input
                    id="email"
                    placeholder="사용자 아이디"
                    bind:value={email}
                    required
                />
            </div>

            <div class="input-group">
                <label for="password">비밀번호</label>
                <input
                    type="password"
                    id="password"
                    placeholder="비밀번호를 입력하세요"
                    bind:value={password}
                    required
                />
            </div>

            <button type="submit" class="login-btn">시작하기</button>
        </form>

        <div class="links">
            <a href="#forgot-password">비밀번호 찾기</a>
            <span>|</span>
            <button>회원가입</button>
        </div>
    </main>
</div>

<style>
    /* 전역 스타일 설정 (body, html 기본 여백 제거 및 스크롤 방지) */
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
    }

    :global(*) {
        box-sizing: border-box;
    }

    /* --- 1. 3D 캔버스 배경 설정 --- */
    #canvas-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
    }

    #bg-3d {
        width: 100%;
        height: 100%;
        display: block;
    }

    /* --- 2. UI 레이어 설정 --- */
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
        pointer-events: none; /* 3D 배경 조작을 위해 오버레이 클릭 무시 */
    }

    /* --- 3. 로그인 박스 (글래스모피즘) --- */
    .login-box {
        pointer-events: auto; /* 박스 영역은 클릭 가능하도록 복구 */
        width: 100%;
        max-width: 380px;
        padding: 40px;

        background: rgba(25, 25, 25, 0.4);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

        color: #fff;
    }

    .login-box h2 {
        text-align: center;
        margin-bottom: 30px;
        font-size: 24px;
        font-weight: 600;
    }

    /* 입력 필드 스타일 */
    .input-group {
        margin-bottom: 20px;
    }

    .input-group label {
        display: block;
        margin-bottom: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.8);
    }

    .input-group input {
        width: 100%;
        padding: 14px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        color: #fff;
        font-size: 15px;
        outline: none;
        transition: all 0.2s ease;
    }

    .input-group input:focus {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.5);
    }

    /* 로그인 버튼 */
    .login-btn {
        width: 100%;
        padding: 14px;
        margin-top: 10px;
        background: #ffffff;
        color: #000000;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }

    .login-btn:hover {
        background: #e0e0e0;
    }

    /* 하단 링크 */
    .links {
        margin-top: 24px;
        text-align: center;
        font-size: 13px;
    }

    .links a,
    button {
        color: rgba(255, 255, 255, 0.6);
        text-decoration: none;
        transition: color 0.2s;
        cursor: pointer;
    }

    .links a:hover,
    button:hover {
        color: #fff;
    }

    .links span {
        color: rgba(255, 255, 255, 0.3);
        margin: 0 10px;
    }
</style>
