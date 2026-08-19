// toast.svelte.ts
export interface Toast {
    id?: string;
    message: string;
    progress?: number;
    thumbnail?: string;
    badge?: string;
    act?: Function;
    lifetime?: number;
    created_at: number;
    color?: string;
    isAlert?: boolean;
    alertTrigger?: number;
}

// toast.svelte.ts
export class ToastManager {
    // 모든 토스트를 상태로 유지
    allToasts = $state<Toast[]>([]);

    // 이제 정렬만 담당합니다 (최신순)
    get displayToasts() {
        return [...this.allToasts].sort((a, b) => b.created_at - a.created_at);
    }

    upsertToast(newToast: Omit<Toast, 'created_at'>, silent = false) {
        // 메시지 내용이 없다면 무시
        if (!newToast.message) return;
        // 아이디 공란시 자동 설정
        if (!newToast.id) newToast.id = `${Date.now()}`;

        // 메시지 길이 기반 자동 시간처리
        if (newToast.lifetime === undefined) {
            // 메시지 길이에 따른 자동 계산
            const charCount = newToast.message?.length;
            // 기본 3초 (3000ms), 1글자당 150ms 추가, 최대 8초 (8000ms) 제한
            const calculated = 3000 + (charCount * 150);
            newToast.lifetime = Math.min(Math.max(calculated, 3000), 8000);
        }

        // 토스트 배경색이 없으면 기본색 부여
        newToast.color = newToast.color || 'var(--toast-default)';

        const index = this.allToasts.findIndex(t => t.id === newToast.id);
        // 동일한 메시지인지 검토
        const isSameMessage = index !== -1 && this.allToasts[index].message === newToast.message && newToast.progress === undefined;
        // 기존 토스트와 ID+메시지가 같다면 Alert 상태 트리거
        const isAlert = !silent && isSameMessage;

        const alertTrigger = isSameMessage ? (this.allToasts[index].alertTrigger || 0) + 1 : 0;

        const toast = { ...newToast, created_at: Date.now(), isAlert, alertTrigger };

        if (index !== -1) {
            this.allToasts[index] = toast;
        } else {
            this.allToasts.push(toast);
        }

        if (newToast.lifetime) {
            this.setTimer(newToast.id, newToast.lifetime);
        }
    }

    removeToast(id: string) {
        this.allToasts = this.allToasts.filter(t => t.id !== id);
        this.clearTimer(id);
    }

    // 타이머 관리 로직은 기존처럼 동일
    private timers = new Map<string, ReturnType<typeof setTimeout>>();
    private setTimer(id: string, lifetime: number) {
        this.clearTimer(id);
        this.timers.set(id, setTimeout(() => this.removeToast(id), lifetime));
    }
    private clearTimer(id: string) {
        if (this.timers.has(id)) {
            clearTimeout(this.timers.get(id)!);
            this.timers.delete(id);
        }
    }
}

export const toastManager = new ToastManager();