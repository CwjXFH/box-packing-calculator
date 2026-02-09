/*
 * Design Philosophy: Futuristic Minimalism
 * - Central axis symmetry with large whitespace
 * - High contrast black background with white content
 * - Electric blue and neon pink accents for interactions
 * - Glowing borders and scan line effects
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

interface BoxDimensions {
  length: number;
  width: number;
  height: number;
}

interface PlacedBox {
  position: [number, number, number];
  orientation: [number, number, number];
  size: [number, number, number];
}

interface PackingResult {
  maxCount: number;
  orientation: [number, number, number];
  countPerDimension: [number, number, number];
  utilizationRate: number;
  wastedSpace: [number, number, number];
  optimalBigBox: [number, number, number];
  allOrientations: OrientationResult[];
}

interface MixedPackingResult {
  totalCount: number;
  placedBoxes: PlacedBox[];
  utilizationRate: number;
  orientationStats: Record<string, number>;
}

interface OrientationResult {
  orientation: [number, number, number];
  count: number;
  countPerDimension: [number, number, number];
  utilizationRate: number;
  wastedSpace: [number, number, number];
  optimalBigBox: [number, number, number];
}

class Space3D {
  constructor(
    public x: number,
    public y: number,
    public z: number,
    public w: number,
    public h: number,
    public d: number
  ) {}

  volume(): number {
    return this.w * this.h * this.d;
  }

  canFit(boxDims: [number, number, number]): {
    fits: boolean;
    orientation: [number, number, number] | null;
  } {
    const permutations: [number, number, number][] = [
      [boxDims[0], boxDims[1], boxDims[2]],
      [boxDims[0], boxDims[2], boxDims[1]],
      [boxDims[1], boxDims[0], boxDims[2]],
      [boxDims[1], boxDims[2], boxDims[0]],
      [boxDims[2], boxDims[0], boxDims[1]],
      [boxDims[2], boxDims[1], boxDims[0]],
    ];

    for (const perm of permutations) {
      if (perm[0] <= this.w && perm[1] <= this.h && perm[2] <= this.d) {
        return { fits: true, orientation: perm };
      }
    }
    return { fits: false, orientation: null };
  }
}

function greedyPackMixedOrientation(
  bigDims: [number, number, number],
  smallDims: [number, number, number],
  maxIterations: number = 1000
): PlacedBox[] {
  const freeSpaces: Space3D[] = [new Space3D(0, 0, 0, bigDims[0], bigDims[1], bigDims[2])];
  const placedBoxes: PlacedBox[] = [];

  let iteration = 0;
  while (freeSpaces.length > 0 && iteration < maxIterations) {
    iteration++;

    // 按体积从大到小排序
    freeSpaces.sort((a, b) => b.volume() - a.volume());

    let placed = false;
    for (let i = 0; i < freeSpaces.length; i++) {
      const space = freeSpaces[i];
      const { fits, orientation } = space.canFit(smallDims);

      if (fits && orientation) {
        placedBoxes.push({
          position: [space.x, space.y, space.z],
          orientation: orientation,
          size: orientation,
        });

        freeSpaces.splice(i, 1);

        // 沿X轴分割
        if (space.w > orientation[0]) {
          freeSpaces.push(
            new Space3D(
              space.x + orientation[0],
              space.y,
              space.z,
              space.w - orientation[0],
              space.h,
              space.d
            )
          );
        }

        // 沿Y轴分割
        if (space.h > orientation[1]) {
          freeSpaces.push(
            new Space3D(
              space.x,
              space.y + orientation[1],
              space.z,
              orientation[0],
              space.h - orientation[1],
              space.d
            )
          );
        }

        // 沿Z轴分割
        if (space.d > orientation[2]) {
          freeSpaces.push(
            new Space3D(
              space.x,
              space.y,
              space.z + orientation[2],
              orientation[0],
              orientation[1],
              space.d - orientation[2]
            )
          );
        }

        placed = true;
        break;
      }
    }

    if (!placed) {
      break;
    }
  }

  return placedBoxes;
}

export default function Home() {
  const [bigBox, setBigBox] = useState<BoxDimensions>({
    length: 60,
    width: 40,
    height: 50,
  });

  const [smallBox, setSmallBox] = useState<BoxDimensions>({
    length: 32.5,
    width: 23.5,
    height: 4,
  });

  const [boxThickness, setBoxThickness] = useState(1.5);
  const [bigBoxWeight, setBigBoxWeight] = useState(300);
  const [smallBoxWeight, setSmallBoxWeight] = useState(100);
  const [volumeWeightDivisor, setVolumeWeightDivisor] = useState(6000);

  const [useMixedOrientation, setUseMixedOrientation] = useState(true);
  const [result, setResult] = useState<PackingResult | null>(null);
  const [mixedResult, setMixedResult] = useState<MixedPackingResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // 计算内径
  const getInnerDimensions = (outer: BoxDimensions): BoxDimensions => {
    return {
      length: Math.max(0, outer.length - boxThickness * 2),
      width: Math.max(0, outer.width - boxThickness * 2),
      height: Math.max(0, outer.height - boxThickness * 2),
    };
  };

  const innerBigBox = getInnerDimensions(bigBox);

  const calculatePacking = () => {
    setIsCalculating(true);

    setTimeout(() => {
      // 使用内径进行计算
      const bigBoxDims = [innerBigBox.length, innerBigBox.width, innerBigBox.height];
      const smallBoxDims = [smallBox.length, smallBox.width, smallBox.height];
      const smallBoxVolume = smallBox.length * smallBox.width * smallBox.height;
      const bigBoxVolume = innerBigBox.length * innerBigBox.width * innerBigBox.height;

      if (useMixedOrientation) {
        // 混合方向装箱
        const placedBoxes = greedyPackMixedOrientation(
          bigBoxDims as [number, number, number],
          smallBoxDims as [number, number, number]
        );

        const orientationStats: Record<string, number> = {};
        placedBoxes.forEach((box) => {
          const key = `${box.orientation[0]} × ${box.orientation[1]} × ${box.orientation[2]}`;
          orientationStats[key] = (orientationStats[key] || 0) + 1;
        });

        const totalVolume = placedBoxes.length * smallBoxVolume;
        const utilization = (totalVolume / bigBoxVolume) * 100;

        setMixedResult({
          totalCount: placedBoxes.length,
          placedBoxes: placedBoxes,
          utilizationRate: parseFloat(utilization.toFixed(2)),
          orientationStats: orientationStats,
        });
        setResult(null);
      } else {
        // 单一方向装箱
        let maxCount = 0;
        let bestArrangement: PackingResult | null = null;
        const allOrientations: OrientationResult[] = [];

        const permutations = [
          [0, 1, 2],
          [0, 2, 1],
          [1, 0, 2],
          [1, 2, 0],
          [2, 0, 1],
          [2, 1, 0],
        ];

        for (const perm of permutations) {
          const smallOrientation: [number, number, number] = [
            smallBoxDims[perm[0]],
            smallBoxDims[perm[1]],
            smallBoxDims[perm[2]],
          ];

          const countX = Math.floor(bigBoxDims[0] / smallOrientation[0]);
          const countY = Math.floor(bigBoxDims[1] / smallOrientation[1]);
          const countZ = Math.floor(bigBoxDims[2] / smallOrientation[2]);

          const total = countX * countY * countZ;

          const usedX = countX * smallOrientation[0];
          const usedY = countY * smallOrientation[1];
          const usedZ = countZ * smallOrientation[2];

          const wasteX = bigBoxDims[0] - usedX;
          const wasteY = bigBoxDims[1] - usedY;
          const wasteZ = bigBoxDims[2] - usedZ;

          const utilizationRate = (total * smallBoxVolume / bigBoxVolume) * 100;
          const optimalBigBox: [number, number, number] = [usedX, usedY, usedZ];

          const orientationResult: OrientationResult = {
            orientation: smallOrientation,
            count: total,
            countPerDimension: [countX, countY, countZ],
            utilizationRate: parseFloat(utilizationRate.toFixed(2)),
            wastedSpace: [
              parseFloat(wasteX.toFixed(1)),
              parseFloat(wasteY.toFixed(1)),
              parseFloat(wasteZ.toFixed(1)),
            ],
            optimalBigBox,
          };

          allOrientations.push(orientationResult);

          if (total > maxCount) {
            maxCount = total;
            bestArrangement = {
              maxCount: total,
              orientation: smallOrientation,
              countPerDimension: [countX, countY, countZ],
              utilizationRate: parseFloat(utilizationRate.toFixed(2)),
              wastedSpace: [
                parseFloat(wasteX.toFixed(1)),
                parseFloat(wasteY.toFixed(1)),
                parseFloat(wasteZ.toFixed(1)),
              ],
              optimalBigBox,
              allOrientations: allOrientations.sort((a, b) => b.count - a.count),
            };
          }
        }

        if (bestArrangement) {
          bestArrangement.allOrientations = allOrientations.sort((a, b) => b.count - a.count);
        }

        setResult(bestArrangement);
        setMixedResult(null);
      }

      setIsCalculating(false);
    }, 600);
  };

  const applyOptimalSize = () => {
    if (result) {
      // 优化尺寸是内径，需要转换为外径
      setBigBox({
        length: result.optimalBigBox[0] + boxThickness * 2,
        width: result.optimalBigBox[1] + boxThickness * 2,
        height: result.optimalBigBox[2] + boxThickness * 2,
      });
    }
  };

  // 计算重量（换算为kg）
  const totalCount = mixedResult?.totalCount || result?.maxCount || 0;
  const actualWeightG = bigBoxWeight + totalCount * smallBoxWeight;
  const actualWeightKg = actualWeightG / 1000;
  const volumeWeightKg = (bigBox.length * bigBox.width * bigBox.height) / volumeWeightDivisor;

  return (
    <div className="min-h-screen grid-bg">
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url(https://files.manuscdn.com/user_upload_by_module/session_file/310519663324726231/vdZWPKglVRkPrJtb.png)" }}
        />
        <div className="absolute inset-0 scan-line" />
        <div className="relative z-10 text-center px-4">
          <h1
            className="text-6xl md:text-8xl font-black mb-6 neon-glow"
            style={{ color: "#00e5ff" }}
          >
            装箱计算器
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 font-medium tracking-wide">
            PRECISION · TECHNOLOGY · EFFICIENCY
          </p>
        </div>
      </section>

      {/* Calculator Section */}
      <section className="container py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          {/* Algorithm Selection */}
          <Card className="p-6 mb-8 bg-card border-2 border-primary/50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">装箱算法模式</h3>
                <p className="text-sm text-gray-400">
                  {useMixedOrientation
                    ? "混合方向模式：小箱子可以不同方向摆放，空间利用率更高"
                    : "单一方向模式：所有小箱子保持同一方向，便于实际操作"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="algorithm-mode" className="text-base font-medium text-gray-300">
                  {useMixedOrientation ? "混合方向" : "单一方向"}
                </Label>
                <Switch
                  id="algorithm-mode"
                  checked={useMixedOrientation}
                  onCheckedChange={setUseMixedOrientation}
                />
              </div>
            </div>
          </Card>

          {/* Box Thickness Setting */}
          <Card className="p-6 mb-8 bg-card border-2 border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">箱体厚度误差</h3>
                <p className="text-sm text-gray-400">
                  大箱子内外径误差，用于计算实际可用内部空间
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={boxThickness}
                  onChange={(e) => setBoxThickness(parseFloat(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  className="w-24 text-lg h-12 bg-input border-border focus:border-primary text-center"
                  step="0.1"
                />
                <span className="text-base text-gray-400">cm</span>
              </div>
            </div>
          </Card>

          {/* 体积重基准参数设置 */}
          <Card className="p-6 bg-card border-2 border-border mb-8">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground mb-2">体积重计算基准</h3>
                <p className="text-sm text-gray-500">
                  不同快递公司的体积重计算除数可能不同，常见值：6000（国内）、5000（国际）
                </p>
              </div>
              <div className="flex items-center gap-3 ml-6">
                <Input
                  type="number"
                  value={volumeWeightDivisor}
                  onChange={(e) => setVolumeWeightDivisor(parseFloat(e.target.value) || 6000)}
                  onFocus={(e) => e.target.select()}
                  className="w-28 text-lg h-12 bg-input border-border focus:border-primary text-center"
                  step="100"
                />
              </div>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Big Box Input */}
            <Card className="p-8 bg-card border-2 border-primary/30 hover:border-primary transition-all scan-line">
              <h2 className="text-3xl font-bold mb-6 text-primary">大箱子尺寸（外径）</h2>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="big-length" className="text-base font-medium text-gray-300">
                    长度 (cm)
                  </Label>
                  <Input
                    id="big-length"
                    type="number"
                    value={bigBox.length}
                    onChange={(e) =>
                      setBigBox({ ...bigBox, length: parseFloat(e.target.value) || 0 })
                    }
                    onFocus={(e) => e.target.select()}
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-primary"
                    step="0.1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    内径: {innerBigBox.length.toFixed(1)} cm
                  </p>
                </div>
                <div>
                  <Label htmlFor="big-width" className="text-base font-medium text-gray-300">
                    宽度 (cm)
                  </Label>
                  <Input
                    id="big-width"
                    type="number"
                    value={bigBox.width}
                    onChange={(e) =>
                      setBigBox({ ...bigBox, width: parseFloat(e.target.value) || 0 })
                    }
                    onFocus={(e) => e.target.select()}
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-primary"
                    step="0.1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    内径: {innerBigBox.width.toFixed(1)} cm
                  </p>
                </div>
                <div>
                  <Label htmlFor="big-height" className="text-base font-medium text-gray-300">
                    高度 (cm)
                  </Label>
                  <Input
                    id="big-height"
                    type="number"
                    value={bigBox.height}
                    onChange={(e) =>
                      setBigBox({ ...bigBox, height: parseFloat(e.target.value) || 0 })
                    }
                    onFocus={(e) => e.target.select()}
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-primary"
                    step="0.1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    内径: {innerBigBox.height.toFixed(1)} cm
                  </p>
                </div>
                <div>
                  <Label htmlFor="big-weight" className="text-base font-medium text-gray-300">
                    单个大箱子重量 (g)
                  </Label>
                  <Input
                    id="big-weight"
                    type="number"
                    value={bigBoxWeight}
                    onChange={(e) => setBigBoxWeight(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-primary"
                    step="1"
                  />
                </div>
              </div>
            </Card>

            {/* Small Box Input */}
            <Card className="p-8 bg-card border-2 border-destructive/30 hover:border-destructive transition-all scan-line">
              <h2 className="text-3xl font-bold mb-6 text-destructive">小箱子尺寸（外径）</h2>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="small-length" className="text-base font-medium text-gray-300">
                    长度 (cm)
                  </Label>
                  <Input
                    id="small-length"
                    type="number"
                    value={smallBox.length}
                    onChange={(e) =>
                      setSmallBox({ ...smallBox, length: parseFloat(e.target.value) || 0 })
                    }
                    onFocus={(e) => e.target.select()}
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-destructive"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label htmlFor="small-width" className="text-base font-medium text-gray-300">
                    宽度 (cm)
                  </Label>
                  <Input
                    id="small-width"
                    type="number"
                    value={smallBox.width}
                    onChange={(e) =>
                      setSmallBox({ ...smallBox, width: parseFloat(e.target.value) || 0 })
                    }
                    onFocus={(e) => e.target.select()}
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-destructive"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label htmlFor="small-height" className="text-base font-medium text-gray-300">
                    高度 (cm)
                  </Label>
                  <Input
                    id="small-height"
                    type="number"
                    value={smallBox.height}
                    onChange={(e) =>
                      setSmallBox({ ...smallBox, height: parseFloat(e.target.value) || 0 })
                    }
                    onFocus={(e) => e.target.select()}
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-destructive"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label htmlFor="small-weight" className="text-base font-medium text-gray-300">
                    单个小箱子重量 (g)
                  </Label>
                  <Input
                    id="small-weight"
                    type="number"
                    value={smallBoxWeight}
                    onChange={(e) => setSmallBoxWeight(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-destructive"
                    step="1"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Calculate Button */}
          <div className="flex justify-center mb-16">
            <Button
              onClick={calculatePacking}
              disabled={isCalculating}
              className="px-12 py-8 text-2xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 neon-glow transition-all"
              size="lg"
            >
              {isCalculating ? "计算中..." : "开始计算"}
            </Button>
          </div>

          {/* Mixed Orientation Results */}
          {mixedResult && (
            <>
              <Card className="p-10 bg-card border-2 border-primary neon-glow animate-fade-in mb-8">
                <div className="flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-shrink-0">
                    <img
                      src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663324726231/OvseQEpWpEzoKRqk.png"
                      alt="装箱可视化"
                      className="w-64 h-64 object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-8">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-400 mb-2">混合方向装箱结果</h3>
                      <div className="flex items-baseline gap-4">
                        <span className="text-8xl font-black number-display text-primary">
                          {mixedResult.totalCount}
                        </span>
                        <span className="text-3xl text-gray-400 font-medium">个</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 mb-1 font-medium">空间利用率</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-destructive number-display">
                            {mixedResult.utilizationRate}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1 font-medium">使用方向数</p>
                        <p className="text-4xl font-bold text-primary">
                          {Object.keys(mixedResult.orientationStats).length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Weight Information */}
              <Card className="p-8 bg-card border-2 border-border animate-fade-in mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-6">重量信息</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="p-6 rounded border-2 border-primary/30 bg-secondary/30">
                    <p className="text-sm text-gray-500 mb-2">实际总重量</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-bold text-primary number-display">
                        {actualWeightKg.toFixed(2)}
                      </span>
                      <span className="text-xl text-gray-400">kg</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                      = 大箱子 {bigBoxWeight}g + 小箱子 {smallBoxWeight}g × {mixedResult.totalCount} = {actualWeightG}g
                    </p>
                  </div>
                  <div className="p-6 rounded border-2 border-destructive/30 bg-secondary/30">
                    <p className="text-sm text-gray-500 mb-2">体积重</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-bold text-destructive number-display">
                        {volumeWeightKg.toFixed(2)}
                      </span>
                      <span className="text-xl text-gray-400">kg</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                      = {bigBox.length} × {bigBox.width} × {bigBox.height} ÷ {volumeWeightDivisor}
                    </p>
                  </div>
                </div>
                <div className="mt-6 p-6 rounded border-2 border-border bg-accent/20">
                  <p className="text-base text-gray-300">
                    <span className="font-bold text-foreground">计费重量：</span>
                    取实际重量和体积重中的较大值 ={" "}
                    <span className="text-2xl font-bold text-primary">
                      {Math.max(actualWeightKg, volumeWeightKg).toFixed(2)}
                    </span>{" "}
                    kg
                  </p>
                </div>
              </Card>

              {/* Orientation Statistics */}
              <Card className="p-8 bg-card border-2 border-border animate-fade-in mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-6">各方向使用统计</h3>
                <div className="space-y-4">
                  {Object.entries(mixedResult.orientationStats)
                    .sort(([, a], [, b]) => b - a)
                    .map(([orientation, count], index) => (
                      <div
                        key={index}
                        className="p-6 rounded border-2 border-primary/30 bg-secondary/30"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">摆放方向</p>
                            <p className="text-lg font-mono font-bold text-foreground">
                              {orientation}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500 mb-1">使用数量</p>
                            <p className="text-3xl font-bold text-primary">{count} 个</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>

              {/* Detailed Placement (first 20) */}
              <Card className="p-8 bg-card border-2 border-border animate-fade-in">
                <h3 className="text-2xl font-bold text-foreground mb-6">
                  详细摆放方案（前20个）
                </h3>
                <div className="space-y-3">
                  {mixedResult.placedBoxes.slice(0, 20).map((box, index) => (
                    <div
                      key={index}
                      className="p-4 rounded border border-border bg-secondary/20 font-mono text-sm"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-gray-500">箱子 {index + 1}:</span>{" "}
                          <span className="text-primary">
                            位置 ({box.position[0].toFixed(1)}, {box.position[1].toFixed(1)},{" "}
                            {box.position[2].toFixed(1)})
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">方向:</span>{" "}
                          <span className="text-destructive">
                            {box.orientation[0]} × {box.orientation[1]} × {box.orientation[2]}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {mixedResult.placedBoxes.length > 20 && (
                    <p className="text-center text-gray-500 pt-4">
                      ... 还有 {mixedResult.placedBoxes.length - 20} 个箱子
                    </p>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* Single Orientation Results */}
          {result && (
            <>
              <Card className="p-10 bg-card border-2 border-primary neon-glow animate-fade-in mb-8">
                <div className="flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-shrink-0">
                    <img
                      src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663324726231/OvseQEpWpEzoKRqk.png"
                      alt="装箱可视化"
                      className="w-64 h-64 object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-8">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-400 mb-2">最优方案</h3>
                      <div className="flex items-baseline gap-4">
                        <span className="text-8xl font-black number-display text-primary">
                          {result.maxCount}
                        </span>
                        <span className="text-3xl text-gray-400 font-medium">个</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 mb-1 font-medium">最佳摆放方向</p>
                        <p className="text-xl font-mono text-foreground">
                          {result.orientation[0]} × {result.orientation[1]} ×{" "}
                          {result.orientation[2]}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1 font-medium">各方向数量</p>
                        <p className="text-xl font-mono text-foreground">
                          {result.countPerDimension[0]} × {result.countPerDimension[1]} ×{" "}
                          {result.countPerDimension[2]}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1 font-medium">空间利用率</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-destructive number-display">
                            {result.utilizationRate}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1 font-medium">浪费空间</p>
                        <p className="text-xl font-mono text-gray-400">
                          {result.wastedSpace[0]} × {result.wastedSpace[1]} ×{" "}
                          {result.wastedSpace[2]}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Weight Information */}
              <Card className="p-8 bg-card border-2 border-border animate-fade-in mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-6">重量信息</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="p-6 rounded border-2 border-primary/30 bg-secondary/30">
                    <p className="text-sm text-gray-500 mb-2">实际总重量</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-bold text-primary number-display">
                        {actualWeightKg.toFixed(2)}
                      </span>
                      <span className="text-xl text-gray-400">kg</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                      = 大箱子 {bigBoxWeight}g + 小箱子 {smallBoxWeight}g × {result.maxCount} = {actualWeightG}g
                    </p>
                  </div>
                  <div className="p-6 rounded border-2 border-destructive/30 bg-secondary/30">
                    <p className="text-sm text-gray-500 mb-2">体积重</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-bold text-destructive number-display">
                        {volumeWeightKg.toFixed(2)}
                      </span>
                      <span className="text-xl text-gray-400">kg</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                      = {bigBox.length} × {bigBox.width} × {bigBox.height} ÷ {volumeWeightDivisor}
                    </p>
                  </div>
                </div>
                <div className="mt-6 p-6 rounded border-2 border-border bg-accent/20">
                  <p className="text-base text-gray-300">
                    <span className="font-bold text-foreground">计费重量：</span>
                    取实际重量和体积重中的较大值 ={" "}
                    <span className="text-2xl font-bold text-primary">
                      {Math.max(actualWeightKg, volumeWeightKg).toFixed(2)}
                    </span>{" "}
                    kg
                  </p>
                </div>
              </Card>

              {result.utilizationRate < 100 && (
                <Card className="p-8 bg-card border-2 border-destructive/50 animate-fade-in mb-8">
                  <div className="flex items-start gap-6">
                    <img
                      src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663324726231/pCBkiEJLvBCZWCYT.png"
                      alt="优化建议"
                      className="w-20 h-20 object-contain flex-shrink-0"
                    />
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-destructive mb-4">空间优化建议</h3>
                      <p className="text-lg text-gray-300 mb-4 leading-relaxed">
                        当前配置下，小箱子保持{" "}
                        <span className="font-mono text-primary">
                          {result.orientation[0]} × {result.orientation[1]} × {result.orientation[2]}
                        </span>{" "}
                        方向摆放时， 大箱子内径存在{" "}
                        <span className="font-mono text-destructive">
                          {result.wastedSpace[0]} × {result.wastedSpace[1]} × {result.wastedSpace[2]}{" "}
                          cm
                        </span>{" "}
                        的浪费空间。
                      </p>
                      <div className="bg-secondary/50 p-6 rounded mb-4">
                        <p className="text-base text-gray-400 mb-2">如果调整大箱子内径为：</p>
                        <p className="text-3xl font-mono font-bold text-primary mb-3">
                          {result.optimalBigBox[0]} × {result.optimalBigBox[1]} ×{" "}
                          {result.optimalBigBox[2]} cm
                        </p>
                        <p className="text-base text-gray-400 mb-2">对应外径为：</p>
                        <p className="text-2xl font-mono font-bold text-destructive mb-3">
                          {(result.optimalBigBox[0] + boxThickness * 2).toFixed(1)} ×{" "}
                          {(result.optimalBigBox[1] + boxThickness * 2).toFixed(1)} ×{" "}
                          {(result.optimalBigBox[2] + boxThickness * 2).toFixed(1)} cm
                        </p>
                        <p className="text-base text-gray-300">
                          可实现{" "}
                          <span className="text-2xl font-bold text-destructive">100%</span>{" "}
                          空间利用率，装载相同的 <span className="font-bold">{result.maxCount}</span>{" "}
                          个小箱子
                        </p>
                      </div>
                      <Button
                        onClick={applyOptimalSize}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 neon-glow-pink"
                      >
                        应用优化尺寸
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-8 bg-card border-2 border-border animate-fade-in">
                <h3 className="text-2xl font-bold text-foreground mb-6">所有摆放方向对比</h3>
                <div className="space-y-4">
                  {result.allOrientations.map((item, index) => (
                    <div
                      key={index}
                      className={`p-6 rounded border-2 transition-all ${
                        item.orientation[0] === result.orientation[0] &&
                        item.orientation[1] === result.orientation[1] &&
                        item.orientation[2] === result.orientation[2]
                          ? "border-primary bg-primary/5"
                          : "border-border bg-secondary/30"
                      }`}
                    >
                      <div className="grid md:grid-cols-5 gap-4 items-center">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">摆放方向</p>
                          <p className="text-lg font-mono font-bold text-foreground">
                            {item.orientation[0]} × {item.orientation[1]} × {item.orientation[2]}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">装载数量</p>
                          <p className="text-2xl font-bold text-primary">{item.count} 个</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">各方向数量</p>
                          <p className="text-sm font-mono text-gray-300">
                            {item.countPerDimension[0]} × {item.countPerDimension[1]} ×{" "}
                            {item.countPerDimension[2]}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">利用率</p>
                          <p className="text-xl font-bold text-destructive">
                            {item.utilizationRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">优化内径</p>
                          <p className="text-sm font-mono text-gray-400">
                            {item.optimalBigBox[0]} × {item.optimalBigBox[1]} ×{" "}
                            {item.optimalBigBox[2]}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-16">
        <div className="container text-center text-gray-500 text-sm font-medium">
          <p>© 2026 装箱计算器 · 精准计算 · 高效装箱</p>
        </div>
      </footer>
    </div>
  );
}
