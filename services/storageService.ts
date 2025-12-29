import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  PutCommand, 
  BatchWriteCommand
} from "@aws-sdk/lib-dynamodb";
import { Asset, AssetStatus, HistoryEntry } from '../types';

const getEnv = (key: string): string | undefined => {
  return (import.meta as any).env?.[key];
};

const REGION = getEnv('VITE_ASSET_AWS_REGION') || 'us-east-1';
const TABLE_NAME = getEnv('VITE_ASSET_DYNAMO_TABLE') || 'Assets';
const ACCESS_KEY = getEnv('VITE_ASSET_ACCESS_KEY');
const SECRET_KEY = getEnv('VITE_ASSET_SECRET_KEY');

let docClient: DynamoDBDocumentClient | null = null;

const getDocClient = () => {
  if (!docClient) {
    if (!ACCESS_KEY || !SECRET_KEY) {
      throw new Error("AWS Credentials (Access/Secret Key) are missing from configuration.");
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
        convertEmptyValues: true // Ensure empty strings don't crash key attributes
      }
    });
  }
  return docClient;
};

export const fetchAssets = async (): Promise<Asset[]> => {
  try {
    const client = getDocClient();
    const command = new ScanCommand({
      TableName: TABLE_NAME,
    });
    
    const response = await client.send(command);
    const items = response.Items || [];
    
    return items.map((item: any) => ({
      ...item,
      country: item.country || '',
      status: item.status || AssetStatus.Normal,
      history: item.history || []
    })) as Asset[];
  } catch (e: any) {
    if (e.name === 'AccessDeniedException') {
      throw new Error("IAM Access Denied: Check policy for 'dynamodb:Scan' on " + TABLE_NAME);
    }
    console.error('DynamoDB Fetch Error:', e);
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
            // Ensure no empty strings in critical fields
            id: asset.id || Math.random().toString(36).substr(2, 9),
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
        RequestItems: {
          [TABLE_NAME]: putRequests
        }
      });
      return client.send(command);
    });

    await Promise.all(writePromises);
  } catch (e: any) {
    console.error('Bulk Upload Error:', e);
    if (e.message.includes('key element')) {
      throw new Error("DynamoDB Schema Mismatch: Ensure your table Partition Key is named exactly 'id' (case-sensitive).");
    }
    throw e;
  }
};

export const updateAsset = async (assetId: string, siteId: string, updates: Partial<Asset>): Promise<void> => {
  try {
    const client = getDocClient();
    const currentAssets = await fetchAssets(); 
    const asset = currentAssets.find(a => a.id === assetId);
    
    if (!asset) throw new Error("Asset not found for update.");

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

    const updatedAsset = { ...asset, ...updates, history: newHistory };

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: updatedAsset
    });

    await client.send(command);
  } catch (e: any) {
    console.error('Update Error:', e);
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
          // IMPORTANT: Only provide the actual Partition Key defined in AWS. 
          // If your table has a Sort Key, you must add it here too.
          Key: {
            id: asset.id
          }
        }
      }));

      const command = new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: deleteRequests
        }
      });
      return client.send(command);
    });

    await Promise.all(deletePromises);
  } catch (e: any) {
    console.error('Delete Error:', e);
    if (e.message.includes('key element')) {
       throw new Error("Delete Failed: The identifier provided doesn't match your DynamoDB Table Key schema.");
    }
    throw e;
  }
};