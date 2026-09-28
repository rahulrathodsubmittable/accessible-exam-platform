type CommandCallback = (command: string, args?: string) => void;

export class VoiceAssistantEngine {
  private recognition: any | null = null;
  private isListening: boolean = false;
  private commands: Map<RegExp, CommandCallback> = new Map();

  constructor(private lang: string = 'en-US') {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = lang;

      this.recognition.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.trim().toLowerCase();
        this.processTranscript(transcript);
      };

      this.recognition.onerror = (err: any) => {
        console.error('Voice Assistant Error:', err);
      };
    }
  }

  public registerCommand(pattern: RegExp, callback: CommandCallback) {
    this.commands.set(pattern, callback);
  }

  public start() {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
      } catch (e) {
        console.error(e);
      }
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  private processTranscript(transcript: string) {
    console.log('Voice Command Received:', transcript);
    for (const [pattern, callback] of this.commands.entries()) {
      const match = transcript.match(pattern);
      if (match) {
        callback(transcript, match[1]);
        return;
      }
    }
  }
}