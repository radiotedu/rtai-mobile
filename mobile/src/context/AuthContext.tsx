import React, { createContext, useState, useContext, useEffect, useCallback, useRef, ReactNode } from 'react';
import axios from 'axios';
import {Linking} from 'react-native';

import { BASE_API } from '../services/config';
import {
    deleteAccountAndClearSession,
    logoutAccountSession,
} from '../services/accountLifecycleService';
import { notifyAuthSessionChanged } from '../services/authSessionEvents';
import {subscribeGoldBalanceChanges} from '../services/goldBalanceEvents';
import {
    ErpIdentityError,
    exchangeTeduLoginCode,
    parseTeduLoginCallback,
    startTeduLogin,
    type TeduLoginSession,
} from '../services/erpIdentity';
import {buildRegistrationPolicy} from '../services/registrationPolicy';
import {Analytics} from '../services/analyticsService';
import api, {isDefinitiveAuthRejection} from '../services/api';
import {
    clearAuthTokens,
    clearAuthTokensIfCurrent,
    getAccessToken,
    getAuthTokenSnapshot,
    setAuthTokens,
} from '../services/authTokenStorage';

const API_URL = BASE_API;
const AUTH_REQUEST_TIMEOUT_MS = 15000;

export interface User {
    id: string;
    email: string;
    display_name: string;
    avatar_url?: string;
    rank_score: number;
    monthly_rank_score?: number;
    gold_balance: number;
    role: string;
    is_guest: boolean;
    total_songs_added: number;
    total_upvotes_received: number;
    last_super_vote_at?: string | null;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (
        email: string,
        password: string,
        displayName: string,
        options: {legalAccepted: boolean; age?: number},
    ) => Promise<void>;
    loginWithTedu: () => Promise<void>;
    isTeduLoginLoading: boolean;
    teduLoginError: string | null;
    guestLogin: (displayName: string) => Promise<void>;
    logout: () => Promise<void>;
    deleteAccount: (password?: string) => Promise<void>;
    refreshSession: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export type ErpAuthAttemptPhase = 'start' | 'waiting' | 'exchange';

export type ErpAuthAttempt = {
    id: number;
    controller: AbortController;
    phase: ErpAuthAttemptPhase;
};

export const createErpAuthAttemptCoordinator = () => {
    let revision = 0;
    let current: ErpAuthAttempt | null = null;

    const isCurrent = (attempt: ErpAuthAttempt) =>
        current === attempt && !attempt.controller.signal.aborted;

    return {
        begin(phase: ErpAuthAttemptPhase): ErpAuthAttempt {
            current?.controller.abort();
            current = {
                id: ++revision,
                controller: new AbortController(),
                phase,
            };
            return current;
        },
        transition(attempt: ErpAuthAttempt, phase: ErpAuthAttemptPhase): boolean {
            if (!isCurrent(attempt)) {
                return false;
            }
            attempt.phase = phase;
            revision += 1;
            return true;
        },
        invalidate(): void {
            revision += 1;
            current?.controller.abort();
            current = null;
        },
        finish(attempt: ErpAuthAttempt): boolean {
            if (!isCurrent(attempt)) {
                return false;
            }
            revision += 1;
            current = null;
            return true;
        },
        getCurrent(): ErpAuthAttempt | null {
            return current && isCurrent(current) ? current : null;
        },
        getRevision(): number {
            return revision;
        },
        isCurrent,
    };
};

export const normalizeUser = (user: Partial<User> & Record<string, any>): User => ({
    id: String(user.id ?? ''),
    email: String(user.email ?? ''),
    display_name: String(user.display_name ?? ''),
    avatar_url: user.avatar_url,
    rank_score: Number(user.rank_score ?? 0),
    monthly_rank_score: Number(user.monthly_rank_score ?? 0),
    gold_balance: Number(user.gold_balance ?? 0),
    role: String(user.role ?? 'guest'),
    is_guest: Boolean(user.is_guest),
    total_songs_added: Number(user.total_songs_added ?? 0),
    total_upvotes_received: Number(user.total_upvotes_received ?? 0),
    last_super_vote_at: user.last_super_vote_at ?? null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTeduLoginLoading, setIsTeduLoginLoading] = useState(false);
    const [teduLoginError, setTeduLoginError] = useState<string | null>(null);
    const isMountedRef = useRef(true);
    const erpAttemptsRef = useRef<ReturnType<typeof createErpAuthAttemptCoordinator> | null>(null);
    if (!erpAttemptsRef.current) {
        erpAttemptsRef.current = createErpAuthAttemptCoordinator();
    }
    const erpAttempts = erpAttemptsRef.current;

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            erpAttempts.invalidate();
        };
    }, [erpAttempts]);

    useEffect(() => subscribeGoldBalanceChanges((goldBalance) => {
        setUser((current) => current
            ? {...current, gold_balance: goldBalance}
            : current);
    }), []);

    useEffect(() => {
        if (!isLoading) {
            Analytics.authState(user ? (user.is_guest ? 'guest' : 'registered') : 'signed_out');
        }
    }, [isLoading, user]);

    const beginErpAttempt = useCallback((phase: ErpAuthAttemptPhase) => {
        const attempt = erpAttempts.begin(phase);
        if (isMountedRef.current) {
            setIsTeduLoginLoading(true);
            setTeduLoginError(null);
        }
        return attempt;
    }, [erpAttempts]);

    const invalidateErpAttempt = useCallback(() => {
        erpAttempts.invalidate();
        if (isMountedRef.current) {
            setIsTeduLoginLoading(false);
            setTeduLoginError(null);
        }
    }, [erpAttempts]);

    const isCurrentErpAttempt = useCallback(
        (attempt: ErpAuthAttempt) => isMountedRef.current && erpAttempts.isCurrent(attempt),
        [erpAttempts],
    );

    const clearSessionState = useCallback(async () => {
        await clearAuthTokens();
        notifyAuthSessionChanged();
        setUser(null);
    }, []);

    const persistSession = useCallback(async (
        session: TeduLoginSession,
        isCurrent?: () => boolean,
    ): Promise<boolean> => {
        if (isCurrent && !isCurrent()) {
            return false;
        }
        await setAuthTokens(session.access_token, session.refresh_token);
        if (isCurrent && !isCurrent()) {
            const snapshot = await getAuthTokenSnapshot();
            if (snapshot?.refreshToken === session.refresh_token) {
                await clearAuthTokensIfCurrent(snapshot);
            }
            return false;
        }
        notifyAuthSessionChanged();
        setUser(normalizeUser(session.user));
        return true;
    }, []);

    const refreshSession = useCallback(async (): Promise<User | null> => {
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setUser(null);
                return null;
            }

            const response = await api.get('/auth/me');
            const nextUser = normalizeUser(response.data.data);
            setUser(nextUser);
            return nextUser;
        } catch (error) {
            if (isDefinitiveAuthRejection(error)) {
                await clearSessionState();
            }
            throw error;
        }
    }, [clearSessionState]);

    useEffect(() => {
        loadStorageData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const completeTeduLogin = useCallback(async (
        url: string,
        allowUnsolicited = false,
    ) => {
        const callback = parseTeduLoginCallback(url);
        if (!callback.matched) {
            return;
        }

        const pendingAttempt = erpAttempts.getCurrent();
        let attempt: ErpAuthAttempt;
        if (pendingAttempt?.phase === 'waiting') {
            if (!erpAttempts.transition(pendingAttempt, 'exchange')) {
                return;
            }
            attempt = pendingAttempt;
            if (isMountedRef.current) {
                setIsTeduLoginLoading(true);
                setTeduLoginError(null);
            }
        } else if (pendingAttempt || allowUnsolicited) {
            attempt = beginErpAttempt('exchange');
        } else {
            return;
        }

        try {
            if (callback.error || !callback.code) {
                throw new ErpIdentityError(callback.error ?? 'erp.callbackFailed');
            }
            const session = await exchangeTeduLoginCode(
                callback.code,
                attempt.controller.signal,
            );
            await persistSession(session, () => isCurrentErpAttempt(attempt));
        } catch (error) {
            if (!isCurrentErpAttempt(attempt)) {
                return;
            }
            setTeduLoginError(error instanceof ErpIdentityError
                ? error.code
                : 'erp.callbackFailed');
        } finally {
            if (erpAttempts.finish(attempt) && isMountedRef.current) {
                setIsTeduLoginLoading(false);
            }
        }
    }, [beginErpAttempt, erpAttempts, isCurrentErpAttempt, persistSession]);

    useEffect(() => {
        const initialRevision = erpAttempts.getRevision();
        const subscription = Linking.addEventListener('url', ({url}) => {
            completeTeduLogin(url).catch(() => undefined);
        });
        Linking.getInitialURL()
            .then((url) => {
                if (url && erpAttempts.getRevision() === initialRevision) {
                    return completeTeduLogin(url, true);
                }
                return undefined;
            })
            .catch(() => undefined);
        return () => subscription.remove();
    }, [completeTeduLogin, erpAttempts]);

    const loadStorageData = async () => {
        try {
            await refreshSession();
        } catch (error) {
            console.log('[AuthContext] Session verification deferred');
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        invalidateErpAttempt();
        try {
            const response = await axios.post(
                `${API_URL}/auth/login`,
                {email, password},
                {timeout: AUTH_REQUEST_TIMEOUT_MS},
            );
            await persistSession(response.data.data);
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Login failed');
        }
    };

    const register = async (
        email: string,
        password: string,
        displayName: string,
        options: {legalAccepted: boolean; age?: number},
    ) => {
        invalidateErpAttempt();
        try {
            const response = await axios.post(
                `${API_URL}/auth/register`,
                {
                    email,
                    password,
                    display_name: displayName,
                    ...buildRegistrationPolicy(email, options.legalAccepted, options.age),
                },
                {timeout: AUTH_REQUEST_TIMEOUT_MS},
            );
            await persistSession(response.data.data);
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Registration failed');
        }
    };

    const loginWithTedu = async () => {
        const attempt = beginErpAttempt('start');
        try {
            await startTeduLogin(attempt.controller.signal);
            if (!isCurrentErpAttempt(attempt)) {
                return;
            }
            if (!erpAttempts.transition(attempt, 'waiting')) {
                return;
            }
            if (isMountedRef.current) {
                setIsTeduLoginLoading(false);
            }
        } catch (error) {
            if (!isCurrentErpAttempt(attempt)) {
                return;
            }
            const code =
                error instanceof ErpIdentityError
                    ? error.code
                    : 'erp.startFailed';
            setTeduLoginError(code);
            setIsTeduLoginLoading(false);
            erpAttempts.finish(attempt);
            throw new ErpIdentityError(code);
        }
    };

    const guestLogin = async (displayName: string) => {
        invalidateErpAttempt();
        try {
            const response = await axios.post(
                `${API_URL}/auth/guest`,
                {display_name: displayName},
                {timeout: AUTH_REQUEST_TIMEOUT_MS},
            );
            await persistSession(response.data.data);
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Guest login failed');
        }
    };

    const logout = useCallback(async () => {
        invalidateErpAttempt();
        try {
            await logoutAccountSession();
        } finally {
            setUser(null);
            notifyAuthSessionChanged();
        }
    }, [invalidateErpAttempt]);

    const deleteAccount = useCallback(async (password?: string) => {
        invalidateErpAttempt();
        await deleteAccountAndClearSession(password);
        setUser(null);
        notifyAuthSessionChanged();
    }, [invalidateErpAttempt]);

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            login,
            register,
            loginWithTedu,
            isTeduLoginLoading,
            teduLoginError,
            guestLogin,
            logout,
            deleteAccount,
            refreshSession,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
