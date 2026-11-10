import { api } from "../../lib/api/client";
import { NotificationsResponse, INotification } from "./types";

export async function fetchNotifications(): Promise<NotificationsResponse> {
  return api.get<NotificationsResponse>("/notifications");
}

export async function markNotificationAsRead(id: string): Promise<{ notification: INotification }> {
  return api.patch<{ notification: INotification }>(`/notifications/${id}/read`);
}

export async function markAllNotificationsAsRead(): Promise<{ count: number; message: string }> {
  return api.post<{ count: number; message: string }>("/notifications/read-all");
}

