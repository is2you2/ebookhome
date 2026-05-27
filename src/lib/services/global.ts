// src/lib/stores/global.ts
import { writable } from 'svelte/store';

export const tabStatus = writable('home');

let previousTab = 'home';

export function changeTabStatus(status: string) {
    tabStatus.update((current) => {
        previousTab = current;
        return status;
    });

    if (status !== 'viewer') {
        document
            .getElementById('scroll_content')
            ?.scrollIntoView({ behavior: 'smooth' });
    }
}

export function goHome() {
    tabStatus.set(previousTab);
}