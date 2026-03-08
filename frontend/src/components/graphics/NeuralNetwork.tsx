import { motion } from "framer-motion";

interface NeuralNetworkProps {
  className?: string;
}

export function NeuralNetwork({ className }: NeuralNetworkProps) {
  const nodes = [
    { x: 50, y: 80, delay: 0 },
    { x: 120, y: 40, delay: 0.1 },
    { x: 120, y: 120, delay: 0.2 },
    { x: 200, y: 60, delay: 0.3 },
    { x: 200, y: 100, delay: 0.4 },
    { x: 280, y: 80, delay: 0.5 },
  ];

  const connections = [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 1, to: 3 },
    { from: 1, to: 4 },
    { from: 2, to: 3 },
    { from: 2, to: 4 },
    { from: 3, to: 5 },
    { from: 4, to: 5 },
  ];

  return (
    <svg viewBox="0 0 330 160" className={className} fill="none">
      {/* Connections */}
      {connections.map((conn, i) => (
        <motion.line
          key={i}
          x1={nodes[conn.from].x}
          y1={nodes[conn.from].y}
          x2={nodes[conn.to].x}
          y2={nodes[conn.to].y}
          stroke="hsl(var(--primary))"
          strokeWidth="1"
          strokeOpacity="0.3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, delay: i * 0.1, ease: "easeOut" }}
        />
      ))}
      
      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.circle
          key={i}
          cx={node.x}
          cy={node.y}
          r="6"
          fill="hsl(var(--primary))"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: node.delay }}
        />
      ))}

      {/* Pulse effects */}
      {nodes.map((node, i) => (
        <motion.circle
          key={`pulse-${i}`}
          cx={node.x}
          cy={node.y}
          r="6"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{
            duration: 2,
            delay: node.delay + 1,
            repeat: Infinity,
            repeatDelay: 3,
          }}
        />
      ))}
    </svg>
  );
}
