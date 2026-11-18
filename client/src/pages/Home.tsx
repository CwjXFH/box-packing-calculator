import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import PackingVisualization3D, {
  MAX_RENDERED_BOXES,
  ORIENTATION_COLORS,
} from "@/components/PackingVisualization3D";
import {
  DEFAULT_FORM,
  type FieldName,
  type FormValues,
  type ParsedInput,
  cm,
  dims,
  parseForm,
} from "@/lib/form";
import {
  type Block,
  type MixedResult,
  type SingleResult,
  type Vec3,
  blockCount,
  expandBlocks,
  orientationStats,
  packSingle,
  singleToBlocks,
} from "@/lib/packing";
import { runPackMixed } from "@/lib/runPacking";
import { type ReactNode, useCallback, useMemo, useState } from "react";

interface Calculation {
  /** 计算时的表单内容，用于判断结果是否过期 */
  formKey: string;
  input: ParsedInput;
  single: SingleResult;
  mixed: MixedResult;
}

/** 方案明细最多列出多少个区域 */
const MAX_LISTED_BLOCKS = 50;

export default function Home() {
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [mixedMode, setMixedMode] = useState(true);
  const [calc, setCalc] = useState<Calculation | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const { input, errors } = useMemo(() => parseForm(form), [form]);
  const formKey = JSON.stringify(form);
  const stale = calc !== null && calc.formKey !== formKey;

  const setField = (name: FieldName, value: string) =>
    setForm(f => ({ ...f, [name]: value }));

  const calculate = async () => {
    setShowErrors(true);
    if (!input) return;
    setCalculating(true);
    setCalcError(null);
    try {
      const single = packSingle(input.inner, input.box);
      const mixed = await runPackMixed(input.inner, input.box);
      setCalc({ formKey, input, single, mixed });
    } catch (err) {
      setCalcError(String(err));
    } finally {
      setCalculating(false);
    }
  };

  const applyOptimalSize = () => {
    const best = calc?.single.best;
    if (!calc || !best) return;
    const t = calc.input.thicknessMm * 2;
    setForm(f => ({
      ...f,
      bigLength: cm(best.used[0] + t),
      bigWidth: cm(best.used[1] + t),
      bigHeight: cm(best.used[2] + t),
    }));
  };

  const field = (
    name: FieldName,
    label: string,
    unit: string,
    hint?: string
  ) => (
    <NumberField
      name={name}
      label={label}
      unit={unit}
      value={form[name]}
      error={showErrors || form[name].trim() !== "" ? errors[name] : undefined}
      hint={hint}
      onChange={v => setField(name, v)}
    />
  );

  const innerHint = (i: number) =>
    input ? `内径 ${cm(input.inner[i])} cm` : undefined;

  return (
    <div className="min-h-screen grid-bg">
      <header className="py-10 md:py-14 text-center border-b border-border">
        <h1
          className="text-4xl md:text-6xl font-black"
          style={{ color: "#00e5ff" }}
        >
          装箱计算器
        </h1>
        <p className="mt-3 text-gray-400">
          计算一个大箱子最多能装下多少个同尺寸的小箱子
        </p>
      </header>

      <main className="container py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* 参数设置 */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 border-2 border-primary/30 gap-4">
              <h2 className="text-xl font-bold text-primary">大箱子（外径）</h2>
              {field("bigLength", "长", "cm", innerHint(0))}
              {field("bigWidth", "宽", "cm", innerHint(1))}
              {field("bigHeight", "高", "cm", innerHint(2))}
              {field("bigWeight", "空箱重量", "g")}
            </Card>
            <Card className="p-6 border-2 border-destructive/30 gap-4">
              <h2 className="text-xl font-bold text-destructive">
                小箱子（外径）
              </h2>
              {field("smallLength", "长", "cm")}
              {field("smallWidth", "宽", "cm")}
              {field("smallHeight", "高", "cm")}
              {field("smallWeight", "单个重量", "g")}
            </Card>
          </div>

          <Card className="p-6 border-2 border-border gap-4">
            <div className="grid md:grid-cols-2 gap-6">
              {field("thickness", "大箱子壁厚", "cm", "内径 = 外径 − 2 × 壁厚")}
              {field(
                "divisor",
                "体积重除数",
                "",
                "常见值：6000（国内）、5000（国际）"
              )}
            </div>
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
              <div>
                <Label htmlFor="mode" className="text-base font-bold">
                  {mixedMode ? "混合方向" : "单一方向"}
                </Label>
                <p className="text-sm text-gray-400 mt-1">
                  {mixedMode
                    ? "小箱子可以不同方向摆放，能装得更多"
                    : "所有小箱子保持同一方向，装箱操作更简单"}
                </p>
              </div>
              <Switch
                id="mode"
                checked={mixedMode}
                onCheckedChange={setMixedMode}
              />
            </div>
          </Card>

          <div className="flex flex-col items-center gap-3 py-4">
            <Button
              onClick={calculate}
              disabled={calculating}
              size="lg"
              className="px-12 py-7 text-xl font-bold neon-glow"
            >
              {calculating ? "计算中…" : "开始计算"}
            </Button>
            {showErrors && !input && (
              <p className="text-destructive">请先修正上面标红的输入项</p>
            )}
            {calcError && (
              <p className="text-destructive">计算出错：{calcError}</p>
            )}
          </div>

          {calc && (
            <div>
              {stale && (
                <div className="mb-4 p-4 border-2 border-yellow-500 bg-[#2a2408] text-yellow-300 text-center sticky top-0 z-10">
                  参数已修改，下面是上一次的结果，请点击「开始计算」更新
                </div>
              )}
              <div className={stale ? "opacity-40" : undefined}>
                <Results
                  calc={calc}
                  mixedMode={mixedMode}
                  onApplyOptimal={applyOptimalSize}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-6 mt-10 text-center text-gray-500 text-sm">
        装箱计算器 · 尺寸精度 0.1cm · 所有计算均在本机完成
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NumberField(props: {
  name: string;
  label: string;
  unit: string;
  value: string;
  error?: string;
  hint?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={props.name} className="text-sm text-gray-300">
        {props.label}
        {props.unit && <span className="text-gray-500">（{props.unit}）</span>}
      </Label>
      <Input
        id={props.name}
        inputMode="decimal"
        autoComplete="off"
        value={props.value}
        aria-invalid={props.error ? true : undefined}
        onChange={e => props.onChange(e.target.value)}
        onFocus={e => e.target.select()}
        className="mt-1.5 h-11 text-lg font-mono"
      />
      {props.error ? (
        <p className="text-sm text-destructive mt-1">{props.error}</p>
      ) : (
        props.hint && <p className="text-sm text-gray-500 mt-1">{props.hint}</p>
      )}
    </div>
  );
}

function Results({
  calc,
  mixedMode,
  onApplyOptimal,
}: {
  calc: Calculation;
  mixedMode: boolean;
  onApplyOptimal: () => void;
}) {
  const { input, single, mixed } = calc;
  const singleCount = single.best?.count ?? 0;
  const count = mixedMode ? mixed.count : singleCount;

  const blocks: Block[] = useMemo(
    () => (mixedMode ? mixed.blocks : singleToBlocks(single.best)),
    [mixedMode, mixed, single]
  );
  const stats = useMemo(() => orientationStats(blocks), [blocks]);
  const placements = useMemo(
    () => expandBlocks(blocks, MAX_RENDERED_BOXES),
    [blocks]
  );
  const colorIndexOf = useCallback(
    (size: Vec3) => {
      const key = size.join(",");
      return Math.max(
        0,
        stats.findIndex(s => s.boxSize.join(",") === key)
      );
    },
    [stats]
  );

  const boxVolume = input.box[0] * input.box[1] * input.box[2];
  const innerVolume = input.inner[0] * input.inner[1] * input.inner[2];
  const utilization = ((count * boxVolume) / innerVolume) * 100;

  if (count === 0) {
    return (
      <Card className="p-8 border-2 border-destructive text-center">
        <p className="text-2xl font-bold text-destructive">一个都放不下</p>
        <p className="text-gray-400 mt-2">
          小箱子 {dims(input.box)} cm 无论怎么翻转都放不进内径{" "}
          {dims(input.inner)} cm 的大箱子
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 主结果 */}
      <Card className="p-6 md:p-8 border-2 border-primary gap-6">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-[420px] h-[360px] md:h-[420px] flex-shrink-0">
            <PackingVisualization3D
              container={input.inner}
              placements={placements}
              colorIndexOf={colorIndexOf}
            />
          </div>
          <div className="flex-1 space-y-5">
            <div>
              <p className="text-gray-400">
                {mixedMode ? "混合方向" : "单一方向"} · 最多可装
              </p>
              <p className="flex items-baseline gap-3">
                <span className="text-7xl font-black number-display text-primary">
                  {count.toLocaleString()}
                </span>
                <span className="text-2xl text-gray-400">个</span>
              </p>
            </div>
            <OptimalityBadge calc={calc} mixedMode={mixedMode} />
            <div className="grid grid-cols-2 gap-4">
              <Stat label="空间利用率" value={`${utilization.toFixed(1)}%`} />
              <Stat
                label="大箱子内径"
                value={`${dims(input.inner)} cm`}
                small
              />
            </div>
            {placements.length < count && (
              <p className="text-sm text-gray-500">
                3D 图只显示了前 {placements.length.toLocaleString()} 个箱子
              </p>
            )}
          </div>
        </div>
      </Card>

      <WeightCard input={input} count={count} />

      {/* 朝向统计 */}
      <Card className="p-6 border-2 border-border gap-4">
        <h3 className="text-xl font-bold">摆放方向</h3>
        <p className="text-sm text-gray-500 -mt-2">
          尺寸顺序为「沿大箱子长 × 宽 × 高方向」，颜色与 3D 图一致
        </p>
        <div className="space-y-2">
          {stats.map((s, i) => (
            <div
              key={s.boxSize.join(",")}
              className="flex items-center justify-between p-3 border border-border bg-secondary/30"
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-block w-4 h-4"
                  style={{
                    background:
                      ORIENTATION_COLORS[i % ORIENTATION_COLORS.length],
                  }}
                />
                <span className="font-mono">{dims(s.boxSize)} cm</span>
              </div>
              <span className="text-xl font-bold text-primary">
                {s.count.toLocaleString()} 个
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* 分区明细 */}
      <Card className="p-6 border-2 border-border gap-4">
        <h3 className="text-xl font-bold">装箱方案明细</h3>
        <p className="text-sm text-gray-500 -mt-2">
          起点为距大箱子内腔角落的距离（长, 宽,
          高），每个区域内的箱子朝向相同、整齐排列
        </p>
        <div className="space-y-2 font-mono text-sm">
          {blocks.slice(0, MAX_LISTED_BLOCKS).map((b, i) => (
            <div
              key={i}
              className="grid md:grid-cols-[auto_1fr_1fr_auto] gap-x-6 gap-y-1 p-3 border border-border bg-secondary/20"
            >
              <span className="text-gray-500">区域 {i + 1}</span>
              <span>
                起点 ({cm(b.origin[0])}, {cm(b.origin[1])}, {cm(b.origin[2])})
              </span>
              <span className="text-destructive">朝向 {dims(b.boxSize)}</span>
              <span className="text-primary">
                {b.grid.join(" × ")} = {blockCount(b).toLocaleString()} 个
              </span>
            </div>
          ))}
          {blocks.length > MAX_LISTED_BLOCKS && (
            <p className="text-center text-gray-500 pt-2">
              … 还有 {blocks.length - MAX_LISTED_BLOCKS} 个区域
            </p>
          )}
        </div>
      </Card>

      {!mixedMode && single.best && (
        <SingleModeDetails calc={calc} onApplyOptimal={onApplyOptimal} />
      )}
    </div>
  );
}

function OptimalityBadge({
  calc,
  mixedMode,
}: {
  calc: Calculation;
  mixedMode: boolean;
}) {
  const { single, mixed } = calc;
  const singleCount = single.best?.count ?? 0;

  if (!mixedMode) {
    return (
      <div className="space-y-2">
        <Badge tone="ok">✓ 所有箱子同一方向时，这就是最大值</Badge>
        {mixed.count > singleCount && (
          <p className="text-sm text-yellow-300">
            提示：允许混合方向可装 {mixed.count.toLocaleString()} 个（多{" "}
            {(mixed.count - singleCount).toLocaleString()} 个）
          </p>
        )}
      </div>
    );
  }
  if (mixed.provenOptimal) {
    return <Badge tone="ok">✓ 已证明是最大值，不可能装得更多</Badge>;
  }
  return (
    <div className="space-y-1">
      <Badge tone="warn">当前找到的最好方案</Badge>
      <p className="text-sm text-gray-400">
        理论上限为 {mixed.upperBound.toLocaleString()}{" "}
        个（按体积估算，实际往往达不到）， 真实最大值在{" "}
        {mixed.count.toLocaleString()} ~ {mixed.upperBound.toLocaleString()}{" "}
        个之间。
      </p>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "warn";
  children: ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-green-500/60 bg-green-500/10 text-green-300"
      : "border-yellow-500/60 bg-yellow-500/10 text-yellow-300";
  return (
    <div className={`inline-block px-3 py-1.5 border font-medium ${cls}`}>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p
        className={
          small
            ? "text-lg font-mono"
            : "text-3xl font-bold text-destructive number-display"
        }
      >
        {value}
      </p>
    </div>
  );
}

function WeightCard({ input, count }: { input: ParsedInput; count: number }) {
  const actualG = input.bigWeightG + count * input.smallWeightG;
  const actualKg = actualG / 1000;
  const outerCm3 = (input.outer[0] * input.outer[1] * input.outer[2]) / 1000;
  const volumeKg = outerCm3 / input.divisor;
  const round = (v: number) => Math.round(v * 100) / 100;

  return (
    <Card className="p-6 border-2 border-border gap-4">
      <h3 className="text-xl font-bold">重量</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 border-2 border-primary/30 bg-secondary/30">
          <p className="text-sm text-gray-500">实际总重量</p>
          <p className="text-4xl font-bold text-primary number-display">
            {actualKg.toFixed(2)}{" "}
            <span className="text-lg text-gray-400">kg</span>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            = 空箱 {input.bigWeightG}g + {input.smallWeightG}g ×{" "}
            {count.toLocaleString()} = {round(actualG).toLocaleString()}g
          </p>
        </div>
        <div className="p-4 border-2 border-destructive/30 bg-secondary/30">
          <p className="text-sm text-gray-500">体积重（按外径）</p>
          <p className="text-4xl font-bold text-destructive number-display">
            {volumeKg.toFixed(2)}{" "}
            <span className="text-lg text-gray-400">kg</span>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            = {dims(input.outer)} ÷ {input.divisor}
          </p>
        </div>
      </div>
      <p className="p-4 border border-border bg-accent/10">
        <span className="font-bold">计费重量</span>（实际重量与体积重取大）={" "}
        <span className="text-2xl font-bold text-primary">
          {Math.max(actualKg, volumeKg).toFixed(2)}
        </span>{" "}
        kg
      </p>
    </Card>
  );
}

function SingleModeDetails({
  calc,
  onApplyOptimal,
}: {
  calc: Calculation;
  onApplyOptimal: () => void;
}) {
  const { input, single } = calc;
  const best = single.best!;
  const t = input.thicknessMm * 2;
  const hasWaste = best.waste.some(w => w > 0);
  const optimalOuter: Vec3 = [
    best.used[0] + t,
    best.used[1] + t,
    best.used[2] + t,
  ];

  return (
    <>
      {hasWaste && (
        <Card className="p-6 border-2 border-destructive/50 gap-3">
          <h3 className="text-xl font-bold text-destructive">缩小大箱子建议</h3>
          <p className="text-gray-300">
            按{" "}
            <span className="font-mono text-primary">{dims(best.boxSize)}</span>{" "}
            方向摆放时，长/宽/高方向分别空出{" "}
            <span className="font-mono text-destructive">
              {dims(best.waste)} cm
            </span>
            。
          </p>
          <p className="text-gray-300">
            把大箱子外径改为{" "}
            <span className="font-mono font-bold text-primary text-xl">
              {dims(optimalOuter)} cm
            </span>
            （内径 {dims(best.used)} cm），同一方向下仍能装{" "}
            {best.count.toLocaleString()} 个，且没有空隙。
          </p>
          <div>
            <Button onClick={onApplyOptimal} variant="destructive">
              使用这个尺寸
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-6 border-2 border-border gap-4">
        <h3 className="text-xl font-bold">所有方向对比</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead className="text-gray-500 text-left">
              <tr>
                <th className="py-2 pr-4 font-normal">朝向（长×宽×高）</th>
                <th className="py-2 pr-4 font-normal">排列</th>
                <th className="py-2 pr-4 font-normal">数量</th>
                <th className="py-2 font-normal">剩余空间</th>
              </tr>
            </thead>
            <tbody>
              {single.options.map(o => (
                <tr
                  key={o.boxSize.join(",")}
                  className={
                    o === best
                      ? "text-primary font-bold"
                      : "text-gray-300 border-t border-border"
                  }
                >
                  <td className="py-2 pr-4">{dims(o.boxSize)}</td>
                  <td className="py-2 pr-4">{o.grid.join(" × ")}</td>
                  <td className="py-2 pr-4">{o.count.toLocaleString()}</td>
                  <td className="py-2">{dims(o.waste)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
