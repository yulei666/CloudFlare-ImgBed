import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCatchAllParams, dispatchToFunction } from '../functions/utils/internalDispatch.js';

// Mirror of how the [[path]] catch-all handlers (file/, api/manage/delete/)
// reconstruct the id from params.path.
function reconstructId(params) {
    return decodeURIComponent(params.path).split(',').join('/');
}

test('toCatchAllParams round-trips a nested path', () => {
    const params = toCatchAllParams('folder/sub/img.png');
    assert.equal(reconstructId(params), 'folder/sub/img.png');
});

test('toCatchAllParams strips a leading slash', () => {
    const params = toCatchAllParams('/a/b.png');
    assert.equal(reconstructId(params), 'a/b.png');
});

test('toCatchAllParams handles spaces and unicode', () => {
    const params = toCatchAllParams('相册/my image.png');
    assert.equal(reconstructId(params), '相册/my image.png');
});

test('toCatchAllParams handles a single top-level file', () => {
    const params = toCatchAllParams('img.png');
    assert.deepEqual(params.path, ['img.png']);
    assert.equal(reconstructId(params), 'img.png');
});

test('dispatchToFunction passes a faithful context and returns the handler response', async () => {
    let seen = null;
    const fakeHandler = async (ctx) => {
        seen = ctx;
        return new Response('ok', { status: 200 });
    };
    const req = new Request('https://example.com/api/manage/list?dir=&count=-1');
    const res = await dispatchToFunction(fakeHandler, {
        request: req,
        env: { FOO: 'bar' },
        waitUntil: undefined,
        params: { path: ['x'] },
    });
    assert.equal(res.status, 200);
    assert.equal(seen.request, req);
    assert.equal(seen.env.FOO, 'bar');
    assert.deepEqual(seen.params, { path: ['x'] });
    assert.equal(typeof seen.waitUntil, 'function'); // falls back to a no-op
    assert.equal(typeof seen.next, 'function');
    // no-op waitUntil must not throw and must swallow rejections
    assert.doesNotThrow(() => seen.waitUntil(Promise.reject(new Error('ignored'))));
});
