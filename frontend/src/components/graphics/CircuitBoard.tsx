import { motion } from "framer-motion";

interface CircuitBoardProps {
  className?: string;
}

export function CircuitBoard({ className }: CircuitBoardProps) {
  return (
    <svg viewBox="0 0 400 400" className={className} fill="none">
      {/* Circuit paths */}
      <motion.path
        d="M50 200 H150 V100 H250"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeOpacity="0.2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
      <motion.path
        d="M50 250 H100 V350 H200 V300"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeOpacity="0.2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, delay: 0.3, ease: "easeInOut" }}
      />
      <motion.path
        d="M350 100 H300 V200 H200"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeOpacity="0.2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, delay: 0.6, ease: "easeInOut" }}
      />
      <motion.path
        d="M350 300 H280 V250 H200"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeOpacity="0.2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, delay: 0.9, ease: "easeInOut" }}
      />

      {/* Junction nodes */}
      {[[150, 100], [150, 200], [100, 250], [100, 350], [200, 300], [200, 350], [300, 100], [300, 200], [280, 250], [280, 300]].map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r="4"
          fill="hsl(var(--primary))"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.5, scale: 1 }}
          transition={{ duration: 0.3, delay: 1 + i * 0.1 }}
        />
      ))}

      {/* Center processor */}
      <motion.rect
        x="175"
        y="175"
        width="50"
        height="50"
        rx="4"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        fill="hsl(var(--primary))"
        fillOpacity="0.1"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 1.5 }}
      />
      <motion.rect
        x="190"
        y="190"
        width="20"
        height="20"
        rx="2"
        fill="hsl(var(--primary))"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2, delay: 2, repeat: Infinity }}
      />
    </svg>
  );
}
