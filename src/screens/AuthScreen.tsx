import React, { useState, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, TextInput, Pressable, Keyboard, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useSignUp, useSignIn } from '@clerk/clerk-expo';
import { playClick } from '../sound';

type AuthScreenProps = {
  onComplete: () => void;
  onBack?: () => void;
};

export default function AuthScreen({ onComplete, onBack }: AuthScreenProps) {
  const { isLoaded } = useAuth();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState<null | boolean>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // Helper to extract emailAddressId from supportedFirstFactors
  const getEmailAddressId = (signIn: any): string | null => {
    const factors = signIn.supportedFirstFactors;
    if (!factors || !Array.isArray(factors)) return null;
    const emailFactor = factors.find((f: any) => f.strategy === 'email_code');
    return emailFactor?.emailAddressId ?? null;
  };

  const handleEmailSubmit = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!signIn || !signUp) {
      setError('Auth not ready');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Check if user exists by trying to create a sign-in
      await signIn.create({ identifier: email });
      // Get the emailAddressId from the created signIn's supportedFirstFactors
      const emailAddressId = getEmailAddressId(signIn);
      if (!emailAddressId) {
        throw new Error('Email address not found after sign-in creation');
      }
      setIsSignUp(false);
      setMessage('Code sent to your email');
      await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId });
      setStep('code');
      setCode('');
    } catch (e: any) {
      // If sign-in fails, try sign-up
      if (e.errors?.[0]?.code === 'form_identifier_not_found' || e.message?.includes('identifier_not_found')) {
        try {
          await signUp.create({ emailAddress: email });
          setIsSignUp(true);
          setMessage('Code sent to your email');
          await signUp.prepareVerification({ strategy: 'email_code' });
          setStep('code');
          setCode('');
        } catch (signUpError: any) {
          setError(signUpError.errors?.[0]?.longMessage ?? 'Failed to send code');
        }
      } else {
        setError(e.errors?.[0]?.longMessage ?? 'Failed to send code');
      }
    }
    setLoading(false);
  };

  const handleCodeSubmit = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    if (!signIn || !signUp) {
      setError('Auth not ready');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp.attemptVerification({ strategy: 'email_code', code });
        console.log('SignUp status after verification:', signUp.status);
        if (signUp.status === 'complete') {
          await setActiveSignUp({ session: signUp.createdSessionId });
          console.log('SignUp: setActive called successfully');
          onComplete();
          return;
        } else if (signUp.status === 'missing_requirements') {
          setError('Account setup incomplete. Please check Clerk dashboard: disable Username/Password requirements.');
        } else {
          setError('Verification incomplete. Please try again.');
        }
      } else {
        const emailAddressId = getEmailAddressId(signIn);
        if (!emailAddressId) {
          throw new Error('Email address ID not found');
        }
        await signIn.attemptFirstFactor({ strategy: 'email_code', code });
        console.log('SignIn status after verification:', signIn.status);
        if (signIn.status === 'complete') {
          await setActiveSignIn({ session: signIn.createdSessionId });
          console.log('SignIn: setActive called successfully');
          onComplete();
          return;
        } else {
          setError('Verification incomplete. Please try again.');
        }
      }
    } catch (e: any) {
      setError(e.errors?.[0]?.longMessage ?? 'Invalid or expired code');
    }
    setLoading(false);
  };

  const resendCode = async () => {
    setError('');
    setLoading(true);
    try {
      if (isSignUp && signUp) {
        await signUp.prepareVerification({ strategy: 'email_code' });
      } else if (signIn) {
        const emailAddressId = getEmailAddressId(signIn);
        if (!emailAddressId) {
          throw new Error('Email address ID not found');
        }
        await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId });
      }
      setMessage('New code sent!');
    } catch (e: any) {
      setError(e.errors?.[0]?.longMessage ?? 'Failed to resend code');
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      // Use Clerk's SSO for Google
      const { useAuth } = await import('@clerk/clerk-expo');
      // Note: In Clerk Expo, OAuth is typically handled via the useAuth hook's signIn object
      // For now, show a message since OAuth requires additional setup
      setError('Google sign-in requires additional Clerk dashboard configuration');
    } catch (e: any) {
      setError(e.message ?? 'Google sign-in failed');
    }
    setLoading(false);
  };

  const goBack = () => {
    if (step === 'code') {
      setStep('email');
      setCode('');
      setError('');
      setMessage('');
      setIsSignUp(null);
    } else if (onBack) {
      playClick();
      onBack();
    }
  };

  if (!isLoaded || !signUpLoaded || !signInLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.card,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Back button */}
        {step === 'email' && onBack && (
          <Pressable onPress={() => { playClick(); onBack(); }} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color="#22d3ee" />
          </Pressable>
        )}

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>BLOCKFALL</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {step === 'email' ? 'Enter your email' : 'Check your inbox'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'email'
            ? "We'll send you a 6-digit code to sign in or create your account."
            : 'Enter the 6-digit code sent to your email.'}
        </Text>

        {/* Email step */}
        {step === 'email' && (
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={handleEmailSubmit}
              editable={!loading}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            {message && <Text style={styles.success}>{message}</Text>}
            <Pressable
              style={[styles.cta, loading && styles.ctaDisabled]}
              onPress={handleEmailSubmit}
              disabled={loading}
            >
              <Text style={styles.ctaText}>{loading ? 'Sending…' : 'Continue'}</Text>
            </Pressable>
          </View>
        )}

        {/* Code step */}
        {step === 'code' && (
          <View style={styles.inputGroup}>
            <View style={styles.codeInputs}>
              {Array.from({ length: 6 }).map((_, i) => (
                <TextInput
                  key={i}
                  style={styles.codeInput}
                  maxLength={1}
                  value={code[i] ?? ''}
                  onChangeText={(t) => {
                    const nextCode = code.slice(0, i) + t + code.slice(i + 1);
                    setCode(nextCode);
                    if (t && i < 5) {
                      // Focus next input would need refs, skip for simplicity
                    }
                  }}
                  keyboardType="number-pad"
                  textAlign="center"
                  autoComplete="one-time-code"
                  editable={!loading}
                />
              ))}
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            {message && <Text style={styles.success}>{message}</Text>}
            <Pressable
              style={[styles.cta, loading && styles.ctaDisabled]}
              onPress={handleCodeSubmit}
              disabled={loading}
            >
              <Text style={styles.ctaText}>{loading ? 'Verifying…' : 'Verify'}</Text>
            </Pressable>
            <Pressable onPress={resendCode} disabled={loading} style={styles.resendBtn}>
              <Text style={styles.resendText}>Resend code</Text>
            </Pressable>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider}>
          <Text style={styles.dividerText}>or continue with</Text>
        </View>

        {/* Google Sign In */}
        <Pressable
          style={[styles.googleBtn, loading && styles.ctaDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <Ionicons name="logo-google" size={22} color="#fff" />
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </Pressable>

        {/* Guest notice */}
        <View style={styles.guestNotice}>
          <Text style={styles.guestNoticeText}>
            Not ready? Play as Guest — your progress saves locally.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: '#22d3ee30',
    shadowColor: '#22d3ee',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  backBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    color: '#22d3ee',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
    textShadowColor: '#22d3ee',
    textShadowRadius: 10,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  inputGroup: {
    gap: 14,
  },
  input: {
    backgroundColor: '#0b0f1a',
    color: '#fff',
    padding: 16,
    borderRadius: 14,
    fontSize: 17,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    backgroundColor: '#0b0f1a',
    color: '#fff',
    padding: 16,
    borderRadius: 14,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
  success: {
    color: '#22c55e',
    fontSize: 13,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: '#22d3ee',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#0b0f1a',
    fontSize: 17,
    fontWeight: '800',
  },
  resendBtn: {
    paddingVertical: 8,
  },
  resendText: {
    color: '#22d3ee',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerText: {
    color: '#64748b',
    fontSize: 13,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  googleBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  guestNotice: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  guestNoticeText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});