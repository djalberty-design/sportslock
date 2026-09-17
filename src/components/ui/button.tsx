import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[transform,background-color,box-shadow,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] min-h-11",
  {
    variants: {
      variant: {
        primary: "bg-emerald-500 text-zinc-950 hover:opacity-90",
        gold: "bg-emerald-500 text-zinc-950 hover:opacity-90",
        ghost: "bg-transparent text-ink hover:bg-wash",
        outline: "bg-card text-ink shadow-[var(--shadow-paper)] hover:shadow-[var(--shadow-paper-hover)]",
        danger: "bg-down text-ink hover:opacity-90",
      },
      size: {
        sm: "rounded-md px-3 text-sm h-10",
        md: "rounded-md px-4 text-sm h-11",
        lg: "rounded-lg px-5 text-base h-12",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
