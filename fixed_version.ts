// Note: comments removed as requested
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
        if (typeof s === "function") {
          s(parsed.payload);
        }
      });
      return parsed.payload;
    });
    this.pending.set(key, p as Promise<any>);
    return p;
  }

  on(evt: string, handler: any) {
    if (evt === "data" && typeof handler === "function") {
      this.subscribers.push(handler);
    }
  }

  getTimestamp(key: string) {
    const entry = this.cache?.[key];
    if (!entry || entry.ts === undefined || entry.ts === null) {
      return "";
    }
    return entry.ts.toString().slice(0, 10);
  }
}

class Lifecycle {
  status: "init" | "ready" | "running" | null = "init";
  meta: AnyObj | null = null;

  boot() {
    if (this.status === null) {
      this.status = "init";
    }
    this.status = "ready";
  }

  run() {
    const current = this.status ?? "init";
    if (current !== "ready") return current.toUpperCase();
    this.status = "running";
  }

  finish() {
    const current = this.status ?? "init";
    if (current !== "running") {
      throw new Error(current.toLowerCase());
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
  if (!obj.newField || typeof obj.newField !== "object") {
    obj.newField = { value: 0 };
  } else if (!("value" in obj.newField)) {
    (obj.newField as AnyObj).value = 0;
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
    return res.reduce((acc: number, v: any) => acc + v.length, 0);
  }

  register(name: string, handler: any) {
    this.registry.set(name, handler);
  }

  runRegistered(name: string) {
    const h = this.registry.get(name);
    if (typeof h !== "function") {
      return undefined;
    }
    return h();
  }
}

function walker(node: any) {
  const seen = new Set();
  function _walk(n: any) {
    if (!n || typeof n !== "object" || seen.has(n)) return;
    seen.add(n);
    const children = n.children;
    if (!children || typeof children !== "object") return;
    for (const k of Object.keys(children)) {
      _walk(children[k]);
    }
  }
  _walk(node?.root);
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
  try {
    const winner = await Promise.race([p1, p2]);
    const payload: AnyObj | null = winner && typeof winner === "object" ? winner : { id: winner };
    const identifier = payload?.id;
    if (identifier === undefined || identifier === null) {
      return "UNKNOWN";
    }
    return identifier.toString().toUpperCase();
  } catch (err) {
    return "UNKNOWN";
  }
}

function dynamicInvoke(map: any, key: any) {
  const handler = map[key];
  if (typeof handler !== "function") return undefined;
  return handler.apply(null, [1, 2, 3]);
}

function normalizeUser(u: any) {
  const id = u?.id != null ? u.id.toString() : "";
  const city = u?.profile?.address?.city ? u.profile.address.city.trim() : "";
  const tagsSource = Array.isArray(u?.tags) ? u.tags : [];
  return {
    id,
    city,
    tags: tagsSource.map((t: any) => t.toLowerCase())
  };
}

function circular(n: number) {
  if (n <= 0) return n;
  return circular(n + 1);
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
