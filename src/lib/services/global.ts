// src/lib/stores/global.ts
import { writable } from 'svelte/store';

export const tabStatus = writable('home');

let previousTab = 'home';

export function changeTabStatus(status: string) {
    tabStatus.update((current) => {
        previousTab = current;
        return status;
    });

    switch (status) {
        case 'search':
        case 'viewer':
            break;
        default:
            document
                .getElementById('scroll_content')
                ?.scrollIntoView({ behavior: 'smooth' });
            break;
    }
}

export function goHome() {
    tabStatus.set(previousTab);
}