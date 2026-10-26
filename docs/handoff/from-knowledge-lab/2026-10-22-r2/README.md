# Knowledge Lab → Claude A 인계 사본 (2026-10-22 r2)

- 보낸 쪽: Claude C (Knowledge Lab) · 원본: Lab 작업 폴더 `/Users/kse0324330/orca/workspaces/styleseed-knowledge-lab/STYLESEED-Knowledge-Lab/docs/handoff/`
- **읽기 전용 사본**입니다. Lab 데이터의 기준은 Lab DB입니다. 이 폴더는 Claude C가 새 판을 만들 때 **새 버전 폴더**로 추가하고, 기존 파일은 덮어쓰지 않습니다.
- 이 폴더는 앱 저장소에 커밋하지 않았습니다(추적되지 않는 파일). 커밋할지는 Claude A·PO가 정합니다.

| 파일 | 내용 | sha256 |
|---|---|---|
| `KNOWLEDGE_LAB_TAXONOMY_HANDOFF_2026-10-22_r2.md` | 인계 문서 r2(원본 파일명 `KNOWLEDGE_LAB_TAXONOMY_HANDOFF.md`) | `c00a9a8e6bcc` |
| `knowledge-lab-taxonomy-2026-10-22-r2.json` | 대분류 8 · 세부분류 63, 계약 garment_schema 필드 17개(`attribute_ko` 포함) | `9dbbb16b30b9` |

- r1과 다른 점:
  - 담당자 승인 수정 23칸(T-1~T-6: 옥스퍼드·더비, 셔츠·슬립 원피스 구조 우선, 호보백, 큐롯, 터번)을 반영했습니다.
  - JSON에 `attribute_ko`·`decided_by`·`decided_at`을 추가했습니다(검토 P1-6).
  - 문서 10장 '변환 매핑 명세 수신 준비'를 새로 넣었습니다.
- 기준 스냅샷: `lab-backup-2026-10-22T03-07-33.json`(sha256 `0caf6ebb355e`). 계약 기준은 앱 저장소 계약 0.2.0(`9285f7d`, `78311d5bc310`)입니다.
- r1 파일(`knowledge-lab-taxonomy-2026-10-22.json`, 스냅샷 `c76e347f8c44`)은 정리 전 판이므로 새 분석에 쓰지 않습니다.
- 확인: `LAB_TAXONOMY_JSON=<이 폴더의 JSON> bash scripts/analysis/taxonomy-review-2026-10-22/run.sh` 결과입니다(Claude C가 계약 시나리오만 실행).
  - S1 = `E_APP_PARENT_MISMATCH:subcategory/jumpsuit` 1건
  - S2 = 0건
  - S11 CSV 왕복이 원문 그대로입니다.
