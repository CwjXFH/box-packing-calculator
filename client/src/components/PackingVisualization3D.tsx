/**
 * 3D Packing Visualization Component
 * Uses Three.js to render the actual packing result in 3D
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface PlacedBox {
  position: [number, number, number];
  orientation: [number, number, number];
  size: [number, number, number];
}

interface PackingVisualization3DProps {
  bigBoxSize: [number, number, number]; // 大箱子内径尺寸
  placedBoxes: PlacedBox[]; // 已摆放的小箱子
  isMixedMode: boolean; // 是否混合方向模式
}

export default function PackingVisualization3D({
  bigBoxSize,
  placedBoxes,
  isMixedMode,
}: PackingVisualization3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 清理之前的场景
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    sceneRef.current = scene;

    // 创建相机
    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    
    // 计算合适的相机距离
    const maxDim = Math.max(...bigBoxSize);
    const cameraDistance = maxDim * 2.5;
    camera.position.set(cameraDistance * 0.7, cameraDistance * 0.5, cameraDistance * 0.7);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 添加光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(1, 1, 1);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0x00d9ff, 0.4);
    directionalLight2.position.set(-1, 0.5, -1);
    scene.add(directionalLight2);

    // 绘制大箱子（线框）
    const bigBoxGeometry = new THREE.BoxGeometry(bigBoxSize[0], bigBoxSize[2], bigBoxSize[1]);
    const bigBoxEdges = new THREE.EdgesGeometry(bigBoxGeometry);
    const bigBoxLine = new THREE.LineSegments(
      bigBoxEdges,
      new THREE.LineBasicMaterial({ color: 0x00d9ff, linewidth: 2 })
    );
    scene.add(bigBoxLine);

    // 添加大箱子半透明面
    const bigBoxMaterial = new THREE.MeshBasicMaterial({
      color: 0x00d9ff,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
    });
    const bigBoxMesh = new THREE.Mesh(bigBoxGeometry, bigBoxMaterial);
    scene.add(bigBoxMesh);

    // 绘制小箱子
    const colors = [
      0xff1493, // 霓虹粉
      0x00d9ff, // 电光蓝
      0x7fff00, // 荧光绿
      0xffd700, // 金色
      0xff6600, // 橙色
      0x9d00ff, // 紫色
    ];

    placedBoxes.forEach((box, index) => {
      const geometry = new THREE.BoxGeometry(box.size[0], box.size[2], box.size[1]);
      
      // 根据方向选择颜色
      const orientationKey = box.orientation.join(",");
      const colorIndex = isMixedMode 
        ? Math.abs(orientationKey.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length
        : 0;
      
      const material = new THREE.MeshPhongMaterial({
        color: colors[colorIndex],
        transparent: true,
        opacity: 0.7,
        shininess: 100,
      });

      const smallBox = new THREE.Mesh(geometry, material);
      
      // 设置位置（注意坐标系转换：Three.js的Y轴是高度）
      // position是小箱子的中心点，需要从角点转换
      const centerX = box.position[0] + box.size[0] / 2 - bigBoxSize[0] / 2;
      const centerY = box.position[2] + box.size[2] / 2 - bigBoxSize[2] / 2;
      const centerZ = box.position[1] + box.size[1] / 2 - bigBoxSize[1] / 2;
      
      smallBox.position.set(centerX, centerY, centerZ);

      // 添加边框
      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 })
      );
      line.position.copy(smallBox.position);
      
      scene.add(smallBox);
      scene.add(line);
    });

    // 添加网格地面
    const gridHelper = new THREE.GridHelper(
      Math.max(...bigBoxSize) * 1.5,
      20,
      0x00d9ff,
      0x1a1a2e
    );
    gridHelper.position.y = -bigBoxSize[2] / 2;
    scene.add(gridHelper);

    // 动画循环
    let rotation = 0;
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // 缓慢旋转整个场景
      rotation += 0.003;
      scene.rotation.y = rotation;

      renderer.render(scene, camera);
    };

    animate();

    // 处理窗口大小变化
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    // 清理函数
    return () => {
      window.removeEventListener("resize", handleResize);
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }

      // 清理几何体和材质
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [bigBoxSize, placedBoxes, isMixedMode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] rounded-lg overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
      }}
    />
  );
}
