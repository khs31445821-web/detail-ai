import { createClient } from "@/lib/supabase/server";

export async function getOrCreateWorkspace() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: existingWorkspace, error: workspaceError } =
    await supabase
      .from("workspaces")
      .select("id, name, owner_id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

  if (workspaceError) {
    throw workspaceError;
  }

  if (existingWorkspace) {
    return existingWorkspace;
  }

  const displayName =
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "내";

  const { data: newWorkspace, error: createError } =
    await supabase
      .from("workspaces")
      .insert({
        owner_id: user.id,
        name: `${displayName}의 작업공간`,
      })
      .select("id, name, owner_id")
      .single();

  if (createError) {
    throw createError;
  }

  return newWorkspace;
}