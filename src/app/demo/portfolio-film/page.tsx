import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioFilmDemo } from "@/components/ghostwriter/PortfolioFilmDemo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Second Voice — portfolio film capture",
  description:
    "A deterministic development-only capture route for the Second Voice outcome rewrite workflow.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function PortfolioFilmRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.GHOSTWRITER_ENABLE_PORTFOLIO_FILM !== "true"
  ) {
    notFound();
  }

  const params = await searchParams;

  return (
    <PortfolioFilmDemo
      captureMode={params.capture === "1"}
      once={params.once === "1"}
    />
  );
}
