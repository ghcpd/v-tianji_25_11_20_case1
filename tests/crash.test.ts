import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as vm from 'vm';
import * as path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, '..', 'input.ts'), 'utf-8');

function runOriginalInSandbox() {
  const sandbox: any = { console, setTimeout, clearTimeout, Promise, Math };
  vm.createContext(sandbox);
  // run the module code in sandbox
  vm.runInContext(source, sandbox, { filename: 'input.ts' });
  return sandbox;
}

describe('original crash reproduction', () => {
  it('getTimestamp should throw when cache missing', () => {
    const s = runOriginalInSandbox();
    const f = new s.RemoteFetcher();
    expect(() => f.getTimestamp('one')).toThrow();
  });

  it('Lifecycle.boot should throw when status null', () => {
    const s = runOriginalInSandbox();
    const Lc = s.Lifecycle;
    const life = new Lc();
    life.status = null;
    expect(() => life.boot()).toThrow();
  });

  it('mutateProto should throw on missing newField', () => {
    const s = runOriginalInSandbox();
    expect(() => s.mutateProto({})).toThrow();
  });

  it('dynamicInvoke should throw when handler not function', () => {
    const s = runOriginalInSandbox();
    expect(() => s.dynamicInvoke({ f: 123 }, 'f')).toThrow();
  });

  it('walker should throw when node.root missing children', () => {
    const s = runOriginalInSandbox();
    expect(() => s.walker({ root: { a: { children: { b: {} } } } })).toThrow();
  });

  it('normalizeUser should throw for deep missing properties', () => {
    const s = runOriginalInSandbox();
    expect(() => s.normalizeUser({ id: 123, profile: {}, tags: null })).toThrow();
  });

  it('raceAndUse crashes when fetchResource returns payload-only object', async () => {
    const s = runOriginalInSandbox();
    // override to ensure fetch resolves quickly to payload-only object
    s.RemoteFetcher.prototype.fetchResource = function() {
      return Promise.resolve({ id: 'x', ts: Date.now() });
    };
    await expect(s.raceAndUse()).rejects.toBeDefined();
  });
});

describe('fixed version should be safe', () => {
  it('fixed getTimestamp returns string safely', async () => {
    const mod = await import('../fixed_version');
    const f = new mod.RemoteFetcher();
    expect(f.getTimestamp('one')).toBe('0');
  });

  it('fixed Lifecycle.boot does not throw', async () => {
    const mod = await import('../fixed_version');
    const life = new mod.Lifecycle();
    life.status = null as any;
    expect(() => life.boot()).not.toThrow();
  });

  it('fixed mutateProto does not throw', async () => {
    const mod = await import('../fixed_version');
    expect(() => mod.mutateProto({})).not.toThrow();
  });

  it('fixed dynamicInvoke returns null for non-function', async () => {
    const mod = await import('../fixed_version');
    expect(mod.dynamicInvoke({ f: 123 }, 'f')).toBe(null);
  });

  it('fixed walker handles missing children', async () => {
    const mod = await import('../fixed_version');
    expect(mod.walker({ root: { a: { children: { b: {} } } } })).toBeGreaterThan(0);
  });

  it('fixed normalizeUser returns safe object', async () => {
    const mod = await import('../fixed_version');
    expect(mod.normalizeUser({ id: 123, profile: {}, tags: null })).toEqual({ id: '123', city: '', tags: [] });
  });

  it('fixed raceAndUse returns null when winner malformed', async () => {
    const mod = await import('../fixed_version');
    // override fetchResource to resolve to payload only
    mod.RemoteFetcher.prototype.fetchResource = function() {
      return Promise.resolve({ id: 'x', ts: Date.now() });
    };
    expect(await mod.raceAndUse()).toBe(null);
  });
});
