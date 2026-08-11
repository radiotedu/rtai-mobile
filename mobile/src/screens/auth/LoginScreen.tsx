import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Image,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SPACING } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const {
        login,
        loginWithTedu,
        isTeduLoginLoading,
        teduLoginError,
    } = useAuth();
    const navigation = useNavigation<any>();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
            return;
        }

        setIsLoading(true);
        try {
            await login(email, password);
            // Navigation state will automatically update via AuthContext
        } catch (error: any) {
            Alert.alert('Hata', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTeduLogin = async () => {
        try {
            await loginWithTedu();
        } catch (error: any) {
            Alert.alert('TEDÜ girişi', error.message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    {/* Logo Section */}
                    <View style={styles.header}>
                        <Image
                            source={require('../../assets/images/logo-03byz.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>Hoş Geldiniz</Text>
                        <Text style={styles.subtitle}>Devam etmek için giriş yapın</Text>
                    </View>

                    {/* Form Section */}
                    <View style={styles.form}>
                        <TouchableOpacity
                            style={styles.teduButton}
                            onPress={handleTeduLogin}
                            disabled={isTeduLoginLoading || isLoading}
                            accessibilityRole="button"
                            accessibilityLabel="TEDÜ ile giriş yap"
                        >
                            {isTeduLoginLoading ? (
                                <ActivityIndicator color={COLORS.text} />
                            ) : (
                                <>
                                    <Icon name="school-outline" size={22} color={COLORS.text} />
                                    <Text style={styles.teduButtonText}>TEDÜ ile giriş yap</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        {teduLoginError ? (
                            <Text style={styles.teduError}>{teduLoginError}</Text>
                        ) : null}

                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>veya RadioTEDU hesabı</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <View style={styles.inputContainer}>
                            <Icon name="email-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="E-posta"
                                placeholderTextColor={COLORS.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Icon name="lock-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Şifre"
                                placeholderTextColor={COLORS.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Icon
                                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={COLORS.textMuted}
                                />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.forgotPassword}>
                            <Text style={styles.forgotPasswordText}>Şifremi Unuttum</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.loginButton}
                            onPress={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.loginButtonText}>Giriş Yap</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Footer Section */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Hesabınız yok mu? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.registerText}>Kayıt Ol</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: SPACING.xl,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        width: 180,
        height: 60,
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textMuted,
    },
    form: {
        width: '100%',
    },
    teduButton: {
        height: 56,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.28)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
    },
    teduButtonText: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '700',
    },
    teduError: {
        color: '#ff8d8d',
        fontSize: 13,
        lineHeight: 18,
        marginTop: SPACING.sm,
        textAlign: 'center',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.lg,
    },
    dividerLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: COLORS.border,
    },
    dividerText: {
        color: COLORS.textMuted,
        fontSize: 12,
        marginHorizontal: SPACING.sm,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        paddingHorizontal: SPACING.md,
        height: 56,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inputIcon: {
        marginRight: SPACING.sm,
    },
    input: {
        flex: 1,
        color: COLORS.text,
        fontSize: 16,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: SPACING.xl,
    },
    forgotPasswordText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    loginButton: {
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 40,
    },
    footerText: {
        color: COLORS.textMuted,
        fontSize: 14,
    },
    registerText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: 'bold',
    },
});

export default LoginScreen;
