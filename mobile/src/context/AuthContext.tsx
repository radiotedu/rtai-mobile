import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {Linking} from 'react-native';

import { BASE_API } from '../services/config';
import {
    deleteAccountAndClearSession,
    logoutAccountSession,
} from '../services/accountLifecycleService';
import { notifyAuthSessionChanged } from '../services/authSessionEvents';
import {
    exchangeTeduLoginCode,
    parseTeduLoginCallback,
    startTeduLogin,
    type TeduLoginSession,
} from '../services/erpIdentity';
import {buildRegistrationPolicy} from '../services/registrationPolicy';

const API_URL = BASE_API;

export interface User {
    id: string;
    email: string;
    display_name: string;
    avatar_url?: string;
    rank_score: number;
    monthly_rank_score?: number;
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

const normalizeUser = (user: Partial<User> & Record<string, any>): User => ({
    id: String(user.id ?? ''),
    email: String(user.email ?? ''),
    display_name: String(user.display_name ?? ''),
    avatar_url: user.avatar_url,
    rank_score: Number(user.rank_score ?? 0),
    monthly_rank_score: Number(user.monthly_rank_score ?? 0),
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

    const clearSessionState = useCallback(async () => {
        await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
        notifyAuthSessionChanged();
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    }, []);

    const persistSession = useCallback(async (session: TeduLoginSession) => {
        await AsyncStorage.multiSet([
            ['access_token', session.access_token],
            ['refresh_token', session.refresh_token],
        ]);
        notifyAuthSessionChanged();
        axios.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
        setUser(normalizeUser(session.user));
    }, []);

    const refreshSession = useCallback(async (): Promise<User | null> => {
        try {
            const accessToken = await AsyncStorage.getItem('access_token');
            if (!accessToken) {
                setUser(null);
                return null;
            }

            axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
            const response = await axios.get(`${API_URL}/auth/me`);
            const nextUser = normalizeUser(response.data.data);
            setUser(nextUser);
            return nextUser;
        } catch (error) {
            await clearSessionState();
            throw error;
        }
    }, [clearSessionState]);

    useEffect(() => {
        loadStorageData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const completeTeduLogin = useCallback(async (url: string) => {
        const callback = parseTeduLoginCallback(url);
        if (!callback.matched) return;

        setIsTeduLoginLoading(true);
        setTeduLoginError(null);
        try {
            if (callback.error || !callback.code) {
                throw new Error(callback.error ?? 'TEDÜ girişi tamamlanamadı.');
            }
            const session = await exchangeTeduLoginCode(callback.code);
            await persistSession(session);
        } catch (error) {
            setTeduLoginError(
                error instanceof Error
                    ? error.message
                    : 'TEDÜ girişi tamamlanamadı.',
            );
        } finally {
            setIsTeduLoginLoading(false);
        }
    }, [persistSession]);

    useEffect(() => {
        const subscription = Linking.addEventListener('url', ({url}) => {
            void completeTeduLogin(url);
        });
        void Linking.getInitialURL().then((url) => {
            if (url) void completeTeduLogin(url);
        });
        return () => subscription.remove();
    }, [completeTeduLogin]);

    const loadStorageData = async () => {
        try {
            await refreshSession();
        } catch (error) {
            console.log('[AuthContext] No valid session found');
            await logout();
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, { email, password });
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
        try {
            const response = await axios.post(`${API_URL}/auth/register`, {
                email,
                password,
                display_name: displayName,
                ...buildRegistrationPolicy(email, options.legalAccepted, options.age),
            });
            await persistSession(response.data.data);
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Registration failed');
        }
    };

    const loginWithTedu = async () => {
        setIsTeduLoginLoading(true);
        setTeduLoginError(null);
        try {
            await startTeduLogin();
        } catch (error: any) {
            const message = error.response?.data?.error
                || error.message
                || 'TEDÜ girişi başlatılamadı.';
            setTeduLoginError(message);
            throw new Error(message);
        } finally {
            setIsTeduLoginLoading(false);
        }
    };

    const guestLogin = async (displayName: string) => {
        try {
            const response = await axios.post(`${API_URL}/auth/guest`, {
                display_name: displayName
            });
            await persistSession(response.data.data);
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Guest login failed');
        }
    };

    const logout = useCallback(async () => {
        try {
            await logoutAccountSession();
        } finally {
            setUser(null);
            notifyAuthSessionChanged();
        }
    }, []);

    const deleteAccount = useCallback(async (password?: string) => {
        await deleteAccountAndClearSession(password);
        setUser(null);
        notifyAuthSessionChanged();
    }, []);

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
