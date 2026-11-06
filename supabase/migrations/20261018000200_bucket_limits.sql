-- =============================================================================
-- Sprint 1A-2 / S2-04 (DB-3): clothing-images 버킷 업로드 크기·형식 제한
--
-- 앱이 올리는 파일: 원본 사진(JPEG/PNG 등), 배경 제거 결과(PNG).
-- 이후 업로드부터 적용되며 이미 저장된 파일에는 영향이 없다.
-- 크기 한도 10MB는 초기값이다. 실제 휴대폰 사진 크기(PQ-6) 측정 후 확정한다.
--
-- 롤백:
--   update storage.buckets set file_size_limit = null, allowed_mime_types = null
--   where id = 'clothing-images';
-- =============================================================================

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
where id = 'clothing-images';
