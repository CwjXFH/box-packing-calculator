/**
 * 端到端测试：用本机已安装的 Chrome / Edge，以「双击打开」的方式（file://）加载打包好的
 * dist/装箱计算器.html，验证业务同事实际使用时的关键流程。
 *
 * 用法：npm run build && npm run test:e2e
 * 指定浏览器：BROWSER_PATH="/path/to/chrome" npm run test:e2e
 * 截图输出到 test-results/ 目录。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const htmlPath = path.join(root, "dist", "装箱计算器.html");
const outDir = path.join(root, "test-results");

if (!fs.existsSync(htmlPath)) {
  console.error(`找不到 ${htmlPath}，请先运行 npm run build`);
  process.exit(1);
}

const candidates = {
  "Microsoft Edge": [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  "Google Chrome": [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ],
};
const browsers = process.env.BROWSER_PATH
  ? [["自定义浏览器", process.env.BROWSER_PATH]]
  : Object.entries(candidates)
      .map(([name, paths]) => [name, paths.find(p => fs.existsSync(p))])
      .filter(([, p]) => p);
if (browsers.length === 0) {
  console.error("没有找到 Chrome 或 Edge，请用 BROWSER_PATH 指定浏览器路径");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const url = pathToFileURL(htmlPath).href;
let failures = 0;

for (const [name, executablePath] of browsers) {
  const slug = name.replace(/\s+/g, "-").toLowerCase();
  const browser = await chromium.launch({
    executablePath,
    // 无显卡环境下用软件渲染，保证 3D 视图（WebGL）可用
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const problems = [];
  page.on("pageerror", e => problems.push(`页面异常：${e.message}`));
  page.on(
    "console",
    m => m.type() === "error" && problems.push(`控制台错误：${m.text()}`)
  );
  page.on("request", r => {
    if (!/^(file|data|blob):/.test(r.url()))
      problems.push(`发起了网络请求：${r.url()}`);
  });
  // 统计 Worker 的使用情况：在 file:// 下 Worker 必须能正常工作
  await page.addInitScript(() => {
    const Native = window.Worker;
    window.__worker = { created: 0, messages: 0, errors: 0 };
    window.Worker = class extends Native {
      constructor(...args) {
        super(...args);
        window.__worker.created++;
        this.addEventListener("message", () => window.__worker.messages++);
        this.addEventListener("error", () => window.__worker.errors++);
      }
    };
  });

  const fill = async values => {
    for (const [id, v] of Object.entries(values)) await page.fill(`#${id}`, v);
  };
  const calculate = async () => {
    await page.click("text=开始计算");
    await page.waitForSelector("text=最多可装", { timeout: 15000 });
    await page.waitForFunction(
      () => !document.body.innerText.includes("计算中")
    );
  };
  const count = async () =>
    Number((await page.locator(".text-7xl").innerText()).replace(/,/g, ""));
  const pageText = () => page.locator("body").innerText();

  const step = async (title, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${title}`);
    } catch (err) {
      failures++;
      console.log(
        `  ✗ ${title}\n    ${err.message.split("\n").join("\n    ")}`
      );
      await page.screenshot({
        path: path.join(outDir, `${slug}-失败-${title}.png`),
        fullPage: true,
      });
    }
  };

  console.log(`\n${name}（${executablePath}）`);
  await page.goto(url);

  await step("默认参数：混合方向可装 33 个，计算在后台线程完成", async () => {
    await calculate();
    assert.equal(await count(), 33);
    assert.match(await pageText(), /理论上限为 34 个/);
    const w = await page.evaluate(() => window.__worker);
    assert.deepEqual(
      w,
      { created: 1, messages: 1, errors: 0 },
      `Worker 状态 ${JSON.stringify(w)}`
    );
    assert.equal(await page.locator("canvas").count(), 1, "3D 视图没有渲染");
    await page.screenshot({
      path: path.join(outDir, `${slug}-默认参数.png`),
      fullPage: true,
    });
  });

  await step("切换为单一方向：28 个，且为该模式下的最大值", async () => {
    await page.click("#mode");
    assert.equal(await count(), 28);
    assert.match(await pageText(), /所有箱子同一方向时，这就是最大值/);
    assert.match(await pageText(), /允许混合方向可装 33 个/);
    await page.click("#mode");
  });

  await step("修改参数后提示结果已过期", async () => {
    await fill({ bigLength: "61" });
    assert.match(await pageText(), /参数已修改/);
  });

  await step("需要交错摆放的案例：8 个，已证明最优", async () => {
    await fill({
      bigLength: "42",
      bigWidth: "40",
      bigHeight: "45",
      thickness: "0.5",
    });
    await fill({ smallLength: "21", smallWidth: "17", smallHeight: "21" });
    await calculate();
    assert.equal(await count(), 8);
    assert.match(await pageText(), /已证明是最大值/);
    assert.doesNotMatch(await pageText(), /参数已修改/);
  });

  await step(
    "大数量：100³ 装 5³ = 8000 个（旧版会被截断为 1000）",
    async () => {
      await fill({
        bigLength: "100",
        bigWidth: "100",
        bigHeight: "100",
        thickness: "0",
      });
      await fill({ smallLength: "5", smallWidth: "5", smallHeight: "5" });
      await calculate();
      assert.equal(await count(), 8000);
    }
  );

  await step("放不下时给出明确提示", async () => {
    await fill({ smallLength: "120" });
    await page.click("text=开始计算");
    await page.waitForSelector("text=一个都放不下", { timeout: 15000 });
  });

  await step("非法输入：逐项提示，不计算", async () => {
    await fill({ smallLength: "", smallWidth: "1.25", thickness: "60" });
    await page.click("text=开始计算");
    const text = await pageText();
    for (const msg of [
      "请填写",
      "最多 1 位小数",
      "壁厚过大",
      "请先修正上面标红的输入项",
    ]) {
      assert.ok(text.includes(msg), `缺少提示「${msg}」`);
    }
    await page.screenshot({
      path: path.join(outDir, `${slug}-输入校验.png`),
      fullPage: true,
    });
  });

  await step("全程无报错、无网络请求", async () => {
    assert.deepEqual(problems, []);
  });

  await browser.close();
}

console.log(
  failures === 0
    ? "\n端到端测试全部通过"
    : `\n${failures} 项失败，截图见 test-results/`
);
process.exit(failures === 0 ? 0 : 1);
