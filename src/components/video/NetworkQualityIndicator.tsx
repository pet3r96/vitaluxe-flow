import { Signal, SignalHigh, SignalLow, SignalMedium, SignalZero } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NetworkQualityIndicatorProps {
  quality: number;
  label?: string;
}

export const NetworkQualityIndicator = ({
  quality,
  label = "Connection",
}: NetworkQualityIndicatorProps) => {
  const getQualityInfo = () => {
    if (quality === 0) return { icon: SignalZero, color: "text-muted-foreground", text: "Unknown" };
    if (quality === 1) return { icon: SignalHigh, color: "text-green-500", text: "Excellent" };
    if (quality === 2) return { icon: SignalHigh, color: "text-green-500", text: "Good" };
    if (quality === 3) return { icon: SignalMedium, color: "text-yellow-500", text: "Poor" };
    if (quality === 4) return { icon: SignalMedium, color: "text-yellow-500", text: "Bad" };
    if (quality === 5) return { icon: SignalLow, color: "text-red-500", text: "Very Bad" };
    return { icon: SignalZero, color: "text-red-500", text: "Down" };
  };

  const { icon: Icon, color, text } = getQualityInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 px-2 py-1 bg-black/60 rounded-lg text-white text-xs">
            <Icon className={`h-3 w-3 ${color}`} />
            <span>{text}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {label}: {text} (Quality: {quality}/6)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
