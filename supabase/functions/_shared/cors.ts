// supabase/functions/_shared/cors.ts
export const ALLOWED_ORIGINS = new Set<string>([
    // Webflow (staging)
    'https://evoenglish.webflow.io',

    // PROD домены (оба варианта — с ev и evo, и с www)
    'https://evo-english.com',
    'https://www.evo-english.com',

    // локальная разработка
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',

    // если тестируешь прямо в Webflow Preview, раскомментируй:
    //'https://preview.webflow.com',
]);

export function getCorsHeaders(req: Request): Headers {
    const origin = req.headers.get('Origin') ?? '';
    const h = new Headers();

    if (ALLOWED_ORIGINS.has(origin)) {
        h.set('Access-Control-Allow-Origin', origin);
    }
    h.set('Vary', 'Origin');
    h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    // Разрешаем запрошенные заголовки (делает preflight более гибким)
    const reqHdrs = req.headers.get('Access-Control-Request-Headers');
    h.set(
        'Access-Control-Allow-Headers',
        reqHdrs || 'authorization, x-client-info, apikey, content-type, x-guest'
    );

    // Если когда-нибудь понадобятся cookies с функции:
    // h.set('Access-Control-Allow-Credentials','true');

    return h;
}

