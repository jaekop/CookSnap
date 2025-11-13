export {};

declare global {
  interface BarcodeDetectorOptions {
    formats?: string[];
  }

  interface BarcodeDetectorResult {
    rawValue?: string;
    format?: string;
    boundingBox?: DOMRectReadOnly;
    cornerPoints?: DOMPoint[];
  }

  interface BarcodeDetector {
    detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>;
  }

  var BarcodeDetector: {
    readonly prototype: BarcodeDetector;
    new (options?: BarcodeDetectorOptions): BarcodeDetector;
  };

  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }

  interface HTMLVideoElement {
    requestVideoFrameCallback?(callback: (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => void): number;
  }

  interface VideoFrameCallbackMetadata {
    presentationTime: DOMHighResTimeStamp;
    expectedDisplayTime: DOMHighResTimeStamp;
    width: number;
    height: number;
    mediaTime: number;
    captureTime?: DOMHighResTimeStamp;
    rtpTimestamp?: number;
  }
}
