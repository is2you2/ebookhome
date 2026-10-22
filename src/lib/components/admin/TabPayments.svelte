<!-- src/lib/components/admin/TabPayments.svelte -->
<script lang="ts">
    let { adminToken }: { adminToken: string } = $props();

    interface PaymentRecord {
        id: number;
        payment_id: string;
        user_email: string;
        book_title: string;
        amount: number;
        status: string;
        pay_method: string;
        created_at: string;
    }

    let payments = $state<PaymentRecord[]>([]);
    let filterStatus = $state("ALL");

    async function loadPayments() {
        const res = await fetch("http://localhost:3000/api/admin/payments", {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        payments = await res.json();
    }

    $effect(() => {
        loadPayments();
    });

    let filteredPayments = $derived(
        filterStatus === "ALL"
            ? payments
            : payments.filter((p) => p.status === filterStatus),
    );
</script>

<div class="tab-payments">
    <div class="header-actions">
        <h3>결제 및 거래 로그 내역</h3>
        <select bind:value={filterStatus}>
            <option value="ALL">전체 상태</option>
            <option value="PAID">결제 완료 (PAID)</option>
            <option value="CANCELLED">취소/환불 (CANCELLED)</option>
        </select>
    </div>

    <div class="card">
        <div class="table-scroll-wrap">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>거래 식별자 (Payment ID)</th>
                        <th>구매 회원</th>
                        <th>구매 도서명</th>
                        <th>결제 금액</th>
                        <th>수단</th>
                        <th>상태</th>
                        <th>거래 일시</th>
                    </tr>
                </thead>
                <tbody>
                    {#if filteredPayments.length === 0}
                        <tr
                            ><td colspan="7" class="empty"
                                >거래 내역이 존재하지 않습니다.</td
                            ></tr
                        >
                    {/if}
                    {#each filteredPayments as p}
                        <tr>
                            <td><code>{p.payment_id}</code></td>
                            <td>{p.user_email || "비회원/게스트"}</td>
                            <td>{p.book_title || "삭제된 도서"}</td>
                            <td
                                ><strong>{p.amount.toLocaleString()}원</strong
                                ></td
                            >
                            <td>{p.pay_method || "CARD"}</td>
                            <td>
                                <span
                                    class="status-pill {p.status === 'PAID'
                                        ? 'paid'
                                        : 'cancel'}"
                                >
                                    {p.status}
                                </span>
                            </td>
                            <td class="text-muted">{p.created_at}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
</div>

<style>
    .tab-payments {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
    }
    .header-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 14px;
    }
    h3 {
        margin: 0;
        font-size: 16px;
    }
    select {
        padding: 8px 12px;
        background: #22222a;
        border: 1px solid #343444;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        outline: none;
    }
    .card {
        background: #16161a;
        border: 1px solid #282834;
        border-radius: 12px;
        padding: 16px;
        box-sizing: border-box;
    }

    .table-scroll-wrap {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
    .admin-table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
        font-size: 13px;
        text-align: left;
    }
    .admin-table th,
    .admin-table td {
        padding: 12px 14px;
        border-bottom: 1px solid #242430;
        white-space: nowrap;
    }
    .admin-table th {
        color: #888;
        font-weight: 500;
    }
    .status-pill {
        padding: 3px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
    }
    .status-pill.paid {
        background: rgba(48, 209, 88, 0.15);
        color: #30d158;
    }
    .status-pill.cancel {
        background: rgba(255, 69, 58, 0.15);
        color: #ff453a;
    }
    .text-muted {
        color: #777;
        font-size: 12px;
    }
    .empty {
        text-align: center;
        color: #777;
        padding: 30px !important;
    }

    @media (max-width: 580px) {
        .card {
            padding: 10px;
        }
    }
</style>
