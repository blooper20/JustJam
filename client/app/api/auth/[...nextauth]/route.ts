import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import KakaoProvider from 'next-auth/providers/kakao';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID || '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        try {
          const provider = account.provider;
          const providerId = account.providerAccountId;
          const email = user.email;
          const nickname = user.name;
          const profileImage = user.image;

          // Call backend to sync user and get token
          const response = await fetch(`${API_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email,
              nickname: nickname,
              profile_image: profileImage,
              provider: provider,
              provider_id: providerId,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            token.accessToken = data.access_token;
            token.refreshToken = data.refresh_token;
            token.userId = data.user.id;
          } else {
            console.error('Backend login failed:', await response.text());
          }
        } catch (error) {
          console.error('Error in jwt callback:', error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Cast to any to avoid typescript errors before we define types
      (session as any).accessToken = token.accessToken;
      if (session.user) {
        (session.user as any).id = token.userId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
