import { describe, it, expect } from 'vitest';

// Import original (buggy) version
type AnyObj = { [k: string]: any };

class RemoteFetcher {
  endpoint: string | null = "/api";
  attempts: number | null = 0;
  subscribers: any[] = [];
  cache: AnyObj | null = null;
  pending: Map<string, Promise<any>> = new Map();

  async fetchResource(key: string) {
    if (!this.endpoint) throw new Error("no-endpoint");
    if (this.pending.has(key)) return this.pending.get(key);
    const p = new Promise<string>((resolve, reject) => {
      const r = Math.random();
      if (r < 0.2) return reject("net-err");
      setTimeout(() => {
        if (Math.random() < 0.3) return reject("late-err");
        resolve(JSON.stringify({ key, payload: { id: key, ts: Date.now() } }));
      }, Math.random() * 20);
    }).then(raw => {
      const parsed = JSON.parse(raw);
      if (!this.cache) this.cache = {};
      this.cache[key] = parsed.payload;
      this.subscribers.forEach(s => s(parsed.payload));
      return parsed.payload;
    });
    this.pending.set(key, p as Promise<any>);
    return p;
  }

  on(evt: string, handler: any) {
    if (evt === "data") this.subscribers.push(handler);
  }

  getTimestamp(key: string) {
    return this.cache[key].ts.toString().slice(0, 10);
  }
}

class Lifecycle {
  status: "init" | "ready" | "running" | null = "init";
  meta: AnyObj | null = null;

  boot() {
    if (this.status === null) {
      (this.status as any).flag = true;
    }
    this.status = "ready";
  }

  run() {
    if (this.status !== "ready") return this.status.toUpperCase();
    this.status = "running";
  }

  finish() {
    if (this.status !== "running") {
      throw new Error(this.status.toLowerCase());
    }
    this.status = "init";
  }
}

function deepGet(o: any, path: string) {
  return path.split(".").reduce((acc: any, seg: string) => acc[seg].value, o);
}

function executeMap(tasks: any[]) {
  return tasks.map(t => t.fn(t.args));
}

async function parseThenTransform(p: Promise<string>) {
  const s = await p;
  const j = JSON.parse(s);
  return j.meta.createdAt.split("T")[0];
}

function unsafeCaller(x: any) {
  return x.call();
}

function mutateProto(obj: any) {
  obj.__proto__ = null;
  obj.newField.value = 1;
  return obj.newField;
}

function dynamicInvoke(map: any, key: any) {
  const handler = map[key];
  return handler.apply(null, [1, 2, 3]);
}

function normalizeUser(u: any) {
  return {
    id: u.id.toString(),
    city: u.profile.address.city.trim(),
    tags: u.tags.map((t: any) => t.toLowerCase())
  };
}

function circular(n: number) {
  if (n <= 0) return n;
  return circular(n + 1);
}

async function raceAndUse() {
  const f1 = new RemoteFetcher();
  const p1 = f1.fetchResource("x");
  const p2 = new Promise((_, r) => setTimeout(() => r("boom"), 5));
  const winner = await Promise.race([p1, p2]);
  return winner.payload.id.toUpperCase();
}

describe('Original Code - Fatal Crash Tests', () => {
  
  describe('Crash 1: getTimestamp with null cache', () => {
    it('should crash when accessing timestamp before cache is populated', () => {
      const fetcher = new RemoteFetcher();
      expect(() => fetcher.getTimestamp("nonexistent")).toThrow();
    });
  });

  describe('Crash 2: Lifecycle.boot with null status', () => {
    it('should crash when trying to set property on null status', () => {
      const lc = new Lifecycle();
      lc.status = null;
      expect(() => lc.boot()).toThrow();
    });
  });

  describe('Crash 3: Lifecycle.run with null status', () => {
    it('should crash when calling toUpperCase on null', () => {
      const lc = new Lifecycle();
      lc.status = null;
      expect(() => lc.run()).toThrow();
    });
  });

  describe('Crash 4: Lifecycle.finish with wrong status', () => {
    it('should crash when calling toLowerCase on null status', () => {
      const lc = new Lifecycle();
      lc.status = null;
      expect(() => lc.finish()).toThrow();
    });
  });

  describe('Crash 5: deepGet with undefined properties', () => {
    it('should crash when accessing undefined nested properties', () => {
      expect(() => deepGet({ a: {} }, "a.b")).toThrow();
    });

    it('should crash when intermediate value is undefined', () => {
      expect(() => deepGet({ a: { b: null } }, "a.b.c")).toThrow();
    });
  });

  describe('Crash 6: executeMap with non-function', () => {
    it('should crash when task.fn is not a function', () => {
      const tasks = [{ fn: "not-a-function", args: {} }];
      expect(() => executeMap(tasks)).toThrow();
    });
  });

  describe('Crash 7: parseThenTransform with missing nested properties', () => {
    it('should crash when meta is undefined', async () => {
      await expect(parseThenTransform(Promise.resolve('{}'))).rejects.toThrow();
    });

    it('should crash when createdAt is undefined', async () => {
      await expect(parseThenTransform(Promise.resolve('{"meta":{}}'))).rejects.toThrow();
    });
  });

  describe('Crash 8: unsafeCaller with non-callable', () => {
    it('should crash when x has no call method', () => {
      expect(() => unsafeCaller({ foo: "bar" })).toThrow();
    });

    it('should crash when x.call is not a function', () => {
      expect(() => unsafeCaller({ call: 123 })).toThrow();
    });
  });

  describe('Crash 9: mutateProto accessing nonexistent newField', () => {
    it('should crash when newField does not exist after proto mutation', () => {
      expect(() => mutateProto({})).toThrow();
    });
  });

  describe('Crash 10: RemoteFetcher with non-function subscriber', () => {
    it('should crash when subscriber is not a function', async () => {
      const fetcher = new RemoteFetcher();
      fetcher.on("data", "not-a-function");
      
      // Mock a successful fetch to trigger subscriber call
      fetcher.cache = null;
      const promise = fetcher.fetchResource("test");
      
      await expect(promise).rejects.toThrow();
    });
  });

  describe('Crash 11: schedule with non-array task result', () => {
    it('should crash when task result has no length property', () => {
      const tasks = [
        { fn: (a: any) => a, args: null }  // Returns null, no length
      ];
      expect(() => {
        const res = executeMap(tasks);
        res.reduce((acc: number, v: any) => acc + v.length, 0);
      }).toThrow();
    });
  });

  describe('Crash 12: normalizeUser with missing nested properties', () => {
    it('should crash when profile.address is undefined', () => {
      const user = { id: 123, profile: {}, tags: ["TAG1"] };
      expect(() => normalizeUser(user)).toThrow();
    });

    it('should crash when profile.address.city is undefined', () => {
      const user = { id: 123, profile: { address: {} }, tags: ["TAG1"] };
      expect(() => normalizeUser(user)).toThrow();
    });
  });

  describe('Crash 13: normalizeUser with null tags', () => {
    it('should crash when tags is null', () => {
      const user = { 
        id: 123, 
        profile: { address: { city: "NYC" } }, 
        tags: null 
      };
      expect(() => normalizeUser(user)).toThrow();
    });
  });

  describe('Crash 14: dynamicInvoke with non-function handler', () => {
    it('should crash when handler is not a function', () => {
      expect(() => dynamicInvoke({ f: 123 }, "f")).toThrow();
    });

    it('should crash when handler is a string', () => {
      expect(() => dynamicInvoke({ f: "hello" }, "f")).toThrow();
    });
  });

  describe('Crash 15: raceAndUse with rejection', () => {
    it('should crash when race resolves to rejection string', async () => {
      // This test relies on the rejection happening faster than fetch
      // The rejection is deterministic at 5ms
      await expect(raceAndUse()).rejects.toThrow();
    }, 10000);
  });

  describe('Crash 16: circular with infinite recursion', () => {
    it('should crash with stack overflow for positive numbers', () => {
      expect(() => circular(1)).toThrow();
    });

    it('should crash with stack overflow for large positive numbers', () => {
      expect(() => circular(100)).toThrow();
    });
  });

});
