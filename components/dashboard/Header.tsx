import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 flex justify-between items-center p-4 pointer-events-none">
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Menu"
        className="rounded-full bg-white/60 backdrop-blur-[2px] border-white/40 hover:bg-white/80 pointer-events-auto"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="border bg-white/60 backdrop-blur-[2px] border-white/40 hover:bg-white/80 shadow-sm px-6 py-2 rounded-full font-medium text-sm pointer-events-auto">
        Dashboard
      </div>
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Menu"
        className="rounded-full bg-white/60 backdrop-blur-[2px] border-white/40 hover:bg-white/80 pointer-events-auto"
      >
        <Menu className="h-5 w-5" />
      </Button>
    </header>
  );
}
