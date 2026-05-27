import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    (async () => {
      const { data } = await supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle();
      if (data?.onboarded) navigate({ to: "/dashboard", replace: true });
      else navigate({ to: "/onboarding", replace: true });
    })();
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Wallet className="h-6 w-6 text-primary animate-pulse" />
        <span>Loading FamilyLedger…</span>
      </div>
    </div>
  );
}
