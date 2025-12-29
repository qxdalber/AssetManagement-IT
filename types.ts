export interface HistoryEntry {
  timestamp: number;
  field: string;
  oldValue: any;
  newValue: any;
}

export interface Asset {
  serialNumber: string; // Primary Key
  model: string;
  siteID: string;
  country: string;
  status: AssetStatus;
  comments?: string;
  createdAt: number;
  history?: HistoryEntry[];
}

export enum AssetStatus {
  Normal = 'Normal',
  RMARequested = 'RMA Requested',
  RMAShipped = 'RMA Shipped',
  RMAEligible = 'RMA Eligible',
  RMANotEligible = 'RMA Not Eligible',
  Deprecated = 'Deprecated',
  Unknown = 'Unknown'
}

export interface ParseResult {
  assets: Omit<Asset, 'createdAt'>[];
}