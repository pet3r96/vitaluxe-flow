import { motion, AnimatePresence, Variants } from "framer-motion";
import { NavLink } from "react-router-dom";
import { MenuItem } from "@/config/menus";
import { cn } from "@/lib/utils";

interface FlyoutMenuProps {
  items: MenuItem[];
  isVisible: boolean;
  onItemClick?: () => void;
}

const flyoutVariants: Variants = {
  hidden: { 
    opacity: 0, 
    x: -10
  },
  visible: { 
    opacity: 1, 
    x: 0
  }
};

export function FlyoutMenu({ items, isVisible, onItemClick }: FlyoutMenuProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={flyoutVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className="absolute left-full ml-2 top-0 z-50 w-64 rounded-lg border border-sidebar-border bg-sidebar-background shadow-elevated"
          onMouseLeave={onItemClick}
        >
          <div className="p-2 space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={onItemClick}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 min-h-[44px]",
                      isActive
                        ? "bg-card border-l-4 border-[#BE9B4B] text-[#BE9B4B] font-semibold pl-[8px] pr-3"
                        : "text-sidebar-foreground hover:text-[#D8C07A] hover:bg-muted/10 px-3"
                    )
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
