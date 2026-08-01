<script lang="ts">
    import { onMount } from "svelte";
    // api.ts 파일에서 3가지 함수를 모두 가져옵니다. (loginUser는 아직 안 만드셨다면 하단 설명을 참고하세요)
    import { registerUser, socialLogin, loginUser } from "$lib/services/server";

 let Kakao: any;

    // Svelte 5 상태 관리
    let email = $state<string>("");
    let password = $state<string>("");
    let isLoading = $state<boolean>(false);

    // 현재 모드가 '로그인'인지 '회원가입'인지 구분하는 상태
    let isSignupMode = $state<boolean>(false);

    const SERVER_URL = "http://localhost:4000";

    // 1. 카카오 SDK 초기화
    onMount(() => {
        const KAKAO_JS_KEY = "여기에_카카오_JAVASCRIPT_KEY_입력";
        if (typeof Kakao !== "undefined" && !Kakao.isInitialized()) {
            Kakao.init(KAKAO_JS_KEY);
        }
    });

    // 2. 이메일/비밀번호 폼 제출 핸들러
    async function handleEmailSubmit(e: Event) {
        e.preventDefault();
        isLoading = true;

        let result;
        if (isSignupMode) {
            // 회원가입 모드일 때
            result = await registerUser(email, password, SERVER_URL);
            if (result.success) {
                alert("회원가입이 완료되었습니다! 이제 로그인해 주세요.");
                isSignupMode = false; // 가입 성공 후 로그인 모드로 전환
                password = ""; // 비밀번호 입력란 초기화
            } else {
                alert(result.error);
            }
        } else {
            // 로그인 모드일 때
            result = await loginUser(email, password, SERVER_URL);
            if (result.success) {
                alert("로그인 성공!");
                // TODO: 메인 페이지로 이동 (예: window.location.href = '/')
            } else {
                alert(result.error);
            }
        }

        isLoading = false;
    }

    // 3. 카카오 로그인 버튼 핸들러
    function handleKakaoLogin() {
        if (typeof Kakao === "undefined") return alert("카카오 SDK 로드 실패");

        isLoading = true;
        Kakao.Auth.login({
            success: function (authObj: any) {
                Kakao.API.request({
                    url: "/v2/user/me",
                    success: async function (res: any) {
                        const providerId = res.id.toString();
                        const kakaoEmail = res.kakao_account?.email;

                        const result = await socialLogin(
                            "kakao",
                            providerId,
                            kakaoEmail,
                            SERVER_URL,
                        );

                        if (result.success) {
                            alert("카카오 로그인 성공!");
                            // TODO: 메인 페이지 이동
                        } else {
                            alert(result.error);
                        }
                        isLoading = false;
                    },
                    fail: (err: any) => {
                        console.error(err);
                        isLoading = false;
                    },
                });
            },
            fail: (err: any) => {
                console.error(err);
                isLoading = false;
            },
        });
    }

    // 모드 전환 핸들러
    function toggleMode() {
        isSignupMode = !isSignupMode;
        password = ""; // 모드 전환 시 비밀번호 필드 초기화
    }
</script>

<!-- 3D 캔버스 배경 레이어 -->
<div id="canvas-container">
    <canvas id="bg-3d"></canvas>
</div>

<!-- UI 오버레이 레이어 -->
<div class="ui-overlay">
    <main class="login-box">
        <h2>{isSignupMode ? "이메일로 회원가입" : "로그인"}</h2>

        <form onsubmit={handleEmailSubmit}>
            <div class="input-group">
                <label for="email">이메일</label>
                <input
                    type="email"
                    id="email"
                    placeholder="example@email.com"
                    bind:value={email}
                    required
                    disabled={isLoading}
                />
            </div>

            <div class="input-group">
                <label for="password">비밀번호</label>
                <input
                    type="password"
                    id="password"
                    placeholder="6자리 이상 입력하세요"
                    bind:value={password}
                    minlength="6"
                    required
                    disabled={isLoading}
                />
            </div>

            <button type="submit" class="login-btn" disabled={isLoading}>
                {#if isLoading}
                    처리 중...
                {:else}
                    {isSignupMode ? "가입하기" : "이메일로 시작하기"}
                {/if}
            </button>
        </form>

        <div class="divider">
            <span>또는</span>
        </div>

        <!-- 카카오 로그인 버튼 -->
        <button
            class="kakao-btn"
            type="button"
            onclick={handleKakaoLogin}
            disabled={isLoading}
        >
            카카오로 1초만에 시작하기
        </button>

        <div class="links">
            {#if !isSignupMode}
                <a href="#forgot-password">비밀번호 찾기</a>
                <span>|</span>
            {/if}
            <!-- svelte-ignore a11y_invalid_attribute -->
            <a
                href="#"
                onclick={(e) => {
                    e.preventDefault();
                    toggleMode();
                }}
            >
                {isSignupMode ? "이미 계정이 있으신가요? 로그인" : "회원가입"}
            </a>
        </div>
    </main>
</div>

<style>
    /* ... 기존 글로벌 스타일 및 레이아웃 스타일 동일 유지 ... */
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
        pointer-events: none;
    }

    .login-box {
        pointer-events: auto;
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
    .input-group input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

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
    .login-btn:hover:not(:disabled) {
        background: #e0e0e0;
    }
    .login-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    /* 구분선 스타일 추가 */
    .divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin: 24px 0;
        color: rgba(255, 255, 255, 0.3);
        font-size: 12px;
    }
    .divider::before,
    .divider::after {
        content: "";
        flex: 1;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .divider span {
        padding: 0 10px;
    }

    /* 카카오 버튼 스타일 추가 */
    .kakao-btn {
        width: 100%;
        padding: 14px;
        background-color: #fee500;
        color: #191919;
        border: none;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .kakao-btn:hover:not(:disabled) {
        opacity: 0.9;
    }
    .kakao-btn:disabled {
        background-color: #ffe83a;
        opacity: 0.5;
        cursor: not-allowed;
    }

    .links {
        margin-top: 24px;
        text-align: center;
        font-size: 13px;
    }
    .links a {
        color: rgba(255, 255, 255, 0.6);
        text-decoration: none;
        transition: color 0.2s;
        cursor: pointer;
    }
    .links a:hover {
        color: #fff;
    }
    .links span {
        color: rgba(255, 255, 255, 0.3);
        margin: 0 10px;
    }
</style>
