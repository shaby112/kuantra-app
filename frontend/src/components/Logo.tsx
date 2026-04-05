import { cn } from "@/lib/utils";

interface LogoProps {
  showText?: boolean;
  showSubtitle?: boolean;
  size?: "sm" | "md" | "lg";
  inverted?: boolean;
  className?: string;
}

const markSizes = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-14 w-14",
};

const textSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl",
};

function PrismMark({ size }: { size: "sm" | "md" | "lg" }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn(markSizes[size], "shrink-0")}
      role="img"
      aria-label="Kuantra prism logo"
    >
      <defs>
        <linearGradient id="logoA" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B39BFF" />
          <stop offset="100%" stopColor="#5F5DFF" />
        </linearGradient>
        <linearGradient id="logoB" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#9EE3FF" />
          <stop offset="100%" stopColor="#4D5FD6" />
        </linearGradient>
        <linearGradient id="logoC" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6A3CC4" />
          <stop offset="100%" stopColor="#A67BFF" />
        </linearGradient>
        <filter id="logoGlow">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon points="60,8 112,98 8,98" fill="url(#logoA)" opacity="0.96" filter="url(#logoGlow)" />
      <polygon points="60,8 84,56 58,62" fill="url(#logoB)" opacity="0.92" />
      <polygon points="84,56 112,98 58,62" fill="url(#logoB)" opacity="0.78" />
      <polygon points="8,98 58,62 60,8" fill="url(#logoC)" opacity="0.88" />
      <polygon points="58,62 112,98 8,98" fill="#4B3FB7" opacity="0.55" />
      <line x1="60" y1="8" x2="58" y2="62" stroke="#E8DEFF" strokeOpacity="0.58" />
      <line x1="58" y1="62" x2="8" y2="98" stroke="#E8DEFF" strokeOpacity="0.3" />
      <line x1="58" y1="62" x2="112" y2="98" stroke="#E8DEFF" strokeOpacity="0.3" />
    </svg>
  );
}

export function Logo({ showText = true, size = "md", inverted = false, className }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <PrismMark size={size} />
      {showText && (
        <div className={cn("font-semibold leading-none", textSizes[size], inverted ? "text-white" : "text-foreground")}>
          Kuantra
        </div>
      )}
    </div>
  );
}
