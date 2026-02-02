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
import { useState } from "react";

interface BoxDimensions {
  length: number;
  width: number;
  height: number;
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

interface OrientationResult {
  orientation: [number, number, number];
  count: number;
  countPerDimension: [number, number, number];
  utilizationRate: number;
  wastedSpace: [number, number, number];
  optimalBigBox: [number, number, number];
}

export default function Home() {
  // 默认值：大箱子 58×38×48，小箱子 32.5×23.5×4
  const [bigBox, setBigBox] = useState<BoxDimensions>({
    length: 58,
    width: 38,
    height: 48,
  });

  const [smallBox, setSmallBox] = useState<BoxDimensions>({
    length: 32.5,
    width: 23.5,
    height: 4,
  });

  const [result, setResult] = useState<PackingResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculatePacking = () => {
    setIsCalculating(true);
    
    // 模拟计算延迟以展示动画效果
    setTimeout(() => {
      const bigBoxDims = [bigBox.length, bigBox.width, bigBox.height];
      const smallBoxDims = [smallBox.length, smallBox.width, smallBox.height];
      const smallBoxVolume = smallBox.length * smallBox.width * smallBox.height;
      const bigBoxVolume = bigBox.length * bigBox.width * bigBox.height;

      let maxCount = 0;
      let bestArrangement: PackingResult | null = null;
      const allOrientations: OrientationResult[] = [];

      // 尝试所有可能的旋转方向
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

        // 计算实际使用的空间和浪费的空间
        const usedX = countX * smallOrientation[0];
        const usedY = countY * smallOrientation[1];
        const usedZ = countZ * smallOrientation[2];

        const wasteX = bigBoxDims[0] - usedX;
        const wasteY = bigBoxDims[1] - usedY;
        const wasteZ = bigBoxDims[2] - usedZ;

        const utilizationRate = (total * smallBoxVolume / bigBoxVolume) * 100;

        // 最优大箱子尺寸（100%利用率）
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
      setIsCalculating(false);
    }, 600);
  };

  const applyOptimalSize = () => {
    if (result) {
      setBigBox({
        length: result.optimalBigBox[0],
        width: result.optimalBigBox[1],
        height: result.optimalBigBox[2],
      });
    }
  };

  return (
    <div className="min-h-screen grid-bg">
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: 'url(/images/hero-background.png)' }}
        />
        
        {/* Scan line effect */}
        <div className="absolute inset-0 scan-line" />
        
        {/* Content */}
        <div className="relative z-10 text-center px-4">
          <h1 className="text-6xl md:text-8xl font-black mb-6 neon-glow" style={{ color: '#00e5ff' }}>
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
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Big Box Input */}
            <Card className="p-8 bg-card border-2 border-primary/30 hover:border-primary transition-all scan-line">
              <h2 className="text-3xl font-bold mb-6 text-primary">大箱子尺寸</h2>
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
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-primary"
                    step="0.1"
                  />
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
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-primary"
                    step="0.1"
                  />
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
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-primary"
                    step="0.1"
                  />
                </div>
              </div>
            </Card>

            {/* Small Box Input */}
            <Card className="p-8 bg-card border-2 border-destructive/30 hover:border-destructive transition-all scan-line">
              <h2 className="text-3xl font-bold mb-6 text-destructive">小箱子尺寸</h2>
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
                    className="mt-2 text-2xl h-14 bg-input border-border focus:border-destructive"
                    step="0.1"
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

          {/* Results */}
          {result && (
            <>
              <Card className="p-10 bg-card border-2 border-primary neon-glow animate-fade-in mb-8">
                <div className="flex flex-col md:flex-row items-center gap-12">
                  {/* Visual */}
                  <div className="flex-shrink-0">
                    <img
                      src="/images/calculation-visual.png"
                      alt="装箱可视化"
                      className="w-64 h-64 object-contain"
                    />
                  </div>

                  {/* Results Data */}
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
                          {result.orientation[0]} × {result.orientation[1]} × {result.orientation[2]}
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
                          {result.wastedSpace[0]} × {result.wastedSpace[1]} × {result.wastedSpace[2]}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Optimization Suggestion */}
              {result.utilizationRate < 100 && (
                <Card className="p-8 bg-card border-2 border-destructive/50 animate-fade-in mb-8">
                  <div className="flex items-start gap-6">
                    <img
                      src="/images/result-icon.png"
                      alt="优化建议"
                      className="w-20 h-20 object-contain flex-shrink-0"
                    />
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-destructive mb-4">空间优化建议</h3>
                      <p className="text-lg text-gray-300 mb-4 leading-relaxed">
                        当前配置下，小箱子保持 <span className="font-mono text-primary">{result.orientation[0]} × {result.orientation[1]} × {result.orientation[2]}</span> 方向摆放时，
                        大箱子存在 <span className="font-mono text-destructive">{result.wastedSpace[0]} × {result.wastedSpace[1]} × {result.wastedSpace[2]} cm</span> 的浪费空间。
                      </p>
                      <div className="bg-secondary/50 p-6 rounded mb-4">
                        <p className="text-base text-gray-400 mb-2">如果调整大箱子尺寸为：</p>
                        <p className="text-3xl font-mono font-bold text-primary mb-3">
                          {result.optimalBigBox[0]} × {result.optimalBigBox[1]} × {result.optimalBigBox[2]} cm
                        </p>
                        <p className="text-base text-gray-300">
                          可实现 <span className="text-2xl font-bold text-destructive">100%</span> 空间利用率，装载相同的 <span className="font-bold">{result.maxCount}</span> 个小箱子
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

              {/* All Orientations */}
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
                            {item.countPerDimension[0]} × {item.countPerDimension[1]} × {item.countPerDimension[2]}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">利用率</p>
                          <p className="text-xl font-bold text-destructive">{item.utilizationRate}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">优化尺寸</p>
                          <p className="text-sm font-mono text-gray-400">
                            {item.optimalBigBox[0]} × {item.optimalBigBox[1]} × {item.optimalBigBox[2]}
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
