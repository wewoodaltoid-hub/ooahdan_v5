import { Fonts, PastelColors, primaryCtaPadding } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useUserStore, type GuardianGender } from "@/stores/user-store";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { makeRedirectUri } from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

const INPUT_RADIUS = 16;
const BUTTON_RADIUS = 16;
const ERROR_RED = "#C62828";
const SUCCESS_GREEN = "#2E7D32";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const KAKAO_BG = "#FEE500";
const KAKAO_TEXT = "#3C1E1E";
const GOOGLE_BG = "#FFFFFF";
const GOOGLE_BORDER = "#DADCE0";
const GOOGLE_TEXT = "#333333";
const APPLE_BG = "#000000";
const APPLE_TEXT = "#FFFFFF";

export default function AuthScreen() {
  const router = useRouter();
  const setChildName = useUserStore((s) => s.setChildName);
  const setStoreUserName = useUserStore((s) => s.setUserName);
  const setStoreGuardianGender = useUserStore((s) => s.setGuardianGender);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // 로그인 공용
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 회원가입 전용
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [userName, setUserName] = useState("");
  const [babyName, setBabyName] = useState("");
  const [guardianGender, setGuardianGender] = useState<GuardianGender>("male");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccessMessage, setEmailSuccessMessage] = useState("");
  const [passwordMatchError, setPasswordMatchError] = useState("");
  const [isEmailChecked, setIsEmailChecked] = useState(false);
  const [isEmailAvailable, setIsEmailAvailable] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  async function handleKakaoLogin() {
    try {
      setKakaoLoading(true);
      const redirectTo = makeRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo },
      });
      if (error) throw error;
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );
        if (result.type === "success" && result.url) {
          const url = result.url;
          const [, fragment] = url.split("#");
          const params = new URLSearchParams(fragment || "");
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
          router.replace("/(tabs)");
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "카카오 로그인에 실패했어요.";
      Alert.alert("로그인 실패", message);
    } finally {
      setKakaoLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setGoogleLoading(true);
      const redirectTo = makeRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );
        if (result.type === "success" && result.url) {
          const url = result.url;
          const [, fragment] = url.split("#");
          const params = new URLSearchParams(fragment || "");
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
          router.replace("/(tabs)");
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "구글 로그인에 실패했어요.";
      Alert.alert("로그인 실패", message);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleAppleLogin() {
    try {
      setAppleLoading(true);
      const redirectTo = makeRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo },
      });
      if (error) throw error;
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );
        if (result.type === "success" && result.url) {
          const url = result.url;
          const [, fragment] = url.split("#");
          const params = new URLSearchParams(fragment || "");
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
          router.replace("/(tabs)");
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "애플 로그인에 실패했어요.";
      Alert.alert("로그인 실패", message);
    } finally {
      setAppleLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/(tabs)");
      }
    });
  }, [router]);

  const switchToSignUp = () => {
    setEmailError("");
    setEmailSuccessMessage("");
    setPasswordMatchError("");
    setIsEmailChecked(false);
    setIsEmailAvailable(false);
    setIsSignUp(true);
  };

  const switchToLogin = () => {
    setEmailError("");
    setEmailSuccessMessage("");
    setPasswordMatchError("");
    setPasswordConfirm("");
    setUserName("");
    setBabyName("");
    setGuardianGender("male");
    setTermsAgreed(false);
    setIsEmailChecked(false);
    setIsEmailAvailable(false);
    setIsSignUp(false);
  };

  const resetEmailCheckOnChange = () => {
    setIsEmailChecked(false);
    setIsEmailAvailable(false);
    setEmailError("");
    setEmailSuccessMessage("");
  };

  const handleDuplicateCheck = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("이메일을 입력해 주세요.");
      setEmailSuccessMessage("");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError("올바른 이메일 형식이 아닙니다.");
      setEmailSuccessMessage("");
      return;
    }
    setCheckingEmail(true);
    setEmailError("");
    setEmailSuccessMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { shouldCreateUser: false },
    });
    setCheckingEmail(false);
    if (error) {
      setIsEmailChecked(true);
      setIsEmailAvailable(true);
      setEmailError("");
      setEmailSuccessMessage("사용 가능한 이메일입니다.");
      return;
    }
    setIsEmailChecked(true);
    setIsEmailAvailable(false);
    setEmailError("이미 가입된 계정입니다.");
    setEmailSuccessMessage("");
  };

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert(
        "입력 확인",
        "이메일과 비밀번호를 모두 입력해 주세요.",
        [{ text: "확인" }]
      );
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert(
        "로그인 실패",
        error.message === "Invalid login credentials"
          ? "이메일 또는 비밀번호가 맞지 않아요. 다시 확인해 주세요."
          : error.message,
        [{ text: "확인" }]
      );
      return;
    }
    router.replace("/(tabs)");
  };

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    setEmailError("");
    setPasswordMatchError("");

    if (!trimmedEmail || !password) {
      Alert.alert("입력 확인", "이메일과 비밀번호를 모두 입력해 주세요.", [{ text: "확인" }]);
      return;
    }
    if (password.length < 6) {
      Alert.alert("비밀번호 길이", "비밀번호는 6자 이상으로 설정해 주세요.", [{ text: "확인" }]);
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordMatchError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!termsAgreed) {
      Alert.alert("약관 동의", "[필수] 개인정보 수집 및 이용 동의에 체크해 주세요.", [
        { text: "확인" },
      ]);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          user_name: userName.trim() || undefined,
          baby_name: babyName.trim() || undefined,
          guardian_gender: guardianGender,
        },
      },
    });
    setLoading(false);

    if (error) {
      setEmailError("이미 가입된 계정입니다.");
      return;
    }

    if (userName.trim()) setStoreUserName(userName.trim());
    if (babyName.trim()) setChildName(babyName.trim());
    setStoreGuardianGender(guardianGender);

    Alert.alert("가입이 완료되었습니다!", "로그인해 주세요.", [
      { text: "확인", onPress: switchToLogin },
    ]);
  };

  const passwordMismatch =
    isSignUp && password.length > 0 && passwordConfirm.length > 0 && password !== passwordConfirm;
  const displayPasswordError = passwordMatchError || (passwordMismatch ? "비밀번호가 일치하지 않습니다." : "");
  const signUpValid =
    isSignUp &&
    isEmailAvailable &&
    password.length >= 6 &&
    password === passwordConfirm &&
    termsAgreed &&
    email.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isSignUp && (
            <Pressable
              style={({ pressed }) => [styles.backRow, pressed && styles.backPressed]}
              onPress={switchToLogin}
            >
              <MaterialIcons name="arrow-back" size={24} color={PastelColors.accent} />
              <Text style={styles.backText}>로그인으로 돌아가기</Text>
            </Pressable>
          )}

          {!isSignUp ? (
            <>
              <Text style={styles.title}>우아단 시작하기</Text>
              <Text style={styles.subtitle}>소셜 계정으로 간편하게 시작하세요.</Text>

              {/* 소셜 로그인: 카카오 → 구글 → 애플 → 구분선 */}
              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  styles.socialButtonKakao,
                  pressed && styles.buttonPressed,
                  kakaoLoading && styles.socialButtonDisabled,
                ]}
                onPress={handleKakaoLogin}
                disabled={kakaoLoading}
              >
                {kakaoLoading ? (
                  <ActivityIndicator color={KAKAO_TEXT} size="small" />
                ) : (
                  <>
                    <Ionicons name="chatbubble-ellipses" size={22} color={KAKAO_TEXT} />
                    <Text style={styles.socialButtonTextKakao}>카카오로 시작하기</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  styles.socialButtonGoogle,
                  pressed && styles.buttonPressed,
                  googleLoading && styles.socialButtonDisabled,
                ]}
                onPress={handleGoogleLogin}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color={GOOGLE_TEXT} size="small" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={22} color={GOOGLE_TEXT} />
                    <Text style={styles.socialButtonTextGoogle}>구글로 시작하기</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  styles.socialButtonApple,
                  pressed && styles.buttonPressed,
                  appleLoading && styles.socialButtonDisabled,
                ]}
                onPress={handleAppleLogin}
                disabled={appleLoading}
              >
                {appleLoading ? (
                  <ActivityIndicator color={APPLE_TEXT} size="small" />
                ) : (
                  <>
                    <FontAwesome5 name="apple" size={22} color={APPLE_TEXT} brand />
                    <Text style={styles.socialButtonTextApple}>애플로 시작하기</Text>
                  </>
                )}
              </Pressable>

              {/* 3개 소셜 버튼 바로 아래 구분선 */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>또는 이메일로 계속하기</Text>
                <View style={styles.dividerLine} />
              </View>

              <TextInput
                style={styles.input}
                placeholder="이메일"
                placeholderTextColor={PastelColors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="비밀번호"
                placeholderTextColor={PastelColors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.buttonPrimary,
                  pressed && styles.buttonPressed,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSignIn}
                disabled={loading}
              >
                <Text style={styles.buttonPrimaryText}>로그인</Text>
              </Pressable>

              <View style={styles.switchModeRow}>
                <Text style={styles.switchModeLabel}>아직 계정이 없으신가요? </Text>
                <Pressable onPress={switchToSignUp} hitSlop={8}>
                  <Text style={styles.switchModeLink}>회원가입하기</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>회원가입</Text>
              <Text style={styles.subtitle}>정보를 입력하고 우아단을 시작해 보세요.</Text>

              {/* 이메일 + 중복 확인 버튼 */}
              <View style={styles.emailRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputFlex,
                    emailError ? styles.inputError : null,
                    emailSuccessMessage ? styles.inputSuccess : null,
                  ]}
                  placeholder="이메일"
                  placeholderTextColor={PastelColors.textSecondary}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    resetEmailCheckOnChange();
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!loading && !checkingEmail}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.duplicateBtn,
                    pressed && styles.buttonPressed,
                    checkingEmail && styles.buttonDisabled,
                  ]}
                  onPress={handleDuplicateCheck}
                  disabled={checkingEmail}
                >
                  <Text style={styles.duplicateBtnText}>
                    {checkingEmail ? "확인 중..." : "중복 확인"}
                  </Text>
                </Pressable>
              </View>
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              {emailSuccessMessage ? (
                <Text style={styles.successText}>{emailSuccessMessage}</Text>
              ) : null}

              {/* 비밀번호 */}
              <TextInput
                style={[styles.input, displayPasswordError ? styles.inputError : null]}
                placeholder="비밀번호 (6자 이상)"
                placeholderTextColor={PastelColors.textSecondary}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (passwordConfirm && t !== passwordConfirm) setPasswordMatchError("비밀번호가 일치하지 않습니다.");
                  else setPasswordMatchError("");
                }}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
              <TextInput
                style={[styles.input, displayPasswordError ? styles.inputError : null]}
                placeholder="비밀번호 확인"
                placeholderTextColor={PastelColors.textSecondary}
                value={passwordConfirm}
                onChangeText={(t) => {
                  setPasswordConfirm(t);
                  if (password && t !== password) setPasswordMatchError("비밀번호가 일치하지 않습니다.");
                  else setPasswordMatchError("");
                }}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
              {displayPasswordError ? (
                <Text style={styles.errorText}>{displayPasswordError}</Text>
              ) : null}

              {/* 이메일 인증 (구현중) */}
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                placeholder="이메일 인증 (구현중)"
                placeholderTextColor={PastelColors.textSecondary}
                editable={false}
              />
              {/* 휴대전화 인증 (구현중) */}
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                placeholder="휴대전화 인증 (구현중)"
                placeholderTextColor={PastelColors.textSecondary}
                editable={false}
              />

              <TextInput
                style={styles.input}
                placeholder="사용자 이름 (예: 엄마 이름)"
                placeholderTextColor={PastelColors.textSecondary}
                value={userName}
                onChangeText={setUserName}
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="우리 아이 이름 (예: 우리 아이)"
                placeholderTextColor={PastelColors.textSecondary}
                value={babyName}
                onChangeText={setBabyName}
                editable={!loading}
              />

              <Text style={styles.fieldLabel}>보호자 성별</Text>
              <View style={styles.genderRow}>
                <Pressable
                  style={[
                    styles.genderChip,
                    guardianGender === "female" && styles.genderChipActive,
                  ]}
                  onPress={() => setGuardianGender("female")}
                >
                  <Text
                    style={[
                      styles.genderChipText,
                      guardianGender === "female" && styles.genderChipTextActive,
                    ]}
                  >
                    엄마
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.genderChip,
                    guardianGender === "male" && styles.genderChipActive,
                  ]}
                  onPress={() => setGuardianGender("male")}
                >
                  <Text
                    style={[
                      styles.genderChipText,
                      guardianGender === "male" && styles.genderChipTextActive,
                    ]}
                  >
                    아빠
                  </Text>
                </Pressable>
              </View>

              {/* 약관 동의 */}
              <View style={styles.termsRow}>
                <Switch
                  value={termsAgreed}
                  onValueChange={setTermsAgreed}
                  trackColor={{ false: PastelColors.border, true: PastelColors.accent }}
                  thumbColor="#fff"
                />
                <Text style={styles.termsLabel}>[필수] 개인정보 수집 및 이용 동의</Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  signUpValid ? styles.buttonPrimary : styles.buttonDisabledLocked,
                  pressed && signUpValid && styles.buttonPressed,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSignUp}
                disabled={loading || !signUpValid}
              >
                <Text
                  style={[
                    signUpValid ? styles.buttonPrimaryText : styles.buttonDisabledText,
                  ]}
                >
                  가입 완료
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 6,
  },
  backPressed: {
    opacity: 0.7,
  },
  backText: {
    fontSize: 15,
    color: PastelColors.accent,
    fontWeight: "500",
    fontFamily: Fonts.rounded,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: PastelColors.text,
    marginBottom: 8,
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    marginBottom: 24,
    fontFamily: Fonts.rounded,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: BUTTON_RADIUS,
    marginBottom: 14,
    gap: 12,
  },
  socialButtonKakao: {
    backgroundColor: KAKAO_BG,
  },
  socialButtonGoogle: {
    backgroundColor: GOOGLE_BG,
    borderWidth: 1,
    borderColor: GOOGLE_BORDER,
  },
  socialButtonApple: {
    backgroundColor: APPLE_BG,
  },
  socialButtonDisabled: {
    opacity: 0.7,
  },
  socialButtonTextKakao: {
    fontSize: 17,
    fontWeight: "600",
    color: KAKAO_TEXT,
    fontFamily: Fonts.rounded,
  },
  socialButtonTextGoogle: {
    fontSize: 17,
    fontWeight: "600",
    color: GOOGLE_TEXT,
    fontFamily: Fonts.rounded,
  },
  socialButtonTextApple: {
    fontSize: 17,
    fontWeight: "600",
    color: APPLE_TEXT,
    fontFamily: Fonts.rounded,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 28,
    gap: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: PastelColors.border,
  },
  dividerText: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    opacity: 0.9,
    fontFamily: Fonts.rounded,
  },
  input: {
    height: 52,
    backgroundColor: PastelColors.cardBg,
    borderRadius: INPUT_RADIUS,
    paddingHorizontal: 20,
    fontSize: 16,
    color: PastelColors.text,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: PastelColors.border,
    fontFamily: Fonts.rounded,
  },
  inputFlex: {
    flex: 1,
    marginBottom: 0,
  },
  inputDisabled: {
    backgroundColor: PastelColors.primaryLight,
    color: PastelColors.textSecondary,
  },
  inputError: {
    borderColor: ERROR_RED,
    borderWidth: 1.5,
  },
  inputSuccess: {
    borderColor: SUCCESS_GREEN,
    borderWidth: 1.5,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  duplicateBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: PastelColors.cardBg,
    borderWidth: 1,
    borderColor: PastelColors.accent,
  },
  duplicateBtnText: {
    fontSize: 13,
    color: PastelColors.accent,
    fontWeight: "600",
    fontFamily: Fonts.rounded,
  },
  errorText: {
    fontSize: 13,
    color: ERROR_RED,
    marginBottom: 10,
    marginTop: 2,
  },
  successText: {
    fontSize: 13,
    color: SUCCESS_GREEN,
    marginBottom: 10,
    marginTop: 2,
  },
  button: {
    minHeight: 56,
    borderRadius: BUTTON_RADIUS,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    ...primaryCtaPadding,
  },
  buttonPrimary: {
    backgroundColor: PastelColors.buttonPrimary,
  },
  buttonPrimaryText: {
    fontSize: 17,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonDisabledLocked: {
    backgroundColor: PastelColors.buttonViewerDisabled,
  },
  buttonDisabledText: {
    fontSize: 17,
    fontWeight: "600",
    color: PastelColors.textSecondary,
    opacity: 0.8,
    fontFamily: Fonts.rounded,
  },
  switchModeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    flexWrap: "wrap",
  },
  switchModeLabel: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  switchModeLink: {
    fontSize: 15,
    color: PastelColors.accent,
    fontWeight: "600",
    fontFamily: Fonts.rounded,
  },
  fieldLabel: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    marginBottom: 10,
    marginTop: 4,
    fontFamily: Fonts.rounded,
  },
  genderRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  genderChip: {
    flex: 1,
    height: 52,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: PastelColors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  genderChipActive: {
    backgroundColor: PastelColors.accent,
  },
  genderChipText: {
    fontSize: 16,
    fontWeight: "600",
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  genderChipTextActive: {
    color: "#fff",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  termsLabel: {
    fontSize: 15,
    color: PastelColors.text,
    flex: 1,
    fontFamily: Fonts.rounded,
  },
});
