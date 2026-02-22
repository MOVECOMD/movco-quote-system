// GA4 Conversion Tracking Functions
declare global {
  interface Window {
    movcoTrackQuoteStarted?: () => void;
    movcoTrackQuoteCompleted?: (value?: number) => void;
    movcoTrackLeadGenerated?: () => void;
    movcoTrackSignUp?: () => void;
    movcoTrackCTAClick?: (buttonName?: string) => void;
  }
}

export {};
