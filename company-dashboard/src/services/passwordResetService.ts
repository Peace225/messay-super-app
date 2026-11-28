import { messayAuth } from "../lib/messaySupabaseAuth";

export async function envoyerRecuperation(email: string) {
  const { error } = await messayAuth.auth.resetPasswordForEmail(
    email.trim(),
    {
      redirectTo: `${window.location.origin}/reset-password`,
    }
  );

  if (error) throw error;
}