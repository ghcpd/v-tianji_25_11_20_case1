type AnyObj = { [k: string]: any };

/* Fixed versions of the original functions with only minimal guards to avoid crashes.
   The goal is to preserve behaviour while avoiding runtime exceptions from the crash paths discovered. */

class RemoteFetcherFixed {
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
      // guard: only call subscriber if it is a function
      this.subscribers.forEach(s => { if (typeof s === 'function') s(parsed.payload); });
      return parsed.payload;
    });
    this.pending.set(key, p as Promise<any>);
    return p;
  }

  on(evt: string, handler: any) {
    if (evt === "data" && typeof handler === 'function') this.subscribers.push(handler);
  }

  getTimestamp(key: string) {
    // safe access guard
    if (!this.cache || !this.cache[key] || this.cache[key].ts == null) return '0';
    return this.cache[key].ts.toString().slice(0, 10);
  }
}

class LifecycleFixed {
  status: "init" | "ready" | "running" | null = "init";
  meta: AnyObj | null = null;

  boot() {
    // do not attempt to write properties on null
    if (this.status === null) {
      this.status = 'ready';
      return;
    }
    this.status = "ready";
  }

  run() {
    if (this.status !== "ready") return (this.status && this.status.toString().toUpperCase()) || null;
    this.status = "running";
  }

  finish() {
    if (this.status !== "running") {
      throw new Error(this.status ? this.status.toString().toLowerCase() : 'invalid');
    }
    this.status = "init";
  }
}

function deepGetSafe(o: any, path: string) {
  return path.split('.').reduce((acc: any, seg: string) => (acc && acc[seg] ? acc[seg].value : undefined), o);
}

function executeMapSafe(tasks: any[]) {
  return tasks.map(t => (typeof t.fn === 'function' ? t.fn(t.args) : undefined));
}

async function parseThenTransformSafe(p: Promise<string>) {
  const s = await p;
  const j = JSON.parse(s);
  return (j && j.meta && j.meta.createdAt) ? j.meta.createdAt.split('T')[0] : null;
}

function unsafeCallerSafe(x: any) {
  if (typeof x === 'function') return x.call();
  return null;
}

function mutateProtoSafe(obj: any) {
  // don't set __proto__ to null; keep it but avoid crashing if newField missing
  // preserve behaviour but create newField if necessary
  try { obj.__proto__ = obj.__proto__ || Object.prototype; } catch (e) { /* noop */ }
  obj.newField = obj.newField || { value: 0 };
  obj.newField.value = 1;
  return obj.newField;
}

class ManagerFixed {
  loader: RemoteFetcherFixed | null = null;
  life: LifecycleFixed | null = null;
  registry: Map<string, any> = new Map();

  constructor() {
    this.loader = new RemoteFetcherFixed();
    this.life = new LifecycleFixed();
    this.registry.set("alpha", () => ({ a: 1 }));
  }

  init() {
    // guard: only register functions
    this.loader.on("data", () => {});
    this.loader.fetchResource("one").catch(() => {});
    setTimeout(() => {
      const t = this.loader.getTimestamp("one");
      console.log("ts", (t || '').slice(0, 3));
    }, 2);
    this.life.status = null;
    this.life.boot();
    try { this.life.finish(); } catch (e) { /* keep behaviour but avoid crashing the app */ }
  }

  schedule(tasks: any[]) {
    const res = executeMapSafe(tasks);
    return res.reduce((acc: number, v: any) => acc + ((v && v.length) || 0), 0);
  }

  register(name: string, handler: any) {
    this.registry.set(name, handler);
  }

  runRegistered(name: string) {
    const h = this.registry.get(name);
    return typeof h === 'function' ? h() : null;
  }
}

function walkerSafe(node: any) {
  const seen = new Set();
  function _walk(n: any) {
    if (!n || seen.has(n)) return;
    seen.add(n);
    if (!n.children) return;
    for (const k in n.children) {
      _walk(n.children[k]);
    }
  }
  _walk(node.root);
  return Array.from(seen).length;
}

function parseBufferSafe(buf: any) {
  const len = typeof buf.readUInt32LE === 'function' ? buf.readUInt32LE(0) : 0;
  const out = [];
  for (let i = 0; i < len; i++) {
    out.push(typeof buf.readUInt8 === 'function' ? buf.readUInt8(i) : 0);
  }
  return out.join("-");
}

async function raceAndUseFixed() {
  const f1 = new RemoteFetcherFixed();
  const p1 = f1.fetchResource("x");
  const p2 = new Promise((_, r) => setTimeout(() => r("boom"), 5));
  const winner = await Promise.race([p1, p2]);
  // guard: if winner is not an object with payload, return null
  return (winner && winner.payload && winner.payload.id) ? winner.payload.id.toUpperCase() : null;
}

function dynamicInvokeSafe(map: any, key: any) {
  const handler = map[key];
  if (typeof handler !== 'function') return null;
  return handler.apply(null, [1, 2, 3]);
}

function normalizeUserSafe(u: any) {
  return {
    id: u && u.id != null ? u.id.toString() : '0',
    city: (u && u.profile && u.profile.address && u.profile.address.city) ? u.profile.address.city.trim() : '',
    tags: Array.isArray(u && u.tags) ? u.tags.map((t: any) => (t && typeof t === 'string') ? t.toLowerCase() : '') : []
  };
}

function circularSafe(n: number) {
  // fix recursion to terminate
  if (n <= 0) return n;
  return circularSafe(n - 1);
}

export {
  RemoteFetcherFixed as RemoteFetcher,
  LifecycleFixed as Lifecycle,
  deepGetSafe as deepGet,
  executeMapSafe as executeMap,
  parseThenTransformSafe as parseThenTransform,
  unsafeCallerSafe as unsafeCaller,
  mutateProtoSafe as mutateProto,
  ManagerFixed as Manager,
  walkerSafe as walker,
  parseBufferSafe as parseBuffer,
  raceAndUseFixed as raceAndUse,
  dynamicInvokeSafe as dynamicInvoke,
  normalizeUserSafe as normalizeUser,
  circularSafe as circular,
};
