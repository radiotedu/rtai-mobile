export interface HeaderAccountUser {
  display_name?: string | null;
  email?: string | null;
}

/**
 * Produces the compact account label shown in the shared application header.
 * The API display name is preferred; older account payloads can still fall
 * back to the local part of the email address.
 */
export function getHeaderAccountLabel(
  user?: HeaderAccountUser | null,
): string | null {
  if (!user) {
    return null;
  }

  const displayName = String(user.display_name ?? '').trim();
  if (displayName) {
    return displayName;
  }

  const email = String(user.email ?? '').trim();
  if (!email) {
    return null;
  }

  return email.split('@')[0]?.trim() || email;
}
