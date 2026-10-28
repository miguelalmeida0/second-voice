import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RewriteReviewPreview } from "@/components/ghostwriter/RewriteReviewPreview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Second Voice — sample review",
  robots: { index: false, follow: false },
};

export default function RewriteReviewPreviewRoute() {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") {
    notFound();
  }
  return <RewriteReviewPreview />;
}
