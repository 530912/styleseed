import { router } from "expo-router";

import { Button, EmptyState, Screen } from "../components/styleseed/ui";

// 회원 탈퇴 완료 안내. Figma 06 Screens "ACCOUNT_DELETED"
export default function AccountDeletedScreen() {
  return (
    <Screen showBack={false}>
      <EmptyState
        title="계정을 삭제했어요"
        description="옷장 데이터와 이미지가 모두 삭제됐어요."
        action={<Button label="처음으로 가기" onPress={() => router.replace("/")} />}
      />
    </Screen>
  );
}
