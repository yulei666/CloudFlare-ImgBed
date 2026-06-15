// In-process dispatch for Pages Functions.
//
// Background: on Cloudflare Pages a Function that calls `fetch()` against its
// own custom domain issues a same-zone loopback subrequest, which Cloudflare
// rejects almost instantly with HTTP 522 ("connection timed out"). The WebDAV
// handler (and a few others) were built on such self-calls, so every WebDAV
// operation failed with `API fetch error: Status 522`.
//
// These helpers let one Function invoke another Function's `onRequest` directly,
// in the same isolate, with a faithfully-reconstructed Pages context. No network
// hop, no edge loopback, no 522. The target handler still runs its own logic
// (and its own auth, when it has any), so behaviour is preserved.

/**
 * Invoke a Pages Function `onRequest` handler in-process.
 *
 * @param {(context: object) => Promise<Response>} onRequest - target handler
 * @param {object} opts
 * @param {Request} opts.request - the request to hand to the handler
 * @param {object} opts.env - Pages env bindings
 * @param {(promise: Promise<any>) => void} [opts.waitUntil] - real waitUntil if available
 * @param {object} [opts.params] - route params (e.g. `{ path: [...] }` for `[[path]]`)
 * @returns {Promise<Response>}
 */
export async function dispatchToFunction(onRequest, { request, env, waitUntil, params = {} }) {
    const context = {
        request,
        env,
        params,
        data: {},
        waitUntil: typeof waitUntil === 'function'
            ? waitUntil
            : (promise) => { Promise.resolve(promise).catch(() => {}); },
        next: async () => new Response('Not Found', { status: 404 }),
        passThroughOnException: () => {},
    };

    return onRequest(context);
}

/**
 * Build the `params.path` value that a Pages `[[path]]` catch-all route would
 * receive for a given already-decoded path. The catch-all handlers in this repo
 * reconstruct the id via `decodeURIComponent(params.path).split(',').join('/')`
 * (relying on Array→String coercion joining segments with ","), so we return an
 * array of percent-encoded segments that round-trips back to the original path.
 *
 * @param {string} decodedPath - e.g. "folder/sub/my image.png" (leading slash ok)
 * @returns {{ path: string[] }}
 */
export function toCatchAllParams(decodedPath) {
    const segments = decodedPath
        .split('/')
        .filter(Boolean)
        .map(encodeURIComponent);
    return { path: segments };
}
