import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, role, status, full_name, can_create_agreements")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsSuperAdmin() {
  const { data, isLoading } = useMyProfile();
  return {
    isSuperAdmin: data?.role === "super_admin" && data?.status === "active",
    isLoading,
  };
}
