import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: {
    width: 2048,
    height: 1200,
  },
});

try {
  await page.goto("http://127.0.0.1:3000/ghostwriter", {
    waitUntil: "networkidle",
  });

  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const docWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body.scrollWidth;

    const offenders = Array.from(document.querySelectorAll("*"))
      .map((node) => {
        const element = node;
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          id: element.id,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          scrollWidth: element.scrollWidth,
        };
      })
      .filter((entry) => entry.right > viewportWidth + 1 || entry.left < -1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 25);

    return {
      bodyWidth,
      docWidth,
      offenders,
      viewportWidth,
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
