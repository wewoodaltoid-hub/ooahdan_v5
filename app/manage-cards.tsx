import {
  AdBannerPlaceholder,
  useAdBannerScrollContentStyle,
} from "@/components/AdBannerPlaceholder";
import { PremiumFlashcard } from "@/components/premium-flashcard";
import { ViewerModeBanner } from "@/components/viewer-mode-banner";
import { isBabyAdmin, useBaby } from "@/contexts/BabyContext";
import { Fonts, PastelColors, flashcardShadow, primaryCtaPadding } from "@/constants/theme";
import { alertMasterOnlyFeature } from "@/lib/master-only-alert";
import { supabase } from "@/lib/supabase";
import {
  addCard,
  getCards,
  subscribe,
  type WordCard,
  type WordStatus,
} from "@/stores/cards-store";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const KAKAO_REST_API_KEY =
  "b6e8b85388e14a5fc417ed093f0c00c7";

/** 기본 10개 카테고리 — 상태로 관리되며 [기타]로 신규 추가 시 목록에 영구 반영 */
const DEFAULT_CATEGORIES = [
  "가족/호칭",
  "탈것",
  "인사/표현",
  "감정/상태",
  "동물",
  "음식/간식",
  "신체부위",
  "사물/공간",
  "의성어/의태어",
  "기타",
];

const SAMPLE_IMAGE = require("@/assets/images/icon.png");

function getImageForWord(_word: string): number {
  return SAMPLE_IMAGE;
}

type DetailModalProps = {
  word: string;
  categories: string[];
  isSaving: boolean;
  editingCardId: string | null;
  initialCategory: string | null;
  initialImageUri: string | null;
  initialStatus?: WordStatus;
  imageSearchResults?: string[];
  isFetchingImage?: boolean;
  onComplete: (category: string, imageUri: string | null, wordStatus: WordStatus) => void;
  onClose: () => void;
};

function DetailModal({
  word,
  categories,
  isSaving,
  editingCardId,
  initialCategory,
  initialImageUri,
  initialStatus,
  imageSearchResults = [],
  isFetchingImage = false,
  onComplete,
  onClose,
}: DetailModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [imagePickSource, setImagePickSource] = useState<"search" | "gallery" | null>(
    null,
  );
  const [wordStatus, setWordStatus] = useState<WordStatus>("knows");
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (word) {
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      if (editingCardId && initialCategory !== null) {
        const isCustom =
          !categories.includes(initialCategory) || initialCategory === "기타";
        setSelectedCategory(isCustom ? "기타" : initialCategory);
        setCustomCategory(isCustom ? initialCategory : "");
        setImageUri(initialImageUri);
        setWordStatus(initialStatus ?? "knows");
      } else {
        setSelectedCategory(null);
        setCustomCategory("");
        setImageUri(initialImageUri);
        setSelectedSearchIndex(0);
        setImagePickSource(initialImageUri ? "search" : null);
        setWordStatus(initialStatus ?? "knows");
      }
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
      setSelectedCategory(null);
      setCustomCategory("");
      setImageUri(null);
      setSelectedSearchIndex(0);
      setImagePickSource(null);
      setWordStatus("knows");
    }
  }, [
    word,
    editingCardId,
    initialCategory,
    initialImageUri,
    initialStatus,
    categories,
    slideAnim,
  ]);

  useEffect(() => {
    if (editingCardId || imagePickSource === "gallery") return;
    if (imageSearchResults.length === 0) return;
    const idx = Math.min(selectedSearchIndex, imageSearchResults.length - 1);
    setImageUri(imageSearchResults[idx]);
    setImagePickSource("search");
    if (idx !== selectedSearchIndex) setSelectedSearchIndex(idx);
  }, [imageSearchResults, editingCardId, imagePickSource, selectedSearchIndex]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setSelectedCategory(null);
      setCustomCategory("");
      setImageUri(null);
      setSelectedSearchIndex(0);
      setImagePickSource(null);
      onClose();
    });
  }, [slideAnim, onClose]);

  const selectSearchImage = useCallback((index: number, uri: string) => {
    setImagePickSource("search");
    setSelectedSearchIndex(index);
    setImageUri(uri);
  }, []);

  const handleComplete = useCallback(async () => {
    if (isSaving) return;
    const category =
      selectedCategory === "기타"
        ? customCategory.trim() || "기타"
        : (selectedCategory ?? "기타");
    await onComplete(category, imageUri, wordStatus);
    handleClose();
  }, [
    selectedCategory,
    customCategory,
    imageUri,
    wordStatus,
    isSaving,
    onComplete,
    handleClose,
  ]);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "갤러리 접근",
        "사진을 선택하려면 갤러리 접근 권한이 필요해요.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setImagePickSource("gallery");
      setImageUri(result.assets[0].uri);
    }
  }, []);

  return (
    <Modal visible={!!word} transparent animationType="none">
      <View style={styles.modalBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={handleClose}
        />
        <Animated.View
          style={[
            styles.modalSheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <KeyboardAvoidingView
            style={[styles.modalKeyboardView, { flex: 1, width: "100%" }]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              style={[styles.modalScroll, { flex: 1, width: "100%" }]}
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              removeClippedSubviews={false}
            >
              <SafeAreaView style={styles.modalSafeInner} edges={["top"]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editingCardId ? "수정" : "상세 설정"} · {word}
                  </Text>
                  <Pressable onPress={handleClose} style={styles.modalCloseBtn}>
                    <Text style={styles.modalCloseText}>취소</Text>
                  </Pressable>
                </View>
              </SafeAreaView>
              {/* 0. 단어 유형 토글 */}
              <Text style={styles.sectionTitle}>단어 유형</Text>
              <View style={styles.wordStatusRow}>
                <Pressable
                  style={[
                    styles.wordStatusBtn,
                    wordStatus === "knows" && styles.wordStatusBtnActive,
                  ]}
                  onPress={() => setWordStatus("knows")}
                >
                  <Text
                    style={[
                      styles.wordStatusBtnText,
                      wordStatus === "knows" && styles.wordStatusBtnTextActive,
                    ]}
                  >
                    👀 아는 단어
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.wordStatusBtn,
                    wordStatus === "says" && styles.wordStatusBtnActive,
                  ]}
                  onPress={() => setWordStatus("says")}
                >
                  <Text
                    style={[
                      styles.wordStatusBtnText,
                      wordStatus === "says" && styles.wordStatusBtnTextActive,
                    ]}
                  >
                    🗣️ 말하는 단어
                  </Text>
                </Pressable>
              </View>
              {/* 1. 카테고리 Chip */}
              <Text style={styles.sectionTitle}>카테고리</Text>
              <View style={styles.chipRow}>
                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[
                      styles.chip,
                      selectedCategory === cat && styles.chipActive,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedCategory === cat && styles.chipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {selectedCategory === "기타" && (
                <TextInput
                  style={styles.customCategoryInput}
                  placeholder="카테고리 이름을 입력하세요"
                  placeholderTextColor={PastelColors.textSecondary}
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  autoCapitalize="none"
                />
              )}

              {/* 2. 썸네일 · 갤러리에서 사진 변경 (1:1 크롭) */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                카드 이미지
              </Text>
              <View style={styles.imageSection}>
                <View style={styles.imagePreviewWrap}>
                  {isFetchingImage ? (
                    <View style={styles.imagePreviewLoading}>
                      <ActivityIndicator
                        size="large"
                        color={PastelColors.accent}
                      />
                    </View>
                  ) : imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.imagePreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <Image
                      source={SAMPLE_IMAGE}
                      style={styles.imagePreview}
                      resizeMode="cover"
                    />
                  )}
                </View>

                {!editingCardId && imageSearchResults.length > 0 ? (
                  <>
                    <Text style={styles.imagePickHint}>
                      검색 이미지 중 하나를 골라 주세요
                    </Text>
                    <View style={styles.imageSearchRow}>
                      {imageSearchResults.map((uri, index) => {
                        const isSelected =
                          imagePickSource === "search" && selectedSearchIndex === index;
                        return (
                          <Pressable
                            key={`${uri}-${index}`}
                            style={[
                              styles.imageSearchThumbWrap,
                              isSelected && styles.imageSearchThumbWrapActive,
                            ]}
                            onPress={() => selectSearchImage(index, uri)}
                          >
                            <Image
                              source={{ uri }}
                              style={styles.imageSearchThumb}
                              resizeMode="cover"
                            />
                            {isSelected ? (
                              <View style={styles.imageSearchThumbBadge}>
                                <Text style={styles.imageSearchThumbBadgeText}>
                                  ✓
                                </Text>
                              </View>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.changePhotoBtn,
                    pressed && styles.changePhotoBtnPressed,
                  ]}
                  onPress={pickImage}
                >
                  <Text style={styles.changePhotoBtnText}>
                    📸 갤러리에서 사진 변경
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.completeBtn,
                  isSaving && styles.completeBtnDisabled,
                ]}
                onPress={handleComplete}
                disabled={isSaving}
              >
                {isSaving ? (
                  <View style={styles.completeBtnLoadingWrap}>
                    <ActivityIndicator
                      size="small"
                      color="#fff"
                      style={styles.completeBtnSpinner}
                    />
                    <Text style={styles.completeBtnText}>저장 중...</Text>
                  </View>
                ) : (
                  <Text style={styles.completeBtnText}>저장 완료</Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function ManageCardsScreen() {
  const router = useRouter();
  const { activeBaby } = useBaby();
  const isAdmin = isBabyAdmin(activeBaby);
  const [inputText, setInputText] = useState("");
  const [cards, setCards] = useState<WordCard[]>(getCards());
  const [pendingWord, setPendingWord] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCard, setEditingCard] = useState<WordCard | null>(null);
  const [fetchedImages, setFetchedImages] = useState<string[]>([]);
  const [isFetchingImage, setIsFetchingImage] = useState(false);
  const listScrollContentStyle = useAdBannerScrollContentStyle(styles.listContent);

  useEffect(() => {
    const unsub = subscribe(() => setCards(getCards()));
    return unsub;
  }, []);

  useEffect(() => {
    if (!pendingWord?.trim()) {
      setFetchedImages([]);
      setIsFetchingImage(false);
      return;
    }
    let cancelled = false;
    setIsFetchingImage(true);
    setFetchedImages([]);

    (async () => {
      try {
        const url = `https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(pendingWord.trim())}&size=3`;
        const res = await fetch(url, {
          headers: { Authorization: "KakaoAK " + KAKAO_REST_API_KEY },
        });
        if (cancelled) return;
        const data = await res.json();
        const urls = ((data?.documents ?? []) as { image_url?: string }[])
          .map((doc) => doc.image_url?.trim())
          .filter((u): u is string => !!u)
          .slice(0, 3);
        if (!cancelled) setFetchedImages(urls);
      } catch {
        if (!cancelled) setFetchedImages([]);
      } finally {
        if (!cancelled) setIsFetchingImage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingWord]);

  const loadWords = useCallback(async () => {
    if (!activeBaby?.id) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("words")
        .select("*")
        .eq("baby_id", activeBaby.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("단어 목록 로드 실패:", error.message);
        return;
      }
      const list = (data ?? []).map(
        (row: {
          id: string;
          word: string;
          category: string;
          image_uri?: string | null;
          status?: string | null;
        }) => ({
          id: String(row.id),
          word: row.word ?? "",
          category: row.category ?? "기타",
          image: row.image_uri ?? getImageForWord(row.word ?? ""),
          status: (row.status === "says" ? "says" : "knows") as WordStatus,
        }),
      );
      setCards(list);
    } finally {
      setLoading(false);
    }
  }, [activeBaby?.id]);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  const handleAdd = useCallback(() => {
    if (!isAdmin) {
      alertMasterOnlyFeature();
      return;
    }
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setPendingWord(trimmed);
    setInputText("");
  }, [inputText, isAdmin]);

  const handleDetailComplete = useCallback(
    async (category: string, imageUri: string | null, wordStatus: WordStatus) => {
      if (!isAdmin) {
        alertMasterOnlyFeature();
        return;
      }
      const isEdit = !!editingCard;
      const wordToSave = isEdit ? editingCard!.word : pendingWord;
      if (!wordToSave || saving) return;
      const finalCategory = category || "기타";
      if (finalCategory && !categories.includes(finalCategory)) {
        setCategories((prev) => [...prev, finalCategory]);
      }
      setSaving(true);
      try {
        let imageUriToSave: string | null = null;
        const isNewLocalImage = imageUri && !imageUri.startsWith("http");

        if (isNewLocalImage) {
          const base64 = await FileSystem.readAsStringAsync(imageUri!, {
            encoding: "base64",
          });
          const ext = imageUri!.toLowerCase().includes(".png") ? "png" : "jpg";
          const contentType = ext === "png" ? "image/png" : "image/jpeg";
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${ext}`;

          const { data: uploadData, error: uploadError } =
            await supabase.storage
              .from("word-images")
              .upload(fileName, decode(base64), { contentType });

          if (uploadError) {
            console.error("업로드 실패:", uploadError);
            Alert.alert("저장 실패", "사진 업로드에 실패했습니다.");
            return;
          }
          const { data: urlData } = supabase.storage
            .from("word-images")
            .getPublicUrl(uploadData.path);
          imageUriToSave = urlData.publicUrl;
        } else if (imageUri && imageUri.startsWith("http")) {
          imageUriToSave = imageUri;
        }

        if (isEdit) {
          const { error: updateError } = await supabase
            .from("words")
            .update({
              category: finalCategory,
              image_uri: imageUriToSave,
              status: wordStatus,
            })
            .eq("id", editingCard!.id);
          if (updateError) {
            console.error("단어 수정 실패:", updateError);
            Alert.alert(
              "저장 실패",
              updateError.message ?? "DB 수정에 실패했어요.",
            );
            return;
          }
          await loadWords();
          setEditingCard(null);
        } else {
          const { data: inserted, error } = await supabase
            .from("words")
            .insert([
              {
                word: wordToSave,
                category: finalCategory,
                image_uri: imageUriToSave,
                status: wordStatus,
                baby_id: activeBaby?.id,
              },
            ])
            .select("id, word, category, image_uri")
            .single();
          if (error) {
            console.error("단어 저장 실패:", error);
            Alert.alert(
              "저장 실패",
              error.message ?? "DB에 저장하지 못했어요.",
            );
            return;
          }
          const image: number | string =
            inserted?.image_uri ?? getImageForWord(wordToSave);
          addCard({
            id: String(inserted?.id ?? Date.now()),
            word: wordToSave,
            image,
            category: finalCategory,
            status: wordStatus,
          });
          setPendingWord(null);
          await loadWords();
        }
      } catch (e) {
        console.error(e);
        Alert.alert(
          "저장 실패",
          e instanceof Error ? e.message : "저장 중 오류가 났어요.",
        );
      } finally {
        setSaving(false);
      }
    },
    [pendingWord, editingCard, categories, saving, loadWords, isAdmin],
  );

  const handleDetailClose = useCallback(() => {
    setInputText(pendingWord ?? "");
    setPendingWord(null);
    setEditingCard(null);
  }, [pendingWord]);

  const handleDelete = useCallback(
    (card: WordCard) => {
      Alert.alert("단어 삭제", "이 단어 카드를 삭제할까요?", [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("words")
              .delete()
              .eq("id", card.id);
            if (error) {
              console.error("삭제 실패:", error);
              Alert.alert("삭제 실패", error.message ?? "삭제하지 못했어요.");
              return;
            }
            loadWords();
          },
        },
      ]);
    },
    [loadWords],
  );

  const handleEdit = useCallback((card: WordCard) => {
    setEditingCard(card);
    setPendingWord(null);
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "우아카드 관리",
          headerBackTitle: "메인",
          headerTintColor: PastelColors.text,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: PastelColors.background },
          headerTitleStyle: {
            fontFamily: Fonts.rounded,
            fontSize: 18,
            color: PastelColors.text,
          },
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {!isAdmin && <ViewerModeBanner />}
          <Pressable
            style={({ pressed }) => [
              styles.playlistButton,
              !isAdmin && styles.playlistButtonViewer,
              pressed && isAdmin && styles.playlistButtonPressed,
            ]}
            onPress={() => {
              if (!isAdmin) {
                alertMasterOnlyFeature();
                return;
              }
              router.push("/manage-playlists");
            }}
          >
            <Text style={styles.playlistButtonIcon}>🗂️</Text>
            <Text style={[styles.playlistButtonLabel, !isAdmin && styles.ctaLabelMuted]}>
              우아카드 단어장 만들기
            </Text>
          </Pressable>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="단어를 입력하세요"
              placeholderTextColor={PastelColors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              editable={isAdmin}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                !isAdmin && styles.addButtonViewer,
                (pressed || loading) && isAdmin && styles.addButtonPressed,
              ]}
              onPress={handleAdd}
              disabled={loading && isAdmin}
            >
              <Text style={[styles.addButtonLabel, !isAdmin && styles.ctaLabelMuted]}>추가</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={listScrollContentStyle}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator
                  size="large"
                  color={PastelColors.segmentHighlight}
                />
                <Text style={styles.loadingText}>단어 목록 불러오는 중...</Text>
              </View>
            ) : cards.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>아직 카드가 없어요.</Text>
                <Text style={styles.emptySub}>
                  {isAdmin
                    ? "단어를 입력하고 추가한 뒤, 상세 설정에서 카테고리와 사진을 정해 보세요!"
                    : "우아마스터가 단어를 등록하면 여기에서 볼 수 있어요."}
                </Text>
              </View>
            ) : (
              cards.map((card) => (
                <PremiumFlashcard key={card.id} style={styles.card}>
                  <View style={styles.cardImageWrap}>
                    {typeof card.image === "string" ? (
                      <Image
                        source={{ uri: card.image }}
                        style={styles.cardImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Image
                        source={card.image}
                        style={styles.cardImage}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.cardCategoryChip}>
                      <Text style={styles.cardCategoryText}>
                        {card.category}
                      </Text>
                    </View>
                    <Text style={styles.cardWord} numberOfLines={1}>
                      {card.word}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.cardActionBtn,
                        !isAdmin && styles.cardActionBtnViewer,
                        pressed && isAdmin && styles.cardActionBtnPressed,
                      ]}
                      onPress={() => {
                        if (!isAdmin) {
                          alertMasterOnlyFeature();
                          return;
                        }
                        handleEdit(card);
                      }}
                    >
                      <Text style={[styles.cardActionBtnText, !isAdmin && styles.cardActionBtnTextViewer]}>
                        수정
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.cardActionBtn,
                        styles.cardActionBtnDelete,
                        !isAdmin && styles.cardActionBtnViewer,
                        pressed && isAdmin && styles.cardActionBtnPressed,
                      ]}
                      onPress={() => {
                        if (!isAdmin) {
                          alertMasterOnlyFeature();
                          return;
                        }
                        handleDelete(card);
                      }}
                    >
                      <Text
                        style={[
                          styles.cardActionBtnText,
                          styles.cardActionBtnTextDelete,
                          !isAdmin && styles.cardActionBtnTextViewer,
                        ]}
                      >
                        삭제
                      </Text>
                    </Pressable>
                  </View>
                </PremiumFlashcard>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        <AdBannerPlaceholder fixedBottom />
      </SafeAreaView>

      <DetailModal
        word={pendingWord ?? editingCard?.word ?? ""}
        categories={categories}
        isSaving={saving}
        editingCardId={editingCard?.id ?? null}
        initialCategory={editingCard?.category ?? null}
        initialImageUri={
          editingCard && typeof editingCard.image === "string"
            ? editingCard.image
            : fetchedImages[0] ?? null
        }
        initialStatus={editingCard?.status}
        imageSearchResults={editingCard ? [] : fetchedImages}
        isFetchingImage={!editingCard && isFetchingImage}
        onComplete={handleDetailComplete}
        onClose={handleDetailClose}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  playlistButtonViewer: {
    backgroundColor: PastelColors.primaryLight,
  },
  addButtonViewer: {
    backgroundColor: PastelColors.buttonViewerDisabled,
  },
  ctaLabelMuted: {
    color: PastelColors.textSecondary,
  },
  cardActionBtnViewer: {
    backgroundColor: PastelColors.primaryLight,
  },
  cardActionBtnTextViewer: {
    color: PastelColors.textSecondary,
  },
  playlistButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...primaryCtaPadding,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: PastelColors.buttonPrimary,
    ...flashcardShadow,
  },
  playlistButtonPressed: {
    opacity: 0.9,
  },
  playlistButtonIcon: {
    fontSize: 22,
  },
  playlistButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    backgroundColor: PastelColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    ...flashcardShadow,
  },
  addButton: {
    backgroundColor: PastelColors.buttonPrimary,
    borderRadius: 16,
    ...primaryCtaPadding,
    justifyContent: "center",
    minWidth: 80,
    ...flashcardShadow,
  },
  addButtonPressed: {
    opacity: 0.88,
  },
  addButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
    gap: 18,
  },
  empty: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 17,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    opacity: 0.85,
    fontFamily: Fonts.rounded,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 96,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cardImageWrap: {
    width: 96,
    height: 96,
    backgroundColor: PastelColors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  cardImage: {
    width: 96,
    height: 96,
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
    minWidth: 0,
  },
  cardCategoryChip: {
    alignSelf: "flex-start",
    backgroundColor: PastelColors.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
  },
  cardCategoryText: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  cardWord: {
    fontSize: 18,
    fontWeight: "600",
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    paddingLeft: 4,
  },
  cardActionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: PastelColors.buttonPrimary,
  },
  cardActionBtnDelete: {
    backgroundColor: PastelColors.primaryLight,
  },
  cardActionBtnPressed: {
    opacity: 0.85,
  },
  cardActionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  cardActionBtnTextDelete: {
    color: PastelColors.textSecondary,
    fontWeight: "600",
  },
  // Modal — 계층: View(배경) > Animated.View(시트) > KeyboardAvoidingView > ScrollView
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    width: "100%",
    backgroundColor: PastelColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.88,
    maxHeight: SCREEN_HEIGHT * 0.88,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalScroll: {
    flex: 1,
  },
  modalSafeInner: {
    paddingBottom: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PastelColors.textSecondary,
    opacity: 0.4,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  modalCloseBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  modalBody: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 200,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 12,
  },
  wordStatusRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  wordStatusBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  wordStatusBtnActive: {
    backgroundColor: PastelColors.buttonPrimary,
  },
  wordStatusBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  wordStatusBtnTextActive: {
    color: "#FFFFFF",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: PastelColors.backgroundMint,
  },
  chipActive: {
    backgroundColor: PastelColors.accent,
  },
  chipText: {
    fontSize: 15,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  chipTextActive: {
    color: PastelColors.buttonTextOnPrimary,
    fontWeight: "600",
  },
  customCategoryInput: {
    marginTop: 12,
    height: 52,
    borderRadius: 20,
    backgroundColor: PastelColors.cardBg,
    paddingHorizontal: 20,
    fontSize: 16,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    ...flashcardShadow,
  },
  imageSection: {
    alignItems: "center",
  },
  imagePreviewWrap: {
    width: 160,
    height: 160,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: PastelColors.backgroundMint,
    ...flashcardShadow,
  },
  imagePreviewLoading: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PastelColors.backgroundMint,
  },
  imagePreview: {
    width: 160,
    height: 160,
  },
  imagePickHint: {
    marginTop: 14,
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: "center",
  },
  imageSearchRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
  },
  imageSearchThumbWrap: {
    width: 88,
    height: 88,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.backgroundMint,
  },
  imageSearchThumbWrapActive: {
    borderColor: PastelColors.accent,
  },
  imageSearchThumb: {
    width: "100%",
    height: "100%",
  },
  imageSearchThumbBadge: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PastelColors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  imageSearchThumbBadgeText: {
    color: PastelColors.buttonTextOnPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  changePhotoBtn: {
    marginTop: 16,
    ...primaryCtaPadding,
    borderRadius: 20,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: "center",
  },
  changePhotoBtnPressed: {
    opacity: 0.88,
  },
  changePhotoBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  completeBtn: {
    marginTop: 28,
    ...primaryCtaPadding,
    borderRadius: 20,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: "center",
  },
  completeBtnPressed: {
    opacity: 0.9,
  },
  completeBtnDisabled: {
    opacity: 0.8,
  },
  completeBtnLoadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  completeBtnSpinner: {
    marginRight: 4,
  },
  completeBtnText: {
    fontSize: 18,
    fontWeight: "600",
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
});
