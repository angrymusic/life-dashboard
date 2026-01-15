import { Button } from "@/shared/ui/button";
import { Plus } from "lucide-react";

type FooterProps = {
  onAddClick: () => void;
};

export default function Footer({ onAddClick }: FooterProps) {
  return (
    <footer className="fixed bottom-0 z-50 flex justify-end w-full items-center p-4 pointer-events-none">
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Add"
        className="rounded-full bg-white/60 backdrop-blur-[2px] hover:bg-white/80 pointer-events-auto"
        onClick={onAddClick}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </footer>
  );
}
