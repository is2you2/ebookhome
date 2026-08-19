<script lang="ts">
    import { toastManager } from "./toast.svelte.ts";
    import { flip } from "svelte/animate";
    import type { Toast } from "./toast.svelte.ts";
    import { cubicOut } from "svelte/easing";

    // $derived를 사용하여 스토어 변화를 감지하고 정렬된 데이터를 가져옵니다.
    let displayToasts = $derived(toastManager.displayToasts);

    function handleClick(toast: Toast) {
        toast.act?.();
        toastManager.removeToast(toast.id);
    }

    // lerp.ts
    export function collapse(node: HTMLElement, { duration = 300 }) {
        const style = getComputedStyle(node);
        const height = parseFloat(style.height);
        const margin = parseFloat(style.marginBottom);

        return {
            duration,
            css: (t: number) => {
                // cubicOut 이징 함수 적용
                const eased = cubicOut(t);
                return `
                height: ${eased * height}px;
                min-height: ${eased * height}px;
                margin-bottom: ${eased * margin}px;
                opacity: ${eased};
            `;
            },
        };
    }
</script>

<div class="toast-container">
    {#each displayToasts as toast (toast.id)}
        <button
            animate:flip={{ duration: 400 }}
            in:collapse={{ duration: 300 }}
            out:collapse={{ duration: 150 }}
            class="toast-item"
            style="background-color: {toast.color};"
            onclick={() => handleClick(toast)}
            oncontextmenu={(e) => {
                e.preventDefault();
                toastManager.removeToast(toast.id);
            }}
            onanimationend={() => (toast.isAlert = false)}
        >
            {#if toast.progress}
                <div
                    class="progress-bg"
                    style="width: {toast.progress ?? 0}%"
                ></div>
            {/if}
            {#if toast.thumbnail}
                <div
                    class="thumbnail-bg"
                    style="background-image: url({toast.thumbnail})"
                ></div>
            {/if}

            <!-- alert 레이어 -->
            {#key toast.alertTrigger}
                {#if toast.alertTrigger > 0}
                    <div class="alert-layer"></div>
                {/if}
            {/key}

            <div class="content">
                {#if toast.badge}
                    <div
                        class="badge-icon"
                        style="background-image: url({toast.badge})"
                    ></div>
                {/if}
                <span
                    class="message"
                    style={toast.badge ? "padding-left: 4px" : ""}
                    >{toast.message}</span
                >
            </div>
        </button>
    {/each}
</div>

<style>
    .toast-container {
        position: absolute;
        top: 8px;
        left: 0;
        width: 100%;
        display: flex;
        gap: 0;
        flex-direction: column;
        align-items: center;
        overflow: visible;
        pointer-events: none;
    }

    .toast-item {
        margin-bottom: 8px;
        min-height: 32px;
        height: 32px;
        position: relative; /* 자식 요소들의 기준점 */
        width: 90%;
        max-width: 900px;
        color: white;
        border: none;
        border-radius: 16px;
        overflow: hidden; /* 여기가 핵심: 진행도 바가 밖으로 삐져나가지 않게 함 */
        pointer-events: none;
        font-size: 1em;
        cursor: pointer;
        pointer-events: auto;
    }

    .alert-layer {
        position: absolute;
        inset: 0;
        border-radius: 16px;
        pointer-events: none;
        /* 추가: 레이어가 생기자마자 애니메이션 시작 */
        animation: flash-fade 0.6s ease-out forwards;
    }

    @keyframes flash-fade {
        0% {
            opacity: 1;
            box-shadow: inset 0 0 0 6px var(--toast-repeat-border); /* 두꺼운 노란 테두리 느낌 */
            background-color: var(--toast-repeat-bg); /* 반투명 노란 배경 */
        }
        100% {
            opacity: 0;
            box-shadow: inset 0 0 0 0px var(--toast-repeat-border);
            background-color: var(--toast-repeat-bg-end);
        }
    }

    /* 진행도 배경 */
    .progress-bg {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: var(--toast-default);
    }

    /* 썸네일 배경 */
    .thumbnail-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0.15; /* 텍스트 가독성을 위해 낮게 설정 */
        background-size: cover;
        background-position: center;
    }

    .content {
        position: relative;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding-right: 16px;

        /* 추가: 뱃지와 텍스트 정렬 */
        display: flex;
        align-items: center;
        gap: 8px; /* 뱃지와 텍스트 사이 간격 */
        height: 100%;
    }

    .badge-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-size: cover;
        background-position: center;
        flex-shrink: 0; /* 뱃지 크기 고정 */
        margin-left: 4px;
    }

    .message {
        overflow: hidden;
        text-overflow: ellipsis;
        padding-left: 16px;
    }
</style>
