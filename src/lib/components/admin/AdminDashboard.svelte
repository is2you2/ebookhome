<!-- src/lib/components/admin/AdminDashboard.svelte -->
<script lang="ts">
    import TabBooks from "./TabBooks.svelte";
    import TabPayments from "./TabPayments.svelte";
    import TabUsers from "./TabUsers.svelte";
    import TabSettings from "./TabSettings.svelte";
    import { fade } from "svelte/transition";

    let { onexit }: { onexit?: () => void } = $props();

    type AdminTab = "books" | "payments" | "users" | "settings";
    let currentTab = $state<AdminTab>("books");

    let adminToken = $state<string>(
        sessionStorage.getItem("admin_token") || "",
    );
    let adminName = $state<string>(sessionStorage.getItem("admin_name") || "");
    let loginId = $state<string>("");
    let loginPw = $state<string>("");
    let loginError = $state<string>("");

    async function handleLogin() {
        loginError = "";
        try {
            const res = await fetch("http://localhost:3000/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ loginId, password: loginPw }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "로그인 실패");

            adminToken = data.token;
            adminName = data.admin.name;
            sessionStorage.setItem("admin_token", data.token);
            sessionStorage.setItem("admin_name", data.admin.name);
        } catch (err: any) {
            loginError = err.message;
        }
    }

    function handleLogout() {
        adminToken = "";
        adminName = "";
        sessionStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_name");
    }
</script>

<div class="admin-wrapper" transition:fade={{ duration: 150 }}>
    {#if !adminToken}
        <div class="login-card">
            <h2>관리자 시스템 접속</h2>
            <p>전자책 플랫폼 운영을 위한 관리자 인증이 필요합니다.</p>

            {#if loginError}
                <div class="error-msg">{loginError}</div>
            {/if}

            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    handleLogin();
                }}
            >
                <input
                    type="text"
                    placeholder="관리자 ID"
                    bind:value={loginId}
                    required
                />
                <input
                    type="password"
                    placeholder="비밀번호"
                    bind:value={loginPw}
                    required
                />
                <button type="submit" class="btn-primary">로그인</button>
                {#if onexit}
                    <button type="button" class="btn-secondary" onclick={onexit}
                        >스토어로 나가기</button
                    >
                {/if}
            </form>
        </div>
    {:else}
        <div class="dashboard-shell">
            <header class="admin-nav">
                <div class="top-row">
                    <div class="brand">
                        <h3>도서관 관리 센터</h3>
                        <span class="admin-tag">{adminName} 님</span>
                    </div>
                    <div class="action-links">
                        <button class="btn-logout" onclick={handleLogout}
                            >로그아웃</button
                        >
                        {#if onexit}
                            <button class="btn-exit" onclick={onexit}
                                >뷰어로 복귀</button
                            >
                        {/if}
                    </div>
                </div>

                <nav class="nav-links">
                    <button
                        class={currentTab === "books" ? "active" : ""}
                        onclick={() => (currentTab = "books")}
                        >도서 및 파일</button
                    >
                    <button
                        class={currentTab === "payments" ? "active" : ""}
                        onclick={() => (currentTab = "payments")}
                        >결제 관리</button
                    >
                    <button
                        class={currentTab === "users" ? "active" : ""}
                        onclick={() => (currentTab = "users")}
                        >회원/서재 지급</button
                    >
                    <button
                        class={currentTab === "settings" ? "active" : ""}
                        onclick={() => (currentTab = "settings")}
                        >통계 및 설정</button
                    >
                </nav>
            </header>

            <main class="tab-body">
                {#if currentTab === "books"}
                    <TabBooks {adminToken} />
                {:else if currentTab === "payments"}
                    <TabPayments {adminToken} />
                {:else if currentTab === "users"}
                    <TabUsers {adminToken} />
                {:else if currentTab === "settings"}
                    <TabSettings {adminToken} onLogout={handleLogout} />
                {/if}
            </main>
        </div>
    {/if}
</div>

<style>
    .admin-wrapper {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #0f0f11;
        color: #f1f1f1;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif;
    }

    .login-card {
        width: 90%;
        max-width: 380px;
        background: #18181c;
        border: 1px solid #282830;
        border-radius: 16px;
        padding: 36px 24px;
        text-align: center;
        box-sizing: border-box;
    }
    .login-card h2 {
        margin: 0 0 8px 0;
        font-size: 20px;
    }
    .login-card p {
        margin: 0 0 24px 0;
        font-size: 13px;
        color: #888;
    }
    .login-card input {
        width: 100%;
        padding: 12px 14px;
        margin-bottom: 12px;
        background: #24242c;
        border: 1px solid #363644;
        border-radius: 8px;
        color: #fff;
        outline: none;
        box-sizing: border-box;
    }
    .error-msg {
        background: rgba(255, 69, 58, 0.15);
        color: #ff453a;
        padding: 10px;
        border-radius: 6px;
        font-size: 13px;
        margin-bottom: 16px;
    }
    .btn-primary {
        width: 100%;
        padding: 12px;
        background: #0a84ff;
        border: none;
        border-radius: 8px;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
    }
    .btn-secondary {
        width: 100%;
        padding: 10px;
        background: none;
        border: none;
        color: #888;
        font-size: 13px;
        cursor: pointer;
        margin-top: 8px;
    }

    .dashboard-shell {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .admin-nav {
        background: #16161a;
        border-bottom: 1px solid #26262e;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px 24px 0 24px;
        flex-shrink: 0;
    }

    .top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
    }

    .brand {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .brand h3 {
        margin: 0;
        font-size: 16px;
        white-space: nowrap;
    }
    .admin-tag {
        font-size: 12px;
        color: #30d158;
        background: rgba(48, 209, 88, 0.12);
        padding: 2px 8px;
        border-radius: 10px;
        white-space: nowrap;
    }

    .nav-links {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
    }
    .nav-links::-webkit-scrollbar {
        display: none;
    }

    .nav-links button {
        background: none;
        border: none;
        color: #888;
        font-size: 14px;
        font-weight: 600;
        padding: 10px 16px;
        border-radius: 8px 8px 0 0;
        cursor: pointer;
        white-space: nowrap;
        border-bottom: 2px solid transparent;
        transition:
            color 0.2s,
            border-color 0.2s;
    }
    .nav-links button.active {
        color: #fff;
        border-bottom: 2px solid #0a84ff;
        background: rgba(255, 255, 255, 0.04);
    }

    .action-links {
        display: flex;
        gap: 8px;
    }
    .btn-logout {
        background: #24242c;
        border: none;
        color: #fff;
        padding: 7px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
    }
    .btn-exit {
        background: none;
        border: 1px solid #363644;
        color: #aaa;
        padding: 7px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
    }

    .tab-body {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        box-sizing: border-box;
    }

    @media (max-width: 680px) {
        .admin-nav {
            padding: 12px 14px 0 14px;
        }
        .tab-body {
            padding: 16px 12px;
        }
        .nav-links button {
            padding: 8px 12px;
            font-size: 13px;
        }
        .brand h3 {
            font-size: 15px;
        }
    }
</style>
