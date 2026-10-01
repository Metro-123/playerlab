import { Suspense } from "react";
import { PlayersPage } from "@/components/PlayersPage";
import { PageFallback } from "@/components/RouteFallback";

export default function Page() {
  return (
    <Suspense fallback={<PageFallback label="Loading player database" />}>
      <PlayersPage />
    </Suspense>
  );
}
