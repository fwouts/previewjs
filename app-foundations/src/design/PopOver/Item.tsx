import { motion } from "framer-motion";
import type React from "react";

export const Item = (props: {
  children: React.ReactNode;
  onAnimationComplete(): void;
}) => {
  return (
    <motion.div
      animate={{ x: "100%" }}
      transition={{ delay: 3 }}
      onAnimationComplete={props.onAnimationComplete}
    >
      <motion.div
        animate={{ x: 0, marginBottom: 0 }}
        initial={{ x: "100%", marginBottom: -100 }}
        transition={{ type: "tween" }}
      >
        <div className="action-log bg-blue-700 text-blue-100 bg-opacity-80 p-2 m-2 border-2 border-blue-300">
          {props.children}
        </div>
      </motion.div>
    </motion.div>
  );
};
