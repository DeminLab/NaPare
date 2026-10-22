/** Explicit database capability. University NULL means global; [] means none. */
export interface TenantDatabaseGrant {
  tables: string[];
  universityIds: string[] | null;
  write?: boolean;
  /** A checked platform scope replaces the actor's ordinary university access. */
  replaceActor?: boolean;
}

/** Only trusted authentication code may establish these identity capabilities. */
export interface TenantAuthenticationAccess {
  authentication: { id?: string; email?: string; maxUserId?: string; write?: boolean };
}

export interface TenantDatabaseRelationAccess {
  relation: { table: string; column: string; value: string; write?: boolean };
}

export type TenantDatabaseAccess = TenantDatabaseGrant | TenantAuthenticationAccess | TenantDatabaseRelationAccess;
