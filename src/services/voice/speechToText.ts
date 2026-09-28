type CommandCallback = (transcript: string, arg?: string) => void;

// Minimal typing for the (still vendor-prefixed) Web Speech recognition API.
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface RecognitionErrorEvent {
  error: string;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionConstructor = new () => Recognition;

function getRecognitionConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export class VoiceAssistantEngine {
  static isSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(getRecognitionConstructor());
  }

  private recognition: Recognition | null = null;
  private shouldListen = false;
  private commands: [RegExp, CommandCallback][] = [];

  constructor(
    lang = 'en-US',
    private readonly onError?: (error: string) => void,
    private readonly onUnrecognized?: (transcript: string) => void,
  ) {
    const SpeechRecognition = getRecognitionConstructor();
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = lang;

    this.recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript.trim().toLowerCase();
      this.processTranscript(transcript);
    };

    this.recognition.onerror = (event) => {
      // "no-speech" and "aborted" are normal during silence or restarts.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') this.shouldListen = false;
      if (event.error !== 'no-speech' && event.error !== 'aborted') this.onError?.(event.error);
    };

    // Browsers end recognition after a period of silence; keep listening until stopped.
    this.recognition.onend = () => {
      if (this.shouldListen) {
        try {
          this.recognition?.start();
        } catch {
          // Already started.
        }
      }
    };
  }

  public registerCommand(pattern: RegExp, callback: CommandCallback) {
    this.commands.push([pattern, callback]);
  }

  public start() {
    if (!this.recognition || this.shouldListen) return;
    this.shouldListen = true;
    try {
      this.recognition.start();
    } catch (e) {
      console.error(e);
    }
  }

  public stop() {
    this.shouldListen = false;
    this.recognition?.stop();
  }

  private processTranscript(transcript: string) {
    for (const [pattern, callback] of this.commands) {
      const match = transcript.match(pattern);
      if (match) {
        callback(transcript, match[1]);
        return;
      }
    }
    this.onUnrecognized?.(transcript);
  }
}
