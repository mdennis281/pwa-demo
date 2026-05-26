import { useState, useCallback } from 'react';
import { DemoPage } from '../_DemoPage';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Types                                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface Purchase {
  id: number;
  transactionId: string;
  customerName: string;
  email: string;
  amount: number;
  category: string;
  merchant: string;
  date: string;        // 'YYYY-MM-DD'
  status: 'completed' | 'pending' | 'refunded';
  cardLast4: string;
  region: string;
}

type Backend = 'mem' | 'ls' | 'idb';

interface QR {
  ms: number;
  count: number;
  dataBytes: number;  // bytes of data this backend had to read/deserialize
}

interface BenchRow {
  id: string;
  label: string;
  desc: string;
  /** short note rendered below the card explaining why results look the way they do */
  note?: string;
  /** highlights IDB's genuine structural advantage vs a case where async overhead dominates */
  tag?: 'idb-wins' | 'tradeoff';
  results: Partial<Record<Backend, QR | 'err'>>;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Data generation                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

const FIRST = [
  'Alice','Aaron','Amber','Bob','Beth','Brian','Carol','Chris','Claire',
  'David','Diana','Emma','Ethan','Frank','Grace','Hank','Henry','Isabel',
  'James','Kate','Liam','Mia','Noah','Olivia','Paul','Quinn','Rachel',
  'Sam','Tina','Uma','Victor','Wendy','Xander','Yara','Zoe',
];
const LAST = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
  'Wilson','Anderson','Taylor','Thomas','Moore','Jackson','Martin',
  'Lee','White','Harris','Clark','Lewis','Robinson','Walker','Hall',
];
const CATS = [
  'Electronics','Clothing','Food','Travel','Entertainment',
  'Health','Books','Sports','Home','Automotive',
] as const;
const MERCH = [
  'Amazon','Best Buy','Target','Walmart','Apple Store','Nike',
  'Whole Foods','Expedia','Netflix','CVS','Barnes & Noble','REI',
  'IKEA','AutoZone','Costco','Etsy','eBay','Adobe','Microsoft','Spotify',
];
const REGIONS = ['Northeast','Southeast','Midwest','Southwest','West','Pacific'];
const STATUSES = [
  'completed','completed','completed','completed',
  'pending','pending','refunded',
] as const;

const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const rp = <T,>(a: readonly T[]) => a[ri(0, a.length - 1)];

function genData(n: number): Purchase[] {
  const base = new Date('2024-01-01').getTime();
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    transactionId: `TXN-${String(1_000_000 + i).padStart(7, '0')}`,
    customerName: `${rp(FIRST)} ${rp(LAST)}`,
    email: `user${i}@example.com`,
    amount: +(Math.random() * 499.99 + 0.01).toFixed(2),
    category: rp(CATS),
    merchant: rp(MERCH),
    date: new Date(base + ri(0, 364) * 86_400_000).toISOString().slice(0, 10),
    status: rp(STATUSES),
    cardLast4: String(ri(1000, 9999)),
    region: rp(REGIONS),
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* IndexedDB helpers                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

const DB_NAME = 'idb-demo', STORE = 'purchases';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' });
        const idxFields = ['transactionId','category','amount','date','customerName','status'];
        idxFields.forEach(k => s.createIndex(k, k, { unique: k === 'transactionId' }));
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

function idbClear(db: IDBDatabase): Promise<void> {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

function idbPutAll(db: IDBDatabase, records: Purchase[]): Promise<void> {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    const s  = tx.objectStore(STORE);
    records.forEach(r => s.put(r));
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

function idbByIndex(
  db: IDBDatabase,
  idx: string,
  range: IDBValidKey | IDBKeyRange,
): Promise<Purchase[]> {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const r  = tx.objectStore(STORE).index(idx).getAll(range);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

/** Count matching records without deserializing any of them — O(log n) */
function idbCount(
  db: IDBDatabase,
  idx: string,
  range: IDBValidKey | IDBKeyRange,
): Promise<number> {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const r  = tx.objectStore(STORE).index(idx).count(range);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Timing helpers                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

const AVG_RECORD_BYTES = 270;

function syncT<T>(fn: () => T): [T, number] {
  const t = performance.now();
  const v = fn();
  return [v, performance.now() - t];
}

async function asyncT<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = performance.now();
  const v = await fn();
  return [v, performance.now() - t];
}

const LS_KEY = 'idb-demo-v1';
let memStore: Purchase[] = [];

function tick() { return new Promise<void>(r => setTimeout(r, 16)); }

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Formatting                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function fmtMs(ms: number) {
  if (ms < 0.01) return '<0.01 ms';
  if (ms < 1)    return `${ms.toFixed(3)} ms`;
  if (ms < 10)   return `${ms.toFixed(2)} ms`;
  return `${ms.toFixed(1)} ms`;
}

function fmtBytes(b: number) {
  if (b < 1024)        return `${b} B`;
  if (b < 1_048_576)   return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Config                                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

const COUNTS = [1_000, 5_000, 10_000, 25_000, 50_000] as const;
type Count = (typeof COUNTS)[number];

const BACKENDS: Backend[] = ['mem', 'ls', 'idb'];

const BK: Record<Backend, { label: string; color: string; bar: string; ring: string; dimBar: string }> = {
  mem: {
    label:  'Memory',
    color:  'text-amber-400',
    bar:    'bg-amber-500',
    ring:   'ring-amber-500/40',
    dimBar: 'bg-amber-500/30',
  },
  ls: {
    label:  'LocalStorage',
    color:  'text-rose-400',
    bar:    'bg-rose-500',
    ring:   'ring-rose-500/40',
    dimBar: 'bg-rose-500/30',
  },
  idb: {
    label:  'IndexedDB',
    color:  'text-emerald-400',
    bar:    'bg-emerald-500',
    ring:   'ring-emerald-500/40',
    dimBar: 'bg-emerald-500/30',
  },
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Component                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function IndexedDBDemo() {
  const [count, setCount]   = useState<Count>(10_000);
  const [rows, setRows]     = useState<BenchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase]   = useState('');

  const runBench = useCallback(async () => {
    setRunning(true);
    setRows([]);

    const push = (r: BenchRow) => setRows(prev => [...prev, r]);

    // ── Generate ────────────────────────────────────────────────────────────
    setPhase('Generating records…');
    await tick();
    const data = genData(count);
    const totalBytes = data.length * AVG_RECORD_BYTES;

    // stable middle record for point lookups
    const midIdx  = Math.floor(data.length / 2);
    const midTxn  = data[midIdx].transactionId;

    // ── Open IDB ────────────────────────────────────────────────────────────
    let db: IDBDatabase;
    try {
      db = await openIDB();
      await idbClear(db);
    } catch (e) {
      setPhase(`IndexedDB unavailable: ${e}`);
      setRunning(false);
      return;
    }

    // ════════════════════════════════════════════
    // 1. SEED — write all records
    // ════════════════════════════════════════════
    setPhase('Seeding all backends…');
    await tick();

    const seedRow: BenchRow = {
      id: 'seed',
      label: 'Write All Records',
      desc: `Bulk insert ${count.toLocaleString()} purchase records into each storage backend`,
      results: {},
    };

    // Memory
    {
      const [, ms] = syncT(() => { memStore = [...data]; });
      seedRow.results.mem = { ms, count: data.length, dataBytes: totalBytes };
    }

    // LocalStorage
    let lsFullBytes = 0;
    try {
      const json = JSON.stringify(data);
      lsFullBytes = json.length * 2; // JS strings are UTF-16
      const [, ms] = syncT(() => localStorage.setItem(LS_KEY, json));
      seedRow.results.ls = { ms, count: data.length, dataBytes: lsFullBytes };
    } catch {
      seedRow.results.ls = 'err';
    }

    // IndexedDB
    {
      const [, ms] = await asyncT(() => idbPutAll(db, data));
      seedRow.results.idb = { ms, count: data.length, dataBytes: totalBytes };
    }

    push(seedRow);

    // ════════════════════════════════════════════
    // 2. POINT LOOKUP — find 1 record by transactionId
    // ════════════════════════════════════════════
    setPhase('Query 1 / 5 — Point lookup…');
    await tick();

    const lookupRow: BenchRow = {
      id: 'lookup',
      label: 'Point Lookup',
      desc: `Retrieve exactly 1 record by transactionId — ${midTxn}`,
      results: {},
    };

    {
      const [r, ms] = syncT(() => memStore.find(x => x.transactionId === midTxn));
      lookupRow.results.mem = { ms, count: r ? 1 : 0, dataBytes: totalBytes };
    }

    try {
      const [r, ms] = syncT(() => {
        const all: Purchase[] = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
        return all.find(x => x.transactionId === midTxn);
      });
      lookupRow.results.ls = { ms, count: r ? 1 : 0, dataBytes: lsFullBytes || totalBytes };
    } catch { lookupRow.results.ls = 'err'; }

    {
      // IDB index lookup — only the single matching record is fetched
      const [r, ms] = await asyncT(() => idbByIndex(db, 'transactionId', midTxn));
      lookupRow.results.idb = { ms, count: r.length, dataBytes: r.length * AVG_RECORD_BYTES };
    }

    push(lookupRow);

    // ════════════════════════════════════════════
    // 3. COUNT — aggregate without loading records
    // ════════════════════════════════════════════
    setPhase('Query 2 / 7 — Count query…');
    await tick();

    const countRow: BenchRow = {
      id: 'count',
      label: 'Count Records',
      desc: 'Count Electronics purchases — IDB uses index.count(), zero records are deserialized',
      tag: 'idb-wins',
      note:
        'IDB\'s index.count() traverses the B-tree and tallies matches without pulling a single ' +
        'record across the IPC boundary. Memory and LocalStorage must iterate the entire dataset.',
      results: {},
    };

    {
      const [n, ms] = syncT(() => memStore.filter(x => x.category === 'Electronics').length);
      countRow.results.mem = { ms, count: n, dataBytes: totalBytes };
    }

    try {
      const [n, ms] = syncT(() => {
        const all: Purchase[] = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
        return all.filter(x => x.category === 'Electronics').length;
      });
      countRow.results.ls = { ms, count: n, dataBytes: lsFullBytes || totalBytes };
    } catch { countRow.results.ls = 'err'; }

    {
      const [n, ms] = await asyncT(() => idbCount(db, 'category', 'Electronics'));
      countRow.results.idb = { ms, count: n, dataBytes: 0 }; // no records loaded!
    }

    push(countRow);

    // ════════════════════════════════════════════
    // 4. EXISTS CHECK — boolean, no record load
    // ════════════════════════════════════════════
    setPhase('Query 3 / 7 — Exists check…');
    await tick();

    const existsRow: BenchRow = {
      id: 'exists',
      label: 'Exists Check',
      desc: 'Does this transactionId exist? Boolean answer — no need to load the full record',
      tag: 'idb-wins',
      note:
        'index.count(key) returns 0 or 1 in O(log n) time with no record deserialization. ' +
        'Memory does a linear find() through the entire store. LocalStorage must parse the full blob.',
      results: {},
    };

    {
      const [found, ms] = syncT(() => !!memStore.find(x => x.transactionId === midTxn));
      existsRow.results.mem = { ms, count: found ? 1 : 0, dataBytes: totalBytes };
    }

    try {
      const [found, ms] = syncT(() => {
        const all: Purchase[] = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
        return !!all.find(x => x.transactionId === midTxn);
      });
      existsRow.results.ls = { ms, count: found ? 1 : 0, dataBytes: lsFullBytes || totalBytes };
    } catch { existsRow.results.ls = 'err'; }

    {
      const [n, ms] = await asyncT(() => idbCount(db, 'transactionId', midTxn));
      existsRow.results.idb = { ms, count: n, dataBytes: 0 };
    }

    push(existsRow);

    // ════════════════════════════════════════════
    // 5. CATEGORY FILTER — ~10% of records
    // ════════════════════════════════════════════
    setPhase('Query 4 / 7 — Category filter…');
    await tick();

    const catRow: BenchRow = {
      id: 'cat',
      label: 'Category Filter',
      desc: 'Return all purchases where category = "Electronics" (~10% of records)',
      tag: 'tradeoff',
      note:
        'IDB\'s async IPC and structured-clone deserialization add overhead when fetching large ' +
        'result sets. For bulk reads that return many records, in-memory iteration wins on raw time. ' +
        'IDB still scans far fewer bytes and never blocks the main thread.',
      results: {},
    };

    {
      const [r, ms] = syncT(() => memStore.filter(x => x.category === 'Electronics'));
      catRow.results.mem = { ms, count: r.length, dataBytes: totalBytes };
    }

    try {
      const [r, ms] = syncT(() => {
        const all: Purchase[] = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
        return all.filter(x => x.category === 'Electronics');
      });
      catRow.results.ls = { ms, count: r.length, dataBytes: lsFullBytes || totalBytes };
    } catch { catRow.results.ls = 'err'; }

    {
      const [r, ms] = await asyncT(() => idbByIndex(db, 'category', 'Electronics'));
      catRow.results.idb = { ms, count: r.length, dataBytes: r.length * AVG_RECORD_BYTES };
    }

    push(catRow);

    // ════════════════════════════════════════════
    // 6. AMOUNT RANGE — $50–$200, ~30% of records
    // ════════════════════════════════════════════
    setPhase('Query 5 / 7 — Amount range…');
    await tick();

    const amtRow: BenchRow = {
      id: 'amount',
      label: 'Amount Range',
      desc: 'Return all purchases with amount between $50 and $200 (~30% of records)',
      tag: 'tradeoff',
      note:
        'A 30% hit rate means IDB deserializes ~30% of the store across the IPC boundary. ' +
        'Raw time is slower than memory, but IDB still loads 70% fewer bytes and ' +
        'the call is async — your UI stays responsive while it runs.',
      results: {},
    };

    {
      const [r, ms] = syncT(() => memStore.filter(x => x.amount >= 50 && x.amount <= 200));
      amtRow.results.mem = { ms, count: r.length, dataBytes: totalBytes };
    }

    try {
      const [r, ms] = syncT(() => {
        const all: Purchase[] = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
        return all.filter(x => x.amount >= 50 && x.amount <= 200);
      });
      amtRow.results.ls = { ms, count: r.length, dataBytes: lsFullBytes || totalBytes };
    } catch { amtRow.results.ls = 'err'; }

    {
      const [r, ms] = await asyncT(() =>
        idbByIndex(db, 'amount', IDBKeyRange.bound(50, 200))
      );
      amtRow.results.idb = { ms, count: r.length, dataBytes: r.length * AVG_RECORD_BYTES };
    }

    push(amtRow);

    // ════════════════════════════════════════════
    // 7. DATE RANGE — March 2024, ~8% of records
    // ════════════════════════════════════════════
    setPhase('Query 6 / 7 — Date range…');
    await tick();

    const dateRow: BenchRow = {
      id: 'date',
      label: 'Date Range',
      desc: 'Return all purchases dated in March 2024 (~8% of records)',
      tag: 'tradeoff',
      note:
        'Selective range query (~8% match) — IDB loads significantly less data than LS. ' +
        'Memory wins on raw speed here but loses on persistence and thread-safety.',
      results: {},
    };

    {
      const [r, ms] = syncT(() =>
        memStore.filter(x => x.date >= '2024-03-01' && x.date <= '2024-03-31')
      );
      dateRow.results.mem = { ms, count: r.length, dataBytes: totalBytes };
    }

    try {
      const [r, ms] = syncT(() => {
        const all: Purchase[] = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
        return all.filter(x => x.date >= '2024-03-01' && x.date <= '2024-03-31');
      });
      dateRow.results.ls = { ms, count: r.length, dataBytes: lsFullBytes || totalBytes };
    } catch { dateRow.results.ls = 'err'; }

    {
      const [r, ms] = await asyncT(() =>
        idbByIndex(db, 'date', IDBKeyRange.bound('2024-03-01', '2024-03-31'))
      );
      dateRow.results.idb = { ms, count: r.length, dataBytes: r.length * AVG_RECORD_BYTES };
    }

    push(dateRow);

    // ════════════════════════════════════════════
    // 8. NAME PREFIX — starts with "A"
    // ════════════════════════════════════════════
    setPhase('Query 7 / 7 — Name prefix search…');
    await tick();

    const nameRow: BenchRow = {
      id: 'name',
      label: 'Name Prefix Search',
      desc: 'Return all customers whose name starts with "A" — using IDBKeyRange on the name index',
      tag: 'tradeoff',
      note:
        'Text prefix search via IDBKeyRange.bound("A", "A\\uffff") — no full-text index needed. ' +
        'IDB still loads only matching records. Memory uses .startsWith() in a tight loop ' +
        'which V8 optimizes aggressively, making it faster in raw ms.',
      results: {},
    };

    {
      const [r, ms] = syncT(() => memStore.filter(x => x.customerName.startsWith('A')));
      nameRow.results.mem = { ms, count: r.length, dataBytes: totalBytes };
    }

    try {
      const [r, ms] = syncT(() => {
        const all: Purchase[] = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
        return all.filter(x => x.customerName.startsWith('A'));
      });
      nameRow.results.ls = { ms, count: r.length, dataBytes: lsFullBytes || totalBytes };
    } catch { nameRow.results.ls = 'err'; }

    {
      // IDB lexicographic range: 'A' ≤ key ≤ 'A￿' catches all names starting with 'A'
      const [r, ms] = await asyncT(() =>
        idbByIndex(db, 'customerName', IDBKeyRange.bound('A', 'A￿'))
      );
      nameRow.results.idb = { ms, count: r.length, dataBytes: r.length * AVG_RECORD_BYTES };
    }

    push(nameRow);

    setRunning(false);
    setPhase('');
  }, [count]);

  // Totals
  const totals = rows.length > 0
    ? BACKENDS.reduce((acc, bk) => {
        acc[bk] = rows.reduce((s, r) => {
          const v = r.results[bk];
          return s + (typeof v === 'object' && v ? v.ms : 0);
        }, 0);
        return acc;
      }, {} as Record<Backend, number>)
    : null;

  const maxTotal = totals ? Math.max(...Object.values(totals), 0.001) : 1;

  return (
    <DemoPage
      id="indexed-db"
      title="IndexedDB benchmark"
      blurb="Benchmark in-memory vs localStorage vs IndexedDB."
      maxWidth="5xl"
    >
      <p className="text-slate-400 mb-3 max-w-2xl">
        Head-to-head benchmark of three browser storage backends across a dataset of purchase
        records. Each query runs against{' '}
        <span className="text-amber-400">in-memory arrays</span>,{' '}
        <span className="text-rose-400">LocalStorage</span>, and{' '}
        <span className="text-emerald-400">IndexedDB</span>.
      </p>

      {/* Honest tradeoff callout */}
      <div className="mb-6 max-w-2xl p-4 bg-slate-900 border border-slate-700 rounded-lg">
        <div className="text-sm font-medium text-slate-200 mb-2">The honest tradeoff</div>
        <p className="text-xs text-slate-400 leading-relaxed mb-2">
          <span className="text-amber-400">Memory</span> wins on raw read speed — V8 optimizes
          array iteration aggressively and there's no IPC boundary.
          That speed disappears on every page reload.
        </p>
        <p className="text-xs text-slate-400 leading-relaxed mb-2">
          <span className="text-rose-400">LocalStorage</span> is synchronous — every read blocks
          the main thread while it parses the entire JSON blob. It also hard-caps at 5 MB,
          which you can see fail at ≥25k records.
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="text-emerald-400">IndexedDB</span>'s async overhead is real for bulk
          reads, but it's doing durable, non-blocking work. Its structural win is{' '}
          <strong className="text-slate-200">aggregation without loading records</strong>{' '}
          — <code className="text-emerald-300">count()</code> and{' '}
          <code className="text-emerald-300">exists()</code> are O(log n) with zero
          deserialization, and it handles datasets that would OOM a tab if held in memory.
        </p>
      </div>

      <p className="text-xs text-slate-500 mb-8 max-w-2xl">
        <span className="inline-block bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded mr-1">idb wins</span> cards show queries where IndexedDB's architecture is structurally superior.{' '}
        <span className="inline-block bg-amber-500/10 text-amber-400 text-[10px] px-1.5 py-0.5 rounded mr-1">tradeoff</span> cards show where async overhead costs more than it saves — each has a note explaining the nuance.
      </p>

      {/* Config row */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <span className="text-sm text-slate-400 mr-1">Records:</span>
        {COUNTS.map(c => (
          <button
            key={c}
            onClick={() => setCount(c)}
            disabled={running}
            className={`px-3 py-1.5 rounded text-sm font-mono transition ${
              count === c
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {c >= 1000 ? `${c / 1000}k` : c}
          </button>
        ))}
        {count >= 25_000 && (
          <span className="text-xs text-amber-400 ml-1">
            ⚠ LocalStorage may exceed its 5 MB quota at this size
          </span>
        )}
        <button
          onClick={runBench}
          disabled={running}
          className="ml-auto px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
        >
          {running ? phase : '▶ Run Benchmarks'}
        </button>
      </div>

      {/* Benchmark cards */}
      {rows.length === 0 && !running && (
        <div className="text-center py-16 text-slate-600 border border-dashed border-slate-800 rounded-lg">
          Choose a record count and click <span className="text-slate-400">▶ Run Benchmarks</span>
        </div>
      )}

      <div className="space-y-4">
        {rows.map(row => (
          <BenchCard key={row.id} row={row} />
        ))}
      </div>

      {/* Total row */}
      {totals && rows.length >= 8 && (
        <div className="mt-6 bg-slate-900 border border-slate-700 rounded-lg p-5">
          <div className="text-sm font-medium text-slate-300 mb-4">
            Total time — all 6 operations combined
          </div>
          <div className="grid grid-cols-3 gap-4">
            {BACKENDS.map(bk => {
              const ms = totals[bk];
              const pct = (ms / maxTotal) * 100;
              return (
                <div key={bk}>
                  <div className={`text-xs font-medium mb-1.5 ${BK[bk].color}`}>
                    {BK[bk].label}
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full ${BK[bk].bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="font-mono text-sm">{fmtMs(ms)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Explanation cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard
          color="text-amber-400"
          title="Memory"
          bullets={[
            'Fastest raw reads — no IPC, no deserialization',
            'Full linear scan O(n) for every filter query',
            'Wiped on page reload or tab close',
            'RAM usage grows with dataset — can OOM on large sets',
            'No storage limit other than available RAM',
          ]}
        />
        <InfoCard
          color="text-rose-400"
          title="LocalStorage"
          bullets={[
            'Synchronous — every read/write stalls the main thread',
            'Must stringify the entire store on every write',
            'Must parse the entire JSON blob on every read',
            'Hard 5 MB origin-wide quota (fails at ~25–50k records)',
            'No indexes — every query is a full table scan',
          ]}
        />
        <InfoCard
          color="text-emerald-400"
          title="IndexedDB"
          bullets={[
            'Async — never blocks the main thread',
            'count() and exists() are O(log n) with zero record deserialization',
            'Point lookups via unique indexes beat linear memory scans',
            'Loads only matched records — not the entire store',
            'GBs of persistent storage, survives refresh and tab close',
          ]}
        />
      </div>

      {/* Sample records */}
      <SampleTable />
    </DemoPage>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* BenchCard                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

function BenchCard({ row }: { row: BenchRow }) {
  const valid = BACKENDS
    .map(bk => ({ bk, r: row.results[bk] }))
    .filter((x): x is { bk: Backend; r: QR } => typeof x.r === 'object' && x.r !== null);

  const maxMs    = Math.max(...valid.map(x => x.r.ms),        0.001);
  const maxBytes = Math.max(...valid.map(x => x.r.dataBytes), 1);
  const minMs    = Math.min(...valid.map(x => x.r.ms));

  const tagEl = row.tag === 'idb-wins'
    ? <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">idb wins</span>
    : row.tag === 'tradeoff'
    ? <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">tradeoff</span>
    : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      {/* Query header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
        <span className="font-medium">{row.label}</span>
        {tagEl}
        <span className="text-sm text-slate-500">{row.desc}</span>
      </div>

      {/* Backend columns */}
      <div className="grid grid-cols-3 gap-3">
        {BACKENDS.map(bk => {
          const r    = row.results[bk];
          const meta = BK[bk];

          if (r === 'err') {
            return (
              <div key={bk} className="bg-slate-800/50 rounded-lg p-3">
                <div className={`text-xs font-medium mb-2 ${meta.color}`}>{meta.label}</div>
                <div className="text-xs text-rose-400/70 mt-4">quota exceeded</div>
              </div>
            );
          }

          if (!r) {
            return (
              <div key={bk} className="bg-slate-800/50 rounded-lg p-3 animate-pulse">
                <div className={`text-xs font-medium mb-3 ${meta.color}`}>{meta.label}</div>
                <div className="h-1.5 bg-slate-700 rounded mb-3" />
                <div className="h-3 bg-slate-700 rounded w-20 mb-2" />
                <div className="h-1.5 bg-slate-700 rounded mt-3 mb-1" />
                <div className="h-3 bg-slate-700 rounded w-16" />
              </div>
            );
          }

          const timePct   = (r.ms / maxMs) * 100;
          const bytesPct  = r.dataBytes === 0 ? 0 : Math.max(Math.sqrt(r.dataBytes / maxBytes) * 100, 1.5);
          const isFastest = valid.length > 1 && r.ms === minMs;
          const zeroBytes = r.dataBytes === 0;

          return (
            <div
              key={bk}
              className={`bg-slate-800/50 rounded-lg p-3 ${isFastest ? `ring-1 ${meta.ring}` : ''}`}
            >
              {/* Name + fastest badge */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                {isFastest && (
                  <span className="text-[10px] text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
                    fastest
                  </span>
                )}
              </div>

              {/* Time */}
              <div className="mb-0.5 text-[10px] text-slate-500 uppercase tracking-wider">Time</div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${meta.bar}`}
                  style={{ width: `${timePct}%` }}
                />
              </div>
              <div className="font-mono text-sm mb-3">{fmtMs(r.ms)}</div>

              {/* Data scanned */}
              <div className="mb-0.5 text-[10px] text-slate-500 uppercase tracking-wider">
                Data Scanned
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${meta.dimBar}`}
                  style={{ width: `${bytesPct}%` }}
                />
              </div>
              <div className={`text-xs mb-1 ${
                zeroBytes ? 'text-emerald-400 font-medium' : 'text-slate-400'
              }`}>
                {zeroBytes ? '0 B — no records loaded' : fmtBytes(r.dataBytes)}
              </div>

              {/* Record count */}
              <div className="text-xs text-slate-500">
                {r.count.toLocaleString()} record{r.count !== 1 ? 's' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Contextual note */}
      {row.note && (
        <p className="mt-3 text-xs text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
          {row.note}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* InfoCard                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

function InfoCard({
  color, title, bullets,
}: { color: string; title: string; bullets: string[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className={`text-sm font-medium mb-2 ${color}`}>{title}</div>
      <ul className="space-y-1.5">
        {bullets.map(b => (
          <li key={b} className="text-xs text-slate-400 flex gap-1.5">
            <span className="text-slate-600 shrink-0">·</span>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* SampleTable — preview of the generated data schema                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

const SAMPLE_DATA = genData(8);

function SampleTable() {
  return (
    <div className="mt-10">
      <div className="text-sm font-medium text-slate-300 mb-1">Sample records</div>
      <p className="text-xs text-slate-500 mb-3">
        Each benchmark run generates fresh random data of this shape.
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/70">
            <tr>
              {['transactionId','customerName','amount','category','date','status','merchant','region']
                .map(h => (
                  <th key={h} className="px-3 py-2 font-medium text-slate-400 whitespace-nowrap">
                    {h}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_DATA.map((p, i) => (
              <tr
                key={p.transactionId}
                className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/30'}
              >
                <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">
                  {p.transactionId}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{p.customerName}</td>
                <td className="px-3 py-2 text-emerald-400 font-mono whitespace-nowrap">
                  ${p.amount.toFixed(2)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{p.category}</td>
                <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{p.date}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={
                    p.status === 'completed' ? 'text-emerald-400' :
                    p.status === 'pending'   ? 'text-amber-400'   :
                    'text-rose-400'
                  }>
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{p.merchant}</td>
                <td className="px-3 py-2 whitespace-nowrap">{p.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
