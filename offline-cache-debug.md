# 离线缓存功能调试记录

## 问题发现

测试时发现以下问题：
1. ✗ 控制台中没有看到 `[Analytics] Offline support initialized` 日志
2. ✗ IndexedDB数据库 `analytics-cache` 未被创建
3. ✗ 点击计算按钮后，没有看到事件追踪的日志

## 可能原因

1. **initAnalytics() 调用时机问题**
   - 在 main.tsx 中调用 initAnalytics() 时，可能DOM还未完全加载
   - window 对象可能还未完全初始化

2. **代码执行顺序问题**
   - React 组件渲染可能在 initAnalytics() 之前

## 解决方案

需要将 initAnalytics() 的调用时机调整到 window.addEventListener('load') 中，确保在页面完全加载后再初始化。


## 进一步调试

发现问题：
- ✗ 即使在 window.addEventListener('load') 中调用，initAnalytics() 仍然没有执行
- ✗ 控制台中没有看到 `[Analytics] Offline support initialized` 日志
- ✗ 没有看到 Service Worker 注册成功的日志（在修复后）

**根本原因分析：**
window.addEventListener('load') 事件可能在某些情况下不会触发，或者触发时机有问题。

**新的解决方案：**
使用 React 的 useEffect 在 App 组件中初始化 analytics，确保在 React 应用启动后立即执行。
