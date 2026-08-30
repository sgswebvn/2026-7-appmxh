const BaseMotionProvider = require('./baseMotionProvider');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { mediaCapability } = require('../mediaCapability');

/**
 * Ken Burns 60FPS Cinematic Camera Motion Provider (Phase 3D.1)
 * Generates real playable H.264 video with smooth zoom, pan, tilt and subtle breathing camera motion.
 */
class KenBurnsMotionProvider extends BaseMotionProvider {
  constructor(config = {}) {
    super(config);
    this.id = 'ken-burns-motion';
    this.name = 'Ken Burns 60FPS Camera Motion Engine';
    this.mediaCapability = config.mediaCapability || mediaCapability;
  }

  async checkFFmpeg() {
    const caps = await this.mediaCapability.checkMediaCapabilities();
    return caps.ffmpegAvailable;
  }

  async generateMotion(options = {}) {
    const { imagePath, cameraMotion = 'push_in', durationMs = 3000, shotType = 'two-shot' } = options;
    const durationSec = (durationMs / 1000).toFixed(2);

    if (!imagePath || !fs.existsSync(imagePath)) {
      return {
        success: false,
        provider: this.id,
        error: { code: 'MISSING_SOURCE_IMAGE', message: 'Không tìm thấy file ảnh nguồn trên đĩa.' }
      };
    }

    const hasFFmpeg = await this.checkFFmpeg();
    if (!hasFFmpeg) {
      return {
        success: false,
        provider: this.id,
        error: {
          code: 'FFMPEG_NOT_AVAILABLE',
          message: 'Hệ thống yêu cầu cài đặt binary FFmpeg để render video thực tế.'
        }
      };
    }

    const outDir = path.join(process.cwd(), 'public', 'uploads', 'video-assets');
    fs.mkdirSync(outDir, { recursive: true });
    const outFileName = `motion_${cameraMotion}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp4`;
    const outFilePath = path.join(outDir, outFileName);

    try {
      const totalFrames = Math.max(15, Math.round(durationSec * 30));
      // Zoompan Filter presets at 1080x1920 (9:16)
      let zoomPanFilter = `zoompan=z='min(zoom+0.0015,1.15)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;

      if (cameraMotion === 'pull_out') {
        zoomPanFilter = `zoompan=z='if(lte(zoom,1.0),1.15,max(1.001,zoom-0.0015))':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
      } else if (cameraMotion === 'pan_left') {
        zoomPanFilter = `zoompan=z=1.12:x='if(lte(on,1),(iw-iw/zoom)/2,max(0,x-0.8))':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1080x1920:fps=30`;
      } else if (cameraMotion === 'pan_right') {
        zoomPanFilter = `zoompan=z=1.12:x='if(lte(on,1),0,min(iw-iw/zoom,x+0.8))':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1080x1920:fps=30`;
      } else if (cameraMotion === 'tilt_up') {
        zoomPanFilter = `zoompan=z=1.12:x='iw/2-(iw/zoom/2)':y='if(lte(on,1),(ih-ih/zoom)/2,max(0,y-0.8))':d=${totalFrames}:s=1080x1920:fps=30`;
      }

      // Convert path to forward slashes for ffmpeg safety
      const safeImagePath = imagePath.replace(/\\/g, '/');
      const safeOutPath = outFilePath.replace(/\\/g, '/');

      const cmdArgs = `-y -loop 1 -i "${safeImagePath}" -vf "${zoomPanFilter},format=yuv420p" -c:v libx264 -t ${durationSec} -r 30 -pix_fmt yuv420p "${safeOutPath}"`;
      await this.mediaCapability.execFfmpeg(cmdArgs);

      if (!fs.existsSync(outFilePath) || fs.statSync(outFilePath).size < 1000) {
        throw new Error('Tệp video đầu ra từ FFmpeg không hợp lệ hoặc quá nhỏ.');
      }

      const videoBuffer = fs.readFileSync(outFilePath);

      return {
        success: true,
        videoBuffer,
        videoPath: outFilePath,
        videoUrl: `/uploads/video-assets/${outFileName}`,
        durationMs,
        cameraMotion,
        width: 1080,
        height: 1920,
        fps: 30,
        codec: 'h264',
        provider: this.id
      };
    } catch (err) {
      return {
        success: false,
        provider: this.id,
        error: {
          code: 'MOTION_RENDER_FAILED',
          message: err.message || 'Lỗi xử lý chuyển động camera qua FFmpeg.'
        }
      };
    }
  }
}

module.exports = KenBurnsMotionProvider;
