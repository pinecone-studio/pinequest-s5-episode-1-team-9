import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-tight transition duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-[#6d4aff] to-[#3b6cff] text-white shadow-[0_10px_24px_rgba(109,74,255,0.28)] hover:shadow-[0_14px_28px_rgba(109,74,255,0.34)]",
        quiet: "border border-line bg-white text-paper shadow-sm hover:bg-panel-2",
        ghost: "text-mute hover:bg-white/70 hover:text-paper",
      },
      size: {
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-[15px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
