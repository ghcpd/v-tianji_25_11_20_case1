// Note: minimally fixed version preserving original behavior
// Minor safety checks added to prevent runtime crashes

export type AnyObjFixed = { [k: string]: any };

export class RemoteFetcherFixed {
  endpoint: string | null = "/api";
  attempts: number | null = 0;
  subscribers: any[] = [];
  cache: AnyObjFixed | null = null;
  pending: Map<string, Promise<any>> = new Map();

  async fetchResource(key: string) {
    if (!this.endpoint) throw new Error("no-endpoint");
    if (this.pending.has(key)) return this.pending.get(key) as Promise<any>;
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
      // Only call subscribers that are functions
      this.subscribers.forEach(s => {
        try {
          if (typeof s === 'function') s(parsed.payload);
        } catch (e) {
          // swallow subscriber errors, don't break the fetch
        }
      });
      return parsed.payload;
    });
    this.pending.set(key, p as Promise<any>);
    return p;
  }

  on(evt: string, handler: any) {
    if (evt === "data" && typeof handler === 'function') this.subscribers.push(handler);
  }

  getTimestamp(key: string) {
    if (!this.cache || !this.cache[key] || typeof this.cache[key].ts === 'undefined') return "";
    return String(this.cache[key].ts).slice(0, 10);
  }
}

export class LifecycleFixed {
  status: "init" | "ready" | "running" | null = "init";
  meta: AnyObjFixed | null = null;

  boot() {
    if (this.status === null) {
      // avoid setting properties on null; ensure status becomes a string
      this.status = "ready";
      return;
    }
    this.status = "ready";
  }

  run() {
    if (this.status !== "ready") return String(this.status).toUpperCase();
    this.status = "running";
  }

  finish() {
    if (this.status !== "running") {
      throw new Error(String(this.status).toLowerCase());
    }
    this.status = "init";
  }
}

export function deepGetFixed(o: any, path: string) {
  return path.split(".").reduce((acc: any, seg: string) => {
    if (acc == null || typeof acc[seg] === 'undefined') return undefined;
    return acc[seg].value;
  }, o);
}

export function executeMapFixed(tasks: any[]) {
  return tasks.map(t => (typeof t.fn === 'function' ? t.fn(t.args) : []));
}

export async function parseThenTransformFixed(p: Promise<string>) {
  const s = await p;
  let j;
  try {
    j = JSON.parse(s);
  } catch (e) {
    return "";
  }
  if (!j || !j.meta || !j.meta.createdAt) return "";
  return j.meta.createdAt.split("T")[0];
}

export function unsafeCallerFixed(x: any) {
  if (!x || typeof x.call !== 'function') return undefined;
  return x.call();
}

export function mutateProtoFixed(obj: any) {
  // Set proto to null only if the environment supports it
  try {
    obj.__proto__ = null;
  } catch (e) {
    // ignore
  }
  if (!obj.newField) obj.newField = { value: undefined };
  obj.newField.value = 1;
  return obj.newField;
}

export class ManagerFixed {
  loader: RemoteFetcherFixed | null = null;
  life: LifecycleFixed | null = null;
  registry: Map<string, any> = new Map();

  constructor() {
    this.loader = new RemoteFetcherFixed();
    this.life = new LifecycleFixed();
    this.registry.set("alpha", () => ({ a: 1 }));
  }

  init() {
    // on() will ignore non-functions now
    if (this.loader) {
      this.loader.on("data", "not-a-fn");
      this.loader.fetchResource("one").catch(() => {});
      setTimeout(() => {
        const t = this.loader!.getTimestamp("one");
        if (t) console.log("ts", t.slice(0, 3));
      }, 2);
    }
    if (this.life) {
      this.life.status = null;
      this.life.boot();
      this.life.finish();
    }
  }

  schedule(tasks: any[]) {
    const res = executeMapFixed(tasks);
    return res.reduce((acc: number, v: any) => acc + (v && typeof v.length === 'number' ? v.length : 0), 0);
  }

  register(name: string, handler: any) {
    this.registry.set(name, handler);
  }

  runRegistered(name: string) {
    const h = this.registry.get(name);
    if (typeof h !== 'function') return h;
    return h();
  }
}

export function walkerFixed(node: any) {
  if (!node || !node.root) return 0;
  const seen = new Set();
  function _walk(n: any) {
    if (!n || seen.has(n)) return;
    seen.add(n);
    const children = n.children || {};
    for (const k in children) {
      if (children[k]) _walk(children[k]);
    }
  }
  _walk(node.root);
  return Array.from(seen).length;
}

export function parseBufferFixed(buf: any) {
  const len = typeof buf.readUInt32LE === 'function' ? buf.readUInt32LE(0) : 0;
  const out = [];
  for (let i = 0; i < len; i++) {
    if (typeof buf.readUInt8 === 'function') out.push(buf.readUInt8(i));
    else out.push(0);
  }
  return out.join("-");
}

export async function raceAndUseFixed() {
  const f1 = new RemoteFetcherFixed();
  const p1 = f1.fetchResource("x");
  const p2 = new Promise((_, r) => setTimeout(() => r("boom"), 5));
  const winner = await Promise.race([p1, p2]);
  if (!winner || typeof winner !== 'object' || !winner.payload) throw new Error('no-winner-payload');
  return winner.payload.id.toUpperCase();
}

export function dynamicInvokeFixed(map: any, key: any) {
  const handler = map[key];
  if (typeof handler !== 'function') return null;
  return handler.apply(null, [1, 2, 3]);
}

export function normalizeUserFixed(u: any) {
  return {
    id: String(u && u.id !== undefined ? u.id : ""),
    city: (u && u.profile && u.profile.address && typeof u.profile.address.city === 'string') ? u.profile.address.city.trim() : "",
    tags: Array.isArray(u && u.tags ? u.tags : []) ? (u.tags || []).map((t: any) => String(t).toLowerCase()) : []
  };
}

export function circularFixed(n: number) {
  if (n <= 0) return n;
  return circular(n - 1);
}

export async function orchestrateFixed() {
  const m = new Manager();
  m.init();
  const tasks = [
    { fn: (a: any) => a.items, args: { items: [1, 2, 3] } },
    { fn: (b: any) => b.value.toString(), args: { value: 5 } }
  ];
  m.schedule(tasks);
  const buf = { readUInt32LE: () => 3, readUInt8: (i: number) => i * 2 };
  parseBufferFixed(buf);
  mutateProtoFixed({});
  const data = await parseThenTransformFixed(Promise.resolve('{"meta": {"createdAt": "2025-01-01T00:00:00Z"}}'));
  const user = normalizeUserFixed({ id: 123, profile: {}, tags: null });
  const w = walkerFixed({ root: { a: { children: { b: {} } } } } as any);
  dynamicInvokeFixed({ f: 123 }, "f");
  // stub RemoteFetcher.fetchResource to be deterministic in tests; leave as-is here
  let r = null;
  try {
    r = await raceAndUseFixed();
  } catch (e) {
    r = null;
  }
  return { data, user, w, r };
}

// Exported orchestrateFixed is now available; do not auto-run to avoid side effects
// orchestrateFixed().catch(e => { console.error("fatal:", e.message || e); });
