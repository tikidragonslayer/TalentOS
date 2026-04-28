import { cn } from "@/lib/utils";
import React from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "neon" | "ghost";
}

export function GlassCard({ 
  children, 
  className, 
  variant = "default",
  ...props 
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300",
        // Default Variant: Subtle glass, good for light/dark mode
        variant === "default" && "bg-background/60 border-white/10 shadow-lg hover:shadow-xl hover:border-white/20",
        
        // Neon Variant: Strong borders, glow effects
        variant === "neon" && "bg-black/40 border-primary/50 shadow-[0_0_15px_rgba(45,212,191,0.2)] hover:shadow-[0_0_25px_rgba(45,212,191,0.4)] hover:border-primary",
        
        // Ghost Variant: Almost invisible, just blur
        variant === "ghost" && "bg-transparent border-transparent hover:bg-white/5",
        
        className
      )}
      {...props}
    >
      {/* Glossy Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

export function GlassHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-4 border-b border-white/5", className)} {...props}>
      {children}
    </div>
  )
}

export function GlassContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6", className)} {...props}>
      {children}
    </div>
  )
}

export function GlassFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-4 border-t border-white/5 bg-black/10 flex items-center", className)} {...props}>
      {children}
    </div>
  )
}
