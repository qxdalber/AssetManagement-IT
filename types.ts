export interface Asset {
  id: string;
  model: string;
  serialNumber: string;
  siteId: string;
  comments: string;
  status: AssetStatus;
  createdAt: number;
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
  assets: Omit<Asset, 'id' | 'createdAt'>[];
}