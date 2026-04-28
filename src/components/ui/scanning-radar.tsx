import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

interface ScanningRadarProps {
    className?: string;
}

export function ScanningRadar({ className }: ScanningRadarProps) {
    return (
        <div className={cn("relative flex items-center justify-center w-32 h-32 md:w-48 md:h-48 mx-auto", className)}>
            {/* Outer Glow */}
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />

            {/* Radar Rings */}
            <div className="absolute inset-0 border border-primary/30 rounded-full animate-ping [animation-duration:3s]" />
            <div className="absolute inset-4 border border-primary/20 rounded-full animate-ping [animation-duration:3s] [animation-delay:1s]" />

            {/* Rotating Scanner Gradient */}
            <div className="absolute inset-0 rounded-full animate-spin [animation-duration:4s] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,theme(colors.primary.DEFAULT)_360deg)] opacity-30 mask-image-circle" />

            {/* Static Grid Lines (Optional tech aesthetic) */}
            <div className="absolute inset-0 border border-primary/20 rounded-full" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[1px] h-full bg-primary/10" />
                <div className="h-[1px] w-full bg-primary/10 absolute" />
            </div>

            {/* Center Icon */}
            <div className="relative z-10 bg-background/80 border border-primary/50 p-4 rounded-full backdrop-blur-md shadow-[0_0_15px_theme(colors.primary.DEFAULT)]">
                <Search className="h-8 w-8 text-primary" />
            </div>
        </div>
    );
}
