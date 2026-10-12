// HTTP lab measurement, not browser CWV. Cookies stay in memory only.
const url = process.argv[2] ?? "http://127.0.0.1:4019/";
for (let run = 0; run < 3; run++) {
  const cookies = new Map();
  const start = performance.now();
  let redirects = 0;
  let target = url;
  let response;
  do {
    response = await fetch(target, { redirect: "manual", headers: { cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join("; ") } });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const index = pair.indexOf("=");
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    if (response.status >= 300 && response.status < 400) {
      target = new URL(response.headers.get("location"), target).href;
      if (++redirects > 4) throw new Error("Redirect loop");
    } else break;
  } while (true);
  const ttfb = performance.now() - start;
  const html = await response.text();
  console.log(JSON.stringify({ run: run + 1, status: response.status, redirects, ttfb: Math.round(ttfb), htmlComplete: Math.round(performance.now() - start), editor: html.includes('id="second-voice-input"'), loader: html.includes("Loading Second Voice AI"), bytes: Buffer.byteLength(html) }));
}
