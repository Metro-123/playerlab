import { Suspense } from "react";
import { ComparePage } from "@/components/ComparePage";
import { PageFallback } from "@/components/RouteFallback";

export default function Page() {
  return (
    <Suspense fallback={<PageFallback label="Loading head-to-head" />}>
      <ComparePage />
    </Suspense>
  );
}
