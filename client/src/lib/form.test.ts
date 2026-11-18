import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, cm, parseCm, parseForm } from "./form";

describe("parseCm", () => {
  it("换算成整数毫米", () => {
    expect(parseCm("32.5")).toBe(325);
    expect(parseCm(" 4 ")).toBe(40);
    expect(parseCm("0.1")).toBe(1);
    expect(parseCm("12.1")).toBe(121);
  });
  it("拒绝非法输入", () => {
    expect(parseCm("")).toBeTypeOf("string");
    expect(parseCm("abc")).toBeTypeOf("string");
    expect(parseCm("-3")).toBeTypeOf("string");
    expect(parseCm("1.25")).toBe("最多 1 位小数（精度 0.1cm）");
    expect(parseCm("0")).toBe("必须大于 0");
    expect(parseCm("0", { allowZero: true })).toBe(0);
    expect(parseCm("1000.1")).toBeTypeOf("string");
  });
});

describe("parseForm", () => {
  it("默认值合法，内径扣除两侧壁厚", () => {
    const { input, errors } = parseForm(DEFAULT_FORM);
    expect(errors).toEqual({});
    expect(input!.inner).toEqual([590, 390, 490]);
    expect(input!.box).toEqual([325, 235, 40]);
  });
  it("壁厚过大时报错", () => {
    const { input, errors } = parseForm({ ...DEFAULT_FORM, thickness: "25" });
    expect(input).toBeNull();
    expect(errors.bigWidth).toBeDefined();
    expect(errors.thickness).toBeDefined();
  });
  it("尺寸没填时不误报壁厚", () => {
    const { errors } = parseForm({ ...DEFAULT_FORM, bigLength: "" });
    expect(errors.bigLength).toBe("请填写");
    expect(errors.thickness).toBeUndefined();
  });
  it("体积重除数不能为 0", () => {
    expect(
      parseForm({ ...DEFAULT_FORM, divisor: "0" }).errors.divisor
    ).toBeDefined();
  });
});

describe("cm", () => {
  it("没有浮点尾巴", () => {
    expect(cm(3)).toBe("0.3");
    expect(cm(305)).toBe("30.5");
    expect(cm(600)).toBe("60");
  });
});
