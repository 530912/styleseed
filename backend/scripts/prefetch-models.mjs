// SlimSAM 모델을 미리 내려받아 transformers.js 파일 캐시에 넣는다 (Beta Launch, 배포 이미지 빌드용)
//
// 서버(server.js getLocalSam)는 첫 요청 때 같은 모델을 from_pretrained로 불러온다.
// 이미지 빌드 단계에서 이 스크립트를 실행하면 캐시
// (node_modules/@huggingface/transformers/.cache/Xenova/slimsam-77-uniform)에 파일이 남아
// 실행 중에는 Hugging Face로 내려받지 않는다.
//
// 마지막에 원격 다운로드를 끈 상태로 다시 불러와 캐시만으로 로딩되는지 확인한다.
// 실패하면 종료 코드 1 → 이미지 빌드가 실패한다.
//
// 실행: node backend/scripts/prefetch-models.mjs

import { AutoProcessor, SamModel, env } from "@huggingface/transformers";

const MODEL_ID = "Xenova/slimsam-77-uniform";

const load = async (label) => {
  const startedAt = performance.now();

  await SamModel.from_pretrained(MODEL_ID);

  await AutoProcessor.from_pretrained(MODEL_ID);

  console.log(
    `${label}: ${Math.round(performance.now() - startedAt)}ms (cache: ${env.cacheDir})`,
  );
};

try {
  await load("다운로드·캐시 저장");

  env.allowRemoteModels = false;

  await load("캐시만으로 로딩 확인");
} catch (error) {
  console.error("SlimSAM 모델 준비 실패:", error?.message ?? error);

  process.exit(1);
}
