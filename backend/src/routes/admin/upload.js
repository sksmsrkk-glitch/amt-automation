// ============================================================================
// /api/admin/upload — 관리자 이미지 업로드 라우트
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   POST /           — 단일 이미지 업로드 (multipart field: "image")
//   POST /multiple   — 최대 10장 다중 업로드 (multipart field: "images")
//
// 저장소: Supabase Storage (영구). 과거에는 로컬 디스크(backend/uploads/) 에
// 저장했지만 Railway 등 컨테이너 플랫폼의 임시 파일시스템 특성상 몇 시간마다
// 업로드된 이미지가 유실되는 문제가 있었다. 그래서 영구 CDN URL 을 주는
// Supabase Storage 로 이전했다. 자세한 원인과 대안 비교는
// docs/SUPABASE_STORAGE_SETUP.md 참고.
//
// 파일 흐름:
//   브라우저 → multer (memoryStorage) → Buffer → Supabase Storage → public URL
//   반환된 URL 은 https://<project>.supabase.co/storage/v1/object/public/<bucket>/<filename>
//   형태의 절대 경로. 기존 '/uploads/xxx' 상대 경로 대신 이 절대 URL 이 DB 에 저장된다.
//
// 제한:
//   - 파일 크기: 10MB
//   - MIME: jpeg / jpg / png / gif / webp (확장자와 mimetype 모두 검사)
//
// 환경 변수 필요:
//   - SUPABASE_URL, SUPABASE_SERVICE_KEY (config/supabase-storage.js 참고)
//
// 주의:
//   - 업로드 후 파일 삭제 엔드포인트는 현재 없다. 테스트용 업로드가 쌓일 수
//     있으므로 주기적으로 Supabase Storage 대시보드에서 정리.
//   - 기존에 DB 에 저장된 '/uploads/xxx' 경로는 이미 파일이 사라진 상태라
//     브라우저에서 404. 프런트엔드는 404 이미지를 빈 플레이스홀더로 처리함
//     (이번 PR 스코프 밖의 별도 작업).
// ============================================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { uploadImage } = require('../../config/supabase-storage');

const router = express.Router();
// 관리자 인증 필수. 업로드는 공개 기능이 아니다.
router.use(authenticate, requireAdmin);

// ----------------------------------------------------------------------------
// multer 메모리 스토리지
// ----------------------------------------------------------------------------
// Supabase Storage 로 바로 흘려 보내기 위해 디스크 대신 메모리에 Buffer 로
// 받는다. 파일 크기 제한(10MB) 이 걸려 있어 메모리 압박은 크지 않다.
// ----------------------------------------------------------------------------
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  // 10MB 제한. 원본 사진을 그대로 올리는 관리자 UX 를 고려한 값.
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // 확장자와 MIME 를 모두 검사. 둘 중 하나라도 일치하지 않으면 거부.
    // 정규식은 소문자 비교를 위해 경로 확장자를 toLowerCase() 처리한다.
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

/**
 * 충돌 방지용 유니크 파일명 생성.
 * 예: 1715342891823-ab3f7c2d.jpg
 * - 앞의 timestamp 는 정렬 보조 / 디버깅용.
 * - 뒤의 8-hex 는 같은 ms 에 다중 업로드돼도 충돌하지 않도록.
 * - 확장자는 originalname 에서 복사해 Supabase 에서 MIME 감지가 쉽도록.
 *
 * @param {string} originalName - multer file.originalname
 * @returns {string} 'YYYYMMDD...' 아닌 단순 숫자 기반 유니크 이름
 */
function buildUniqueFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const rand = crypto.randomBytes(4).toString('hex');
  return `${Date.now()}-${rand}${ext}`;
}

/**
 * POST / — 단일 이미지 업로드.
 *
 * form field: image (multipart/form-data)
 * 응답: 200 { url, filename, size }
 *       400 파일 없음
 *       500 업로드 실패 (Supabase 설정 누락 포함)
 *
 * 반환되는 url 은 Supabase Storage 의 절대 공개 URL.
 */
router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });

  try {
    const filename = buildUniqueFilename(req.file.originalname);
    const url = await uploadImage(filename, req.file.buffer, req.file.mimetype);
    res.json({ url, filename, size: req.file.size });
  } catch (err) {
    console.error('Upload error:', err);
    // Supabase 구성 오류 메시지는 운영 디버깅에 필요하므로 그대로 전달.
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

/**
 * POST /multiple — 다중 이미지 업로드 (최대 10장).
 *
 * form field: images (반복)
 * 응답: 200 { files: [{ url, filename, size }, ...] }
 *       400 파일 없음 | 500 업로드 실패
 *
 * 각 파일은 Supabase Storage 에 순차적으로 올리고(병렬 업로드 시 race 위험이
 * 없지만 rate-limit 고려해 직렬), 하나라도 실패하면 이미 올라간 파일은 남겨 둔
 * 채 500 반환. 프런트엔드(ImageUploader) 가 성공 응답만 상태로 반영하므로
 * 부분 실패 시 정합성은 자동으로 유지된다.
 */
router.post('/multiple', upload.array('images', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  try {
    const files = [];
    for (const f of req.files) {
      const filename = buildUniqueFilename(f.originalname);
      const url = await uploadImage(filename, f.buffer, f.mimetype);
      files.push({ url, filename, size: f.size });
    }
    res.json({ files });
  } catch (err) {
    console.error('Multiple upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

module.exports = router;
