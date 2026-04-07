import { cn } from "@/lib/utils";

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "text-sm",
  md: "text-xl",
  lg: "text-3xl",
};

export function Icon({ name, className, filled = false, size = "md" }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined", sizeMap[size], className)}
      style={filled ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
    >
      {name}
    </span>
  );
}
