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
    Alert,
    Linking,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SPACING } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import {
    isTeduInstitutionEmail,
    PRIVACY_URL,
    TERMS_URL,
} from '../../services/registrationPolicy';
import {useTranslation} from 'react-i18next';
import {authCopy} from '../../i18n/screenCopy';

const RegisterScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [age, setAge] = useState('');
    const [legalAccepted, setLegalAccepted] = useState(false);

    const { register } = useAuth();
    const navigation = useNavigation<any>();
    const {i18n} = useTranslation();
    const copy = (key: string) => authCopy(i18n.language, key);
    const requiresAdultAge = email.includes('@') && !isTeduInstitutionEmail(email);

    const handleRegister = async () => {
        if (!email || !password || !displayName) {
            Alert.alert(copy('register.genericError'), copy('login.missingFields'));
            return;
        }

        if (password.length < 6) {
            Alert.alert(copy('register.genericError'), copy('register.passwordError'));
            return;
        }

        if (!legalAccepted) {
            Alert.alert(copy('register.confirmTitle'), copy('register.confirm'));
            return;
        }

        const numericAge = Number(age);
        if (requiresAdultAge && (!Number.isInteger(numericAge) || numericAge < 18)) {
            Alert.alert(copy('register.ageTitle'), copy('register.ageError'));
            return;
        }

        setIsLoading(true);
        try {
            await register(email, password, displayName, {
                legalAccepted,
                age: requiresAdultAge ? numericAge : undefined,
            });
            Alert.alert(copy('register.successTitle'), copy('register.success'));
        } catch (error: any) {
            Alert.alert(copy('register.genericError'), error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="chevron-left" size={32} color={COLORS.text} />
                </TouchableOpacity>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{copy('register.title')}</Text>
                        <Text style={styles.subtitle}>{copy('register.subtitle')}</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Icon name="account-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={copy('register.name')}
                                placeholderTextColor={COLORS.textMuted}
                                value={displayName}
                                onChangeText={setDisplayName}
                            />
                        </View>

                        {requiresAdultAge ? (
                            <View style={styles.inputContainer}>
                                <Icon name="calendar-account-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder={copy('register.age')}
                                    placeholderTextColor={COLORS.textMuted}
                                    value={age}
                                    onChangeText={(value) => setAge(value.replace(/\D/g, '').slice(0, 3))}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                />
                            </View>
                        ) : null}

                        <View style={styles.inputContainer}>
                            <Icon name="email-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={copy('register.email')}
                                placeholderTextColor={COLORS.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.legalRow}
                            onPress={() => setLegalAccepted((accepted) => !accepted)}
                            accessibilityRole="checkbox"
                            accessibilityState={{checked: legalAccepted}}
                        >
                            <Icon
                                name={legalAccepted ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                size={24}
                                color={legalAccepted ? COLORS.primary : COLORS.textMuted}
                            />
                            <Text style={styles.legalText}>
                                {copy('register.legal')}
                            </Text>
                        </TouchableOpacity>
                        <View style={styles.legalLinks}>
                            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                                <Text style={styles.legalLink}>{copy('register.terms')}</Text>
                            </TouchableOpacity>
                            <Text style={styles.legalSeparator}>·</Text>
                            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                                <Text style={styles.legalLink}>{copy('register.privacy')}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <Icon name="lock-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={copy('register.password')}
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

                        <TouchableOpacity
                            style={styles.registerButton}
                            onPress={handleRegister}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.registerButtonText}>{copy('register.submit')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>{copy('register.haveAccount')} </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.loginText}>{copy('register.login')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                </ScrollView>
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
    backButton: {
        marginTop: SPACING.md,
        marginLeft: SPACING.md,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    content: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xl,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
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
    legalRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        paddingVertical: SPACING.sm,
    },
    legalText: {
        flex: 1,
        color: COLORS.textMuted,
        fontSize: 13,
        lineHeight: 19,
    },
    legalLinks: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 32,
        marginBottom: SPACING.sm,
    },
    legalLink: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    legalSeparator: {
        color: COLORS.textMuted,
        marginHorizontal: SPACING.sm,
    },
    registerButton: {
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.lg,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    registerButtonText: {
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
    loginText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: 'bold',
    },
});

export default RegisterScreen;
