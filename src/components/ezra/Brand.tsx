import markImage from "@/assets/ezra-mark.png";
import { cn } from "@/lib/utils";

export function EzraMark({ className }: { className?: string }) {
  return (
    <img
      src={markImage}
      alt=""
      width={816}
      height={816}
      className={cn("size-9 object-contain", className)}
    />
  );
}

export function EzraLogo({ className }: { className?: string }) {
  return (
    <span dir="ltr" className={cn("logo-ezra text-2xl font-semibold", className)}>
      EZRA
    </span>
  );
}