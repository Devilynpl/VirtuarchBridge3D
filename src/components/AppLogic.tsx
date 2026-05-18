"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function AppLogic() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;

        // Listen for Electron Menu actions
        if (window.electron && window.electron.onMenuAction) {
            window.electron.onMenuAction((action: string) => {
                console.log("ELECTRON ACTION:", action);
                if (action === "sync") {
                    toast.loading("Syncing library...", { duration: 2000 });
                    // Trigger any sync logic here if needed
                }
            });
        }
    }, [isClient]);

    return null;
}

declare global {
    interface Window {
        electron: {
            onMenuAction: (callback: (action: string) => void) => void;
        };
    }
}
