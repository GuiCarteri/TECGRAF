import { Shell } from "@/components/strata/shell";
import { Library } from "@/components/strata/library";
export default function Home() {
  return (
    <Shell active="library">
      <Library />
    </Shell>
  );
}
