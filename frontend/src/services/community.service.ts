import { CommunityPost } from "@/types/community";
import { MOCK_COMMUNITY_POSTS } from "@/mocks/data/community";

export const communityService = {
  async getPosts(): Promise<CommunityPost[]> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return [...MOCK_COMMUNITY_POSTS];
  },

  async getPostById(id: string): Promise<CommunityPost | null> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const found = MOCK_COMMUNITY_POSTS.find((p) => p.id === id);
    return found || null;
  },
};
