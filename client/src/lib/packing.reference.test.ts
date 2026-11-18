/**
 * 与独立实现的「参考精确解」对照，验证 packMixed 的结果：
 * - 数量等于真实最大值（小规模案例可以穷举出真实最大值）
 * - 标记为「已证明最优」时一定真的最优
 *
 * 参考解法刻意不复用 packing.ts 的任何代码：
 * 在 0.1cm（1mm）级别的规则网格上，按顺序找第一个空格子，要么放箱子、要么标记浪费，暴力穷举。
 * 它很慢，只能用于小规模案例，但实现简单、容易确认正确。
 */
import { describe, expect, it } from "vitest";
import { type Vec3, packMixed } from "./packing";

/**
 * 返回真实最大值；超时返回 null。
 * 任何摆法都可以把箱子向原点推紧而不减少数量，推紧后箱子的坐标都是「若干条边长之和」，
 * 所以只需在这些坐标构成的（不等距）网格上穷举，结果仍然精确。
 */
function referenceMax(
  container: Vec3,
  box: Vec3,
  timeLimitMs: number
): number | null {
  // 每个轴上可能出现的坐标：0 和所有 ≤ 容器尺寸的边长组合
  const axisCoords = container.map(limit => {
    const sums = new Set<number>([0]);
    const queue = [0];
    while (queue.length) {
      const s = queue.shift()!;
      for (const e of box) {
        if (s + e <= limit && !sums.has(s + e)) {
          sums.add(s + e);
          queue.push(s + e);
        }
      }
    }
    return [...sums].sort((a, b) => a - b);
  });
  const [cx, cy, cz] = axisCoords;
  const nx = cx.length - 1;
  const ny = cy.length - 1;
  const nz = cz.length - 1;
  const perms: number[][] = [];
  for (const p of [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]) {
    const o = [box[p[0]], box[p[1]], box[p[2]]];
    if (!perms.some(q => q.join() === o.join())) perms.push(o);
  }
  const grid = new Uint8Array(Math.max(0, nx * ny * nz)); // 0 未定，1 有箱子，2 空着
  const at = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const cellVolume = (i: number, j: number, k: number) =>
    (cx[i + 1] - cx[i]) * (cy[j + 1] - cy[j]) * (cz[k + 1] - cz[k]);
  const boxVolume = box[0] * box[1] * box[2];
  const deadline = Date.now() + timeLimitMs;
  let best = 0;
  let timedOut = false;

  const search = (from: number, placed: number, freeVolume: number) => {
    if (timedOut || Date.now() > deadline) {
      timedOut = true;
      return;
    }
    best = Math.max(best, placed);
    if (placed + Math.floor(freeVolume / boxVolume) <= best) return;
    let p = from;
    while (p < grid.length && grid[p]) p++;
    if (p === grid.length) return;
    const i = p % nx;
    const j = Math.floor(p / nx) % ny;
    const k = Math.floor(p / (nx * ny));
    for (const [dx, dy, dz] of perms) {
      const ie = cx.indexOf(cx[i] + dx);
      const je = cy.indexOf(cy[j] + dy);
      const ke = cz.indexOf(cz[k] + dz);
      if (ie < 0 || je < 0 || ke < 0) continue;
      let free = true;
      for (let c = k; c < ke && free; c++)
        for (let b = j; b < je && free; b++)
          for (let a = i; a < ie && free; a++)
            if (grid[at(a, b, c)]) free = false;
      if (!free) continue;
      const set = (v: number) => {
        for (let c = k; c < ke; c++)
          for (let b = j; b < je; b++)
            for (let a = i; a < ie; a++) grid[at(a, b, c)] = v;
      };
      set(1);
      search(p + 1, placed + 1, freeVolume - boxVolume);
      set(0);
    }
    grid[p] = 2;
    search(p + 1, placed, freeVolume - cellVolume(i, j, k));
    grid[p] = 0;
  };
  search(0, 0, cx[nx] * cy[ny] * cz[nz]);
  return timedOut ? null : best;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("与参考精确解对照", () => {
  it("手工挑选的案例", () => {
    const cases: [Vec3, Vec3, number][] = [
      [[30, 30, 10], [20, 10, 10], 4], // 3×3 放 2×1：需要混合朝向
      [[50, 50, 10], [20, 10, 10], 12], // 5×5 放 2×1：25/2 向下取整
      [[410, 390, 440], [210, 170, 210], 8], // 分块法只能 6 个，需要交错摆法
      [[380, 310, 290], [70, 195, 225], 8], // 真实最大值低于理论上限 9
    ];
    for (const [container, box, expected] of cases) {
      expect(
        referenceMax(container, box, 20000),
        `参考解 ${container}/${box}`
      ).toBe(expected);
      const r = packMixed(container, box);
      expect(r.count, `${container}/${box}`).toBe(expected);
      expect(r.provenOptimal).toBe(true);
    }
  }, 60_000);

  it("随机小规模案例：结果等于真实最大值，且「已证明最优」从不误报", () => {
    const rand = rng(2024);
    // 尺寸都取 5mm 的倍数，参考解的网格才足够粗、跑得动
    const int = (lo: number, hi: number) =>
      (lo + Math.floor(rand() * (hi - lo + 1))) * 5;
    let compared = 0;
    for (let attempt = 0; attempt < 400 && compared < 30; attempt++) {
      const container: Vec3 = [int(10, 24), int(10, 24), int(10, 24)];
      const box: Vec3 = [int(3, 12), int(3, 12), int(3, 12)];
      // 只对照小规模案例（先用体积粗筛，避免在大案例上白跑）
      const roughBound = Math.floor(
        (container[0] * container[1] * container[2]) /
          (box[0] * box[1] * box[2])
      );
      if (roughBound > 10) continue;
      const r = packMixed(container, box);
      const truth = referenceMax(container, box, 500);
      if (truth === null) continue;
      compared++;
      expect(r.count, `${container} / ${box}`).toBe(truth);
      if (r.provenOptimal) expect(r.count).toBe(truth);
    }
    expect(compared).toBeGreaterThanOrEqual(20);
  }, 180_000);
});
