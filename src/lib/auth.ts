import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma"; // basePrisma — 테넌트 필터 없음
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        // basePrisma 사용: auth 시점에는 organizationId 컨텍스트 없음
        const user = await prisma.user.findFirst({
          where: { username: credentials.username, isActive: true },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role as "ADMIN" | "STAFF",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.organizationId = (user as { organizationId: string }).organizationId;
        token.role = (user as { role: "ADMIN" | "STAFF" }).role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.userId = token.userId as string;
      session.user.organizationId = token.organizationId as string;
      session.user.role = token.role as "ADMIN" | "STAFF";
      return session;
    },
  },
};
