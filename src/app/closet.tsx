import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { router } from "expo-router";

import { useClosetStore } from "../store/useClosetStore";

export default function ClosetScreen() {
  const clothes = useClosetStore((state) => state.clothes);

  const capitalize = (text: string) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Digital Closet</Text>

      <Text style={styles.description}>내가 등록한 옷</Text>

      <View style={styles.grid}>
        {clothes.map((clothing) => (
          <Pressable
            key={clothing.id}
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/styling",
                params: {
                  clothingId: String(clothing.id),
                },
              })
            }
          >
            <View style={styles.imageBox}>
              {clothing.imageUri ? (
                <Image
                  source={{
                    uri: clothing.imageUri,
                  }}
                  style={styles.image}
                />
              ) : (
                <Text style={styles.imageText}>
                  {capitalize(clothing.subCategory)}
                </Text>
              )}
            </View>

            <Text style={styles.category}>
              {capitalize(clothing.subCategory)}
            </Text>

            <Text style={styles.info}>
              {capitalize(clothing.color)}
              {" · "}
              {capitalize(clothing.fit)}
              {" · "}
              {clothing.style.map(capitalize).join(", ")}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 100,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111111",
  },

  description: {
    marginTop: 12,
    fontSize: 16,
    color: "#666666",
  },

  grid: {
    marginTop: 40,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    width: "48%",
    marginBottom: 28,
  },

  imageBox: {
    width: "100%",
    aspectRatio: 0.8,
    backgroundColor: "#eeeeee",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  imageText: {
    color: "#999999",
  },

  category: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "600",
    color: "#111111",
  },

  info: {
    marginTop: 4,
    fontSize: 13,
    color: "#777777",
  },
});
