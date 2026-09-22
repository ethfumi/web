// The gzip is a distribution artifact, so static hosting needs no Content-Encoding configuration.
(async () => {
  "use strict";
  const url = new URL(document.currentScript.src);
  const version = url.searchParams.get("v");
  const status = document.getElementById("load-status");
  try {
    const asset = new URL(`runtime.js.gz?v=${version}`, url);
    const response = await fetch(asset);
    if (!response.ok) throw new Error(`Runtime download failed: ${response.status}`);
    // Reuse the first download when the new service worker installs its offline cache.
    if ("caches" in window) {
      const copy = response.clone();
      caches.open(`train-go-v${version}`).then(cache => cache.put(asset, copy)).catch(() => {});
    }
    let bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (typeof DecompressionStream === "function") {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        await new Promise((resolve, reject) => {
          const fallback = document.createElement("script");
          fallback.src = new URL(`vendor/fflate.min.js?v=${version}`, url);
          fallback.onload = resolve;
          fallback.onerror = reject;
          document.head.appendChild(fallback);
        });
        bytes = window.fflate.gunzipSync(bytes);
      }
    }
    const runtime = document.createElement("script");
    runtime.textContent = new TextDecoder().decode(bytes);
    document.head.appendChild(runtime);
    runtime.remove();
    if (!window.TRAIN_GO_READY) throw new Error("Runtime did not finish starting");
    document.body.classList.remove("loading");
    status.remove();
  } catch (error) {
    console.error(error);
    status.textContent = "よみこめなかったよ。もういちど ひらいてね。";
    const retry = document.createElement("button");
    retry.textContent = "もういちど";
    retry.addEventListener("click", () => location.reload());
    status.appendChild(retry);
  }
})();
