import { getImageProps } from "next/image";

const desktop = getImageProps({
  src: "/brand/second-voice-wordmark.webp", alt: "", width: 600, height: 200, sizes: "197px", unoptimized: true,
}).props;
const mobile = getImageProps({
  src: "/brand/second-voice-icon.webp", alt: "", width: 228, height: 242, sizes: "76px", loading: "eager", unoptimized: true,
}).props;

export function StudioBrand() {
  return (
    <picture className="duet-logo">
      <source media="(min-width: 768px)" srcSet={desktop.src} sizes={desktop.sizes} />
      {/* Pre-encoded at 3× display size; no request-time optimization dependency. */}
      <img {...mobile} alt="" />
    </picture>
  );
}
