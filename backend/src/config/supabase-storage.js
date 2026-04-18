// ============================================================================
// Supabase Storage 클라이언트 래퍼
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) process.env.SUPABASE_URL + SUPABASE_SERVICE_KEY 로 Supabase 클라이언트를
//      지연 초기화한다(싱글턴).
//   2) 업로드용 헬퍼 uploadImage() 를 노출한다:
//      - 파일 버퍼를 특정 버킷에 올리고
//      - 공개 URL 을 반환.
//
// 왜 이렇게 설계했나:
//   - 기존 디스크 저장(multer diskStorage) 은 Railway 의 임시 파일시스템에
//     쓰기 때문에 컨테이너 재시작 시 모든 업로드가 사라졌다. 영구 저장
//     스토리지로 이관하기 위해 Supabase Storage 를 사용한다 (DB 이미 Supabase).
//   - SERVICE_KEY 를 쓰는 이유: 관리자 전용 업로드라 RLS 정책 우회가 편리하고,
//     클라이언트에 노출되지 않는 백엔드 전용 키이므로 안전하다.
//     ⚠ 절대 프런트엔드 코드/번들에 넣지 말 것.
//
// 필수 환경 변수:
//   - SUPABASE_URL           : https://<project>.supabase.co
//   - SUPABASE_SERVICE_KEY   : service_role 키 (Supabase → Project Settings → API)
//   - SUPABASE_STORAGE_BUCKET: 업로드 버킷 이름 (기본 'product-images')
//
// Supabase 대시보드에서 해야 할 사전 작업:
//   1) Storage → Create bucket → 'product-images' (Public)
//   2) Bucket 정책은 public SELECT 만 열어 두고 write 는 service key 로만 허용.
//      (Public bucket 생성 시 기본 정책이 그에 가깝다.)
// ============================================================================

const { createClient } = require('@supabase/supabase-js');

// 싱글턴 캐시. 첫 호출 때만 createClient 실행.
let cachedClient = null;

/**
 * Supabase 클라이언트 지연 초기화 헬퍼.
 *
 * 필수 env 누락 시 즉시 throw — 호출부(upload 라우트) 가 500 으로 반환하고,
 * 서버 로그에 명확한 원인이 남는다. 부팅 시점에 throw 하지 않는 이유는
 * 업로드 기능을 쓰지 않는 배포 환경(예: 로컬 테스트)에서도 서버가 기동되어야
 * 하기 때문.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase Storage 가 구성되지 않았습니다.\n' +
      '  필수 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_KEY\n' +
      '  Railway Variables 또는 backend/.env 에 추가하세요.\n' +
      '  자세한 절차는 docs/SUPABASE_STORAGE_SETUP.md 참고.'
    );
  }

  // auth.persistSession: 백엔드에서는 사용자 세션이 없으므로 off.
  // auth.autoRefreshToken: service key 는 만료 없음이므로 off.
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedClient;
}

/**
 * 사용 버킷 이름. env 로 재정의 가능 (운영/스테이징 환경 분리용).
 */
function getBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
}

/**
 * 파일 버퍼를 Supabase Storage 에 업로드하고 공개 URL 을 반환한다.
 *
 * @param {string} filename    - 저장할 파일명 (이미 유니크 규칙으로 생성된 값)
 * @param {Buffer} buffer      - 파일 바이너리 (multer memoryStorage 에서 얻음)
 * @param {string} contentType - 'image/jpeg' 등 MIME. getPublicUrl 응답 헤더에 반영.
 * @returns {Promise<string>} https 로 시작하는 영구 공개 URL
 * @throws 업로드 실패 시 원본 에러를 그대로 throw (호출부가 500 으로 감쌈)
 */
async function uploadImage(filename, buffer, contentType) {
  const supabase = getSupabaseClient();
  const bucket = getBucketName();

  // upsert: false 로 두어 같은 이름 충돌 시 에러로 감지한다. 이름 충돌은
  // 타임스탬프 + 랜덤 suffix 로 사실상 발생하지 않음(upload.js 의 파일명 전략).
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType,
      cacheControl: '3600', // 1시간. CDN 캐시 갱신 주기.
      upsert: false,
    });

  if (uploadError) {
    // 호출부가 사용자에게 보여줄 메시지이므로 원인 명시. storage 쪽 에러는
    // message 필드에 이유(권한/버킷 없음/크기 초과 등)가 담겨 내려온다.
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

  // Public bucket 기준 CDN URL. 비공개 버킷이면 createSignedUrl 을 써야 한다.
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  if (!data || !data.publicUrl) {
    throw new Error('Supabase Storage 에서 공개 URL 을 생성하지 못했습니다.');
  }

  return data.publicUrl;
}

module.exports = {
  getSupabaseClient,
  getBucketName,
  uploadImage,
};
