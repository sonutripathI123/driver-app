import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface Floating3DCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'gold' | 'cyan' | 'emerald' | 'none';
}

export const Floating3DCard: React.FC<Floating3DCardProps> = ({
  children,
  className = '',
  glowColor = 'gold',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = (mouseX / width) * 100;
    const yPct = (mouseY / height) * 100;

    const rotX = ((mouseY - height / 2) / (height / 2)) * -7;
    const rotY = ((mouseX - width / 2) / (width / 2)) * 7;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlarePos({ x: xPct, y: yPct, opacity: 0.15 });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos({ x: 50, y: 50, opacity: 0 });
  };

  const glowStyles = {
    gold: 'border-amber-500/30 shadow-[0_10px_30px_-10px_rgba(212,175,55,0.2)] hover:border-amber-400/50',
    cyan: 'border-cyan-500/30 shadow-[0_10px_30px_-10px_rgba(6,182,212,0.2)] hover:border-cyan-400/50',
    emerald: 'border-emerald-500/30 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.2)] hover:border-emerald-400/50',
    none: 'border-slate-800',
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
      className={`relative rounded-2xl bg-slate-900/80 backdrop-blur-xl border transition-colors duration-300 ${glowStyles[glowColor]} ${className}`}
    >
      {/* Specular Glare Reflection */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300 z-10"
        style={{
          background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity}), transparent 60%)`,
        }}
      />
      <div className="relative z-20 h-full">{children}</div>
    </motion.div>
  );
};
