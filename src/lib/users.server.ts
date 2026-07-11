type AuthAdminErrorLike = {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
};

export function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*?";
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = 0; i < 8; i++) base.push(pick(all));
  return base.sort(() => Math.random() - 0.5).join("");
}

export function getCreateUserFailureMessage(error: AuthAdminErrorLike | null | undefined) {
  const rawMsg = error?.message?.trim() ?? "";
  const msg = rawMsg === "{}" ? "" : rawMsg;
  const normalized = msg.toLowerCase();

  if (error?.code === "email_exists" || normalized.includes("already") || normalized.includes("registered")) {
    return "Ya existe un usuario con ese email.";
  }

  if (error?.name === "AuthRetryableFetchError" || (error?.status ?? 0) >= 500 || !msg) {
    return "No se pudo completar la creación en autenticación. Inténtalo de nuevo en unos segundos.";
  }

  return msg;
}