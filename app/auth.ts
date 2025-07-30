import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Email from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import dbConnect from "./lib/dbConnect";
import { IS_CLOUD } from "./config/constants";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adapter = MongoDBAdapter(
  async () => {
    await dbConnect();
    return mongoose.connection.getClient();
  },
  {
    collections: {
      Users: "usersv2",
    },
  }
);

const cloudProviders = [
  Google,
  GitHub,
  Email({
    server: {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || "587"),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    },
    from: process.env.EMAIL_FROM,
  }),
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: adapter,
  providers: IS_CLOUD
    ? cloudProviders
    : [
        Credentials({
          name: "Credentials",
          credentials: {
            email: { label: "Email" },
            password: { label: "Password", type: "password" },
          },
          authorize: async (credentials) => {
            const user = await adapter.getUserByEmail?.(
              credentials.email as string
            );

            if (!user) {
              const salt = await bcrypt.genSalt(10);
              const hash = await bcrypt.hash(
                credentials.password as string,
                salt
              );
              const newUser = await adapter.createUser?.({
                id: new mongoose.Types.ObjectId().toHexString(),
                email: credentials.email as string,
                hash: hash,
                emailVerified: null,
              });

              if (!newUser) {
                throw new Error("Failed to create user");
              }

              return newUser;
            }
            if (
              await bcrypt.compare(
                credentials.password as string,
                user.hash as string
              )
            ) {
              return user;
            }
            return null;
          },
        }),
      ],
  session: {
    strategy: "jwt",
  },
  events: {
    async signIn({ user }) {
      if (!user || !user.id) return;
      adapter.updateUser?.({
        id: user.id,
        signin_at: new Date(),
      });
    },
    async createUser({ user }) {
      if (!user || !user.id) return;
      adapter.updateUser?.({
        id: user.id,
        created_at: new Date(),
      });
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id;
      }
      if (token.legacy_id) {
        session.user.legacy_id = token.legacy_id;
      }
      return session;
    },
    async jwt({ token, user, profile }) {
      if (user) {
        token.id = user.id;
        token.legacy_id = user?.legacy_id;
      }
      if (profile && profile.name) {
        token.name = profile.name;
      }
      return token;
    },
  },
});
