import { LoadTokensFunc, SaveTokensFunc, AuthData } from 'home-assistant-js-websocket';

const STORAGE_AUTH_PATH = 'home_assistant_auth';

export const loadTokens: LoadTokensFunc = () => {
    const storageJson = window.localStorage.getItem(STORAGE_AUTH_PATH);
    return storageJson ? JSON.parse(storageJson) : null;
};

export const saveTokens: SaveTokensFunc = (data: AuthData | null) => {
    window.localStorage.setItem(STORAGE_AUTH_PATH, JSON.stringify(data));
};