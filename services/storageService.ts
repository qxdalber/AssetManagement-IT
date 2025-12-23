import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Asset, AssetStatus, HistoryEntry } from '../types';

const getEnv = (key: string): string | undefined => {
  return (import.meta as any).env?.[key];
};

const REGION = getEnv('VITE_ASSET_S3_REGION') || 'us-east-1';
const BUCKET = getEnv('VITE_ASSET_S3_BUCKET');
const ACCESS_KEY = getEnv('VITE_ASSET_S3_ACCESS_KEY');
const SECRET_KEY = getEnv('VITE_ASSET_S3_SECRET_KEY');

const ASSET_PREFIX = 'assets/';

let client: S3Client | null = null;

const getClient = () => {
  if (!client) {
    if (!ACCESS_KEY || !SECRET_KEY) {
      console.error("Missing S3 Credentials.");
      throw new Error("S3 Credentials are not configured.");
    }
    client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
      },
    });
  }
  return client;
};

const getSiteFileKey = (siteId: string) => {
  const sanitized = siteId.trim().replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${ASSET_PREFIX}site_${sanitized}.json`;
};

const fetchAssetsByKey = async (key: string): Promise<Asset[]> => {
  try {
    const s3 = getClient();
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    
    const response = await s3.send(command);
    if (response.Body) {
      const str = await response.Body.transformToString();
      const rawData = JSON.parse(str);
      return rawData.map((item: any) => ({
        ...item,
        country: item.country || '',
        status: item.status || AssetStatus.Normal,
        history: item.history || []
      }));
    }
    return [];
  } catch (e: any) {
    if (e.name === 'NoSuchKey' || e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
      return [];
    }
    return [];
  }
};

export const fetchAssets = async (): Promise<Asset[]> => {
  if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) return [];
  try {
    const s3 = getClient();
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: ASSET_PREFIX,
    });
    const listResponse = await s3.send(listCommand);
    const contents = listResponse.Contents || [];
    if (contents.length === 0) return [];
    const filePromises = contents
      .map(file => file.Key)
      .filter((key): key is string => !!key)
      .map(key => fetchAssetsByKey(key));
    const results = await Promise.all(filePromises);
    return results.flat();
  } catch (e) {
    console.error('S3 Fetch Error:', e);
    throw e;
  }
};

export const addAssets = async (newAssets: Asset[]): Promise<void> => {
  if (!BUCKET) throw new Error("S3 Bucket missing.");
  const s3 = getClient();
  const assetsBySite = newAssets.reduce((acc, asset) => {
    const key = asset.siteId;
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      ...asset,
      history: asset.history || [{
        timestamp: Date.now(),
        field: 'System',
        oldValue: null,
        newValue: 'Initial Asset Registration'
      }]
    });
    return acc;
  }, {} as Record<string, Asset[]>);

  const updates = Object.entries(assetsBySite).map(async ([siteId, assetsToAdd]) => {
    const fileKey = getSiteFileKey(siteId);
    const existingAssets = await fetchAssetsByKey(fileKey);
    const updatedAssets = [...existingAssets, ...assetsToAdd];
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileKey,
      Body: JSON.stringify(updatedAssets),
      ContentType: "application/json",
    });
    return s3.send(putCommand);
  });
  await Promise.all(updates);
};

export const updateAsset = async (assetId: string, siteId: string, updates: Partial<Asset>): Promise<void> => {
  if (!BUCKET) throw new Error("S3 Bucket missing.");
  const s3 = getClient();
  const fileKey = getSiteFileKey(siteId);
  const existingAssets = await fetchAssetsByKey(fileKey);
  const updatedAssets = existingAssets.map(asset => {
    if (asset.id === assetId) {
      const newHistory: HistoryEntry[] = [...(asset.history || [])];
      Object.entries(updates).forEach(([key, value]) => {
        const field = key as keyof Asset;
        if (asset[field] !== value && !['history', 'id', 'createdAt'].includes(key)) {
          newHistory.push({
            timestamp: Date.now(),
            field: key,
            oldValue: asset[field],
            newValue: value
          });
        }
      });
      return { ...asset, ...updates, history: newHistory };
    }
    return asset;
  });
  const putCommand = new PutObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
    Body: JSON.stringify(updatedAssets),
    ContentType: "application/json",
  });
  await s3.send(putCommand);
};

export const deleteAssets = async (assetsToDelete: Asset[]): Promise<void> => {
  if (!BUCKET) throw new Error("S3 Bucket missing.");
  const s3 = getClient();
  const assetsBySite = assetsToDelete.reduce((acc, asset) => {
    const key = asset.siteId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(asset.id);
    return acc;
  }, {} as Record<string, string[]>);
  const updates = Object.entries(assetsBySite).map(async ([siteId, idsToDelete]) => {
    const fileKey = getSiteFileKey(siteId);
    const existingAssets = await fetchAssetsByKey(fileKey);
    const updatedAssets = existingAssets.filter(a => !idsToDelete.includes(a.id));
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileKey,
      Body: JSON.stringify(updatedAssets),
      ContentType: "application/json",
    });
    return s3.send(putCommand);
  });
  await Promise.all(updates);
};