import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Share2,
  CheckCheck,
  ExternalLink,
} from "lucide-react";
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "./api";
import { INotification } from "./types";
import { getSocket } from "../../lib/socket/socketClient";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "report_approved":
    case "section_approved":
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "report_generated":
      return <FileText className="w-4 h-4 text-accent" />;
    case "conflict_detected":
    case "risk_flagged":
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case "report_shared":
      return <Share2 className="w-4 h-4 text-cyan-400" />;
    default:
      return <Bell className="w-4 h-4 text-slate-400" />;
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Real-time socket listener for incoming notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [queryClient]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = async (notif: INotification) => {
    if (!notif.readAt) {
      markReadMutation.mutate(notif._id);
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white transition-colors"
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-background shadow-md animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-panel border border-surface-border shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px]"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-panel">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/20 text-accent">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="flex items-center gap-1 text-[11px] text-accent hover:underline disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto divide-y divide-surface-border/50 flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-slate-500 opacity-60" />
                  <p className="text-xs font-medium text-slate-300">No notifications yet</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Updates on report generations, reviews, and conflicts will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const isUnread = !n.readAt;
                  return (
                    <div
                      key={n._id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3.5 flex items-start gap-3 hover:bg-surface/70 cursor-pointer transition-colors ${
                        isUnread ? "bg-accent/[0.04]" : ""
                      }`}
                    >
                      <div className="mt-0.5 p-1.5 rounded-lg bg-surface border border-surface-border shrink-0">
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${isUnread ? "text-white font-medium" : "text-slate-300"}`}>
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-mono">
                          <span>{formatRelativeTime(n.createdAt)}</span>
                          {n.link && (
                            <span className="flex items-center gap-0.5 text-accent">
                              View <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
