import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getErrorMessage, isApiError } from "../lib/api";
import type {
  AcceptInvitationResponse,
  AuthResponse,
  ClientMembershipSummary,
  MeResponse,
  Membership,
  RegisterPendingResponse,
  ResendVerificationResponse,
  User,
} from "../lib/types";

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  organizationName: string;
};

export type VerifyEmailInput = {
  email: string;
  code: string;
};

export type AcceptInvitationInput = {
  token: string;
  name?: string;
  password?: string;
};

type AuthContextValue = {
  user: User | null;
  memberships: Membership[];
  clientMemberships: ClientMembershipSummary[];
  loading: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => Promise<void>;
  login: (input: LoginInput) => Promise<string | null>;
  register: (input: RegisterInput) => Promise<RegisterPendingResponse>;
  verifyEmail: (input: VerifyEmailInput) => Promise<string | null>;
  resendVerification: (email: string) => Promise<ResendVerificationResponse>;
  acceptInvitation: (input: AcceptInvitationInput) => Promise<string | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

function destinationFor(
  memberships: Membership[],
  clientMemberships: ClientMembershipSummary[],
): string | null {
  if (memberships[0]) return `/orgs/${memberships[0].organization.id}`;
  return clientMemberships.length > 0 ? "/portal" : null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [clientMemberships, setClientMemberships] = useState<ClientMembershipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setBootstrapError(null);
    try {
      await api.initCsrf();
      const response = await api.get<MeResponse>("/auth/me");
      setUser(response.user);
      setMemberships(response.memberships);
      setClientMemberships(response.clientMemberships);
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        setUser(null);
        setMemberships([]);
        setClientMemberships([]);
      } else {
        setBootstrapError(getErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
      setMemberships([]);
      setClientMemberships([]);
    }
    window.addEventListener("studioos:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("studioos:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const response = await api.post<AuthResponse>("/auth/login", input);
    setUser(response.user);
    setMemberships(response.memberships);
    setClientMemberships(response.clientMemberships);
    return destinationFor(response.memberships, response.clientMemberships);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    return api.post<RegisterPendingResponse>("/auth/register", input);
  }, []);

  const verifyEmail = useCallback(async (input: VerifyEmailInput) => {
    const response = await api.post<AuthResponse>("/auth/register/verify", input);
    setUser(response.user);
    setMemberships(response.memberships);
    setClientMemberships(response.clientMemberships);
    return destinationFor(response.memberships, response.clientMemberships);
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    return api.post<ResendVerificationResponse>("/auth/register/resend", { email });
  }, []);

  const acceptInvitation = useCallback(async (input: AcceptInvitationInput) => {
    const response = await api.post<AcceptInvitationResponse>("/invitations/accept", input);
    const me = await api.get<MeResponse>("/auth/me");
    setUser(me.user);
    setMemberships(me.memberships);
    setClientMemberships(me.clientMemberships);
    const organization = response.memberships[0] ?? me.memberships[0];
    if (organization) return `/orgs/${organization.organization.id}`;
    return me.clientMemberships.length > 0 ? "/portal" : null;
  }, []);

  const logout = useCallback(async () => {
    await api.post<void>("/auth/logout");
    setUser(null);
    setMemberships([]);
    setClientMemberships([]);
    api.clearCsrf();
    try {
      await api.initCsrf();
    } catch {
      // A fresh CSRF token will be requested on the next bootstrap attempt.
    }
  }, []);

  const refresh = useCallback(async () => {
    const response = await api.get<MeResponse>("/auth/me");
    setUser(response.user);
    setMemberships(response.memberships);
    setClientMemberships(response.clientMemberships);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      memberships,
      clientMemberships,
      loading,
      bootstrapError,
      retryBootstrap: bootstrap,
      login,
      register,
      verifyEmail,
      resendVerification,
      acceptInvitation,
      logout,
      refresh,
    }),
    [
      user,
      memberships,
      clientMemberships,
      loading,
      bootstrapError,
      bootstrap,
      login,
      register,
      verifyEmail,
      resendVerification,
      acceptInvitation,
      logout,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
