import type { ResponseInput } from '@just-every/ensemble';

// Approximate token counter for ResponseInput.
// Traverses all fields for text chars / model-specific divisor (~4).
// Embedded base64 images/PDFs: Multi-regex detect, subtract length, add model-specific image tokens or decoded/4 for PDFs.
// Images: Model-specific fixed/avg (updated July 2025: GPT detail-based avgs, Gemini 258, Claude 1100, Grok 500 placeholder).
// Files: Type-specific (e.g., /3.5 code); images as image tokens, PDFs decoded/4.
// Base64-like strings: /1.3 if not image/PDF.
// Structure: Included via all non-content strings.
// Returns total or breakdown.

export function approximateTokens(input: ResponseInput, model: string = 'gpt-4o', withBreakdown: boolean = false): number | { total: number; breakdown: { text: number; images: number; files: number; embedded: number; structure: number }; warnings: string[] } {
    let totalChars = 0;
    let base64Chars = 0; // For non-image/PDF base64
    let imageTokens = 0;
    let fileTokens = 0;
    let embeddedTokens = 0;
    let structureChars = 0; // Metadata like types/roles
    const warnings: string[] = [];

    const charsPerToken = model.toLowerCase().includes('grok') ? 3.5 : 4;
    const base64PerToken = 1.3; // For compressed binary

    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|svg|webp|tiff)$/i;
    const pdfExtensions = /\.pdf$/i;
    const textExtensions = ['txt', 'md', 'log', 'csv', 'tsv'];
    const codeExtensions = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'rb', 'php'];
    const structuredExtensions = ['json', 'xml', 'yaml', 'yml', 'toml'];

    // Updated model-specific image tokens (per image, avgs from docs/forums July 2025)
    let lowTokens = 85;   // GPT/Claude low
    let autoTokens = 255; // GPT avg (85 + 1 tile*170)
    let highTokens = 765; // GPT avg (85 + 4 tiles*170 for ~1024x1024)
    let fixedImageTokens = 0;

    if (model.toLowerCase().includes('gemini')) {
        fixedImageTokens = 258; // Base for Gemini 1.5/2.5; high-res adds ~129/tile, but avg fixed
    } else if (model.toLowerCase().includes('opus') || model.toLowerCase().includes('claude')) {
        fixedImageTokens = 1100; // Avg (width*height)/750 ~ for 1000x1000 /750 ≈1333, but docs avg 1100
    } else if (model.toLowerCase().includes('grok')) {
        fixedImageTokens = 500; // No official; placeholder avg
    } else {
        // GPT-4o, o3: detail-based
        fixedImageTokens = 0;
    }

    // Enhanced regex for embedded (from Sol1 patterns)
    const base64ImageRegexes = [
        /data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/gi, // data URL
        /^([A-Za-z0-9+/]{100,}={0,2})$/gm, // Raw large base64
        /<img[^>]+src=["']data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)["'][^>]*>/gi, // Img tag
        /!\[[^\]]*\]\(data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)\)/gi // Markdown
    ];
    const base64PdfRegex = /data:application\/pdf;base64,[\w+/=]+/gi;

    function looksLikeBase64(str: string): boolean {
        return str.length > 128 && /^[A-Za-z0-9+/=]+$/.test(str);
    }

    function getImgTok(detail: string = 'auto'): number {
        if (fixedImageTokens > 0) {
            return fixedImageTokens;
        } else {
            switch (detail) {
                case 'low':
                    return lowTokens;
                case 'auto':
                    return autoTokens;
                case 'high':
                    return highTokens;
                default:
                    return autoTokens;
            }
        }
    }

    function processString(str: string, isMetadata: boolean = false): void {
        let subtracted = 0;
        let imgCount = 0;
        let pdfTok = 0;

        // Detect/subtract embedded images
        base64ImageRegexes.forEach(regex => {
            const matches = str.match(regex) || [];
            matches.forEach(match => {
                const base64 = match.split('base64,')[1] || match;
                if (looksLikeBase64(base64)) {
                    subtracted += match.length;
                    imgCount++;
                }
            });
        });
        if (imgCount > 0) {
            embeddedTokens += imgCount * getImgTok();
            warnings.push(`Found ${imgCount} embedded image(s) in string`);
        }

        // Detect/subtract PDFs
        const pdfMatches = str.match(base64PdfRegex) || [];
        const pdfSub = pdfMatches.reduce((sum, m) => sum + m.length, 0);
        subtracted += pdfSub;
        pdfMatches.forEach(match => {
            const decodedLen = (match.length * 3 / 4); // Approx decoded
            pdfTok += Math.ceil(decodedLen / charsPerToken);
        });
        fileTokens += pdfTok;

        const remaining = str.length - subtracted;
        if (looksLikeBase64(str) && subtracted === 0) { // Non-image/PDF base64
            base64Chars += remaining;
        } else {
            if (isMetadata) {
                structureChars += remaining;
            } else {
                totalChars += remaining;
            }
        }
    }

    function getFileDivisor(extension?: string): number {
        if (extension && textExtensions.includes(extension)) return 4;
        if (extension && codeExtensions.includes(extension)) return 3.5;
        if (extension && structuredExtensions.includes(extension)) return 3;
        return 20; // Binary/other
    }

    function traverse(obj: any, isMetadata: boolean = true): void { // Default metadata for non-content
        if (typeof obj === 'string') {
            processString(obj, isMetadata);
        } else if (Array.isArray(obj)) {
            obj.forEach(item => traverse(item, false)); // Content arrays are non-metadata
        } else if (typeof obj === 'object' && obj !== null) {
            if (obj.type === 'input_image') {
                imageTokens += getImgTok(obj.detail || 'auto');
                if (obj.image_url) traverse(obj.image_url, false);
                if (obj.file_id) traverse(obj.file_id, true);
            } else if (obj.type === 'input_file') {
                const filename = obj.filename || '';
                const ext = filename.split('.').pop()?.toLowerCase();
                const isImage = imageExtensions.test(filename);
                const isPdf = pdfExtensions.test(filename);
                if (isImage) {
                    imageTokens += getImgTok('high');
                    if (obj.file_data) processString(obj.file_data, false); // Handles if base64
                } else if (isPdf) {
                    if (obj.file_data) processString(obj.file_data, false); // PDF tok added in process
                } else {
                    // Other file: Count data with type-specific divisor
                    if (obj.file_data) {
                        if (looksLikeBase64(obj.file_data)) {
                            const decodedLen = obj.file_data.length * 3 / 4;
                            fileTokens += Math.ceil(decodedLen / getFileDivisor(ext));
                        } else {
                            fileTokens += Math.ceil(obj.file_data.length / getFileDivisor(ext));
                        }
                    }
                }
                if (obj.file_id) traverse(obj.file_id, true);
                if (obj.filename) traverse(obj.filename, true);
            } else if (obj.type === 'input_text') {
                traverse(obj.text, false); // Text content
            } else {
                // Other objects: Traverse values, metadata
                Object.values(obj).forEach(val => traverse(val, true));
            }
        }
    }

    traverse(input);

    const textTokens = Math.ceil(totalChars / charsPerToken);
    const base64Tokens = Math.ceil(base64Chars / base64PerToken);
    const structureTokens = Math.ceil(structureChars / charsPerToken);
    const total = textTokens + base64Tokens + imageTokens + fileTokens + embeddedTokens + structureTokens;

    if (withBreakdown) {
        return {
            total,
            breakdown: {
                text: textTokens + base64Tokens,
                images: imageTokens,
                files: fileTokens,
                embedded: embeddedTokens,
                structure: structureTokens
            },
            warnings
        };
    }
    return total;
}

// Example:
// const tokens = approximateTokens(myInput, 'gpt-4o');
// const details = approximateTokens(myInput, 'claude', true) as { total: number; ... };