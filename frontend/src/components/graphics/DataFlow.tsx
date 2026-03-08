import { motion } from "framer-motion";

interface DataFlowProps {
  className?: string;
}

export function DataFlow({ className }: DataFlowProps) {
  return (
    <svg viewBox="0 0 300 200" className={className} fill="none">
      {/* Data streams */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.line
          key={i}
          x1="0"
          y1={30 + i * 35}
          x2="300"
          y2={30 + i * 35}
          stroke="hsl(var(--primary))"
          strokeWidth="1"
          strokeOpacity="0.15"
          strokeDasharray="8 4"
        />
      ))}

      {/* Moving data packets */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.circle
          key={`packet-${i}`}
          cy={30 + i * 35}
          r="4"
          fill="hsl(var(--primary))"
          initial={{ cx: -20, opacity: 0 }}
          animate={{ 
            cx: [0, 300], 
            opacity: [0, 1, 1, 0] 
          }}
          transition={{
            duration: 3 + i * 0.5,
            delay: i * 0.4,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      ))}

      {/* Central hub */}
      <motion.circle
        cx="150"
        cy="100"
        r="25"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        fill="hsl(var(--primary))"
        fillOpacity="0.1"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      />
      
      {/* Hub pulse */}
      <motion.circle
        cx="150"
        cy="100"
        r="25"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        fill="none"
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{ scale: 2, opacity: 0 }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Inner core */}
      <motion.circle
        cx="150"
        cy="100"
        r="8"
        fill="hsl(var(--primary))"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </svg>
  );
}
