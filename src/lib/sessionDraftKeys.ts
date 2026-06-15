type SessionDraftKeyParams = {
  userId: string;
  company: string;
  project: string;
  auditDate: string;
};

export function buildSessionDraftKey({
  userId,
  company,
  project,
  auditDate,
}: SessionDraftKeyParams) {
  return `audit-draft:${userId}:${company}:${project}:${auditDate}`;
}

export function buildSessionDraftSyncHashKey(params: SessionDraftKeyParams) {
  return `${buildSessionDraftKey(params)}:sync-hash`;
}

export function buildSessionDraftUserPrefix(userId: string) {
  return `audit-draft:${userId}:`;
}
