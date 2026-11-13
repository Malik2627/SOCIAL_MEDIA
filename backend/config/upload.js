import multer from 'multer';

export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function getFileExtension(filename) {
  if (typeof filename !== 'string') {
    return '';
  }

  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : '';
}

function createUploadError(message, statusCode = 400, code = 'INVALID_FILE_TYPE') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

/**
 * Validate uploaded image MIME types and extensions before buffering in memory.
 */
export function imageFileFilter(_req, file, cb) {
  const mimeType = typeof file?.mimetype === 'string' ? file.mimetype.toLowerCase() : '';
  const extension = getFileExtension(file?.originalname);

  const hasValidMime = ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
  const hasValidExtension = !extension || ALLOWED_IMAGE_EXTENSIONS.has(extension);

  if (!hasValidMime || !hasValidExtension) {
    cb(
      createUploadError(
        'Unsupported image type. Only JPEG, JPG, PNG, and WEBP images are allowed.'
      ),
      false
    );
    return;
  }

  cb(null, true);
}

const storage = multer.memoryStorage();

/**
 * Memory-based Multer instance configured for temporary single-image uploads up to 5 MB.
 */
export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_FILE_SIZE,
    files: 1,
  },
  fileFilter: imageFileFilter,
});

const uploadAvatarFields = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'profilePicture', maxCount: 1 },
]);

/**
 * Express middleware that handles single profile avatar upload with clean 400 error responses
 * for oversized files, invalid MIME types, and unsupported extensions.
 * Populates req.file from 'avatar', 'image', or 'profilePicture' fields.
 */
export function handleAvatarUpload(req, res, next) {
  uploadAvatarFields(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds the 5 MB limit',
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
        });
      }

      if (err.statusCode || err.code === 'INVALID_FILE_TYPE') {
        return res.status(err.statusCode || 400).json({
          success: false,
          message: err.message || 'Invalid file type',
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }

    if (req.files) {
      req.file =
        req.files.avatar?.[0] ||
        req.files.image?.[0] ||
        req.files.profilePicture?.[0] ||
        null;
    }

    return next();
  });
}

const uploadPostImageFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'media', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

/**
 * Express middleware that handles single post image upload with clean 400 error responses
 * for oversized files, invalid MIME types, and unsupported extensions.
 * Populates req.file from 'image', 'media', or 'file' fields.
 */
export function handlePostImageUpload(req, res, next) {
  uploadPostImageFields(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds the 5 MB limit',
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
        });
      }

      if (err.statusCode || err.code === 'INVALID_FILE_TYPE') {
        return res.status(err.statusCode || 400).json({
          success: false,
          message: err.message || 'Invalid file type',
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }

    if (req.files) {
      req.file =
        req.files.image?.[0] ||
        req.files.media?.[0] ||
        req.files.file?.[0] ||
        null;
    }

    return next();
  });
}

export default upload;

