/// <reference lib="webworker" />
import { packMixed, type PackMixedOptions, type Vec3 } from "./packing";

self.onmessage = (
  e: MessageEvent<{ container: Vec3; box: Vec3; options: PackMixedOptions }>
) => {
  const { container, box, options } = e.data;
  try {
    self.postMessage({ ok: true, result: packMixed(container, box, options) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
