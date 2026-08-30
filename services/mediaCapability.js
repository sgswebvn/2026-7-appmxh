const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');

/**
 * MediaCapability Service (Phase 3D.1)
 * Detects and executes real FFmpeg and FFprobe binaries across environments.
 */
class MediaCapability {
  constructor() {
    this._ffmpegPath = null;
    this._ffprobePath = null;
    this._initPaths();
  }

  _initPaths() {
    // 1. Check project installed @ffmpeg-installer & @ffprobe-installer
    try {
      const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
      if (ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
        this._ffmpegPath = ffmpegInstaller.path;
      }
    } catch (e) {}

    try {
      const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
      if (ffprobeInstaller.path && fs.existsSync(ffprobeInstaller.path)) {
        this._ffprobePath = ffprobeInstaller.path;
      }
    } catch (e) {}

    // 2. Check environment variables
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
      this._ffmpegPath = process.env.FFMPEG_PATH;
    }
    if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
      this._ffprobePath = process.env.FFPROBE_PATH;
    }
  }

  getFfmpegPath() {
    if (this._ffmpegPath && fs.existsSync(this._ffmpegPath)) return this._ffmpegPath;
    return 'ffmpeg'; // fallback to PATH lookup
  }

  getFfprobePath() {
    if (this._ffprobePath && fs.existsSync(this._ffprobePath)) return this._ffprobePath;
    return 'ffprobe'; // fallback to PATH lookup
  }

  async checkMediaCapabilities() {
    const ffmpegPath = this.getFfmpegPath();
    const ffprobePath = this.getFfprobePath();

    const ffmpegOk = await new Promise((resolve) => {
      exec(`"${ffmpegPath}" -version`, (err) => resolve(!err));
    });

    const ffprobeOk = await new Promise((resolve) => {
      exec(`"${ffprobePath}" -version`, (err) => resolve(!err));
    });

    return {
      ffmpegAvailable: ffmpegOk,
      ffprobeAvailable: ffprobeOk,
      ffmpegPath: ffmpegOk ? ffmpegPath : null,
      ffprobePath: ffprobeOk ? ffprobePath : null,
      readyForProduction: ffmpegOk && ffprobeOk
    };
  }

  /**
   * Execute FFmpeg command line
   * @param {string} commandArgs
   * @param {Object} [options]
   * @returns {Promise<{ stdout: string, stderr: string }>}
   */
  execFfmpeg(commandArgs, options = {}) {
    const ffmpegPath = this.getFfmpegPath();
    return new Promise((resolve, reject) => {
      const cmd = `"${ffmpegPath}" ${commandArgs}`;
      exec(cmd, { maxBuffer: 10 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
        if (err) {
          const error = new Error(`FFmpeg Execution Error: ${err.message}\n${stderr || ''}`);
          error.code = 'FFMPEG_EXECUTION_FAILED';
          error.stderr = stderr;
          return reject(error);
        }
        resolve({ stdout, stderr });
      });
    });
  }

  /**
   * Execute FFprobe probe
   * @param {string} commandArgs
   * @param {Object} [options]
   * @returns {Promise<{ stdout: string, stderr: string }>}
   */
  execFfprobe(commandArgs, options = {}) {
    const ffprobePath = this.getFfprobePath();
    return new Promise((resolve, reject) => {
      const cmd = `"${ffprobePath}" ${commandArgs}`;
      exec(cmd, { maxBuffer: 10 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
        if (err) {
          const error = new Error(`FFprobe Execution Error: ${err.message}\n${stderr || ''}`);
          error.code = 'FFPROBE_EXECUTION_FAILED';
          error.stderr = stderr;
          return reject(error);
        }
        resolve({ stdout, stderr });
      });
    });
  }

  /**
   * Check if video file has decodable video/audio frames
   */
  async validateVideoDecodability(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      return { decodable: false, error: 'File does not exist' };
    }

    try {
      // Decode video to null sink: ffmpeg -v error -i <file> -f null -
      const { stderr } = await this.execFfmpeg(`-v error -i "${filePath}" -f null -`);
      if (stderr && stderr.trim().length > 0) {
        return { decodable: false, error: stderr.trim() };
      }
      return { decodable: true };
    } catch (err) {
      return { decodable: false, error: err.message };
    }
  }
}

const defaultMediaCapability = new MediaCapability();

module.exports = {
  MediaCapability,
  mediaCapability: defaultMediaCapability
};
