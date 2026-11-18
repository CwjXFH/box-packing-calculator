/**
 * 装箱算法：把同一尺寸的小箱子尽可能多地装进一个大箱子（长方体），
 * 小箱子允许任意翻转（6 种朝向），只能沿坐标轴摆放。
 *
 * 约定：
 * - 所有尺寸都是「整数毫米」（界面上 0.1cm 精度 = 1mm），避免浮点误差。
 * - 轴 0 = 长（length），轴 1 = 宽（width），轴 2 = 高（height）。
 *
 * 两种模式：
 * - 单一方向（packSingle）：所有箱子朝向相同，结果就是该约束下的精确最大值。
 * - 混合方向（packMixed），分两步：
 *   1. 分块法：递归「切一刀」把空间分成两块分别求解，每块用单一朝向排满。
 *      速度快、适用于任意规模，结果一定不少于单一方向。
 *   2. 穷举搜索（规模不大时）：可以找到分块法表达不了的「交错」摆法，
 *      并且搜完后能证明结果就是真正的最大值。
 *   另给出理论上限（按体积估算）。结果等于上限或穷举搜完，即「已证明最优」。
 */

export type Vec3 = [number, number, number];

/** 一组同朝向、整齐排列的小箱子 */
export interface Block {
  /** 区域起点（mm，相对大箱子内腔原点） */
  origin: Vec3;
  /** 该区域内每个小箱子在长/宽/高方向的尺寸（mm） */
  boxSize: Vec3;
  /** 长/宽/高方向各排几个 */
  grid: Vec3;
}

export interface Placement {
  position: Vec3;
  size: Vec3;
}

export interface SingleOption {
  boxSize: Vec3;
  grid: Vec3;
  count: number;
  /** 实际占用的内腔尺寸 */
  used: Vec3;
  /** 每个方向剩余的空间 */
  waste: Vec3;
}

export interface SingleResult {
  /** 按数量从多到少排序的所有朝向（已去重） */
  options: SingleOption[];
  /** 最优朝向；一个都放不下时为 null */
  best: SingleOption | null;
}

export interface MixedResult {
  count: number;
  /** 理论最大值（任何摆法都不可能超过） */
  upperBound: number;
  /** 已证明是真正的最大值：达到理论上限，或穷举搜索已完整搜完 */
  provenOptimal: boolean;
  /** guillotine = 分块法；exact = 穷举搜索（找到更优解或完成了最优性证明） */
  method: "guillotine" | "exact";
  /** 搜索是否在时间预算内完整结束 */
  searchComplete: boolean;
  blocks: Block[];
  elapsedMs: number;
}

export interface PackMixedOptions {
  /** 搜索时间上限，超时后返回目前找到的最好方案（仍然是可行方案） */
  timeLimitMs?: number;
}

/** 大箱子内腔尺寸上限（mm），即 10 米 */
export const MAX_DIMENSION_MM = 10000;

/** 小箱子的所有不同朝向 */
export function orientations(box: Vec3): Vec3[] {
  const [a, b, c] = box;
  const all: Vec3[] = [
    [a, b, c],
    [a, c, b],
    [b, a, c],
    [b, c, a],
    [c, a, b],
    [c, b, a],
  ];
  const seen = new Set<string>();
  return all.filter(o => {
    const key = o.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assertValid(container: Vec3, box: Vec3) {
  for (const v of [...container, ...box]) {
    if (!Number.isInteger(v) || v <= 0 || v > MAX_DIMENSION_MM) {
      throw new RangeError(
        `尺寸必须是 1~${MAX_DIMENSION_MM} 之间的整数毫米，收到 ${v}`
      );
    }
  }
}

export function blockCount(b: Block): number {
  return b.grid[0] * b.grid[1] * b.grid[2];
}

// ---------------------------------------------------------------------------
// 单一方向
// ---------------------------------------------------------------------------

export function packSingle(container: Vec3, box: Vec3): SingleResult {
  assertValid(container, box);
  const options: SingleOption[] = orientations(box).map(o => {
    const grid: Vec3 = [
      Math.floor(container[0] / o[0]),
      Math.floor(container[1] / o[1]),
      Math.floor(container[2] / o[2]),
    ];
    const used: Vec3 = [grid[0] * o[0], grid[1] * o[1], grid[2] * o[2]];
    return {
      boxSize: o,
      grid,
      count: grid[0] * grid[1] * grid[2],
      used,
      waste: [
        container[0] - used[0],
        container[1] - used[1],
        container[2] - used[2],
      ],
    };
  });
  options.sort((x, y) => y.count - x.count);
  return { options, best: options[0].count > 0 ? options[0] : null };
}

// ---------------------------------------------------------------------------
// 混合方向
// ---------------------------------------------------------------------------

/**
 * 预处理：哪些长度可以由小箱子的边长组合（a·i + b·j + c·k）恰好拼出。
 * reduce[d] = 不超过 d 的最大可拼长度。一段长度 d 中真正能用上的只有 reduce[d]，
 * 剩下的必然浪费，所以子空间尺寸可以先「缩减」，大幅减少需要搜索的状态。
 */
function buildReduceTable(maxD: number, box: Vec3) {
  const [a, b, c] = box;
  const reachable = new Uint8Array(maxD + 1);
  const reduce = new Int32Array(maxD + 1);
  const normalPoints: number[] = [];
  reachable[0] = 1;
  for (let d = 1; d <= maxD; d++) {
    if (
      (d >= a && reachable[d - a]) ||
      (d >= b && reachable[d - b]) ||
      (d >= c && reachable[d - c])
    ) {
      reachable[d] = 1;
      normalPoints.push(d);
    }
    reduce[d] = reachable[d] ? d : reduce[d - 1];
  }
  return { reduce, normalPoints };
}

/** 递归深度上限，防止极端输入导致栈溢出 */
const MAX_DEPTH = 800;

export function packMixed(
  container: Vec3,
  box: Vec3,
  opts: PackMixedOptions = {}
): MixedResult {
  assertValid(container, box);
  const start = Date.now();
  const deadline = start + (opts.timeLimitMs ?? 2000);

  const volume = box[0] * box[1] * box[2];
  const maxD = Math.max(...container);
  const { reduce, normalPoints } = buildReduceTable(maxD, box);
  const orients = orientations(box);

  // 状态 (x ≤ y ≤ z) → 最多可装数量。由于允许任意翻转，空间的长宽高互换后答案不变，
  // 所以只需存排序后的尺寸。choice 记录该状态的最优做法，用于还原摆放方案：
  //   负数 -(i+1)：整块用第 i 种朝向排满
  //   正数 (axis+1)*K + p：沿排序后的第 axis 维在 p 处切一刀
  const K = maxD + 1;
  const memo = new Map<number, number>();
  const choice = new Map<number, number>();

  let stopped = false;
  let ops = 0;
  const outOfTime = () => {
    if (stopped) return true;
    if ((++ops & 1023) === 0 && Date.now() > deadline) stopped = true;
    return stopped;
  };

  const solveSorted = (
    d0: number,
    d1: number,
    d2: number,
    depth: number
  ): number => {
    // 排序三个数
    let t: number;
    if (d0 > d1) {
      t = d0;
      d0 = d1;
      d1 = t;
    }
    if (d1 > d2) {
      t = d1;
      d1 = d2;
      d2 = t;
    }
    if (d0 > d1) {
      t = d0;
      d0 = d1;
      d1 = t;
    }
    return solve(d0, d1, d2, depth);
  };

  const solve = (x: number, y: number, z: number, depth: number): number => {
    if (x === 0) return 0;
    const key = (x * K + y) * K + z;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const space = x * y * z;
    const ub = Math.floor(space / volume);

    // 1) 整块用一种朝向排满
    let best = 0;
    let bestChoice = 0;
    for (let i = 0; i < orients.length; i++) {
      const o = orients[i];
      const n =
        Math.floor(x / o[0]) * Math.floor(y / o[1]) * Math.floor(z / o[2]);
      if (n > best) {
        best = n;
        bestChoice = -(i + 1);
      }
    }

    // 2) 尝试沿某一维切一刀，两块分别求解
    if (best < ub && depth < MAX_DEPTH) {
      const dims = [x, y, z];
      search: for (let k = 0; k < 3; k++) {
        if (k > 0 && dims[k] === dims[k - 1]) continue; // 两维相等时切法重复
        const D = dims[k];
        const cross = space / D; // 另外两维的面积
        const a = k === 0 ? y : x;
        const b = k === 2 ? y : z;
        for (let j = 0; j < normalPoints.length; j++) {
          const p = normalPoints[j];
          if (p * 2 > D) break; // 切在 p 和切在 D-p 等价，只需看一半
          const q = reduce[D - p];
          // 两块的体积上限之和都不超过当前最优，没必要细算
          if (
            Math.floor((p * cross) / volume) +
              Math.floor((q * cross) / volume) <=
            best
          )
            continue;
          if (outOfTime()) break search;
          const n =
            solveSorted(p, a, b, depth + 1) + solveSorted(q, a, b, depth + 1);
          if (n > best) {
            best = n;
            bestChoice = (k + 1) * K + p;
            if (best >= ub) break search;
          }
        }
      }
    }

    memo.set(key, best);
    choice.set(key, bestChoice);
    return best;
  };

  const r: Vec3 = [
    reduce[container[0]],
    reduce[container[1]],
    reduce[container[2]],
  ];
  const upperBound = Math.floor((r[0] * r[1] * r[2]) / volume);
  const count = solveSorted(r[0], r[1], r[2], 0);
  const guillotineComplete = !stopped;

  // 还原摆放方案
  const blocks: Block[] = [];
  const collect = (origin: Vec3, dims: Vec3) => {
    const rd: Vec3 = [reduce[dims[0]], reduce[dims[1]], reduce[dims[2]]];
    if (rd[0] === 0 || rd[1] === 0 || rd[2] === 0) return;
    // idx[s] = 排序后第 s 维对应的实际轴
    const idx = [0, 1, 2].sort((i, j) => rd[i] - rd[j]);
    const s = [rd[idx[0]], rd[idx[1]], rd[idx[2]]];
    const key = (s[0] * K + s[1]) * K + s[2];
    if (!choice.has(key)) solve(s[0], s[1], s[2], MAX_DEPTH); // 理论上不会发生，兜底
    const ch = choice.get(key)!;
    if (ch < 0) {
      const o = orients[-ch - 1];
      const boxSize: Vec3 = [0, 0, 0];
      const grid: Vec3 = [0, 0, 0];
      for (let t = 0; t < 3; t++) {
        boxSize[idx[t]] = o[t];
        grid[idx[t]] = Math.floor(s[t] / o[t]);
      }
      if (grid[0] * grid[1] * grid[2] > 0)
        blocks.push({ origin, boxSize, grid });
    } else if (ch > 0) {
      const axis = idx[Math.floor(ch / K) - 1];
      const p = ch % K;
      const d1: Vec3 = [...rd];
      const d2: Vec3 = [...rd];
      const o2: Vec3 = [...origin];
      d1[axis] = p;
      d2[axis] = rd[axis] - p;
      o2[axis] += p;
      collect(origin, d1);
      collect(o2, d2);
    }
  };
  collect([0, 0, 0], r);

  if (count === upperBound) {
    return {
      count,
      upperBound,
      provenOptimal: true,
      method: "guillotine",
      searchComplete: true,
      blocks,
      elapsedMs: Date.now() - start,
    };
  }

  // 3) 规模不大时做穷举搜索：既可能找到分块法找不到的「交错」摆法，
  //    也能在搜完后证明结果就是真正的最大值（即使低于理论上限）。
  let exact: ReturnType<typeof exactSearch> = null;
  try {
    exact = exactSearch(r, box, reduce, orients, count, deadline);
  } catch (err) {
    if (!(err instanceof RangeError)) throw err; // 栈溢出等极端情况：保留分块法结果
  }
  if (exact && exact.best > count) {
    return {
      count: exact.best,
      upperBound,
      provenOptimal: exact.complete || exact.best === upperBound,
      method: "exact",
      searchComplete: exact.complete,
      blocks: exact.blocks,
      elapsedMs: Date.now() - start,
    };
  }
  return {
    count,
    upperBound,
    provenOptimal: exact?.complete ?? false,
    method: exact?.complete ? "exact" : "guillotine",
    searchComplete: exact ? exact.complete : guillotineComplete,
    blocks,
    elapsedMs: Date.now() - start,
  };
}

/** 穷举搜索允许的最大网格单元数（同时限制了递归深度） */
const EXACT_MAX_CELLS = 6000;

/**
 * 精确搜索（分支定界）。
 * 把内腔按「可拼长度」切成网格：任何摆法都可以把箱子推向原点而不减少数量，
 * 推完后每个箱子的角点都落在可拼长度上，所以只需考虑网格点。
 * 按 (高, 宽, 长) 顺序找第一个未决定的单元格：要么在这里放一个箱子（6 种朝向），要么认定它空着。
 * 剪枝：已放数量 + 剩余未决定体积 / 单箱体积 ≤ 当前最优 时放弃该分支。
 * 返回 null 表示规模太大不适合穷举。
 */
function exactSearch(
  r: Vec3,
  box: Vec3,
  reduce: Int32Array,
  orients: Vec3[],
  lowerBound: number,
  deadline: number
): { best: number; blocks: Block[]; complete: boolean } | null {
  const coords = r.map(D => {
    const pts = [0];
    for (let d = 1; d <= D; d++) if (reduce[d] === d) pts.push(d);
    return pts;
  });
  const n = coords.map(c => c.length - 1);
  const cells = n[0] * n[1] * n[2];
  if (cells === 0 || cells > EXACT_MAX_CELLS) return null;

  const index = coords.map(c => {
    const m = new Int32Array(c[c.length - 1] + 1).fill(-1);
    c.forEach((x, i) => (m[x] = i));
    return m;
  });
  const volume = box[0] * box[1] * box[2];
  const n0 = n[0];
  const n01 = n[0] * n[1];
  const occ = new Uint8Array(cells); // 0 未决定，1 有箱子，2 空着
  const cellVolume = new Float64Array(cells);
  for (let k = 0; k < n[2]; k++)
    for (let j = 0; j < n[1]; j++)
      for (let i = 0; i < n0; i++)
        cellVolume[k * n01 + j * n0 + i] =
          (coords[0][i + 1] - coords[0][i]) *
          (coords[1][j + 1] - coords[1][j]) *
          (coords[2][k + 1] - coords[2][k]);

  let best = lowerBound;
  let bestLayout: Placement[] | null = null;
  const stack: Placement[] = [];
  let timedOut = false;
  let ops = 0;

  const fill = (
    i0: number,
    i1: number,
    j0: number,
    j1: number,
    k0: number,
    k1: number,
    val: number
  ) => {
    for (let k = k0; k < k1; k++)
      for (let j = j0; j < j1; j++) {
        const base = k * n01 + j * n0;
        for (let i = i0; i < i1; i++) occ[base + i] = val;
      }
  };
  const isFree = (
    i0: number,
    i1: number,
    j0: number,
    j1: number,
    k0: number,
    k1: number
  ) => {
    for (let k = k0; k < k1; k++)
      for (let j = j0; j < j1; j++) {
        const base = k * n01 + j * n0;
        for (let i = i0; i < i1; i++) if (occ[base + i] !== 0) return false;
      }
    return true;
  };

  const dfs = (from: number, placed: number, free: number) => {
    if (timedOut) return;
    if ((++ops & 4095) === 0 && Date.now() > deadline) {
      timedOut = true;
      return;
    }
    if (placed > best) {
      best = placed;
      bestLayout = stack.slice();
    }
    if (placed + Math.floor(free / volume) <= best) return;

    let p = from;
    while (p < cells && occ[p] !== 0) p++;
    if (p >= cells) return;
    const i = p % n0;
    const j = Math.floor(p / n0) % n[1];
    const k = Math.floor(p / n01);
    const x = coords[0][i];
    const y = coords[1][j];
    const z = coords[2][k];

    for (const o of orients) {
      const xe = x + o[0];
      const ye = y + o[1];
      const ze = z + o[2];
      if (xe > r[0] || ye > r[1] || ze > r[2]) continue;
      const ie = index[0][xe];
      const je = index[1][ye];
      const ke = index[2][ze];
      if (!isFree(i, ie, j, je, k, ke)) continue;
      fill(i, ie, j, je, k, ke, 1);
      stack.push({ position: [x, y, z], size: o });
      dfs(p + 1, placed + 1, free - volume);
      stack.pop();
      fill(i, ie, j, je, k, ke, 0);
      if (timedOut) return;
    }
    occ[p] = 2;
    dfs(p + 1, placed, free - cellVolume[p]);
    occ[p] = 0;
  };

  dfs(0, 0, r[0] * r[1] * r[2]);
  const layout = bestLayout as Placement[] | null;
  return {
    best,
    complete: !timedOut,
    blocks: layout
      ? layout.map(pl => ({
          origin: pl.position,
          boxSize: pl.size,
          grid: [1, 1, 1] as Vec3,
        }))
      : [],
  };
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/** 单一方向结果转成 Block，方便与混合方向共用展示逻辑 */
export function singleToBlocks(option: SingleOption | null): Block[] {
  if (!option || option.count === 0) return [];
  return [{ origin: [0, 0, 0], boxSize: option.boxSize, grid: option.grid }];
}

/** 展开为逐个箱子的位置（用于 3D 展示），超过 limit 个时截断 */
export function expandBlocks(blocks: Block[], limit = Infinity): Placement[] {
  const out: Placement[] = [];
  for (const b of blocks) {
    for (let i = 0; i < b.grid[0]; i++) {
      for (let j = 0; j < b.grid[1]; j++) {
        for (let k = 0; k < b.grid[2]; k++) {
          if (out.length >= limit) return out;
          out.push({
            position: [
              b.origin[0] + i * b.boxSize[0],
              b.origin[1] + j * b.boxSize[1],
              b.origin[2] + k * b.boxSize[2],
            ],
            size: b.boxSize,
          });
        }
      }
    }
  }
  return out;
}

/** 按朝向统计数量（从多到少） */
export function orientationStats(
  blocks: Block[]
): { boxSize: Vec3; count: number }[] {
  const map = new Map<string, { boxSize: Vec3; count: number }>();
  for (const b of blocks) {
    const key = b.boxSize.join(",");
    const entry = map.get(key) ?? { boxSize: b.boxSize, count: 0 };
    entry.count += blockCount(b);
    map.set(key, entry);
  }
  return [...map.values()].sort((x, y) => y.count - x.count);
}
