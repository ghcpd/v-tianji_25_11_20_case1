/* eslint-disable @typescript-eslint/no-var-requires */
const target = process.env.CODE_VERSION || '../fixed_version';
const imported = require(target);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('RemoteFetcher', () => {
  test('ignores non-function subscribers and resolves payload', async () => {
    jest.useFakeTimers();
    const randSpy = jest
      .spyOn(Math, 'random')
      // net-err check
      .mockReturnValueOnce(0.9)
      // late-err check
      .mockReturnValueOnce(0.9)
      // delay
      .mockReturnValue(0.5);

    const rf = new imported.RemoteFetcher();
    rf.on('data', 'bad-subscriber');
    const p = rf.fetchResource('k');
    jest.advanceTimersByTime(25);
    await expect(p).resolves.toMatchObject({ id: 'k' });
    randSpy.mockRestore();
  });

  test('getTimestamp safely handles missing cache entries', () => {
    const rf = new imported.RemoteFetcher();
    expect(rf.getTimestamp('missing')).toBeNull();
  });
});

describe('Lifecycle', () => {
  test('boot handles null status', () => {
    const l = new imported.Lifecycle();
    l.status = null;
    expect(() => l.boot()).not.toThrow();
    expect(l.status).toBe('ready');
  });

  test('run handles null status gracefully', () => {
    const l = new imported.Lifecycle();
    l.status = null;
    expect(l.run()).toBe('');
  });

  test('finish reports invalid state instead of TypeError', () => {
    const l = new imported.Lifecycle();
    l.status = null;
    expect(() => l.finish()).toThrow(/invalid/);
  });
});

describe('Utility functions', () => {
  test('mutateProto does not throw on empty object', () => {
    expect(() => imported.mutateProto({})).not.toThrow();
    const res = imported.mutateProto({});
    expect(res).toEqual({ value: 1 });
  });

  test('walker tolerates missing children', () => {
    const count = imported.walker({ root: { a: { children: { b: {} } } } });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('dynamicInvoke returns null for non-function handler', () => {
    expect(imported.dynamicInvoke({ f: 123 }, 'f')).toBeNull();
  });

  test('normalizeUser tolerates missing profile and tags', () => {
    const u = imported.normalizeUser({ id: 123, profile: {}, tags: null });
    expect(u).toEqual({ id: '123', city: '', tags: [] });
  });

  test('deepGet returns undefined when path missing', () => {
    expect(imported.deepGet({ a: {} }, 'a.b.c')).toBeUndefined();
  });

  test('executeMap skips invalid tasks', () => {
    const res = imported.executeMap([{ fn: 'notfn', args: {} }]);
    expect(res).toEqual([undefined]);
  });

  test('parseThenTransform returns null on invalid JSON/meta', async () => {
    await expect(imported.parseThenTransform(Promise.resolve('not-json'))).resolves.toBeNull();
    await expect(imported.parseThenTransform(Promise.resolve('{"meta":{}}'))).resolves.toBeNull();
  });

  test('unsafeCaller returns undefined for invalid callable', () => {
    expect(imported.unsafeCaller({})).toBeUndefined();
  });

  test('parseBuffer returns empty string when buffer missing methods', () => {
    expect(imported.parseBuffer({})).toBe('');
  });

  test('circular safely returns 0 for positive n', () => {
    expect(imported.circular(3)).toBe(0);
  });
});

describe('Manager', () => {
  test('init no longer crashes', () => {
    jest.useFakeTimers();
    const randSpy = jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.9)
      .mockReturnValue(0.5);
    const m = new imported.Manager();
    expect(() => m.init()).not.toThrow();
    jest.advanceTimersByTime(5);
    randSpy.mockRestore();
  });

  test('schedule handles empty tasks', () => {
    const m = new imported.Manager();
    expect(m.schedule([])).toBe(0);
  });

  test('runRegistered returns undefined for missing handler', () => {
    const m = new imported.Manager();
    expect(m.runRegistered('missing')).toBeUndefined();
  });
});

describe('raceAndUse', () => {
  test('returns null when race winner lacks payload (p2 wins)', async () => {
    // stub fetchResource to resolve slower than p2
    const orig = imported.RemoteFetcher.prototype.fetchResource;
    imported.RemoteFetcher.prototype.fetchResource = function (key: string) {
      return new Promise(resolve => setTimeout(() => resolve({ payload: { id: key } }), 50));
    };
    jest.useFakeTimers();
    const resPromise = imported.raceAndUse();
    jest.advanceTimersByTime(5);
    await expect(resPromise).resolves.toBeNull();
    imported.RemoteFetcher.prototype.fetchResource = orig;
    jest.useRealTimers();
  });
});

describe('orchestrate', () => {
  test('runs end-to-end without crashing', async () => {
    jest.useFakeTimers();
    const randSpy = jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.9)
      .mockReturnValue(0.5);
    const p = imported.orchestrate();
    await jest.runAllTimersAsync();
    const result = await p;
    expect(result).toHaveProperty('data', '2025-01-01');
    expect(result.user).toEqual({ id: '123', city: '', tags: [] });
    randSpy.mockRestore();
  }, 10000);
});
