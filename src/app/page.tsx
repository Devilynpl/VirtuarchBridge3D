import { getAssets, hasCache } from "@/lib/assets";
import AssetLibrary from "@/components/AssetLibrary";
import AuthOverlay from "@/components/AuthOverlay";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Read from cache only (single JSON file) — fast, with 2s safety timeout
  const assets = await Promise.race([
    getAssets(),
    new Promise<any[]>((r) => setTimeout(() => r([]), 2000)),
  ]);
  const cacheExists = await hasCache();

  return (
    <main className="w-full min-h-screen pt-12">
      <AuthOverlay />
      <AssetLibrary initialAssets={assets} needsSync={!cacheExists} />
    </main>
  );
}
