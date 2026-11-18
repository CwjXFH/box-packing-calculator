/**
 * 表单输入解析与校验。界面上的尺寸单位是 cm（最多 1 位小数），内部统一换算成整数毫米。
 */
import { MAX_DIMENSION_MM, type Vec3 } from "./packing";

export interface FormValues {
  bigLength: string;
  bigWidth: string;
  bigHeight: string;
  bigWeight: string;
  smallLength: string;
  smallWidth: string;
  smallHeight: string;
  smallWeight: string;
  thickness: string;
  divisor: string;
}

export type FieldName = keyof FormValues;

export const DEFAULT_FORM: FormValues = {
  bigLength: "60",
  bigWidth: "40",
  bigHeight: "50",
  bigWeight: "300",
  smallLength: "32.5",
  smallWidth: "23.5",
  smallHeight: "4",
  smallWeight: "100",
  thickness: "0.5",
  divisor: "6000",
};

export interface ParsedInput {
  /** 大箱子外径（mm） */
  outer: Vec3;
  /** 大箱子内腔（mm） = 外径 − 2 × 壁厚 */
  inner: Vec3;
  /** 小箱子外径（mm） */
  box: Vec3;
  thicknessMm: number;
  bigWeightG: number;
  smallWeightG: number;
  divisor: number;
}

export type FieldErrors = Partial<Record<FieldName, string>>;

const CM_PATTERN = /^\d+(\.\d)?$/;
const NUMBER_PATTERN = /^\d+(\.\d+)?$/;
const MAX_CM = MAX_DIMENSION_MM / 10;

/** "32.5" → 325（mm）；不合法返回错误信息 */
export function parseCm(
  raw: string,
  { allowZero = false } = {}
): number | string {
  const s = raw.trim();
  if (s === "") return "请填写";
  if (!CM_PATTERN.test(s)) {
    return /^\d+\.\d{2,}$/.test(s)
      ? "最多 1 位小数（精度 0.1cm）"
      : "请输入数字";
  }
  const mm = Math.round(Number(s) * 10);
  if (!allowZero && mm === 0) return "必须大于 0";
  if (mm > MAX_DIMENSION_MM) return `不能超过 ${MAX_CM} cm`;
  return mm;
}

function parseNonNegative(raw: string): number | string {
  const s = raw.trim();
  if (s === "") return "请填写";
  if (!NUMBER_PATTERN.test(s)) return "请输入数字";
  return Number(s);
}

export function parseForm(form: FormValues): {
  input: ParsedInput | null;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const num = (field: FieldName, v: number | string): number => {
    if (typeof v === "string") {
      errors[field] = v;
      return 0;
    }
    return v;
  };

  const outer: Vec3 = [
    num("bigLength", parseCm(form.bigLength)),
    num("bigWidth", parseCm(form.bigWidth)),
    num("bigHeight", parseCm(form.bigHeight)),
  ];
  const box: Vec3 = [
    num("smallLength", parseCm(form.smallLength)),
    num("smallWidth", parseCm(form.smallWidth)),
    num("smallHeight", parseCm(form.smallHeight)),
  ];
  const thicknessMm = num(
    "thickness",
    parseCm(form.thickness, { allowZero: true })
  );
  const bigWeightG = num("bigWeight", parseNonNegative(form.bigWeight));
  const smallWeightG = num("smallWeight", parseNonNegative(form.smallWeight));
  const divisor = num("divisor", parseNonNegative(form.divisor));
  if (!errors.divisor && divisor === 0) errors.divisor = "必须大于 0";

  const inner: Vec3 = [
    outer[0] - 2 * thicknessMm,
    outer[1] - 2 * thicknessMm,
    outer[2] - 2 * thicknessMm,
  ];
  if (!errors.thickness) {
    const fields: FieldName[] = ["bigLength", "bigWidth", "bigHeight"];
    const tooThin = fields.filter((f, i) => !errors[f] && inner[i] <= 0);
    tooThin.forEach(f => (errors[f] = "扣除两侧壁厚后内径 ≤ 0"));
    if (tooThin.length > 0) errors.thickness = "壁厚过大，大箱子内径 ≤ 0";
  }

  if (Object.keys(errors).length > 0) return { input: null, errors };
  return {
    input: {
      outer,
      inner,
      box,
      thicknessMm,
      bigWeightG,
      smallWeightG,
      divisor,
    },
    errors,
  };
}

/** 毫米 → 厘米字符串（整数毫米 / 10 不会出现 0.30000000000000004 之类的问题） */
export function cm(mm: number): string {
  return String(mm / 10);
}

export function dims(v: Vec3): string {
  return `${cm(v[0])} × ${cm(v[1])} × ${cm(v[2])}`;
}
