declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

interface Window {
  chazzyDebug?: {
    injectWidget: () => boolean;
  };
} 