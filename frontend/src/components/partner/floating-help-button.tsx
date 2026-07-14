import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Phone, FileText, HelpCircle, X } from "lucide-react";

export function FloatingHelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="mb-4 flex flex-col gap-3"
          >
            <HelpOption
              icon={<Phone className="h-5 w-5" />}
              label="Contact Trainer"
              onClick={() => console.log("Contact trainer clicked")}
            />
            <HelpOption
              icon={<MessageCircle className="h-5 w-5" />}
              label="Chat Support"
              onClick={() => console.log("Chat support clicked")}
            />
            <HelpOption
              icon={<FileText className="h-5 w-5" />}
              label="View Guide"
              onClick={() => console.log("View guide clicked")}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-primary to-shero-emerald text-white shadow-xl hover:shadow-2xl transition-shadow"
      >
        {isOpen ? <X className="h-6 w-6" /> : <HelpCircle className="h-6 w-6" />}
      </motion.button>
    </div>
  );
}

function HelpOption({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, x: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="group flex items-center gap-3 rounded-full border border-white/40 bg-white/80 py-2 pl-2 pr-4 shadow-lg backdrop-blur-md transition-colors hover:bg-white"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
        {icon}
      </div>
      <span className="text-sm font-semibold text-foreground/90">{label}</span>
    </motion.button>
  );
}
