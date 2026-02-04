import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Email from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import dbConnect from "./lib/dbConnect";
import { IS_CLOUD, DISABLE_SIGNUP } from "./config/constants";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { validateCredentials } from "./lib/validation";
import { createTransport } from "nodemailer";

const adapter = MongoDBAdapter(
  async () => {
    await dbConnect();
    return mongoose.connection.getClient();
  },
  {
    collections: {
      Users: "usersv2",
    },
  },
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
    sendVerificationRequest: async ({ identifier, url, provider }) => {
      const transport = createTransport(provider.server);

      let interstitialUrl = url;
      try {
        const baseUrl = new URL(url).origin;
        interstitialUrl = `${baseUrl}/api/auth/verify?callbackUrl=${Buffer.from(url).toString("base64")}`;
      } catch {
        // Fallback to the original URL if parsing fails to avoid unexpected crashes.
      }

      try {
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: "Sign in to Corsfix",
          text: `Sign in to Corsfix\n\nClick here to sign in: ${interstitialUrl}\n\n`,
          html: `
            <body style="font-family: sans-serif; padding: 20px;">
              <h1>Sign in to Corsfix</h1>
              <p>Click the button below to sign in:</p>
              <a href="${interstitialUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px;">Sign in</a>
            </body>
          `,
        });
      } catch (error) {
        console.error("Failed to send verification email", error);
        throw new Error("Unable to send verification email. Please try again later.");
      }
    },
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
            mode: { label: "Mode" },
          },
          authorize: async (credentials) => {
            const isLogin = credentials.mode === "login";

            const validation = validateCredentials(
              credentials.email,
              credentials.password,
              !isLogin,
            );
            if (!validation.success) {
              throw new Error(validation.error);
            }

            const { email, password } = validation.data;
            const user = await adapter.getUserByEmail?.(email);

            if (isLogin) {
              // Login mode: user must exist
              // User not found or user exists but has no password (e.g. OAuth-only user)
              if (!user || !user.hash) {
                throw new Error("Invalid email or password");
              }
              const isValidPassword = await bcrypt.compare(
                password,
                user.hash as string,
              );
              if (!isValidPassword) {
                throw new Error("Invalid email or password");
              }
              return user;
            } else {
              // Signup mode: user must not exist
              if (user) {
                throw new Error("User already exists");
              }
              if (DISABLE_SIGNUP) {
                throw new Error("Signups are disabled");
              }

              const salt = await bcrypt.genSalt(10);
              const hash = await bcrypt.hash(password, salt);
              const newUser = await adapter.createUser?.({
                id: new mongoose.Types.ObjectId().toHexString(),
                email: email,
                hash: hash,
                emailVerified: null,
              });

              if (!newUser) {
                throw new Error("Failed to create user");
              }

              return newUser;
            }
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
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      adapter.updateUser?.({
        id: user.id,
        created_at: new Date(),
        trial_ends_at: trialEndsAt,
      });
      user.trial_ends_at = trialEndsAt;
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
      if (token.trial_ends_at) {
        session.user.trial_ends_at = token.trial_ends_at;
      }
      return session;
    },
    async jwt({ token, user, profile }) {
      if (user) {
        token.id = user.id;
        token.legacy_id = user?.legacy_id;
        token.trial_ends_at = user?.trial_ends_at;
      }
      if (profile && profile.name) {
        token.name = profile.name;
      }
      return token;
    },
  },
});
