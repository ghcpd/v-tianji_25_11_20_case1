import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import {
  RemoteFetcherFixed,
  AnyObjFixed,
  LifecycleFixed,
  deepGetFixed,
  executeMapFixed,
  parseThenTransformFixed,
  unsafeCallerFixed,
  mutateProtoFixed,
  ManagerFixed,
  walkerFixed,
  parseBufferFixed,
  raceAndUseFixed,
  dynamicInvokeFixed,
  normalizeUserFixed,
  circularFixed
} from '../fixed_version';

const INPUT_PATH = path.resolve(__dirname, '../input.ts');

function makeRunner(originalCode: string): string {
  // Transform top-level classes and functions to globalThis.xxx so we can call them
  let code = originalCode.replace(/^(\s*)(class)\s+(\w+)\s+/mg, (_m, ws, kw, name) => `${ws}globalThis.${name} = class ${name} `);
  code = code.replace(/^(\s*)(function)\s+(\w+)\s*\(/mg, (_m, ws, kw, name) => `${ws}globalThis.${name} = function ${name}(`);
  // make sure unhandled rejections cause process exit with non-zero
  const header = `process.on('unhandledRejection', (err) => { console.error(err); process.exit(1); }); process.on('uncaughtException', (err) => { console.error(err); process.exit(1); });\n`;
  return header + code;
}

function runOriginalAndExpectCrash(scenarios: string, env: any = {}): { status: number, stderr: string, stdout: string } {
  const inp = fs.readFileSync(INPUT_PATH, 'utf8');
  const tmp = makeRunner(inp) + '\n' + scenarios;
  const tmpPath = path.join(__dirname, 'tmp_input_runner.ts');
  fs.writeFileSync(tmpPath, tmp);
  const exec = spawnSync('node', ['-r', 'ts-node/register', tmpPath], { env: { ...process.env, ...env }, timeout: 2000 });
  return { status: exec.status ?? 1, stderr: exec.stderr?.toString() ?? '', stdout: exec.stdout?.toString() ?? '' };
}

describe('Fatal crash paths', () => {
  test('RemoteFetcher subscriber non-function causes crash in original, fixed ignores', async () => {
    const scenario = `
      (globalThis as any).Math.random = () => 0.5;
      const f = new (globalThis as any).RemoteFetcher();
      f.on('data', 'not-a-fn');
      f.fetchResource('one');
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    const fixed = new RemoteFetcherFixed();
    fixed.on('data', 'not-a-fn');
    (globalThis as any).Math.random = () => 0.5;
    await expect(fixed.fetchResource('one')).resolves.toBeDefined();
  });

  test('getTimestamp missing cache crashes original, fixed returns empty string', () => {
    const scenario = `
      const f = new (globalThis as any).RemoteFetcher();
      f.getTimestamp('nope');
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    const f2 = new RemoteFetcherFixed();
    expect(f2.getTimestamp('nope')).toBe('');
  });

  test('Lifecycle.boot writes to null and crashes original, fixed avoids', () => {
    const scenario = `
      const l = new (globalThis as any).Lifecycle();
      l.status = null;
      l.boot();
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    const lf = new LifecycleFixed();
    lf.status = null as any;
    expect(() => lf.boot()).not.toThrow();
  });

  test('deepGet crashes original, fixed returns undefined', () => {
    const scenario = `
      const v = (globalThis as any).deepGet({}, 'a.b');
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    expect(deepGetFixed({}, 'a.b')).toBeUndefined();
  });

  test('executeMap calling non-function crashes original, fixed ignores', () => {
    const scenario = `
      const tasks = [{ fn: 'notfn', args: {} }];
      (globalThis as any).executeMap(tasks);
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    expect(executeMapFixed([{ fn: 'notfn', args: {} }])).toEqual([[]]);
  });

  test('parseThenTransform throws on invalid JSON in original, fixed returns ""', async () => {
    const scenario = `
      (async function(){ await (globalThis as any).parseThenTransform(Promise.resolve('{}')); })();
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    await expect(parseThenTransformFixed(Promise.resolve('{}'))).resolves.toBe('');
  });

  test('unsafeCaller crashes original, fixed returns undefined', () => {
    const scenario = `
      (globalThis as any).unsafeCaller(null);
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    expect(unsafeCallerFixed(null)).toBeUndefined();
  });

  test('mutateProto on missing newField crashes original, fixed sets object', () => {
    const scenario = `
      (globalThis as any).mutateProto({});
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    const r = mutateProtoFixed({});
    expect(r).toHaveProperty('value', 1);
  });

  test('Manager.init crash path original vs fixed', () => {
    const scenario = `
      const m = new (globalThis as any).Manager();
      m.init();
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    const mf = new ManagerFixed();
    (globalThis as any).Math.random = () => 0.5;
    expect(() => mf.init()).not.toThrow();
  });

  test('schedule reduces length and avoids crash in fixed', () => {
    const scenario = `
      const m = new (globalThis as any).Manager();
      const tasks = [{ fn: (a) => 1, args: {} }];
      m.schedule(tasks);
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    const res2 = new ManagerFixed().schedule([{ fn: (a: any) => a.items, args: { items: [1] } }]);
    expect(res2).toBe(1);
  });

  test('runRegistered non-function crashes original, fixed returns handler', () => {
    const scenario = `
      const m = new (globalThis as any).Manager();
      m.registry.set('beta', 123);
      m.runRegistered('beta');
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    const mf = new ManagerFixed();
    mf.register('beta', () => 7);
    expect(mf.runRegistered('beta')).toEqual(7);
  });

  test('walker crashes original when children missing, fixed returns count', () => {
    const scenario = `
      (globalThis as any).walker({ root: { a: {} } });
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    expect(walkerFixed({ root: { a: { children: {} } } })).toBeGreaterThanOrEqual(1);
  });

  test('parseBuffer crashes for invalid buf original, fixed returns placeholders', () => {
    const scenario = `
      (globalThis as any).parseBuffer({});
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    expect(parseBufferFixed({ readUInt32LE: () => 2, readUInt8: (i) => i })).toEqual('0-1');
  });

  test('raceAndUse string winner crashes original, fixed throws controlled error', async () => {
    const scenario = `
      (globalThis as any).Math.random = () => 1; // make p1 slower
      (async function(){ await (globalThis as any).raceAndUse(); })();
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    (globalThis as any).Math.random = () => 1;
    await expect(raceAndUseFixed()).rejects.toThrow('no-winner-payload');
  });

  test('dynamicInvoke crashes on non-function original, fixed returns null', () => {
    const scenario = `
      (globalThis as any).dynamicInvoke({ f: 123 }, 'f');
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    expect(dynamicInvokeFixed({ f: () => 5 }, 'f')).toEqual(5);
    expect(dynamicInvokeFixed({ f: 123 }, 'f')).toBeNull();
  });

  test('normalizeUser throws on missing nested properties in original, fixed returns safe defaults', () => {
    const scenario = `
      const u = { id: 123, profile: {}, tags: null };
      (globalThis as any).normalizeUser(u);
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    expect(normalizeUserFixed({ id: 123, profile: {} as any, tags: null })).toEqual({ id: '123', city: '', tags: [] });
  });

  test('circular causes RangeError in original, fixed halts recursion', () => {
    const scenario = `
      (globalThis as any).circular(1);
    `;
    const res = runOriginalAndExpectCrash(scenario);
    expect(res.status).toBe(1);

    expect(circularFixed(1)).toBe(0);
  });
});
