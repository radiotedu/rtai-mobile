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
    const requiresAdultAge = email.includes('@') && !isTeduInstitutionEmail(email);

    const handleRegister = async () => {
        if (!email || !password || !displayName) {
            Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
            return;
        }

        if (!legalAccepted) {
            Alert.alert('Onay gerekli', 'Kullanım Koşulları ve Gizlilik Bildirimi’ni kabul etmelisiniz.');
            return;
        }

        const numericAge = Number(age);
        if (requiresAdultAge && (!Number.isInteger(numericAge) || numericAge < 18)) {
            Alert.alert('Yaş sınırı', 'TEDÜ dışı e-posta ile kayıt için 18 yaşında veya daha büyük olmalısınız.');
            return;
        }

        setIsLoading(true);
        try {
            await register(email, password, displayName, {
                legalAccepted,
                age: requiresAdultAge ? numericAge : undefined,
            });
            Alert.alert('Başarılı', 'RadioTEDU hesabınız oluşturuldu ve oturum açıldı.');
        } catch (error: any) {
            Alert.alert('Hata', error.message);
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
                        <Text style={styles.title}>Kayıt Ol</Text>
                        <Text style={styles.subtitle}>Yeni bir hesap oluşturun</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Icon name="account-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Ad Soyad"
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
                                    placeholder="Yaş (18+)"
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
                                placeholder="E-posta"
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
                                Kayıt olarak Kullanım Koşulları’nı kabul eder ve Gizlilik Bildirimi’ni okuduğunuzu onaylarsınız.
                            </Text>
                        </TouchableOpacity>
                        <View style={styles.legalLinks}>
                            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                                <Text style={styles.legalLink}>Kullanım Koşulları</Text>
                            </TouchableOpacity>
                            <Text style={styles.legalSeparator}>·</Text>
                            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                                <Text style={styles.legalLink}>Gizlilik Bildirimi</Text>
                            </TouchableOpacity>
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

                        <TouchableOpacity
                            style={styles.registerButton}
                            onPress={handleRegister}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.registerButtonText}>Kayıt Ol</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Zaten hesabınız var mı? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.loginText}>Giriş Yap</Text>
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
