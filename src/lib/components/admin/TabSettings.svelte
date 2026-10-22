<!-- src/lib/components/admin/TabSettings.svelte -->
<script lang="ts">
    let {
        adminToken,
        onLogout,
    }: { adminToken: string; onLogout?: () => void } = $props();

    interface StatsData {
        totalSales: number;
        totalUsers: number;
        totalBooks: number;
        recentPayments: number;
    }

    let stats = $state<StatsData>({
        totalSales: 0,
        totalUsers: 0,
        totalBooks: 0,
        recentPayments: 0,
    });
    let currentPw = $state("");
    let newPw = $state("");
    let message = $state("");
    let isError = $state(false);

    async function loadStats() {
        const res = await fetch("http://localhost:3000/api/admin/stats", {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        stats = await res.json();
    }

    $effect(() => {
        loadStats();
    });

    async function handlePasswordChange() {
        message = "";
        try {
            const res = await fetch(
                "http://localhost:3000/api/admin/change-password",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${adminToken}`,
                    },
                    body: JSON.stringify({
                        currentPassword: currentPw,
                        newPassword: newPw,
                    }),
                },
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            isError = false;
            message =
                "비밀번호가 성공적으로 변경되었습니다. 다시 로그인해 주세요.";
            currentPw = "";
            newPw = "";
            setTimeout(() => onLogout?.(), 1500);
        } catch (err: any) {
            isError = true;
            message = err.message;
        }
    }
</script>

<div class="tab-settings">
    <!-- 주요 통계 카드 -->
    <section class="stats-grid">
        <div class="stat-card">
            <span class="label">누적 결제 매출</span>
            <h2>{stats.totalSales.toLocaleString()}원</h2>
        </div>
        <div class="stat-card">
            <span class="label">등록 도서 총계</span>
            <h2>{stats.totalBooks}권</h2>
        </div>
        <div class="stat-card">
            <span class="label">가입 회원 총계</span>
            <h2>{stats.totalUsers}명</h2>
        </div>
        <div class="stat-card">
            <span class="label">최근 7일 거래 건수</span>
            <h2>{stats.recentPayments}건</h2>
        </div>
    </section>

    <!-- 관리자 비밀번호 변경 -->
    <section class="card password-card">
        <h3>관리자 계정 보안 설정</h3>
        {#if message}
            <div class="alert {isError ? 'err' : 'ok'}">{message}</div>
        {/if}
        <form
            onsubmit={(e) => {
                e.preventDefault();
                handlePasswordChange();
            }}
        >
            <label>
                <span>현재 비밀번호</span>
                <input type="password" bind:value={currentPw} required />
            </label>
            <label>
                <span>새 비밀번호 (8자 이상)</span>
                <input type="password" bind:value={newPw} required />
            </label>
            <button type="submit" class="btn-save">비밀번호 변경</button>
        </form>
    </section>
</div>

<style>
    .tab-settings {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 24px;
    }
    .stat-card {
        background: #16161a;
        border: 1px solid #282834;
        border-radius: 12px;
        padding: 20px;
        box-sizing: border-box;
    }
    .stat-card .label {
        font-size: 13px;
        color: #888;
    }
    .stat-card h2 {
        margin: 8px 0 0 0;
        font-size: 22px;
        color: #30d158;
        word-break: break-all;
    }

    .card {
        background: #16161a;
        border: 1px solid #282834;
        border-radius: 12px;
        padding: 22px;
        max-width: 440px;
        box-sizing: border-box;
    }
    h3 {
        margin: 0 0 16px 0;
        font-size: 15px;
    }
    label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 12px;
        font-size: 13px;
        color: #aaa;
    }
    input[type="password"] {
        padding: 10px 12px;
        background: #22222a;
        border: 1px solid #343444;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
    }
    .btn-save {
        width: 100%;
        padding: 11px;
        background: #0a84ff;
        border: none;
        border-radius: 6px;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        margin-top: 6px;
        font-size: 14px;
    }
    .alert {
        padding: 10px;
        border-radius: 6px;
        font-size: 13px;
        margin-bottom: 12px;
    }
    .alert.err {
        background: rgba(255, 69, 58, 0.15);
        color: #ff453a;
    }
    .alert.ok {
        background: rgba(48, 209, 88, 0.15);
        color: #30d158;
    }

    @media (max-width: 900px) {
        .stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 540px) {
        .stats-grid {
            grid-template-columns: 1fr;
        }
        .card {
            max-width: 100%;
        }
    }
</style>
