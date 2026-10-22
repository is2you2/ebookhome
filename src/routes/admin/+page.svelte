<!-- src/routes/admin/+page.svelte -->
<script lang="ts">
    import AdminDashboard from "$lib/components/admin/AdminDashboard.svelte";
    import { goto } from "$app/navigation";

    // 뷰어로 복귀 또는 스토어로 나가기 실행 시 메인 페이지로 이동
    function handleExit() {
        goto("/");
    }
</script>

<svelte:head>
    <title>도서관 관리자 센터</title>
</svelte:head>

<AdminDashboard onexit={handleExit} />
