export interface AvatarOption {
  id: string;
  name: string;
  url: string;
}

export const DEFAULT_AVATAR = '/avatars/default-1.png';
export const DEFAULT_FEMALE_AVATAR = '/avatars/default-2.png';

export const AVATAR_PICKER_CONFIG = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_DIMENSION: 400, // 400x400 standard circle avatar
  IMAGE_QUALITY: 0.88,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
} as const;

export const PRESET_AVATARS: AvatarOption[] = [
  {
    id: 'default-male',
    name: 'Mặc định (Nam)',
    url: '/avatars/default-1.png',
  },
  {
    id: 'default-female',
    name: 'Mặc định (Nữ)',
    url: '/avatars/default-2.png',
  },
  {
    id: 'avatar-1',
    name: 'Avatar 1',
    url: '/avatars/avatar-1.jpg',
  },
  {
    id: 'avatar-2',
    name: 'Avatar 2',
    url: '/avatars/avatar-2.jpg',
  },
  {
    id: 'avatar-3',
    name: 'Avatar 3',
    url: '/avatars/avatar-3.jpg',
  },
  {
    id: 'avatar-4',
    name: 'Avatar 4',
    url: '/avatars/avatar-4.jpg',
  },
  {
    id: 'avatar-5',
    name: 'Avatar 5',
    url: '/avatars/avatar-5.jpg',
  },
  {
    id: 'avatar-6',
    name: 'Avatar 6',
    url: '/avatars/avatar-6.jpg',
  },
  {
    id: 'avatar-7',
    name: 'Avatar 7',
    url: '/avatars/avatar-7.jpg',
  },
  {
    id: 'avatar-8',
    name: 'Avatar 8',
    url: '/avatars/avatar-8.jpg',
  },
  {
    id: 'avatar-9',
    name: 'Avatar 9',
    url: '/avatars/avatar-9.jpg',
  },
];
