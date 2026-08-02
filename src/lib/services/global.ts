import { writable } from "svelte/store";

const statusString = 'init' as 'init' | 'login' | 'main';
export const status = writable(statusString);
