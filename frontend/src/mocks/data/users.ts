import { InviteCandidate } from "@/types/planner";

export const CURRENT_USER: InviteCandidate = {
  id: "user-current",
  displayName: "Trọng Phúc",
  email: "phuc@example.com",
  avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
  isOnline: true,
};

export const MOCK_USERS: InviteCandidate[] = [
  CURRENT_USER,
  {
    id: "user-lan",
    displayName: "Lan Nguyễn",
    email: "lan@example.com",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    isOnline: true,
  },
  {
    id: "user-minh",
    displayName: "Minh Trần",
    email: "minh@example.com",
    avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80",
    isOnline: false,
  },
  {
    id: "user-huong",
    displayName: "Hương Giang",
    email: "huong@example.com",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80",
    isOnline: true,
  },
  {
    id: "user-tuan",
    displayName: "Tuấn Anh",
    email: "tuan@example.com",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    isOnline: false,
  },
  {
    id: "user-quynh",
    displayName: "Quỳnh Như",
    email: "quynh@example.com",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80",
    isOnline: true,
  },
  {
    id: "user-khoa",
    displayName: "Đăng Khoa",
    email: "khoa@example.com",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    isOnline: false,
  },
];
