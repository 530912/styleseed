import { router } from "expo-router";

import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Button,
  EmptyState,
  Label,
  Screen,
  ScreenHeader,
} from "../components/styleseed/ui";

import {
  CLOTHING_CATEGORIES,
  CLOTHING_COLORS,
  CLOTHING_FITS,
  CLOTHING_MATERIALS,
  CLOTHING_STYLES,
  CLOTHING_SUBCATEGORIES,
} from "../constants/clothingOptions";

import { palette } from "../constants/ui";

import { apiPost } from "../lib/api";

import { getApiErrorMessage, isApiError } from "../lib/apiErrors";

import { isSignedIn } from "../lib/sessionPolicy";

import { saveClothingToSupabase } from "../lib/clothes";

import { now, perfLog } from "../lib/perf";

import { logResearchEvent } from "../lib/researchEvents";

import { getEditedFields, toAnalysisErrorCode } from "../lib/researchEventsPolicy";

import { supabase } from "../lib/supabase";

import { getUserErrorMessage } from "../lib/userErrors";

import { useAnalysisStore } from "../store/useAnalysisStore";

import { useClosetStore } from "../store/useClosetStore";

import { usePendingClothingStore } from "../store/usePendingClothingStore";

import type { ClothingAnalysis } from "../types";

import { getClothingName, joinTitles, toTitle } from "../utils/format";

import {
  getSubcategoryOptions,
  normalizeAnalysisTaxonomy,
} from "../utils/taxonomyCompat";

// 분석을 기다리는 동안 순서대로 보여줄 항목
// (Gemini 분석 결과에 실제로 포함되는 속성만 사용)
const ANALYSIS_STEPS = ["COLOR", "MATERIAL", "FIT", "STYLE", "SEASON", "TPO"];

const STEP_INTERVAL_MS = 450;

type EditableField = "category" | "color" | "fit" | "material" | "style";

// 로그인 전에도 분석할 수 있다(guest). 백엔드 Gemini 제한 시간보다 길게 기다린다.
// 서버 GEMINI_TIMEOUT_MS를 40~45초로 올릴 수 있게 50초로 둔다(Claude B 인계 4번, 서버값은 PO 결정)
const ANALYZE_TIMEOUT_MS = 50_000;

// 백엔드 실패를 사용자가 이해할 수 있는 원인별 문구로 바꾼다.
const getAnalysisErrorMessage = (error: unknown) => {
  if (isApiError(error) && error.code === "NETWORK") {
    // 사용자에게 보이는 문구라 개발 용어(백엔드)를 쓰지 않는다
    return "분석 서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해주세요.";
  }

  return getApiErrorMessage(error, "옷 분석 중 오류가 발생했습니다.");
};

export default function AnalyzeScreen() {
  const imageUri = useAnalysisStore((state) => state.imageUri);

  const imageBase64 = useAnalysisStore((state) => state.imageBase64);

  const analysisResult = useAnalysisStore((state) => state.analysisResult);

  const setAnalysisResult = useAnalysisStore(
    (state) => state.setAnalysisResult,
  );

  const clearImage = useAnalysisStore((state) => state.clearImage);

  const addClothing = useClosetStore((state) => state.addClothing);

  const setPendingClothing = usePendingClothingStore(
    (state) => state.setPendingClothing,
  );

  const [selectedCategory, setSelectedCategory] = useState(
    analysisResult?.category ?? null,
  );

  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(
    analysisResult?.subCategory ?? null,
  );

  const [selectedColor, setSelectedColor] = useState(
    analysisResult?.color ?? null,
  );

  const [selectedFit, setSelectedFit] = useState(analysisResult?.fit ?? null);

  const [selectedMaterial, setSelectedMaterial] = useState(
    analysisResult?.material ?? null,
  );

  const [selectedStyles, setSelectedStyles] = useState<
    ClothingAnalysis["style"]
  >(analysisResult?.style ?? []);

  const [editingField, setEditingField] = useState<EditableField | null>(null);

  const [loading, setLoading] = useState(
    !analysisResult && Boolean(imageBase64),
  );

  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const [revealedSteps, setRevealedSteps] = useState(0);

  const analyzeClothing = async () => {
    if (!imageBase64) {
      setError("분석할 이미지가 없습니다.");

      setLoading(false);

      return;
    }

    // 사용자 조사: 분석 시작·완료·실패와 걸린 시간
    const researchStartedAt = Date.now();

    logResearchEvent("analysis_started");

    try {
      setLoading(true);
      setError(null);

      const analyzeStartedAt = now();

      const response = (await apiPost(
        "/analyze-clothing",
        {
          imageBase64,
        },
        {
          auth: "session",
          timeoutMs: ANALYZE_TIMEOUT_MS,
        },
      )) as ClothingAnalysis;

      perfLog("analyze.request", analyzeStartedAt, {
        base64Bytes: imageBase64.length,
      });

      // 분류를 앱 값으로 정리(대분류 jumpsuit → dress, 어긋난 쌍 보정). 바뀌면 원래 값은 taxonomySource에 남는다
      const { analysis: data } = normalizeAnalysisTaxonomy(response);

      setAnalysisResult(data);

      logResearchEvent("analysis_completed", {
        duration_ms: Date.now() - researchStartedAt,
        category: data.category,
      });

      setSelectedCategory(data.category);
      setSelectedSubCategory(data.subCategory);
      setSelectedColor(data.color);
      setSelectedFit(data.fit);
      setSelectedMaterial(data.material);
      setSelectedStyles(data.style);
    } catch (error) {
      // 서버 혼잡·한도 초과·연결 실패는 예상 가능한 실패라 개발용 오류 팝업 대신 화면 문구로 안내
      console.log(
        "분석 요청 실패:",
        isApiError(error) ? `${error.code} ${error.status ?? ""}` : error,
      );

      logResearchEvent("analysis_failed", {
        duration_ms: Date.now() - researchStartedAt,
        error_code: toAnalysisErrorCode(isApiError(error) ? error.code : undefined),
      });

      setError(getAnalysisErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 같은 이미지의 분석 결과가 이미 있으면 다시 요청하지 않음
    if (!imageUri || analysisResult) {
      return;
    }

    analyzeClothing();
  }, [imageUri]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    setRevealedSteps(1);

    const timer = setInterval(() => {
      setRevealedSteps((count) => Math.min(count + 1, ANALYSIS_STEPS.length));
    }, STEP_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [loading]);

  const toggleEditing = (field: EditableField) => {
    setEditingField((current) => (current === field ? null : field));
  };

  const toggleStyle = (style: ClothingAnalysis["style"][number]) => {
    setSelectedStyles((current) => {
      const alreadySelected = current.includes(style);

      if (alreadySelected) {
        // STYLE이 최소 하나는 남도록 한다.
        if (current.length === 1) {
          return current;
        }

        return current.filter((item) => item !== style);
      }

      return [...current, style];
    });
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }

    if (!analysisResult || !imageUri) {
      return;
    }

    try {
      setSaving(true);

      const newClothing = {
        ...analysisResult,

        category: selectedCategory ?? analysisResult.category,

        subCategory: selectedSubCategory ?? analysisResult.subCategory,

        color: selectedColor ?? analysisResult.color,

        fit: selectedFit ?? analysisResult.fit,

        material: selectedMaterial ?? analysisResult.material,

        style:
          selectedStyles.length > 0 ? selectedStyles : analysisResult.style,

        id: Date.now(),

        imageUri,
      };

      // 사용자 조사: AI 결과를 고쳤는지(고친 속성 키만, 값은 남기지 않음)
      const editedFields = getEditedFields(analysisResult, newClothing);

      logResearchEvent("analysis_reviewed", {
        edited: editedFields.length > 0,
        edited_count: editedFields.length,
        edited_fields: editedFields.length > 0 ? editedFields.join("|") : "none",
        category: newClothing.category,
      });

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      // 익명 세션(로그인 전 분석용)은 로그아웃과 같이 취급해 가입·로그인 화면으로 보낸다
      if (!isSignedIn(session)) {
        setPendingClothing(newClothing);

        router.push("/signup");

        return;
      }

      const savedClothing = await saveClothingToSupabase(
        newClothing,
        session.user.id,
      );

      addClothing(savedClothing);

      clearImage();

      router.replace("/closet");
    } catch (error) {
      console.error("옷 저장 실패:", error);

      Alert.alert(
        "저장 실패",
        getUserErrorMessage(
          error,
          "옷을 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!imageUri) {
    return (
      <Screen>
        <ScreenHeader eyebrow="AI ANALYSIS" title="분석할 옷이 없어요" />

        <EmptyState
          title="먼저 옷 사진을 올려주세요"
          description="STYLESEED는 사진 한 장에서 옷 한 벌을 분석해요."
          action={
            <Button
              label="옷 등록하기"
              onPress={() => router.replace("/upload")}
            />
          }
        />
      </Screen>
    );
  }

  if (!analysisResult) {
    if (error && !loading) {
      return (
        <Screen>
          <ScreenHeader eyebrow="AI ANALYSIS" title="분석에 실패했어요" />

          <View style={styles.loadingImageBox}>
            <Image
              source={{ uri: imageUri }}
              style={styles.fillImage}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.errorText}>{error}</Text>

          <View style={styles.errorActions}>
            <Button label="다시 시도" onPress={analyzeClothing} />

            <Button
              label="다른 사진 선택"
              variant="secondary"
              onPress={() => router.replace("/upload")}
            />
          </View>
        </Screen>
      );
    }

    return (
      <Screen>
        <ScreenHeader
          eyebrow="AI ANALYSIS"
          title="옷을 분석하고 있어요..."
          description="STYLESEED가 옷의 디테일을 읽고 있어요."
        />

        <View style={styles.loadingImageBox}>
          <Image
            source={{ uri: imageUri }}
            style={styles.fillImage}
            resizeMode="cover"
          />
        </View>

        <View style={styles.stepList}>
          {ANALYSIS_STEPS.map((step, index) => {
            const isVisible = index < revealedSteps;

            const isLatest = index === revealedSteps - 1;

            return (
              <View
                key={step}
                style={[styles.stepRow, !isVisible && styles.stepHidden]}
              >
                <Text style={styles.stepName}>{step}</Text>

                <View style={styles.stepLine} />

                {isVisible && isLatest ? (
                  <ActivityIndicator size="small" color={palette.ink} />
                ) : (
                  <View style={styles.stepDot} />
                )}
              </View>
            );
          })}
        </View>
      </Screen>
    );
  }

  const category = selectedCategory ?? analysisResult.category;

  const subCategory = selectedSubCategory ?? analysisResult.subCategory;

  const color = selectedColor ?? analysisResult.color;

  const fit = selectedFit ?? analysisResult.fit;

  const material = selectedMaterial ?? analysisResult.material;

  const styleValues =
    selectedStyles.length > 0 ? selectedStyles : analysisResult.style;

  return (
    <Screen
      footer={
        <Button
          label={saving ? "저장 중..." : "내 옷장에 저장"}
          loading={saving}
          onPress={handleSave}
        />
      }
    >
      <ScreenHeader
        eyebrow="AI ANALYSIS"
        title={getClothingName({ color, subCategory }).toUpperCase()}
        description="사진 속 옷을 옷장 데이터로 정리했어요."
      />

      <View style={styles.summaryRow}>
        <View style={styles.previewBox}>
          <Image
            source={{ uri: imageUri }}
            style={styles.fillImage}
            resizeMode="cover"
          />
        </View>

        <Pressable
          style={[
            styles.categoryBlock,
            editingField === "category" && styles.cardEditing,
          ]}
          onPress={() => toggleEditing("category")}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>CATEGORY</Text>

            <Text style={styles.editText}>
              {editingField === "category" ? "완료" : "수정"}
            </Text>
          </View>

          <View>
            <Text style={styles.categoryValue} numberOfLines={2}>
              {toTitle(subCategory)}
            </Text>

            <Text style={styles.categoryDetail}>{toTitle(category)}</Text>
          </View>

          <Text style={styles.aiNote}>AI 분석 결과</Text>
        </Pressable>
      </View>

      {editingField === "category" && (
        <View style={styles.editPanel}>
          <Label style={styles.optionLabel}>CATEGORY</Label>

          <View style={styles.optionRow}>
            {CLOTHING_CATEGORIES.map((item) => (
              <OptionChip
                key={item}
                label={toTitle(item)}
                selected={category === item}
                onPress={() => {
                  setSelectedCategory(item);

                  setSelectedSubCategory(CLOTHING_SUBCATEGORIES[item][0]);
                }}
              />
            ))}
          </View>

          <Label style={styles.optionLabel}>SUB CATEGORY</Label>

          <View style={styles.optionRow}>
            {getSubcategoryOptions(category, subCategory).map((item) => (
              <OptionChip
                key={item}
                label={toTitle(item)}
                selected={subCategory === item}
                onPress={() => setSelectedSubCategory(item)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.grid}>
        <AttributeCard
          label="COLOR"
          value={toTitle(color)}
          editable
          editing={editingField === "color"}
          onEdit={() => toggleEditing("color")}
        />

        <AttributeCard
          label="MATERIAL"
          value={toTitle(material)}
          editable
          editing={editingField === "material"}
          onEdit={() => toggleEditing("material")}
        />

        <AttributeCard
          label="FIT"
          value={toTitle(fit)}
          editable
          editing={editingField === "fit"}
          onEdit={() => toggleEditing("fit")}
        />

        <AttributeCard
          label="STYLE"
          value={joinTitles(styleValues)}
          editable
          editing={editingField === "style"}
          onEdit={() => toggleEditing("style")}
        />

        <AttributeCard
          label="SEASON"
          value={
            analysisResult.season.length > 0
              ? joinTitles(analysisResult.season)
              : "—"
          }
        />

        <AttributeCard
          label="TPO"
          value={
            analysisResult.tpo.length > 0 ? joinTitles(analysisResult.tpo) : "—"
          }
        />
      </View>

      {editingField === "color" && (
        <View style={[styles.editPanel, styles.optionRow]}>
          {CLOTHING_COLORS.map((item) => (
            <OptionChip
              key={item}
              label={toTitle(item)}
              selected={color === item}
              onPress={() => {
                setSelectedColor(item);
                setEditingField(null);
              }}
            />
          ))}
        </View>
      )}

      {editingField === "material" && (
        <View style={[styles.editPanel, styles.optionRow]}>
          {CLOTHING_MATERIALS.map((item) => (
            <OptionChip
              key={item}
              label={toTitle(item)}
              selected={material === item}
              onPress={() => {
                setSelectedMaterial(item);
                setEditingField(null);
              }}
            />
          ))}
        </View>
      )}

      {editingField === "fit" && (
        <View style={[styles.editPanel, styles.optionRow]}>
          {CLOTHING_FITS.map((item) => (
            <OptionChip
              key={item}
              label={toTitle(item)}
              selected={fit === item}
              onPress={() => {
                setSelectedFit(item);
                setEditingField(null);
              }}
            />
          ))}
        </View>
      )}

      {editingField === "style" && (
        <View style={[styles.editPanel, styles.optionRow]}>
          {CLOTHING_STYLES.map((item) => (
            <OptionChip
              key={item}
              label={toTitle(item)}
              selected={styleValues.includes(item)}
              onPress={() => toggleStyle(item)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

type AttributeCardProps = {
  label: string;
  value: string;
  editable?: boolean;
  editing?: boolean;
  onEdit?: () => void;
};

function AttributeCard({
  label,
  value,
  editable = false,
  editing = false,
  onEdit,
}: AttributeCardProps) {
  return (
    <Pressable
      style={[styles.attributeCard, editing && styles.cardEditing]}
      onPress={onEdit}
      disabled={!editable}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{label}</Text>

        {editable ? (
          <Text style={styles.editText}>{editing ? "완료" : "수정"}</Text>
        ) : null}
      </View>

      <Text style={styles.attributeValue} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

type OptionChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function OptionChip({ label, selected, onPress }: OptionChipProps) {
  return (
    <Pressable
      style={[styles.optionButton, selected && styles.selectedOption]}
      onPress={onPress}
    >
      <Text style={[styles.optionText, selected && styles.selectedOptionText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fillImage: {
    width: "100%",
    height: "100%",
  },

  loadingImageBox: {
    width: "100%",
    height: 260,
    backgroundColor: palette.placeholder,
    overflow: "hidden",
  },

  stepList: {
    marginTop: 20,
    gap: 4,
  },

  stepRow: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  stepHidden: {
    opacity: 0.12,
  },

  stepName: {
    width: 84,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: palette.ink,
  },

  stepLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
  },

  stepDot: {
    width: 6,
    height: 6,
    marginHorizontal: 7,
    borderRadius: 3,
    backgroundColor: palette.ink,
  },

  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: palette.danger,
  },

  errorActions: {
    marginTop: 20,
    gap: 10,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },

  previewBox: {
    width: "44%",
    aspectRatio: 0.85,
    backgroundColor: palette.placeholder,
    overflow: "hidden",
  },

  categoryBlock: {
    flex: 1,
    padding: 14,
    justifyContent: "space-between",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surface,
  },

  categoryValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    color: palette.ink,
  },

  categoryDetail: {
    marginTop: 4,
    fontSize: 13,
    color: palette.body,
  },

  aiNote: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: palette.muted,
  },

  grid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },

  attributeCard: {
    width: "48.5%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surface,
  },

  cardEditing: {
    borderColor: palette.ink,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: palette.muted,
  },

  editText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.subtle,
  },

  attributeValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
    color: palette.ink,
  },

  editPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },

  optionLabel: {
    marginBottom: 8,
  },

  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },

  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#cccccc",
  },

  selectedOption: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },

  optionText: {
    fontSize: 13,
    color: palette.ink,
  },

  selectedOptionText: {
    color: palette.background,
  },
});
