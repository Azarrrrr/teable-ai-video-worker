# Teable Video Worker

Video jobs execute remotely via workflow_dispatch. Credentials are GitHub Actions Secrets. Final videos are stored in Teable only; Cloudinary stores JPEG cover images only. No media artifacts are published in this repository.

Short videos use Reap captions. Longer videos use Reap AI clipping. FFmpeg normalizes aspect ratio while preserving text; HyperFrames renders an animated progress overlay. Existing Reap project IDs are reused on retries. AI music generation and creative template planning are not implemented.
