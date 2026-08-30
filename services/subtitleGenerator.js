/**
 * SubtitleGenerator (Phase 3D)
 * Generates exact-timing SRT and ASS subtitles styled for 9:16 vertical video safe-areas.
 */
class SubtitleGenerator {
  /**
   * Convert milliseconds to SRT timestamp format (HH:MM:SS,mmm)
   */
  static formatSrtTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = ms % 1000;
    const hrs = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    const millis = m.toString().padStart(3, '0');
    return `${hrs}:${mins}:${secs},${millis}`;
  }

  /**
   * Convert milliseconds to ASS timestamp format (H:MM:SS.cc)
   */
  static formatAssTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}.${cs}`;
  }

  /**
   * Generate Subtitle Tracks (SRT, ASS, JSON)
   * @param {Array<Object>} audioTimeline - Audio timeline from Phase 3C
   * @returns {{ srt: string, ass: string, events: Array<Object> }}
   */
  static generateSubtitles(audioTimeline = []) {
    if (!audioTimeline || audioTimeline.length === 0) {
      return { srt: '', ass: '', events: [] };
    }

    let srt = '';
    let events = [];

    // Header for 9:16 Vertical Substation Alpha (ASS)
    let ass = `[Script Info]
Title: AI Video Factory Vertical Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: SpeakerDefault,Arial,54,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,3,2,60,60,340,1
Style: SpeakerMale,Arial,54,&H0000FFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,3,2,60,60,340,1
Style: SpeakerFemale,Arial,54,&H00FF80FF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,3,2,60,60,340,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    audioTimeline.forEach((item, index) => {
      const idx = index + 1;
      const startMs = item.startMs || 0;
      const endMs = item.endMs || (startMs + (item.durationMs || 2000));
      const speakerName = item.speakerName || 'Speaker';
      const text = item.text || '';
      const voiceId = item.voiceId || '';

      // Style determination
      let styleName = 'SpeakerDefault';
      if (voiceId.includes('male') || voiceId.includes('Nam')) {
        styleName = 'SpeakerMale';
      } else if (voiceId.includes('female') || voiceId.includes('Hoai') || voiceId.includes('Jenny')) {
        styleName = 'SpeakerFemale';
      }

      // SRT block
      srt += `${idx}\n`;
      srt += `${this.formatSrtTime(startMs)} --> ${this.formatSrtTime(endMs)}\n`;
      srt += `${speakerName}: ${text}\n\n`;

      // ASS line
      ass += `Dialogue: 0,${this.formatAssTime(startMs)},${this.formatAssTime(endMs)},${styleName},${speakerName},0,0,0,,{\\b1}${speakerName}:{\\b0} ${text}\n`;

      // JSON event
      events.push({
        index: idx,
        dialogueId: item.dialogueId,
        speakerId: item.speakerId,
        speakerName,
        text,
        startMs,
        endMs,
        durationMs: endMs - startMs,
        startTimeFormatted: this.formatSrtTime(startMs),
        endTimeFormatted: this.formatSrtTime(endMs)
      });
    });

    return {
      srt: srt.trim(),
      ass: ass.trim(),
      events
    };
  }
}

module.exports = SubtitleGenerator;
