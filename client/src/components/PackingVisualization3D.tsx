/**
 * 3D 装箱示意图（Three.js）
 * - 同一朝向的箱子同一颜色，颜色与「朝向统计」列表一致
 * - 使用 InstancedMesh，上万个箱子也能流畅显示
 * - 拖拽旋转、滚轮缩放、双击重置视角
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { type Placement, type Vec3 } from "@/lib/packing";

export const ORIENTATION_COLORS = [
  "#ff1493",
  "#00e5ff",
  "#7CFC00",
  "#ffd700",
  "#ff8c00",
  "#b388ff",
];

/** 超过这个数量只画前面一部分，避免显卡吃不消 */
export const MAX_RENDERED_BOXES = 30000;
/** 超过这个数量不画白色描边 */
const MAX_EDGED_BOXES = 4000;

interface Props {
  /** 大箱子内腔尺寸（mm） */
  container: Vec3;
  placements: Placement[];
  /** 朝向（boxSize.join(",")）→ 颜色序号 */
  colorIndexOf: (size: Vec3) => number;
}

export default function PackingVisualization3D({
  container,
  placements,
  colorIndexOf,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    // 场景单位用 cm；Three.js 的 Y 轴向上 = 高度，所以 (长, 宽, 高) → (x, z, y)
    const S = 0.1;
    const [L, W, H] = container.map(v => v * S);
    const maxDim = Math.max(L, W, H);
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(o: T) => (
      disposables.push(o),
      o
    );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f1a);

    const camera = new THREE.PerspectiveCamera(
      45,
      1,
      maxDim * 0.01,
      maxDim * 50
    );
    const initialPos = new THREE.Vector3(
      maxDim * 1.5,
      maxDim * 1.2,
      maxDim * 1.7
    );
    camera.position.copy(initialPos);

    const renderer = track(new THREE.WebGLRenderer({ antialias: true }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const controls = track(new OrbitControls(camera, renderer.domElement));
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = maxDim * 0.5;
    controls.maxDistance = maxDim * 6;
    controls.target.set(0, 0, 0);

    const onDblClick = () => {
      camera.position.copy(initialPos);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    renderer.domElement.addEventListener("dblclick", onDblClick);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(maxDim * 2, maxDim * 3, maxDim * 1.5);
    scene.add(light);
    const fill = new THREE.DirectionalLight(0x00d9ff, 0.4);
    fill.position.set(-maxDim, maxDim * 0.5, -maxDim);
    scene.add(fill);

    // 大箱子：线框 + 半透明面
    const bigGeo = track(new THREE.BoxGeometry(L, H, W));
    scene.add(
      new THREE.LineSegments(
        track(new THREE.EdgesGeometry(bigGeo)),
        track(new THREE.LineBasicMaterial({ color: 0x00d9ff }))
      )
    );
    scene.add(
      new THREE.Mesh(
        bigGeo,
        track(
          new THREE.MeshBasicMaterial({
            color: 0x00d9ff,
            transparent: true,
            opacity: 0.06,
            side: THREE.BackSide,
            depthWrite: false,
          })
        )
      )
    );

    // 小箱子
    const shown = placements.slice(0, MAX_RENDERED_BOXES);
    if (shown.length > 0) {
      const unitGeo = track(new THREE.BoxGeometry(1, 1, 1));
      const mat = track(
        new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.88 })
      );
      const mesh = new THREE.InstancedMesh(unitGeo, mat, shown.length);
      track({ dispose: () => mesh.dispose() });
      const m = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const color = new THREE.Color();
      const gap = 0.97; // 稍微缩小，相邻箱子之间留出缝隙便于分辨
      shown.forEach((p, i) => {
        const [sx, sy, sz] = p.size.map(v => v * S);
        pos.set(
          p.position[0] * S + sx / 2 - L / 2,
          p.position[2] * S + sz / 2 - H / 2,
          p.position[1] * S + sy / 2 - W / 2
        );
        scale.set(sx * gap, sz * gap, sy * gap);
        m.compose(pos, quat, scale);
        mesh.setMatrixAt(i, m);
        color.set(
          ORIENTATION_COLORS[colorIndexOf(p.size) % ORIENTATION_COLORS.length]
        );
        mesh.setColorAt(i, color);
      });
      scene.add(mesh);

      // 描边：所有箱子合并成一个几何体，一次绘制
      if (shown.length <= MAX_EDGED_BOXES) {
        const edges = new Float32Array(shown.length * 24 * 3);
        const corner = (x: number, y: number, z: number, o: number) => {
          edges[o] = x;
          edges[o + 1] = y;
          edges[o + 2] = z;
        };
        shown.forEach((p, i) => {
          const [sx, sy, sz] = p.size.map(v => v * S);
          const x0 = p.position[0] * S - L / 2,
            x1 = x0 + sx;
          const y0 = p.position[2] * S - H / 2,
            y1 = y0 + sz;
          const z0 = p.position[1] * S - W / 2,
            z1 = z0 + sy;
          const segs = [
            [x0, y0, z0, x1, y0, z0],
            [x0, y1, z0, x1, y1, z0],
            [x0, y0, z1, x1, y0, z1],
            [x0, y1, z1, x1, y1, z1],
            [x0, y0, z0, x0, y1, z0],
            [x1, y0, z0, x1, y1, z0],
            [x0, y0, z1, x0, y1, z1],
            [x1, y0, z1, x1, y1, z1],
            [x0, y0, z0, x0, y0, z1],
            [x1, y0, z0, x1, y0, z1],
            [x0, y1, z0, x0, y1, z1],
            [x1, y1, z0, x1, y1, z1],
          ];
          segs.forEach((s, j) => {
            const o = (i * 24 + j * 2) * 3;
            corner(s[0], s[1], s[2], o);
            corner(s[3], s[4], s[5], o + 3);
          });
        });
        const edgeGeo = track(new THREE.BufferGeometry());
        edgeGeo.setAttribute("position", new THREE.BufferAttribute(edges, 3));
        scene.add(
          new THREE.LineSegments(
            edgeGeo,
            track(
              new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.55,
              })
            )
          )
        );
      }
    }

    // 地面网格
    const grid = new THREE.GridHelper(maxDim * 2, 20, 0x00d9ff, 0x2a2a3e);
    track(grid);
    grid.position.y = -H / 2 - maxDim * 0.002;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    scene.add(grid);

    // 尺寸随容器变化
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("dblclick", onDblClick);
      disposables.forEach(d => d.dispose());
      renderer.domElement.remove();
    };
  }, [container, placements, colorIndexOf]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden border-2 border-cyan-500/30 cursor-grab active:cursor-grabbing"
      />
      <div className="absolute top-3 left-3 bg-black/60 px-3 py-2 border border-cyan-500/30 text-xs text-cyan-300/90 space-y-1 pointer-events-none">
        <div>拖拽：旋转视角</div>
        <div>滚轮：缩放</div>
        <div>双击：重置视角</div>
      </div>
    </div>
  );
}
