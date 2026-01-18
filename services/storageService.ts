import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  PutCommand, 
  DeleteCommand,
  BatchWriteCommand
} from "@aws-sdk/lib-dynamodb";
import { Asset, AssetStatus, HistoryEntry } from '../types.ts';

const getEnv = (key: string): string | undefined => {
  const metaEnv = (import.meta as any).env || {};
  return metaEnv[key] || process.env[key];
};

const REGION = getEnv('VITE_ASSET_AWS_REGION') || 'us-east-1';
const TABLE_NAME = getEnv('VITE_ASSET_DYNAMO_TABLE') || 'Assets';
const ACCESS_KEY = getEnv('VITE_ASSET_ACCESS_KEY');
const SECRET_KEY = getEnv('VITE_ASSET_SECRET_KEY');

let docClient: DynamoDBDocumentClient | null = null;

const getDocClient = () => {
  if (!docClient) {
    if (!ACCESS_KEY || !SECRET_KEY) {
      throw new Error("AWS Credentials missing. Check environment variables.");
    }
    const client = new DynamoDBClient({
      region: REGION,
      credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
      },
    });
    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true
      }
    });
  }
  return docClient;
};

export const fetchAssets = async (): Promise<Asset[]> => {
  try {
    const client = getDocClient();
    const command = new ScanCommand({ TableName: TABLE_NAME });
    const response = await client.send(command);
    return (response.Items || []).map((item: any) => ({
      ...item,
      status: item.status || AssetStatus.Normal,
      history: item.history || []
    })) as Asset[];
  } catch (e: any) {
    console.error('Fetch Error:', e);
    throw e;
  }
};

export const addAssets = async (newAssets: Asset[]): Promise<void> => {
  try {
    const client = getDocClient();
    const batches: Asset[][] = [];
    for (let i = 0; i < newAssets.length; i += 25) {
      batches.push(newAssets.slice(i, i + 25));
    }

    const writePromises = batches.map(async (batch) => {
      const putRequests = batch.map(asset => ({
        PutRequest: {
          Item: {
            ...asset,
            history: asset.history || [{
              timestamp: Date.now(),
              field: 'System',
              oldValue: null,
              newValue: 'Initial Asset Registration'
            }]
          }
        }
      }));

      const command = new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: putRequests }
      });
      return client.send(command);
    });

    await Promise.all(writePromises);
  } catch (e: any) {
    console.error('Bulk Upload Error:', e);
    throw e;
  }
};

export const updateAsset = async (serialNumber: string, updates: Partial<Asset>): Promise<void> => {
  try {
    const client = getDocClient();
    const currentAssets = await fetchAssets(); 
    const asset = currentAssets.find(a => a.serialNumber === serialNumber);
    
    if (!asset) throw new Error("Asset not found.");

    const newHistory: HistoryEntry[] = [...(asset.history || [])];
    Object.entries(updates).forEach(([key, value]) => {
      const field = key as keyof Asset;
      if (asset[field] !== value && !['history', 'createdAt'].includes(key)) {
        newHistory.push({
          timestamp: Date.now(),
          field: key === 'siteID' ? 'Site Transfer' : key,
          oldValue: asset[field],
          newValue: value
        });
      }
    });

    const updatedAsset = { ...asset, ...updates, history: newHistory };
    
    if (updates.serialNumber && updates.serialNumber !== serialNumber) {
      await client.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { serialNumber }
      }));
    }

    await client.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: updatedAsset
    }));
  } catch (e: any) {
    console.error('Update Error:', e);
    throw e;
  }
};

export const bulkUpdateAssets = async (serials: string[], updates: Partial<Asset>): Promise<void> => {
  try {
    const client = getDocClient();
    const currentAssets = await fetchAssets();
    const targets = currentAssets.filter(a => serials.includes(a.serialNumber));

    const updatePromises = targets.map(async (asset) => {
      const newHistory: HistoryEntry[] = [...(asset.history || [])];
      
      Object.entries(updates).forEach(([key, value]) => {
        if (asset[key as keyof Asset] !== value && !['history', 'createdAt'].includes(key)) {
          newHistory.push({
            timestamp: Date.now(),
            field: key === 'siteID' ? 'Site Transfer' : key,
            oldValue: asset[key as keyof Asset],
            newValue: value
          });
        }
      });

      const updatedAsset = { ...asset, ...updates, history: newHistory };
      return client.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: updatedAsset
      }));
    });

    await Promise.all(updatePromises);
  } catch (e: any) {
    console.error('Bulk Update Error:', e);
    throw e;
  }
};

export const deleteAssets = async (assetsToDelete: Asset[]): Promise<void> => {
  try {
    const client = getDocClient();
    const batches: Asset[][] = [];
    for (let i = 0; i < assetsToDelete.length; i += 25) {
      batches.push(assetsToDelete.slice(i, i + 25));
    }

    const deletePromises = batches.map(async (batch) => {
      const deleteRequests = batch.map(asset => ({
        DeleteRequest: {
          Key: { serialNumber: asset.serialNumber }
        }
      }));
      const command = new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: deleteRequests }
      });
      return client.send(command);
    });

    await Promise.all(deletePromises);
  } catch (e: any) {
    console.error('Delete Error:', e);
    throw e;
  }
};