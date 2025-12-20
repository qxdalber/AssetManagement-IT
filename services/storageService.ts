
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Asset, AssetStatus } from '../types';

// Use import.meta.env with VITE_ prefix (standard for Vite applications)
// Fix: Use casting for import.meta to avoid TS property 'env' errors
const REGION = (import.meta as any).env.VITE_ASSET_S3_REGION || 'us-east-1';
const BUCKET = (import.meta as any).env.VITE_ASSET_S3_BUCKET;
const ACCESS_KEY = (import.meta as any).env.VITE_ASSET_S3_ACCESS_KEY;
const SECRET_KEY = (import.meta as any).env.VITE_ASSET_S3_SECRET_KEY;

// Folder prefix for asset files
const ASSET_PREFIX = 'assets/';

// Lazy initialization of the client
let client: S3Client | null = null;

const getClient = () => {
  if (!client) {
    if (!ACCESS_KEY || !SECRET_KEY) {
      console.error("Missing S3 Credentials. Expected VITE_ASSET_S3_ACCESS_KEY and VITE_ASSET_S3_SECRET_KEY");
      throw new Error("S3 Credentials are not configured in environment variables.");
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

// Helper to sanitize Site ID for filenames
const getSiteFileKey = (siteId: string) => {
  const sanitized = siteId.trim().replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${ASSET_PREFIX}site_${sanitized}.json`;
};

// Helper to fetch data from a specific key
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
        status: item.status || item.rmaStatus || AssetStatus.Normal,
      }));
    }
    return [];
  } catch (e: any) {
    if (e.name === 'NoSuchKey' || e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
      return [];
    }
    console.error(`Failed to load assets from ${key}:`, e);
    return [];
  }
};

export const fetchAssets = async (): Promise<Asset[]> => {
  if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) {
    console.warn("VITE_ASSET_S3 variables not found. S3 storage is disabled.");
    return [];
  }

  try {
    const s3 = getClient();
    
    // 1. List all files in the assets/ folder
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: ASSET_PREFIX,
    });
    
    const listResponse = await s3.send(listCommand);
    const contents = listResponse.Contents || [];

    if (contents.length === 0) {
      return [];
    }

    // 2. Fetch all files in parallel
    const filePromises = contents
      .map(file => file.Key)
      .filter((key): key is string => !!key)
      .map(key => fetchAssetsByKey(key));

    const results = await Promise.all(filePromises);

    // 3. Flatten results into single array
    return results.flat();

  } catch (e: any) {
    console.error('Failed to load asset library from S3:', e);
    throw new Error('Could not connect to S3 Bucket.');
  }
};

export const addAssets = async (newAssets: Asset[]): Promise<void> => {
  if (!BUCKET) throw new Error("S3 Bucket name is missing.");
  const s3 = getClient();

  // Group assets by Site ID to minimize S3 writes
  const assetsBySite = newAssets.reduce((acc, asset) => {
    const key = asset.siteId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(asset);
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

export const deleteAssets = async (assetsToDelete: Asset[]): Promise<void> => {
  if (!BUCKET) throw new Error("S3 Bucket name is missing.");
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
