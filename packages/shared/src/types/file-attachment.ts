import { FileType } from '../constants/common';

export interface FileAttachment {
  id: string;
  pairSpaceId: string;
  uploadedBy: string;
  fileUrl: string;
  fileName: string;
  fileType: FileType;
  size: number;
  createdAt: Date;
}

export interface FileAttachmentWithUser extends FileAttachment {
  uploaderName?: string;
}
