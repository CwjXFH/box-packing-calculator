/**
 * 3D Packing Visualization Component
 * Uses Three.js to render the actual packing result in 3D
 * Optimized for better visual clarity and readability
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
    scene.background = new THREE.Color(0x0f0f1a); // 更亮的背景
    sceneRef.current = scene;

    // 创建相机
    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    
    // 优化相机位置，获得更好的观察角度
    const maxDim = Math.max(...bigBoxSize);
    const cameraDistance = maxDim * 2.2;
    camera.position.set(cameraDistance * 0.8, cameraDistance * 0.6, cameraDistance * 0.8);
    camera.lookAt(0, bigBoxSize[2] * 0.1, 0); // 稍微向上看
    cameraRef.current = camera;

    // 创建渲染器，启用更多优化选项
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制最大像素比
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 增强光照系统
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // 提高环境光
    scene.add(ambientLight);

    // 主光源
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(maxDim * 2, maxDim * 2, maxDim * 2);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    // 辅助光源（电光蓝）
    const accentLight1 = new THREE.DirectionalLight(0x00d9ff, 0.6);
    accentLight1.position.set(-maxDim, maxDim * 0.5, -maxDim);
    scene.add(accentLight1);

    // 辅助光源（霓虹粉）
    const accentLight2 = new THREE.DirectionalLight(0xff1493, 0.4);
    accentLight2.position.set(maxDim, -maxDim * 0.3, maxDim);
    scene.add(accentLight2);

    // 绘制大箱子（加粗线框）
    const bigBoxGeometry = new THREE.BoxGeometry(bigBoxSize[0], bigBoxSize[2], bigBoxSize[1]);
    const bigBoxEdges = new THREE.EdgesGeometry(bigBoxGeometry);
    
    // 使用自定义shader实现更粗的线条
    const bigBoxLine = new THREE.LineSegments(
      bigBoxEdges,
      new THREE.LineBasicMaterial({ 
        color: 0x00d9ff, 
        linewidth: 3, // 加粗线条
        transparent: true,
        opacity: 0.9
      })
    );
    scene.add(bigBoxLine);

    // 添加大箱子半透明面（稍微增加不透明度）
    const bigBoxMaterial = new THREE.MeshPhongMaterial({
      color: 0x00d9ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      shininess: 30,
    });
    const bigBoxMesh = new THREE.Mesh(bigBoxGeometry, bigBoxMaterial);
    bigBoxMesh.receiveShadow = true;
    scene.add(bigBoxMesh);

    // 更鲜明的颜色方案
    const colors = [
      0xff1493, // 霓虹粉（主色）
      0x00ffff, // 青色
      0x00ff00, // 绿色
      0xffff00, // 黄色
      0xff6600, // 橙色
      0xff00ff, // 品红
    ];

    // 绘制小箱子
    placedBoxes.forEach((box, index) => {
      const geometry = new THREE.BoxGeometry(box.size[0], box.size[2], box.size[1]);
      
      // 根据方向选择颜色
      const orientationKey = box.orientation.join(",");
      const colorIndex = isMixedMode 
        ? Math.abs(orientationKey.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length
        : 0;
      
      // 使用更亮的材质
      const material = new THREE.MeshPhongMaterial({
        color: colors[colorIndex],
        transparent: true,
        opacity: 0.85, // 提高不透明度
        shininess: 120,
        specular: 0x444444,
        emissive: colors[colorIndex],
        emissiveIntensity: 0.15, // 添加自发光
      });

      const smallBox = new THREE.Mesh(geometry, material);
      smallBox.castShadow = true;
      smallBox.receiveShadow = true;
      
      // 设置位置（注意坐标系转换：Three.js的Y轴是高度）
      const centerX = box.position[0] + box.size[0] / 2 - bigBoxSize[0] / 2;
      const centerY = box.position[2] + box.size[2] / 2 - bigBoxSize[2] / 2;
      const centerZ = box.position[1] + box.size[1] / 2 - bigBoxSize[1] / 2;
      
      smallBox.position.set(centerX, centerY, centerZ);

      // 添加更粗的白色边框
      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ 
          color: 0xffffff, 
          linewidth: 2, // 加粗边框
          transparent: true,
          opacity: 0.8
        })
      );
      line.position.copy(smallBox.position);
      
      scene.add(smallBox);
      scene.add(line);
    });

    // 优化网格地面
    const gridSize = Math.max(...bigBoxSize) * 1.8;
    const gridHelper = new THREE.GridHelper(
      gridSize,
      24,
      0x00d9ff, // 主网格线（电光蓝）
      0x2a2a3e  // 次网格线（更亮）
    );
    gridHelper.position.y = -bigBoxSize[2] / 2 - 0.1; // 稍微下移避免z-fighting
    gridHelper.material.opacity = 0.5;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // 添加坐标轴辅助线（可选，帮助理解空间）
    const axesHelper = new THREE.AxesHelper(maxDim * 0.8);
    axesHelper.position.set(-bigBoxSize[0] / 2, -bigBoxSize[2] / 2, -bigBoxSize[1] / 2);
    scene.add(axesHelper);

    // 动画循环
    let rotation = 0;
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // 缓慢旋转整个场景
      rotation += 0.002; // 稍微减慢旋转速度
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
      className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border-2 border-cyan-500/30"
      style={{
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)",
      }}
    />
  );
}
