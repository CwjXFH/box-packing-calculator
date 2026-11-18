import { describe, expect, it } from "vitest";
import {
  type Block,
  type Vec3,
  blockCount,
  expandBlocks,
  orientations,
  orientationStats,
  packMixed,
  packSingle,
} from "./packing";

/** 校验方案是真实可摆的：每块都是合法朝向、在内腔内、互不重叠，且数量一致 */
function assertValidLayout(
  container: Vec3,
  box: Vec3,
  blocks: Block[],
  expectedCount: number
) {
  const sortedBox = [...box].sort((a, b) => a - b).join(",");
  let total = 0;
  const ranges = blocks.map(b => {
    expect([...b.boxSize].sort((x, y) => x - y).join(",")).toBe(sortedBox);
    const end = [0, 1, 2].map(i => b.origin[i] + b.grid[i] * b.boxSize[i]);
    for (let i = 0; i < 3; i++) {
      expect(b.origin[i]).toBeGreaterThanOrEqual(0);
      expect(end[i]).toBeLessThanOrEqual(container[i]);
      expect(b.grid[i]).toBeGreaterThan(0);
    }
    total += blockCount(b);
    return { start: b.origin, end };
  });
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const A = ranges[i];
      const B = ranges[j];
      const overlap = [0, 1, 2].every(
        k => A.start[k] < B.end[k] && B.start[k] < A.end[k]
      );
      expect(overlap, `块 ${i} 与块 ${j} 重叠`).toBe(false);
    }
  }
  expect(total).toBe(expectedCount);
}

/** 可复现的伪随机数 */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("orientations", () => {
  it("去掉重复朝向", () => {
    expect(orientations([10, 20, 30])).toHaveLength(6);
    expect(orientations([10, 10, 30])).toHaveLength(3);
    expect(orientations([10, 10, 10])).toHaveLength(1);
  });
});

describe("packSingle", () => {
  it("默认参数", () => {
    const r = packSingle([590, 390, 490], [325, 235, 40]);
    expect(r.best?.count).toBe(28);
  });

  it("整除边界没有浮点误差（旧版 12.1/1.1 只算出 10）", () => {
    expect(packSingle([121, 100, 100], [11, 100, 100]).best?.count).toBe(11);
  });

  it("放不下时返回 null", () => {
    expect(packSingle([100, 100, 100], [101, 10, 10]).best).toBeNull();
  });

  it("非法输入报错", () => {
    expect(() => packSingle([0, 100, 100], [10, 10, 10])).toThrow();
    expect(() => packSingle([100, 100, 100], [-1, 10, 10])).toThrow();
    expect(() => packSingle([100, 100, 100], [1.5, 10, 10])).toThrow();
    expect(() => packSingle([100, 100, NaN], [10, 10, 10])).toThrow();
  });
});

describe("packMixed", () => {
  it("没有 1000 个的上限（旧版显示 1000）", () => {
    const r = packMixed([1000, 1000, 1000], [50, 50, 50]);
    expect(r.count).toBe(8000);
    expect(r.provenOptimal).toBe(true);
  });

  it("默认参数不少于旧版贪心结果 31", () => {
    const container: Vec3 = [590, 390, 490];
    const box: Vec3 = [325, 235, 40];
    const r = packMixed(container, box);
    expect(r.count).toBeGreaterThanOrEqual(31);
    expect(r.count).toBeLessThanOrEqual(r.upperBound);
    assertValidLayout(container, box, r.blocks, r.count);
  });

  it("旧版贪心明显偏少的案例：61×44×70 装 11×8×20（单一方向 96，旧版混合 75）", () => {
    const container: Vec3 = [610, 440, 700];
    const box: Vec3 = [110, 80, 200];
    const r = packMixed(container, box);
    expect(r.count).toBeGreaterThanOrEqual(96);
    assertValidLayout(container, box, r.blocks, r.count);
  });

  it("需要混合朝向才能达到最优：3×3 空间放 2×1 的箱子 = 4 个", () => {
    const r = packMixed([30, 30, 10], [20, 10, 10]);
    expect(packSingle([30, 30, 10], [20, 10, 10]).best?.count).toBe(3);
    expect(r.count).toBe(4);
    expect(r.provenOptimal).toBe(true);
    assertValidLayout([30, 30, 10], [20, 10, 10], r.blocks, 4);
  });

  it("穷举搜索找到交错摆法：41×39×44 装 21×17×21（分块法只有 6 个，真实最优 8 个）", () => {
    const container: Vec3 = [410, 390, 440];
    const box: Vec3 = [210, 170, 210];
    const r = packMixed(container, box);
    expect(r.count).toBe(8);
    expect(r.provenOptimal).toBe(true);
    assertValidLayout(container, box, r.blocks, 8);
  });

  it("穷举搜索证明最优（低于理论上限）：38×31×29 装 7×19.5×22.5 = 8 个", () => {
    const r = packMixed([380, 310, 290], [70, 195, 225]);
    expect(r.count).toBe(8);
    expect(r.upperBound).toBe(9);
    expect(r.provenOptimal).toBe(true);
    assertValidLayout([380, 310, 290], [70, 195, 225], r.blocks, 8);
  });

  it("放不下时为 0", () => {
    const r = packMixed([100, 100, 100], [101, 10, 10]);
    expect(r.count).toBe(0);
    expect(r.blocks).toHaveLength(0);
  });

  it("随机 300 组：方案合法、不少于单一方向、不超过上限", () => {
    const rand = rng(42);
    const int = (lo: number, hi: number) =>
      lo + Math.floor(rand() * (hi - lo + 1));
    for (let n = 0; n < 300; n++) {
      const container: Vec3 = [int(200, 800), int(200, 800), int(200, 800)];
      const box: Vec3 = [int(30, 300), int(30, 300), int(30, 300)];
      const single = packSingle(container, box).best?.count ?? 0;
      const r = packMixed(container, box, { timeLimitMs: 200 });
      expect(r.count, `${container} / ${box}`).toBeGreaterThanOrEqual(single);
      expect(r.count).toBeLessThanOrEqual(r.upperBound);
      assertValidLayout(container, box, r.blocks, r.count);
    }
  }, 180_000);

  it("困难输入在时间预算内返回合法方案", () => {
    const container: Vec3 = [10000, 10000, 10000];
    const box: Vec3 = [23, 31, 47];
    const t = Date.now();
    const r = packMixed(container, box, { timeLimitMs: 1000 });
    expect(Date.now() - t).toBeLessThan(3000);
    expect(r.count).toBeGreaterThanOrEqual(
      packSingle(container, box).best!.count
    );
    expect(r.count).toBeLessThanOrEqual(r.upperBound);
    const total = r.blocks.reduce((s, b) => s + blockCount(b), 0);
    expect(total).toBe(r.count);
  });
});

describe("工具函数", () => {
  it("expandBlocks 截断与 orientationStats 汇总", () => {
    const r = packMixed([30, 30, 10], [20, 10, 10]);
    expect(expandBlocks(r.blocks)).toHaveLength(4);
    expect(expandBlocks(r.blocks, 2)).toHaveLength(2);
    const stats = orientationStats(r.blocks);
    expect(stats.reduce((s, x) => s + x.count, 0)).toBe(4);
  });
});
