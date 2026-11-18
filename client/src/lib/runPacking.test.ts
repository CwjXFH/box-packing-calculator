/**
 * runPackMixed 在没有 Web Worker 的环境（这里的 Node 测试环境就没有）
 * 必须自动退回主线程计算，并得到与直接调用 packMixed 相同的结果。
 */
import { describe, expect, it } from "vitest";
import { packMixed } from "./packing";
import { runPackMixed } from "./runPacking";

describe("runPackMixed", () => {
  it("Worker 不可用时退回主线程，结果一致", async () => {
    expect(typeof Worker).toBe("undefined");
    const r = await runPackMixed([590, 390, 490], [325, 235, 40]);
    const direct = packMixed([590, 390, 490], [325, 235, 40], {
      timeLimitMs: 1500,
    });
    expect(r.count).toBeGreaterThanOrEqual(31);
    expect(r.upperBound).toBe(direct.upperBound);
  });

  it("非法输入时返回失败而不是卡住", async () => {
    await expect(runPackMixed([0, 100, 100], [10, 10, 10])).rejects.toThrow();
  });
});
