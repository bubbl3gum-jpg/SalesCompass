import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Object storage client for Replit
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

export class TransferImportStorage {
  private getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error("PRIVATE_OBJECT_DIR not set");
    }
    return dir;
  }

  // Generate presigned URL for direct upload
  async generatePresignedUploadUrl(fileName: string, contentType: string): Promise<{
    uploadId: string;
    presignedUrl: string;
    fileKey: string;
    expiresInSeconds: number;
  }> {
    const uploadId = `imp_${randomUUID().replace(/-/g, '')}`;
    const privateDir = this.getPrivateObjectDir();
    const fileKey = `${privateDir}/transfers/${new Date().toISOString().split('T')[0]}/${uploadId}/${fileName}`;
    
    const { bucketName, objectName } = parseObjectPath(fileKey);
    
    const presignedUrl = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900, // 15 minutes
      contentType
    });

    return {
      uploadId,
      presignedUrl,
      fileKey,
      expiresInSeconds: 900
    };
  }

  // Get file from object storage for processing
  async getImportFile(fileKey: string): Promise<File> {
    const { bucketName, objectName } = parseObjectPath(fileKey);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    const [exists] = await file.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    
    return file;
  }

  // Stream file content for processing
  async streamFileContent(fileKey: string): Promise<NodeJS.ReadableStream> {
    const file = await this.getImportFile(fileKey);
    return file.createReadStream();
  }

  // Get file size
  async getFileSize(fileKey: string): Promise<number> {
    const file = await this.getImportFile(fileKey);
    const [metadata] = await file.getMetadata();
    return parseInt(String(metadata.size || '0'));
  }

  // Generate presigned URL for general object uploads (e.g., Excel/ODS files)
  async getObjectEntityUploadURL(): Promise<string> {
    const uploadId = `upload_${randomUUID().replace(/-/g, '')}`;
    const privateDir = this.getPrivateObjectDir();
    const fileKey = `${privateDir}/uploads/${uploadId}`;
    
    const { bucketName, objectName } = parseObjectPath(fileKey);
    
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900, // 15 minutes
    });
  }

  // Get file content as buffer for processing
  async getFileContent(fileUrl: string): Promise<Buffer> {
    try {
      let objectPath: string;
      
      // Handle both direct paths and URLs
      if (fileUrl.startsWith('https://storage.googleapis.com/')) {
        const url = new URL(fileUrl);
        objectPath = url.pathname;
      } else {
        objectPath = fileUrl;
      }
      
      const { bucketName, objectName } = parseObjectPath(objectPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      
      const [exists] = await file.exists();
      if (!exists) {
        throw new ObjectNotFoundError();
      }
      
      const [content] = await file.download();
      return content;
    } catch (error) {
      console.error('Error downloading file content:', error);
      throw new Error('Failed to download file content');
    }
  }
}

// Helper functions
function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return { bucketName, objectName };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
  contentType
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
  contentType?: string;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    ...(contentType && { content_type: contentType })
  };

  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to sign object URL: ${response.status}`);
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

export const transferImportStorage = new TransferImportStorage();