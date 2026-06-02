import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getProfileImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${serverUrl}${cleanUrl}`;
}
