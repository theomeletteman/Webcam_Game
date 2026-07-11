export class WebcamStream {
  readonly video: HTMLVideoElement;
  private readonly stream: MediaStream;

  private constructor(video: HTMLVideoElement, stream: MediaStream) {
    this.video = video;
    this.stream = stream;
  }

  static async start(): Promise<WebcamStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        void video.play();
        resolve();
      };
    });

    return new WebcamStream(video, stream);
  }

  stop(): void {
    this.stream.getTracks().forEach((track) => track.stop());
  }
}
