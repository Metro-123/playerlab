import { Suspense } from "react";
import { WhatIfPage } from "@/components/WhatIfPage";
import { PageFallback } from "@/components/RouteFallback";

export default function Page() {
  return (
    <Suspense fallback={<PageFallback label="Loading What-If Lab" />}>
      <WhatIfPage />
    </Suspense>
  );
}
