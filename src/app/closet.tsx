import { Ionicons } from "@expo/vector-icons";

import { router } from "expo-router";

import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ClothingImage } from "../components/styleseed/clothing-image";

import {
  Button,
  EmptyState,
  Screen,
  ScreenHeader,
} from "../components/styleseed/ui";

import { palette } from "../constants/ui";

import { resetClosetSync, useClosetLoader } from "../hooks/use-closet-loader";

import { deleteClothingFromSupabase } from "../lib/clothes";

import { supabase } from "../lib/supabase";

import { useClosetStore } from "../store/useClosetStore";

import { useImagePreferenceStore } from "../store/useImagePreferenceStore";

import { getClothingName, toTitle } from "../utils/format";

export default function ClosetScreen() {
  const clothes = useClosetStore((state) => state.clothes);

  const removeClothing = useClosetStore((state) => state.removeClothing);

  const clearClothes = useClosetStore((state) => state.clearClothes);

  const clearImagePreference = useImagePreferenceStore(
    (state) => state.clearPreference,
  );

  // 로그인 상태 확인 + Supabase에서 내 옷 불러오기
  const { status, reload } = useClosetLoader();

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedClothing =
    clothes.find((clothing) => clothing.id === selectedId) ?? null;

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("로그아웃 실패:", error);
      return;
    }

    resetClosetSync();

    clearClothes();

    router.replace("/");
  };

  const handleDelete = (clothingId: number) => {
    Alert.alert(
      "옷장에서 삭제할까요?",
      "삭제하면 저장된 옷 정보와 이미지가 모두 삭제됩니다.",
      [
        {
          text: "취소",
          style: "cancel",
        },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            if (deletingId !== null) {
              return;
            }

            try {
              setDeletingId(clothingId);

              await deleteClothingFromSupabase(clothingId);

              removeClothing(clothingId);

              clearImagePreference(clothingId);

              setSelectedId((current) =>
                current === clothingId ? null : current,
              );
            } catch (error) {
              console.error("옷 삭제 실패:", error);

              Alert.alert("삭제 실패", "옷을 삭제하지 못했어요.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const handleStyle = () => {
    if (!selectedClothing) {
      return;
    }

    router.push({
      pathname: "/styling",
      params: {
        clothingId: String(selectedClothing.id),
      },
    });
  };

  const handleEditImage = () => {
    if (!selectedClothing) {
      return;
    }

    router.push({
      pathname: "/item",
      params: {
        clothingId: String(selectedClothing.id),
      },
    });
  };

  const renderEmpty = () => {
    if (status === "loading") {
      return <ActivityIndicator style={styles.loader} color={palette.ink} />;
    }

    if (status === "signed-out") {
      return (
        <EmptyState
          title="로그인하고 내 옷장을 확인하세요"
          action={
            <Button
              label="로그인"
              onPress={() =>
                router.push({
                  pathname: "/login",
                  params: {
                    redirectTo: "closet",
                  },
                })
              }
            />
          }
        />
      );
    }

    if (status === "error") {
      return (
        <EmptyState
          title="옷장을 불러오지 못했어요"
          description="인터넷 연결을 확인하고 다시 시도해주세요."
          action={
            <Button
              label="다시 시도"
              variant="secondary"
              onPress={() => reload(true)}
            />
          }
        />
      );
    }

    return (
      <EmptyState
        title="아직 등록된 옷이 없어요"
        description="첫 번째 옷을 올려 내 옷장을 데이터로 만들어보세요."
        action={
          <Button label="옷 등록하기" onPress={() => router.push("/upload")} />
        }
      />
    );
  };

  return (
    <Screen
      scroll={false}
      // 옷 저장 후 이동해 온 경우에도 빈 등록/분석 화면이 아닌 HOME으로 돌아간다
      onBack={() => router.dismissTo("/")}
      footer={
        clothes.length > 0 ? (
          <>
            <Text style={styles.footerHint} numberOfLines={1}>
              {selectedClothing
                ? `선택됨 · ${getClothingName(selectedClothing).toUpperCase()}`
                : "코디할 옷을 탭해서 선택하세요"}
            </Text>

            <View style={styles.footerRow}>
              <Button
                label="옷 수정"
                variant="secondary"
                disabled={!selectedClothing}
                onPress={handleEditImage}
                style={styles.footerButton}
              />

              <Button
                label="이 옷으로 코디하기"
                disabled={!selectedClothing}
                onPress={handleStyle}
                style={styles.footerButton}
              />
            </View>
          </>
        ) : undefined
      }
    >
      <ScreenHeader
        eyebrow={`DIGITAL CLOSET · ${clothes.length}벌`}
        title="내 디지털 옷장"
        description="내 옷이 스타일 데이터로 정리돼요."
        right={
          status === "signed-out" ? undefined : (
            <>
              <Pressable onPress={() => router.push("/upload")} hitSlop={8}>
                <Text style={styles.headerLink}>+ 추가</Text>
              </Pressable>

              <Pressable onPress={() => router.push("/saved-looks")} hitSlop={8}>
                <Text style={styles.headerLink}>저장한 코디</Text>
              </Pressable>

              <Pressable onPress={() => router.push("/account")} hitSlop={8}>
                <Text style={styles.headerLink}>계정</Text>
              </Pressable>

              <Pressable onPress={handleLogout} hitSlop={8}>
                <Text style={styles.headerLink}>로그아웃</Text>
              </Pressable>
            </>
          )
        }
      />

      <FlatList
        data={clothes}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty()}
        extraData={[selectedId, deletingId]}
        renderItem={({ item }) => {
          const isSelected = item.id === selectedId;

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                setSelectedId((current) =>
                  current === item.id ? null : item.id,
                )
              }
            >
              <View
                style={[styles.imageFrame, isSelected && styles.imageSelected]}
              >
                <ClothingImage
                  clothing={item}
                  style={styles.image}
                  padding={12}
                />

                <Pressable
                  style={styles.deleteButton}
                  accessibilityRole="button"
                  accessibilityLabel={`${getClothingName(item)} 삭제`}
                  disabled={deletingId === item.id}
                  hitSlop={6}
                  onPress={(event) => {
                    event.stopPropagation();

                    handleDelete(item.id);
                  }}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Ionicons
                      name="trash-outline"
                      size={15}
                      color={palette.ink}
                    />
                  )}
                </Pressable>

                {isSelected ? (
                  <View style={styles.selectedTag}>
                    <Text style={styles.selectedTagText}>선택됨</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.cardTitle} numberOfLines={1}>
                {getClothingName(item).toUpperCase()}
              </Text>

              <Text style={styles.cardMeta} numberOfLines={1}>
                {toTitle(item.subCategory)} · {toTitle(item.material)}
              </Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerLink: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.subtle,
  },

  loader: {
    marginTop: 40,
  },

  listContent: {
    paddingBottom: 16,
  },

  columns: {
    justifyContent: "space-between",
  },

  card: {
    width: "48%",
    marginBottom: 20,
  },

  imageFrame: {
    width: "100%",
    aspectRatio: 0.8,
    borderWidth: 2,
    borderColor: "transparent",
  },

  imageSelected: {
    borderColor: palette.ink,
  },

  image: {
    flex: 1,
  },

  deleteButton: {
    position: "absolute",
    top: 8,
    right: 8,

    width: 30,
    height: 30,

    borderRadius: 15,

    backgroundColor: "rgba(255, 255, 255, 0.85)",

    justifyContent: "center",
    alignItems: "center",
  },

  selectedTag: {
    position: "absolute",
    left: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: palette.ink,
  },

  selectedTagText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.background,
  },

  cardTitle: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: palette.ink,
  },

  cardMeta: {
    marginTop: 3,
    fontSize: 12,
    color: palette.subtle,
  },

  footerRow: {
    flexDirection: "row",
    gap: 10,
  },

  footerButton: {
    flex: 1,
    paddingHorizontal: 8,
  },

  footerHint: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    color: palette.muted,
  },
});
