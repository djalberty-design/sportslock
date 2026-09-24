import { createFileRoute } from "@tanstack/react-router";
import { ProfileForm } from "@/components/app/profile-form";
import { User } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div className="space-y-6 pt-4 sm:pt-0 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1 border-b border-line pb-4">
        <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-ink flex items-center gap-2.5">
          <User className="size-7 text-primary" />
          <span>User Profile & Personalization</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted">
          Customize your unit sizing, bankroll risk profile, active sportsbooks, and real-time alert triggers.
        </p>
      </div>

      <ProfileForm />
    </div>
  );
}
