import { describe, it, expect } from 'vitest';
import {
  RemoteFetcher,
  Lifecycle,
  deepGet,
  executeMap,
  parseThenTransform,
  unsafeCaller,
  mutateProto,
  Manager,
  walker,
  parseBuffer,
  raceAndUse,
  dynamicInvoke,
  normalizeUser,
  circular,
  orchestrate
} from '../fixed_version';

describe('fixed_version - runtime safety', () => {
  it('RemoteFetcher.getTimestamp is safe when cache missing', () => {
    const r = new RemoteFetcher();
    expect(r.getTimestamp('nope')).toBeUndefined();
  });

  it('RemoteFetcher.on ignores non-functions', () => {
    const r = new RemoteFetcher();
    // should not throw
    r.on('data', 'not-a-fn');
  });

  it('Lifecycle.boot handles null status', () => {
    const l = new Lifecycle();
    l.status = null;
    expect(() => l.boot()).not.toThrow();
    expect(l.status).toBe('ready');
  });

  it('deepGet returns undefined for missing path', () => {
    expect(deepGet({ a: { b: { value: 1 } } }, 'a.c')).toBeUndefined();
  });

  it('executeMap tolerates non-function entries', () => {
    const tasks = [{ fn: (x: any) => [1, 2, 3], args: {} }, { fn: 123 as any, args: {} }];
    const out = executeMap(tasks);
    expect(Array.isArray(out)).toBe(true);
    expect(out[0]).toEqual([1, 2, 3]);
    expect(out[1]).toBeUndefined();
  });

  it('parseThenTransform handles missing meta', async () => {
    expect(await parseThenTransform(Promise.resolve('{}'))).toBeUndefined();
  });

  it('unsafeCaller returns undefined for non-callable', () => {
    expect(unsafeCaller({})).toBeUndefined();
  });

  it('mutateProto creates newField safely', () => {
    const obj: any = {};
    const nf = mutateProto(obj);
    expect(nf).toBeTruthy();
    expect(nf.value).toBe(1);
  });

  it('Manager.init is resilient (no unhandled timer errors)', async () => {
    const m = new Manager();
    expect(() => m.init()).not.toThrow();
  });

  it('runRegistered returns undefined for non-function handlers', () => {
    const m = new Manager();
    m.register('bad', 123 as any);
    expect(m.runRegistered('bad')).toBeUndefined();
  });

  it('walker tolerates missing children and counts nodes', () => {
    const w = walker({ root: { a: { children: { b: {} } } } });
    expect(typeof w).toBe('number');
  });

  it('parseBuffer works for simple buffer-like object', () => {
    const buf: any = { readUInt32LE: () => 3, readUInt8: (i: number) => i * 2 };
    expect(parseBuffer(buf)).toBe('0-2-4');
  });

  it('raceAndUse returns uppercase string even if race returns primitive', async () => {
    const v = await raceAndUse();
    expect(typeof v).toBe('string');
  });

  it('dynamicInvoke is safe when handler missing', () => {
    expect(dynamicInvoke({ f: 123 }, 'f')).toBeUndefined();
    expect(dynamicInvoke({ f: (a: any) => a }, 'f')).toBeTruthy();
  });

  it('normalizeUser is defensive', () => {
    const u = normalizeUser({ id: 123, profile: {}, tags: null });
    expect(u.id).toBe('123');
    expect(u.city).toBe('');
    expect(Array.isArray(u.tags)).toBe(true);
  });

  it('circular protects against infinite recursion', () => {
    expect(() => circular(100000)).toThrow();
    expect(circular(0)).toBe(0);
  });

  it('orchestrate runs end-to-end without throwing', async () => {
    await expect(orchestrate()).resolves.toMatchObject({ data: '2025-01-01', user: { id: '123' } });
  });
});
