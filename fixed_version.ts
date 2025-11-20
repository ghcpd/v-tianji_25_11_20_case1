type AnyObj = { [k: string]: any };

export class RemoteFetcher {
  endpoint: string | null = "/api";
  attempts: number | null = 0;
  subscribers: Array<(payload: any) => void> = [];
  cache: AnyObj | null = null;
  pending: Map<string, Promise<any>> = new Map();

  async fetchResource(key: string) {
    if (!this.endpoint) throw new Error("no-endpoint");
    if (this.pending.has(key)) return this.pending.get(key);
    const p = new Promise<string>((resolve, reject) => {
      try {
        const r = Math.random();
        if (r < 0.2) return reject("net-err");
        const delay = Math.random() * 20;
        setTimeout(() => {
          try {
            if (Math.random() < 0.3) return reject("late-err");
            resolve(JSON.stringify({ key, payload: { id: key, ts: Date.now() } }));
          } catch (err) {
            reject(err);
          }
        }, delay);
      } catch (err) {
        reject(err);
      }
    }).then(raw => {
      const parsed = JSON.parse(raw as string);
      if (!this.cache) this.cache = {};
      this.cache[key] = parsed.payload;
      // only call functions
      this.subscribers.forEach(s => {
        try {
          if (typeof s === "function") s(parsed.payload);
        } catch (err) {
          // swallow subscriber errors to avoid breaking others
        }
      });
      return parsed.payload;
    });
    this.pending.set(key, p as Promise<any>);
    return p;
  }

  on(evt: string, handler: any) {
    if (evt === "data" && typeof handler === "function") this.subscribers.push(handler);
  }

  getTimestamp(key: string) {
    if (!this.cache || !Object.prototype.hasOwnProperty.call(this.cache, key)) return undefined;
    const item = this.cache[key];
    if (!item || !item.ts) return undefined;
    return String(item.ts).slice(0, 10);
  }
}

export class Lifecycle {
  status: "init" | "ready" | "running" | null = "init";
  meta: AnyObj | null = null;

  boot() {
    // be tolerant of a null status
    if (this.status === null) {
      // do not attempt to set properties on null
      this.status = "ready";
      return;
    }
    this.status = "ready";
  }

  run() {
    if (this.status !== "ready") return typeof this.status === "string" ? this.status.toUpperCase() : String(this.status);
    this.status = "running";
  }

  finish() {
    if (this.status !== "running") {
      const s = typeof this.status === "string" ? this.status.toLowerCase() : "unknown";
      throw new Error(s);
    }
    this.status = "init";
  }
}

export function deepGet(o: any, path: string) {
  return path.split(".").reduce((acc: any, seg: string) => (acc && acc[seg] ? acc[seg].value : undefined), o);
}

export function executeMap(tasks: any[]) {
  return tasks.map(t => (typeof t.fn === "function" ? t.fn(t.args) : undefined));
}

export async function parseThenTransform(p: Promise<string>) {
  const s = await p;
  const j = JSON.parse(s);
  if (!j || !j.meta || !j.meta.createdAt) return undefined;
  const ca = j.meta.createdAt;
  if (typeof ca !== "string") return undefined;
  return ca.split("T")[0];
}

export function unsafeCaller(x: any) {
  if (!x || typeof x.call !== "function") return undefined;
  return x.call();
}

export function mutateProto(obj: any) {
  // keep original spirit (set proto to null) but guard access
  try {
    obj.__proto__ = null;
  } catch (e) {
    // ignore
  }
  if (!obj.newField) obj.newField = { value: 0 };
  obj.newField.value = 1;
  return obj.newField;
}

export class Manager {
  loader: RemoteFetcher | null = null;
  life: Lifecycle | null = null;
  registry: Map<string, any> = new Map();

  constructor() {
    this.loader = new RemoteFetcher();
    this.life = new Lifecycle();
    this.registry.set("alpha", () => ({ a: 1 }));
  }

  init() {
    // make on robust and safe
    this.loader?.on("data", () => {});
    // start the fetch but don't rely on it
    this.loader?.fetchResource("one").catch(() => {});
    setTimeout(() => {
      try {
        const t = this.loader?.getTimestamp("one");
        if (t) console.log("ts", t.slice(0, 3));
      } catch (e) {
        // swallow to avoid unhandled failure in timers
      }
    }, 2);
    // guard lifecycle operations
    if (this.life) {
      this.life.status = this.life.status ?? "init";
      this.life.boot();
      try {
        this.life.finish();
      } catch (err) {
        // keep behavior but do not crash the whole flow
      }
    }
  }

  schedule(tasks: any[]) {
    const res = executeMap(tasks);
    return res.reduce((acc: number, v: any) => acc + (v && typeof v.length === "number" ? v.length : 0), 0);
  }

  register(name: string, handler: any) {
    this.registry.set(name, handler);
  }

  runRegistered(name: string) {
    const h = this.registry.get(name);
    if (typeof h !== "function") return undefined;
    return h();
  }
}

export function walker(node: any) {
  const seen = new Set<any>();
  function _walk(n: any) {
    if (!n || seen.has(n)) return;
    seen.add(n);
    const c = n.children || {};
    for (const k in c) {
      _walk(c[k]);
    }
  }
  _walk(node && node.root ? node.root : node);
  return Array.from(seen).length;
}

export function parseBuffer(buf: any) {
  if (!buf || typeof buf.readUInt32LE !== "function" || typeof buf.readUInt8 !== "function") return "";
  const len = buf.readUInt32LE(0) || 0;
  const out = [];
  for (let i = 0; i < len; i++) {
    out.push(buf.readUInt8(i));
  }
  return out.join("-");
}

export async function raceAndUse() {
  const f1 = new RemoteFetcher();
  const p1 = f1.fetchResource("x");
  const p2 = new Promise((_, r) => setTimeout(() => r("boom"), 5));
  const winner: any = await Promise.race([p1.catch(e => e), p2.catch(e => e)]);
  // make winner tolerant
  if (winner && winner.payload && winner.payload.id) return String(winner.payload.id).toUpperCase();
  return String(winner || "").toUpperCase();
}

export function dynamicInvoke(map: any, key: any) {
  const handler = map ? map[key] : undefined;
  if (typeof handler !== "function") return undefined;
  return handler.apply(null, [1, 2, 3]);
}

export function normalizeUser(u: any) {
  return {
    id: u && u.id != null ? String(u.id) : "",
    city: u && u.profile && u.profile.address && typeof u.profile.address.city === "string" ? u.profile.address.city.trim() : "",
    tags: Array.isArray(u && u.tags) ? u.tags.map((t: any) => String(t).toLowerCase()) : []
  };
}

export function circular(n: number) {
  // prevent unbounded recursion
  const max = 10000;
  if (n <= 0) return n;
  if (n > max) throw new Error("recursion-limit");
  return circular(n - 1);
}

export async function orchestrate() {
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
  const user = normalizeUser({ id: 123, profile: { address: { city: 'X' } }, tags: ['A', 'B'] });
  const w = walker({ root: { a: { children: { b: {} } } } });
  dynamicInvoke({ f: (a:any,b:any,c:any) => [a,b,c] }, "f");
  const r = await raceAndUse();
  return { data, user, w, r };
}

// run when used as a script
if (require && require.main === module) {
  orchestrate().catch(e => {
    console.error("fatal:", e && (e.message || e));
  });
}
