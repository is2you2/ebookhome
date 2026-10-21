<!-- src/lib/components/+login.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import {
        registerUser,
        socialLogin,
        loginUser,
        currentUser,
    } from "$lib/services/server.svelte";
    import { status } from "$lib/services/global.svelte";

    let {
        title = "로그인이 필요합니다",
        description = "서비스를 이용하시려면 먼저 로그인해 주세요.",
    }: {
        title?: string;
        description?: string;
    } = $props();

    let Kakao: any;

    let email = $state<string>("");
    let password = $state<string>("");
    let isLoading = $state<boolean>(false);
    let isSignupMode = $state<boolean>(false);

    const SERVER_URL = "http://localhost:3000";

    onMount(() => {
        const KAKAO_JS_KEY = "여기에_카카오_JAVASCRIPT_KEY_입력";
        if (typeof Kakao !== "undefined" && !Kakao.isInitialized()) {
            Kakao.init(KAKAO_JS_KEY);
        }
    });

    async function handleEmailSubmit(e: Event) {
        e.preventDefault();
        isLoading = true;

        if (isSignupMode) {
            const result = await registerUser(email, password, SERVER_URL);
            if (result.success) {
                alert("회원가입이 완료되었습니다! 이제 로그인해 주세요.");
                isSignupMode = false;
                password = "";
            } else {
                alert(result.error);
            }
        } else {
            const result = await loginUser(email, password, SERVER_URL);
            if (result.success) {
                status.value = "main";
            } else {
                alert(result.error);
            }
        }

        isLoading = false;
    }

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
                            status.value = "main";
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

    function toggleMode() {
        isSignupMode = !isSignupMode;
        password = "";
    }
</script>

<div class="login-wrapper">
    <header class="login-header">
        <h3>{title}</h3>
        <p>{description}</p>
    </header>

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

        <button type="submit" class="submit-btn" disabled={isLoading}>
            {#if isLoading}
                처리 중...
            {:else}
                {isSignupMode ? "회원가입하기" : "이메일로 로그인"}
            {/if}
        </button>
    </form>

    <div class="divider">
        <span>또는</span>
    </div>

    <button
        class="kakao-btn"
        type="button"
        onclick={handleKakaoLogin}
        disabled={isLoading}
    >
        카카오로 1초만에 시작하기
    </button>

    <div class="login-footer">
        <!-- svelte-ignore a11y_invalid_attribute -->
        <a
            href="#"
            onclick={(e) => {
                e.preventDefault();
                toggleMode();
            }}
        >
            {isSignupMode
                ? "이미 계정이 있으신가요? 로그인"
                : "계정이 없으신가요? 회원가입"}
        </a>
    </div>
</div>

<style>
    /* 🌟 margin: auto를 주어 flex 부모 안에서 수직·수평 정중앙에 위치하도록 설정 */
    .login-wrapper {
        width: 100%;
        max-width: 360px;
        height: 100%;
        align-content: center;
        margin: auto;
        padding: 20px 0;
        background: transparent;
        border: none;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }

    .login-header {
        text-align: center;
        margin-bottom: 28px;
    }

    .login-header h3 {
        margin: 0 0 8px 0;
        font-size: 22px;
        font-weight: 600;
        color: #ffffff;
    }

    .login-header p {
        margin: 0;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.45);
    }

    .input-group {
        margin-bottom: 16px;
    }

    .input-group label {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
    }

    .input-group input {
        width: 100%;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        color: #ffffff;
        font-size: 14px;
        outline: none;
        transition:
            border-color 0.2s,
            background 0.2s;
    }

    .input-group input:focus {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.4);
    }

    .input-group input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .submit-btn {
        width: 100%;
        padding: 13px;
        margin-top: 6px;
        background: #ffffff;
        color: #000000;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition:
            background 0.2s,
            opacity 0.2s;
    }

    .submit-btn:hover:not(:disabled) {
        background: #e6e6e6;
    }

    .submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin: 22px 0;
        color: rgba(255, 255, 255, 0.25);
        font-size: 12px;
    }

    .divider::before,
    .divider::after {
        content: "";
        flex: 1;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .divider span {
        padding: 0 10px;
    }

    .kakao-btn {
        width: 100%;
        padding: 13px;
        background-color: #fee500;
        color: #191919;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .kakao-btn:hover:not(:disabled) {
        opacity: 0.9;
    }

    .kakao-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .login-footer {
        margin-top: 22px;
        text-align: center;
        font-size: 13px;
    }

    .login-footer a {
        color: rgba(255, 255, 255, 0.5);
        text-decoration: none;
        transition: color 0.2s;
        cursor: pointer;
    }

    .login-footer a:hover {
        color: #ffffff;
        text-decoration: underline;
    }
</style>
