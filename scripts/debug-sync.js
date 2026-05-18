const { generateAssetsData, getAssets } = require('./src/lib/assets.ts');

async function debugScan() {
    console.log("=== STARTING DIRECT DEBUG SCAN ===");
    try {
        console.log("1. Calling getAssets()...");
        let localAssets = await getAssets();
        console.log(`1. getAssets() returned ${localAssets.length} items`);

        if (localAssets.length === 0) {
            console.log("2. Calling generateAssetsData()...");
            localAssets = await generateAssetsData();
            console.log(`2. generateAssetsData() returned ${localAssets.length} items`);
        }

        console.log("=== FINISHED ===");
    } catch (err) {
        console.error("DEBUG SCRIPT FAILED:", err);
    }
}

debugScan();
