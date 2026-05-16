export interface FileWithPreview extends File { 
  preview: string; 
  id: string; 
}

export interface ShareResult { 
  url: string; 
  expiresAt: string; 
  originalUrl?: string; 
  isLinkMode?: boolean;
}

export interface ExpiryOption {
  label: string;
  hours: number;
}

export const EXPIRY_OPTIONS: ExpiryOption[] = [
  { label: '1 hr',   hours: 1   },
  { label: '6 hrs',  hours: 6   },
  { label: '12 hrs', hours: 12  },
  { label: '24 hrs', hours: 24  },
  { label: '7 days', hours: 168 },
];
