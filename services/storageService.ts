import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Asset, AssetStatus } from '../types';

// AWS Configuration
const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.AWS_BUCKET_NAME;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// Folder prefix for asset files
const ASSET_PREFIX = 'assets/';

// Lazy initialization of the client
let client: S3Client | null = null;

const getClient = () => {
  if (!client) {
    if (!ACCESS_KEY || !SECRET_KEY) {
      throw new Error("AWS Credentials are missing");
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
    console.warn("AWS Credentials not configured. Returning empty list.");
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
    throw new Error('Could not load data from S3');
  }
};

export const addAssets = async (newAssets: Asset[]): Promise<void> => {
  if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error("AWS Credentials not configured");
  }
  const s3 = getClient();

  // 1. Group assets by Site ID
  const assetsBySite = newAssets.reduce((acc, asset) => {
    const key = asset.siteId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(asset);
    return acc;
  }, {} as Record<string, Asset[]>);

  // 2. Process each site independently (Read -> Append -> Write)
  const updates = Object.entries(assetsBySite).map(async ([siteId, assetsToAdd]) => {
    const fileKey = getSiteFileKey(siteId);
    
    // Fetch existing assets for this site
    const existingAssets = await fetchAssetsByKey(fileKey);
    
    // Append new assets
    const updatedAssets = [...existingAssets, ...assetsToAdd];
    
    // Save back to S3
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
  if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error("AWS Credentials not configured");
  }
  const s3 = getClient();

  // 1. Group by Site ID to know which files to touch
  const assetsBySite = assetsToDelete.reduce((acc, asset) => {
    const key = asset.siteId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(asset.id);
    return acc;
  }, {} as Record<string, string[]>); // Map SiteID -> Array of AssetIDs

  // 2. Process each site
  const updates = Object.entries(assetsBySite).map(async ([siteId, idsToDelete]) => {
    const fileKey = getSiteFileKey(siteId);
    
    const existingAssets = await fetchAssetsByKey(fileKey);
    
    // Filter out deleted items
    const updatedAssets = existingAssets.filter(a => !idsToDelete.includes(a.id));
    
    // Save back (even if empty, to maintain file existence, or we could delete the file)
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