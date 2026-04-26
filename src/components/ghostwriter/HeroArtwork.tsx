import { getImageProps } from "next/image";

type HeroArtworkProps = {
  className?: string;
};

const HERO_ALT = "Writer character illustration reacting to the hero headline";

export function HeroArtwork({ className }: HeroArtworkProps) {
  const wrapperClassName = className ? `hero-character ${className}` : "hero-character";

  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    alt: "",
    decoding: "async",
    height: 1117,
    loading: "eager",
    sizes: "(min-width: 1280px) min(46vw, 780px), 1px",
    src: "/ghostwriter-hero-desktop-edge-clean.png",
    width: 1408,
  });

  const {
    props: { srcSet: mediumSrcSet },
  } = getImageProps({
    alt: "",
    decoding: "async",
    height: 1030,
    loading: "eager",
    sizes: "(min-width: 1024px) and (max-width: 1279px) min(44vw, 560px), 1px",
    src: "/ghostwriter-hero-medium-edge-clean.png",
    width: 1527,
  });

  const {
    props: { src, srcSet: smallSrcSet, ...imgProps },
  } = getImageProps({
    alt: HERO_ALT,
    decoding: "async",
    height: 1116,
    loading: "eager",
    sizes: "(max-width: 1023px) min(68vw, 460px), 1px",
    src: "/ghostwriter-hero-small-edge-clean.png",
    width: 1409,
  });

  return (
    <picture className={wrapperClassName}>
      <source media="(min-width: 1280px)" srcSet={desktopSrcSet} />
      <source media="(min-width: 1024px)" srcSet={mediumSrcSet} />
      <source media="(max-width: 1023px)" srcSet={smallSrcSet} />
      <img {...imgProps} alt={HERO_ALT} className="hero-character-image" src={src} />
    </picture>
  );
}
