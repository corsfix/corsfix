import { DefaultSession, DefaultUser } from "next-auth";
import { AdapterUser as DefaultAdapterUser } from "next-auth/adapters";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      legacy_id?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    legacy_id?: string;
    created_at?: Date;
    signin_at?: Date;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser extends DefaultAdapterUser {
    hash?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    legacy_id?: string;
  }
}
