// 构建后处理：把 dist/index.html 复制为 dist/装箱计算器.html，方便直接分发给业务同事。
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve(import.meta.dirname, "..", "dist");
const src = path.join(dist, "index.html");
const dest = path.join(dist, "装箱计算器.html");

fs.copyFileSync(src, dest);
fs.rmSync(src);
const kb = (fs.statSync(dest).size / 1024).toFixed(0);
console.log(`\n✔ 已生成 ${dest} (${kb} KB)，双击即可在浏览器中使用。`);
