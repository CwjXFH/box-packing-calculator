/**
 * 在后台线程（Web Worker）里运行混合方向计算，计算期间界面不会卡住。
 * 如果浏览器不允许创建 Worker（个别浏览器对本地 file:// 文件有限制），自动退回主线程计算。
 */
import { packMixed, type MixedResult, type Vec3 } from "./packing";
import PackingWorker from "./packing.worker?worker&inline";

const TIME_LIMIT_WORKER_MS = 2000;
const TIME_LIMIT_MAIN_THREAD_MS = 1500;

function runOnMainThread(container: Vec3, box: Vec3): Promise<MixedResult> {
  return new Promise((resolve, reject) => {
    // 先让出主线程，让「计算中」状态有机会渲染出来
    setTimeout(() => {
      try {
        resolve(
          packMixed(container, box, { timeLimitMs: TIME_LIMIT_MAIN_THREAD_MS })
        );
      } catch (err) {
        reject(err);
      }
    }, 30);
  });
}

export function runPackMixed(container: Vec3, box: Vec3): Promise<MixedResult> {
  let worker: Worker;
  try {
    worker = new PackingWorker();
  } catch {
    return runOnMainThread(container, box);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      settled = true;
      worker.terminate();
    };
    worker.onmessage = (
      e: MessageEvent<{ ok: boolean; result?: MixedResult; error?: string }>
    ) => {
      if (settled) return;
      finish();
      if (e.data.ok) resolve(e.data.result!);
      else reject(new Error(e.data.error));
    };
    worker.onerror = e => {
      e.preventDefault();
      if (settled) return;
      finish();
      runOnMainThread(container, box).then(resolve, reject);
    };
    worker.postMessage({
      container,
      box,
      options: { timeLimitMs: TIME_LIMIT_WORKER_MS },
    });
  });
}
