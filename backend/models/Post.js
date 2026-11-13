import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Post author is required'],
      index: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: [2000, 'Content cannot exceed 2000 characters'],
      default: '',
      validate: {
        validator: function (val) {
          const hasContent = typeof val === 'string' && val.trim().length > 0;
          const hasImage = typeof this.image === 'string' && this.image.trim().length > 0;
          return hasContent || hasImage;
        },
        message: 'A post must contain either text content or an image',
      },
    },
    image: {
      type: String,
      default: '',
      trim: true,
    },
    imagePublicId: {
      type: String,
      default: '',
      trim: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
  },
  {
    timestamps: true,
  }
);

postSchema.pre('validate', function () {
  const hasContent = typeof this.content === 'string' && this.content.trim().length > 0;
  const hasImage = typeof this.image === 'string' && this.image.trim().length > 0;

  if (!hasContent && !hasImage) {
    this.invalidate('content', 'A post must contain either text content or an image');
  }
});

const Post = mongoose.model('Post', postSchema);

export default Post;

