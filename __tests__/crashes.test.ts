import { loadSourceModule } from "../test/loadSource";

type LoadedModule = Record<string, any>;

const original: LoadedModule = loadSourceModule("input.ts");
const fixed: LoadedModule = loadSourceModule("fixed_version.ts");

function stubRandomSequence(sequence: number[]) {
  const originalRandom = Math.random;
  Math.random = () => {
    if (sequence.length) {
      return sequence.shift() as number;
    }
    return 0.5;
  };
  return () => {
    Math.random = originalRandom;
  };
}

describe("Lifecycle boot crash", () => {
  test("null status is handled only in fixed version", () => {
    const oLife = new original.Lifecycle();
    oLife.status = null;
    expect(() => oLife.boot()).toThrow(TypeError);

    const fLife = new fixed.Lifecycle();
    fLife.status = null;
    expect(() => fLife.boot()).not.toThrow();
    expect(fLife.status).toBe("ready");
  });
});

describe("RemoteFetcher timestamp and subscribers", () => {
  test("missing cache entry blows up only in original", () => {
    const oFetcher = new original.RemoteFetcher();
    expect(() => oFetcher.getTimestamp("ghost")).toThrow();

    const fFetcher = new fixed.RemoteFetcher();
    expect(fFetcher.getTimestamp("ghost")).toBe("");
  });

  test("invalid subscriber crashes original fetch", async () => {
    jest.useFakeTimers();
    const oFetcher = new original.RemoteFetcher();
    oFetcher.on("data", "not-a-function");
    const restoreRandom = stubRandomSequence([0.5, 0, 0.5]);
    const promise = oFetcher.fetchResource("alpha");
    jest.runAllTimers();
    await expect(promise).rejects.toThrow(/function/i);
    restoreRandom();
    jest.useRealTimers();
  });

  test("fixed fetch ignores invalid subscribers", async () => {
    jest.useFakeTimers();
    const fFetcher = new fixed.RemoteFetcher();
    fFetcher.on("data", "not-a-function");
    const restoreRandom = stubRandomSequence([0.5, 0, 0.5]);
    const promise = fFetcher.fetchResource("alpha");
    jest.runAllTimers();
    await expect(promise).resolves.toHaveProperty("id", "alpha");
    restoreRandom();
    jest.useRealTimers();
  });
});

describe("Utility crashes", () => {
  test("mutateProto no longer throws when newField is missing", () => {
    expect(() => original.mutateProto({})).toThrow(TypeError);
    expect(() => fixed.mutateProto({})).not.toThrow();
  });

  test("walker tolerates nodes without children", () => {
    const tree = { root: { a: { children: { b: {} } } } };
    expect(() => original.walker(tree)).toThrow(TypeError);
    expect(fixed.walker(tree)).toBe(1);
  });

  test("normalizeUser guards nested properties and tags", () => {
    const payload = { id: 123, profile: {}, tags: null };
    expect(() => original.normalizeUser(payload)).toThrow(TypeError);
    expect(fixed.normalizeUser(payload)).toEqual({ id: "123", city: "", tags: [] });
  });

  test("dynamicInvoke validates handlers", () => {
    const registry = { bad: 123 };
    expect(() => original.dynamicInvoke(registry, "bad")).toThrow(TypeError);
    expect(fixed.dynamicInvoke(registry, "bad")).toBeUndefined();
  });

  test("Manager.runRegistered gracefully handles missing functions", () => {
    const oManager = new original.Manager();
    expect(() => oManager.runRegistered("missing")).toThrow(TypeError);

    const fManager = new fixed.Manager();
    expect(fManager.runRegistered("missing")).toBeUndefined();
  });
});

describe("raceAndUse promise race", () => {
  test("original misreads resolved payload", async () => {
    const spy = jest
      .spyOn(original.RemoteFetcher.prototype, "fetchResource")
      .mockResolvedValue({ id: "omega" });
    await expect(original.raceAndUse()).rejects.toThrow();
    spy.mockRestore();
  });

  test("fixed version returns uppercase id even on races", async () => {
    const spy = jest
      .spyOn(fixed.RemoteFetcher.prototype, "fetchResource")
      .mockResolvedValue({ id: "omega" });
    await expect(fixed.raceAndUse()).resolves.toBe("OMEGA");
    spy.mockRestore();
  });
});
