<script lang="ts">
    import type { BookInfo } from "$lib/services/global.svelte";
    import { fade, scale } from "svelte/transition";

    let {
        book,
        isPurchased = false,
        onclose,
        onbuy,
        onread,
        onpreview,
    }: {
        book: BookInfo;
        isPurchased?: boolean;
        onclose: () => void;
        onbuy?: (book: BookInfo) => void;
        onread?: (book: BookInfo) => void;
        onpreview?: (book: BookInfo) => void;
    } = $props();

    let fullDescription = $state<string>("");
    let isLoadingDesc = $state<boolean>(false);

    let discountRate = $derived.by(() => {
        if (
            book.original_price &&
            book.price &&
            book.original_price > book.price
        ) {
            return Math.round(
                ((book.original_price - book.price) / book.original_price) *
                    100,
            );
        }
        return 0;
    });

    $effect(() => {
        if (book.description_url) {
            isLoadingDesc = true;
            fetch(book.description_url)
                .then((res) => {
                    if (!res.ok) throw new Error();
                    return res.text();
                })
                .then((text) => (fullDescription = text))
                .catch(
                    () =>
                        (fullDescription =
                            book.desc || "상세 설명이 없습니다."),
                )
                .finally(() => (isLoadingDesc = false));
        } else {
            fullDescription = book.desc || "상세 설명이 없습니다.";
        }
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="detail-backdrop"
    transition:fade={{ duration: 150 }}
    onclick={onclose}
>
    <div
        class="detail-card"
        transition:scale={{ start: 0.96, duration: 180 }}
        onclick={(e) => e.stopPropagation()}
    >
        <button class="close-btn" onclick={onclose}>✕</button>

        <div class="detail-content-scroll">
            <section class="meta-section">
                <div class="cover-media-box">
                    {#if book.video_thumbnail}
                        <video
                            src={book.video_thumbnail}
                            autoplay
                            loop
                            muted
                            playsinline
                            class="media"
                        ></video>
                    {:else}
                        <img
                            src={book.thumbnail}
                            alt={book.title}
                            class="media"
                        />
                    {/if}
                </div>

                <div class="info-box">
                    <div class="header-tags">
                        {#if book.rating}
                            <span class="rating-badge"
                                >★ {book.rating.toFixed(1)}</span
                            >
                        {/if}
                        {#if book.publisher}
                            <span class="publisher-tag">{book.publisher}</span>
                        {/if}
                    </div>

                    <h2 class="book-title">{book.title}</h2>
                    <p class="book-author">{book.author} 저</p>

                    <div class="price-box">
                        {#if isPurchased}
                            <span class="status-badge">보유 중인 도서</span>
                        {:else if book.price !== undefined}
                            <div class="price-row">
                                {#if discountRate > 0}
                                    <span class="discount-rate"
                                        >{discountRate}%</span
                                    >
                                {/if}
                                <span class="sale-price"
                                    >{book.price.toLocaleString()}원</span
                                >
                            </div>
                            {#if book.original_price && discountRate > 0}
                                <span class="original-price"
                                    >{book.original_price.toLocaleString()}원</span
                                >
                            {/if}
                        {:else}
                            <span class="free-price">무료</span>
                        {/if}
                    </div>

                    <div class="action-row">
                        {#if isPurchased}
                            <button
                                class="btn-primary"
                                onclick={() => onread?.(book)}
                            >
                                3D 뷰어로 읽기
                            </button>
                        {:else}
                            <!-- 🌟 뷰어를 5페이지 모드로 실행하는 미리보기 버튼 -->
                            <button
                                class="btn-secondary"
                                onclick={() => onpreview?.(book)}
                            >
                                📖 5페이지 미리보기
                            </button>
                            <button
                                class="btn-primary buy"
                                onclick={() => onbuy?.(book)}
                            >
                                바로 구매하기
                            </button>
                        {/if}
                    </div>
                </div>
            </section>

            <hr class="divider" />

            <section class="description-section">
                <h3>작품 소개</h3>
                {#if isLoadingDesc}
                    <div class="loading-desc">
                        도서 소개를 불러오는 중입니다...
                    </div>
                {:else}
                    <div class="desc-text-body">{fullDescription}</div>
                {/if}
            </section>
        </div>
    </div>
</div>

<style>
    .detail-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.65);
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 24px;
        backdrop-filter: blur(6px);
    }
    .detail-card {
        width: 100%;
        max-width: 680px;
        max-height: 85vh;
        background: rgba(28, 28, 28, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 20px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
        color: #ffffff;
    }
    .close-btn {
        position: absolute;
        top: 18px;
        right: 18px;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: rgba(255, 255, 255, 0.7);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .detail-content-scroll {
        padding: 32px 28px;
        overflow-y: auto;
    }
    .meta-section {
        display: flex;
        gap: 24px;
    }
    .cover-media-box {
        width: 180px;
        min-width: 180px;
        aspect-ratio: 2 / 3;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .media {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .info-box {
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    .header-tags {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
    }
    .rating-badge {
        font-size: 13px;
        font-weight: 700;
        color: #ffd60a;
        background: rgba(255, 214, 10, 0.12);
        padding: 4px 8px;
        border-radius: 6px;
    }
    .publisher-tag {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.06);
        padding: 4px 8px;
        border-radius: 6px;
    }
    .book-title {
        font-size: 22px;
        margin: 4px 0 6px 0;
        font-weight: 700;
    }
    .book-author {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.6);
        margin: 0 0 16px 0;
    }
    .price-box {
        margin-top: auto;
        padding-top: 12px;
        margin-bottom: 16px;
    }
    .status-badge {
        display: inline-block;
        font-size: 14px;
        font-weight: 600;
        color: #30d158;
        background: rgba(48, 209, 88, 0.12);
        padding: 6px 12px;
        border-radius: 8px;
    }
    .price-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
    }
    .discount-rate {
        color: #ff453a;
        font-size: 22px;
        font-weight: 700;
    }
    .sale-price {
        font-size: 24px;
        font-weight: 700;
    }
    .original-price {
        display: block;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.4);
        text-decoration: line-through;
    }
    .free-price {
        font-size: 20px;
        font-weight: 700;
        color: #30d158;
    }
    .action-row {
        display: flex;
        gap: 10px;
    }
    .btn-primary {
        flex: 1;
        padding: 13px;
        border-radius: 10px;
        border: none;
        background: #ffffff;
        color: #000;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
    }
    .btn-primary.buy {
        background: #0a84ff;
        color: #fff;
    }
    .btn-secondary {
        padding: 13px 16px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
    }
    .divider {
        border: none;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        margin: 28px 0 20px 0;
    }
    .description-section h3 {
        font-size: 16px;
        margin: 0 0 12px 0;
    }
    .loading-desc {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.4);
    }
    .desc-text-body {
        font-size: 14px;
        line-height: 1.7;
        color: rgba(255, 255, 255, 0.7);
        white-space: pre-wrap;
    }
</style>
