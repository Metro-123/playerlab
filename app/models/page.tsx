import { Suspense } from "react";
import { ModelsPage } from "@/components/ModelsPage";
import { PageFallback } from "@/components/RouteFallback";

export default function Page() {
  return (
    <Suspense fallback={<PageFallback label="Loading model metrics" />}>
      <ModelsPage />
    </Suspense>
  );
}
