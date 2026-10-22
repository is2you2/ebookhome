<!-- src/lib/components/admin/TabUsers.svelte -->
<script lang="ts">
    let { adminToken }: { adminToken: string } = $props();

    interface UserRecord {
        id: number;
        email: string;
        is_active: number;
        owned_book_count: number;
        created_at: string;
    }

    let users = $state<UserRecord[]>([]);
    let selectedUser = $state<UserRecord | null>(null);
    let userOwnedBooks = $state<
        { id: string; title: string; purchased_at: string }[]
    >([]);
    let grantBookId = $state("");

    async function loadUsers() {
        const res = await fetch("http://localhost:3000/api/admin/users", {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        users = await res.json();
    }

    $effect(() => {
        loadUsers();
    });

    async function openUserModal(u: UserRecord) {
        selectedUser = u;
        const res = await fetch(
            `http://localhost:3000/api/admin/users/${u.id}/books`,
            {
                headers: { Authorization: `Bearer ${adminToken}` },
            },
        );
        userOwnedBooks = await res.json();
    }

    async function handleGrantBook() {
        if (!selectedUser || !grantBookId.trim()) return;
        await fetch(
            `http://localhost:3000/api/admin/users/${selectedUser.id}/books`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ bookId: grantBookId.trim() }),
            },
        );
        grantBookId = "";
        openUserModal(selectedUser);
        loadUsers();
    }

    async function handleRevokeBook(bookId: string) {
        if (
            !selectedUser ||
            !confirm("해당 회원의 소장 도서를 회수하시겠습니까?")
        )
            return;
        await fetch(
            `http://localhost:3000/api/admin/users/${selectedUser.id}/books/${bookId}`,
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${adminToken}` },
            },
        );
        openUserModal(selectedUser);
        loadUsers();
    }
</script>

<div class="tab-users">
    <h3>등록 회원 목록 ({users.length}명)</h3>
    <div class="card">
        <div class="table-scroll-wrap">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>UID</th>
                        <th>이메일 계정</th>
                        <th>보유 도서</th>
                        <th>계정 상태</th>
                        <th>가입 일시</th>
                        <th>서재 관리</th>
                    </tr>
                </thead>
                <tbody>
                    {#if users.length === 0}
                        <tr
                            ><td colspan="6" class="empty"
                                >가입된 회원이 없습니다.</td
                            ></tr
                        >
                    {/if}
                    {#each users as u}
                        <tr>
                            <td>#{u.id}</td>
                            <td><strong>{u.email || "미인증/소셜"}</strong></td>
                            <td>{u.owned_book_count}권</td>
                            <td><span class="badge green">정상</span></td>
                            <td class="text-muted">{u.created_at}</td>
                            <td>
                                <button
                                    class="btn-manage"
                                    onclick={() => openUserModal(u)}
                                    >소장 도서 관리</button
                                >
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    <!-- 서재 수동 지급/회수 모달 -->
    {#if selectedUser}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="modal-backdrop" onclick={() => (selectedUser = null)}>
            <div class="modal-box" onclick={(e) => e.stopPropagation()}>
                <h4>{selectedUser.email} 님의 소장 도서 관리</h4>
                <div class="grant-row">
                    <input
                        type="text"
                        placeholder="도서 ID (예: test_book_id_0)"
                        bind:value={grantBookId}
                    />
                    <button class="btn-grant" onclick={handleGrantBook}
                        >수동 지급</button
                    >
                </div>

                <ul class="book-list">
                    {#if userOwnedBooks.length === 0}
                        <li class="empty">소장 중인 도서가 없습니다.</li>
                    {/if}
                    {#each userOwnedBooks as b}
                        <li>
                            <span class="book-name"
                                >{b.title} (<code>{b.id}</code>)</span
                            >
                            <button
                                class="btn-revoke"
                                onclick={() => handleRevokeBook(b.id)}
                                >회수</button
                            >
                        </li>
                    {/each}
                </ul>

                <button class="btn-close" onclick={() => (selectedUser = null)}
                    >닫기</button
                >
            </div>
        </div>
    {/if}
</div>

<style>
    .tab-users {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
    }
    h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
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
        min-width: 600px;
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
    .badge {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
    }
    .badge.green {
        background: rgba(48, 209, 88, 0.15);
        color: #30d158;
    }
    .btn-manage {
        padding: 5px 10px;
        background: #262634;
        border: 1px solid #3c3c4e;
        border-radius: 4px;
        color: #fff;
        cursor: pointer;
        font-size: 12px;
        white-space: nowrap;
    }
    .text-muted {
        color: #777;
        font-size: 12px;
    }
    .empty {
        text-align: center;
        color: #777;
        padding: 24px !important;
    }

    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(4px);
    }
    .modal-box {
        width: 92%;
        max-width: 440px;
        background: #1a1a22;
        border: 1px solid #323244;
        border-radius: 14px;
        padding: 22px;
        color: #fff;
        box-sizing: border-box;
    }
    .modal-box h4 {
        margin: 0 0 16px 0;
        font-size: 15px;
        word-break: break-all;
    }
    .grant-row {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
    }
    .grant-row input {
        flex: 1;
        padding: 9px 12px;
        background: #242430;
        border: 1px solid #3c3c4e;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        outline: none;
    }
    .btn-grant {
        padding: 9px 14px;
        background: #0a84ff;
        border: none;
        border-radius: 6px;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        font-size: 13px;
        white-space: nowrap;
    }
    .book-list {
        list-style: none;
        padding: 0;
        margin: 0 0 16px 0;
        max-height: 220px;
        overflow-y: auto;
    }
    .book-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #262634;
        font-size: 13px;
        gap: 8px;
    }
    .book-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .btn-revoke {
        background: none;
        border: 1px solid #ff453a;
        color: #ff453a;
        padding: 3px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        white-space: nowrap;
    }
    .btn-close {
        width: 100%;
        padding: 11px;
        background: #262632;
        border: none;
        border-radius: 6px;
        color: #fff;
        cursor: pointer;
        font-size: 13px;
    }
</style>
