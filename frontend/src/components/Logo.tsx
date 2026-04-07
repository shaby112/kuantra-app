import { cn } from "@/lib/utils";

interface LogoProps {
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const imgSizes = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

const textSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

export function Logo({ showText = true, size = "md", className }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <img
        src="/logo.png"
        alt="Kuantra Logo"
        className={cn(imgSizes[size], "object-contain shrink-0")}
      />
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-black tracking-tighter text-primary", textSizes[size])}>
            Kuantra
          </span>
          <span className="font-label uppercase tracking-widest text-[10px] text-zinc-500">
            BI Platform
          </span>
        </div>
      )}
    </div>
  );
}
