export interface DiscussionMessage {
  id: string;
  pairSpaceId: string;
  userId: string;
  text: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionMessageWithUser extends DiscussionMessage {
  userName?: string;
  userAvatar?: string;
  replies?: DiscussionMessageWithUser[];
}
