export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  destination: string;
  authorName: string;
  authorAvatar: string;
  authorBio?: string;
  createdAt: string;
  images: string[];
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  linkedPlannerId?: string;
  linkedPlannerTitle?: string;
  tags: string[];
}
