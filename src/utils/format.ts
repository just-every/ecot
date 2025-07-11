/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const truncateLargeValues = (obj: unknown, maxLength: number = 1000): unknown => {
    if (typeof obj === 'string') {
        if (obj.startsWith('data:image/') && obj.length > maxLength) {
            return `${obj.substring(0, 100)}...[truncated ${formatBytes(obj.length)}]`;
        }
        return obj.length > maxLength ? obj.substring(0, maxLength) + '...' : obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => truncateLargeValues(item, maxLength));
    }

    if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = truncateLargeValues(value, maxLength);
        }
        return result;
    }

    return obj;
};