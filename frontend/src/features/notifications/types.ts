export interface INotification {
  _id: string;
  userId: string;
  type: string;
  message: string;
  link?: string;
  readAt?: string;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: INotification[];
  unreadCount: number;
}
