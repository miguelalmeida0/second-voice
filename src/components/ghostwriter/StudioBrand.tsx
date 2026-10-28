import { getImageProps } from "next/image";

const desktop = getImageProps({
  src: "/brand/second-voice-wordmark.png", alt: "", width: 2048, height: 684, sizes: "197px",
}).props;
const mobile = getImageProps({
  src: "/brand/second-voice-icon.png", alt: "", width: 1218, height: 1291, sizes: "76px", loading: "eager",
}).props;

export function StudioBrand() {
  return (
    <picture className="duet-logo">
      <source media="(min-width: 768px)" srcSet={desktop.srcSet} sizes={desktop.sizes} />
      {/* Next optimizes each original; CSS frames the artwork inside its white canvas. */}
      <img {...mobile} alt="" />
    </picture>
  );
}
