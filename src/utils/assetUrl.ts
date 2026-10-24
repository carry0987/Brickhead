export function assetUrl(path: string): string {
    if (/^(?:https?:)?\/\//.test(path)) {
        return path;
    }

    return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
