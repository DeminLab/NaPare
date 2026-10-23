export type Account = { id: string; email: string; firstName?: string; lastName?: string };
export type DeletionPreview = {
  accountId: string; archiveModel: 'pseudonymous'; removed: string[]; retained: string[];
  blockers: { code: string; message: string }[];
};
export type DeletionReceipt = {
  success: boolean; archiveCode: string; deletedAt: string; retained: string[]; archiveModel: 'pseudonymous';
};
