import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  PutCommand, 
  DeleteCommand,
  BatchWriteCommand,
  GetCommand
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
    let allItems: any[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    do {
      const command: ScanCommand = new ScanCommand({ 
        TableName: TABLE_NAME,
        ExclusiveStartKey: lastEvaluatedKey
      });
      const response = await client.send(command) as any;
      allItems = allItems.concat(response.Items || []);
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems.map((item: any) => ({
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

export const updateAsset = async (serialNumber: string, updates: Partial<Asset>): Promise<Asset> => {
  try {
    const client = getDocClient();
    
    // Use GetCommand for efficiency and consistency
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { serialNumber },
      ConsistentRead: true
    });
    
    const { Item: asset } = await client.send(getCommand);
    
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

    const updatedAsset = { ...asset, ...updates, history: newHistory } as Asset;
    
    // If serial number changed, we need to delete the old one and put the new one
    if (updates.serialNumber && updates.serialNumber !== serialNumber) {
      // Put new first to ensure we don't lose data if delete succeeds but put fails
      await client.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: updatedAsset
      }));
      
      await client.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { serialNumber }
      }));
    } else {
      await client.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: updatedAsset
      }));
    }

    return updatedAsset;
  } catch (e: any) {
    console.error('Update Error:', e);
    throw e;
  }
};

export const bulkUpdateAssets = async (serials: string[], updates: Partial<Asset>): Promise<Asset[]> => {
  try {
    const client = getDocClient();
    const currentAssets = await fetchAssets();
    const targets = currentAssets.filter(a => serials.includes(a.serialNumber));

    const updatedAssets: Asset[] = [];

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

      const updatedAsset = { ...asset, ...updates, history: newHistory } as Asset;
      await client.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: updatedAsset
      }));
      updatedAssets.push(updatedAsset);
    });

    await Promise.all(updatePromises);
    return updatedAssets;
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