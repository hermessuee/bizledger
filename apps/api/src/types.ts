import { UserSession, Role, MenuKey } from '@bizledger/shared';

export interface Env {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  RESEND_API_KEY?: string;
  ALLOWED_ORIGIN?: string;
  EMAIL_FROM?: string;
}

export interface AppVariables {
  user: UserSession;
  businessId: string;
}

export type AppContext = {
  Bindings: Env;
  Variables: AppVariables;
};
