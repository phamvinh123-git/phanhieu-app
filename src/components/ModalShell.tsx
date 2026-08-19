"use client";

import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Backdrop + panel dùng chung cho các modal, có animation vào/ra
// ---------------------------------------------------------------------------

export function ModalShell({
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[85vh] w-full ${maxWidth} overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
