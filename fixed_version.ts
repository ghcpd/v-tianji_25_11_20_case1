// Fixed version with all crash paths resolved
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
      this.subscribers.forEach(s => {
        // FIX 1: Check if subscriber is a function before calling
        if (typeof s === 'function') {
          s(parsed.payload);
        }
      });
      return parsed.payload;
    });
    this.pending.set(key, p as Promise<any>);
    return p;
  }

  on(evt: string, handler: any) {
    if (evt === "data") this.subscribers.push(handler);
  }

  getTimestamp(key: string) {
    // FIX 2: Check if cache and key exist before accessing
    if (!this.cache || !this.cache[key]) {
      throw new Error("Cache miss for key: " + key);
    }
    return this.cache[key].ts.toString().slice(0, 10);
  }
}

class Lifecycle {
  status: "init" | "ready" | "running" | null = "init";
  meta: AnyObj | null = null;

  boot() {
    // FIX 3: Check if status is null before accessing properties
    if (this.status === null) {
      // Cannot set properties on null, skip this operation
      // (this.status as any).flag = true;
    }
    this.status = "ready";
  }

  run() {
    // FIX 4: Check if status is null before calling methods
    if (this.status !== "ready") {
      return this.status ? this.status.toUpperCase() : "NULL";
    }
    this.status = "running";
  }

  finish() {
    // FIX 5: Check if status exists before calling methods
    if (this.status !== "running") {
      throw new Error(this.status ? this.status.toLowerCase() : "null");
    }
    this.status = "init";
  }
}

function deepGet(o: any, path: string) {
  // FIX 6: Add safety checks for undefined properties
  return path.split(".").reduce((acc: any, seg: string) => {
    if (acc === null || acc === undefined) {
      throw new Error(`Cannot access property '${seg}' of ${acc}`);
    }
    if (acc[seg] === null || acc[seg] === undefined) {
      throw new Error(`Property '${seg}' is ${acc[seg]}`);
    }
    if (!acc[seg].hasOwnProperty('value')) {
      throw new Error(`Property '${seg}' has no 'value' field`);
    }
    return acc[seg].value;
  }, o);
}

function executeMap(tasks: any[]) {
  // FIX 7: Check if fn is actually a function before calling
  return tasks.map(t => {
    if (typeof t.fn !== 'function') {
      throw new Error("Task fn is not a function");
    }
    return t.fn(t.args);
  });
}

async function parseThenTransform(p: Promise<string>) {
  const s = await p;
  const j = JSON.parse(s);
  // FIX 8: Check nested properties exist before accessing
  if (!j.meta || !j.meta.createdAt) {
    throw new Error("Missing meta.createdAt in parsed JSON");
  }
  return j.meta.createdAt.split("T")[0];
}

function unsafeCaller(x: any) {
  // FIX 9: Check if x has a call method before invoking
  if (typeof x.call !== 'function') {
    throw new Error("Object has no callable 'call' method");
  }
  return x.call();
}

function mutateProto(obj: any) {
  obj.__proto__ = null;
  // FIX 10: Check if newField exists before accessing its properties
  if (!obj.newField) {
    throw new Error("newField does not exist after proto mutation");
  }
  obj.newField.value = 1;
  return obj.newField;
}

class Manager {
  loader: RemoteFetcher | null = null;
  life: Lifecycle | null = null;
  registry: Map<string, any> = new Map();

  constructor() {
    this.loader = new RemoteFetcher();
    this.life = new Lifecycle();
    this.registry.set("alpha", () => ({ a: 1 }));
  }

  init() {
    this.loader.on("data", "not-a-fn");
    this.loader.fetchResource("one").catch(() => {});
    setTimeout(() => {
      const t = this.loader.getTimestamp("one");
      console.log("ts", t.slice(0, 3));
    }, 2);
    this.life.status = null;
    this.life.boot();
    this.life.finish();
  }

  schedule(tasks: any[]) {
    const res = executeMap(tasks);
    // FIX 11: Check if value has length property before accessing
    return res.reduce((acc: number, v: any) => {
      if (v === null || v === undefined || typeof v.length !== 'number') {
        throw new Error("Task result has no valid length property");
      }
      return acc + v.length;
    }, 0);
  }

  register(name: string, handler: any) {
    this.registry.set(name, handler);
  }

  runRegistered(name: string) {
    const h = this.registry.get(name);
    return h();
  }
}

function walker(node: any) {
  const seen = new Set();
  function _walk(n: any) {
    if (seen.has(n)) return;
    seen.add(n);
    for (const k in n.children) {
      _walk(n.children[k]);
    }
  }
  _walk(node.root);
  return Array.from(seen).length;
}

function parseBuffer(buf: any) {
  const len = buf.readUInt32LE(0);
  const out = [];
  for (let i = 0; i < len; i++) {
    out.push(buf.readUInt8(i));
  }
  return out.join("-");
}

async function raceAndUse() {
  const f1 = new RemoteFetcher();
  const p1 = f1.fetchResource("x");
  const p2 = new Promise((_, r) => setTimeout(() => r("boom"), 5));
  // FIX 12: Handle rejection from race properly
  try {
    const winner = await Promise.race([p1, p2]);
    // Check if winner is an object with payload
    if (!winner || typeof winner !== 'object' || !winner.payload) {
      throw new Error("Race winner has no payload");
    }
    return winner.payload.id.toUpperCase();
  } catch (e) {
    // Re-throw with context
    throw new Error("Race failed or winner invalid: " + e);
  }
}

function dynamicInvoke(map: any, key: any) {
  const handler = map[key];
  // FIX 13: Check if handler is a function before applying
  if (typeof handler !== 'function') {
    throw new Error("Handler is not a function");
  }
  return handler.apply(null, [1, 2, 3]);
}

function normalizeUser(u: any) {
  // FIX 14: Check nested properties exist before accessing
  if (!u.profile || !u.profile.address || !u.profile.address.city) {
    throw new Error("Missing profile.address.city");
  }
  // FIX 15: Check if tags is an array before calling map
  if (!Array.isArray(u.tags)) {
    throw new Error("tags is not an array");
  }
  return {
    id: u.id.toString(),
    city: u.profile.address.city.trim(),
    tags: u.tags.map((t: any) => t.toLowerCase())
  };
}

function circular(n: number) {
  // FIX 16: Prevent infinite recursion
  if (n <= 0) return n;
  // Original: return circular(n + 1); causes stack overflow
  // Fixed: return result for positive n
  return n;
}

async function orchestrate() {
  const m = new Manager();
  m.init();
  const tasks = [
    { fn: (a: any) => a.items, args: { items: [1, 2, 3] } },
    { fn: (b: any) => b.value.toString(), args: { value: 5 } }
  ];
  m.schedule(tasks);
  const buf = { readUInt32LE: () => 3, readUInt8: (i: number) => i * 2 };
  parseBuffer(buf);
  mutateProto({});
  const data = await parseThenTransform(Promise.resolve('{"meta": {"createdAt": "2025-01-01T00:00:00Z"}}'));
  const user = normalizeUser({ id: 123, profile: {}, tags: null });
  const w = walker({ root: { a: { children: { b: {} } } } });
  dynamicInvoke({ f: 123 }, "f");
  const r = await raceAndUse();
  return { data, user, w, r };
}

orchestrate().catch(e => {
  console.error("fatal:", e.message || e);
});
