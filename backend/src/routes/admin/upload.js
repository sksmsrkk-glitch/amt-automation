const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

// Max dimension enforced on stored images. Claude API rejects "many-image
// requests" when any image exceeds 2000px on either side, so we downscale
// uploads here to keep them under that limit.
const MAX_DIMENSION = 2000;

const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Use memory storage so we can pipe the buffer through sharp before writing.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// Downscale and persist a single uploaded file. Preserves aspect ratio and
// never enlarges smaller images. Animated GIFs are passed through unchanged.
async function processAndSave(file) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = uniqueSuffix + ext;
  const outPath = path.join(uploadDir, filename);

  if (ext === '.gif') {
    // sharp can handle animated GIFs but losing frames is worse than a large
    // GIF for our use case; write as-is.
    fs.writeFileSync(outPath, file.buffer);
  } else {
    await sharp(file.buffer)
      .rotate() // honor EXIF orientation so resize sees the visible dimensions
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFile(outPath);
  }

  const stat = fs.statSync(outPath);
  return { filename, size: stat.size };
}

// POST / - upload single image
router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });
  try {
    const { filename, size } = await processAndSave(req.file);
    res.json({ url: `/uploads/${filename}`, filename, size });
  } catch (err) {
    console.error('Image processing failed:', err);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// POST /multiple - upload multiple images
router.post('/multiple', upload.array('images', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images provided' });
  try {
    const files = await Promise.all(
      req.files.map(async (f) => {
        const { filename, size } = await processAndSave(f);
        return { url: `/uploads/${filename}`, filename, size };
      })
    );
    res.json({ files });
  } catch (err) {
    console.error('Image processing failed:', err);
    res.status(500).json({ error: 'Failed to process images' });
  }
});

module.exports = router;
