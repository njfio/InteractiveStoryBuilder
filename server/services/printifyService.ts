import sharp from 'sharp';
import { db } from '@db';
import { printifyBlueprints, printifyProducts, printifyImagePlacements } from '@db/schema';
import axios from 'axios';
import { eq } from 'drizzle-orm';

const PRINTIFY_API_URL = 'https://api.printify.com/v1';
const PRINTIFY_API_TOKEN = process.env.PRINTIFY_API_TOKEN;

interface PrintifyError extends Error {
  response?: {
    data?: any;
    status?: number;
  };
}

// Helper function to handle Printify API errors
const handlePrintifyError = (error: PrintifyError): never => {
  if (error.response?.data) {
    throw new Error(`Printify API Error: ${JSON.stringify(error.response.data)}`);
  }
  throw error;
};

export class PrintifyService {
  private async getApiHeaders() {
    return {
      'Authorization': `Bearer ${PRINTIFY_API_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  // Blueprint Management
  async getBlueprints(forceRefresh = false) {
    try {
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cachedBlueprints = await db.query.printifyBlueprints.findMany({
          orderBy: (pb, { desc }) => [desc(pb.lastUpdated)],
        });

        if (cachedBlueprints.length > 0) {
          const cacheAge = Date.now() - cachedBlueprints[0].lastUpdated.getTime();
          // Return cache if less than 24 hours old
          if (cacheAge < 24 * 60 * 60 * 1000) {
            return cachedBlueprints;
          }
        }
      }

      // Fetch fresh data from Printify
      const response = await axios.get(`${PRINTIFY_API_URL}/catalog/blueprints.json`, {
        headers: await this.getApiHeaders(),
      });

      // Update cache
      const blueprints = response.data;
      for (const blueprint of blueprints) {
        await db.insert(printifyBlueprints).values({
          blueprintId: blueprint.id,
          title: blueprint.title,
          description: blueprint.description,
          variants: blueprint.variants,
          printAreas: blueprint.print_areas,
          lastUpdated: new Date(),
        }).onConflictDoUpdate({
          target: printifyBlueprints.blueprintId,
          set: {
            title: blueprint.title,
            description: blueprint.description,
            variants: blueprint.variants,
            printAreas: blueprint.print_areas,
            lastUpdated: new Date(),
          },
        });
      }

      return blueprints;
    } catch (error) {
      handlePrintifyError(error as PrintifyError);
    }
  }

  // Image Upload
  async uploadImage(fileBuffer: Buffer, fileName: string) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer]), fileName);

      const response = await axios.post(
        `${PRINTIFY_API_URL}/uploads/images.json`,
        formData,
        { headers: await this.getApiHeaders() }
      );

      return response.data.id;
    } catch (error) {
      handlePrintifyError(error as PrintifyError);
    }
  }

  // Product Creation
  async createProduct(params: {
    uploadId: string;
    blueprintId: number;
    title: string;
    description?: string;
    placements?: Array<{
      x: number;
      y: number;
      scale: number;
      angle: number;
    }>;
  }) {
    try {
      const { uploadId, blueprintId, title, description, placements } = params;

      const productData = {
        blueprint_id: blueprintId,
        title,
        description,
        print_areas: {
          front: {
            src: uploadId,
            position: placements?.[0] || await this.calculateDefaultPlacement(uploadId),
          },
        },
      };

      const response = await axios.post(
        `${PRINTIFY_API_URL}/shops/{shop_id}/products.json`,
        productData,
        { headers: await this.getApiHeaders() }
      );

      return response.data.id;
    } catch (error) {
      handlePrintifyError(error as PrintifyError);
    }
  }

  // AI-Driven Placement
  async calculateAIPlacement(imageBuffer: Buffer, printAreaWidth: number, printAreaHeight: number) {
    try {
      // Get image dimensions
      const { width, height } = await sharp(imageBuffer).metadata();

      if (!width || !height) {
        throw new Error('Could not determine image dimensions');
      }

      // Calculate aspect ratios
      const designRatio = width / height;
      const productRatio = printAreaWidth / printAreaHeight;

      // Determine scale factor
      let scaleFactor: number;
      if (designRatio > productRatio) {
        scaleFactor = printAreaWidth / width;
      } else {
        scaleFactor = printAreaHeight / height;
      }

      // Convert to Printify scale (assuming 1.0 = 4000 px)
      const maxPixels = Math.max(printAreaWidth, printAreaHeight);
      let scale = scaleFactor / (maxPixels / Math.max(width, height));

      // Ensure scale is within bounds
      if (scale > 1.0) scale = 1.0;

      // Center the image
      return {
        x: 0.5,
        y: 0.5,
        scale,
        angle: 0,
      };
    } catch (error) {
      console.error('Error calculating image placement:', error);
      // Return default centered placement
      return {
        x: 0.5,
        y: 0.5,
        scale: 0.8,
        angle: 0,
      };
    }
  }

  // Product Publishing
  async publishProduct(productId: string) {
    try {
      await axios.post(
        `${PRINTIFY_API_URL}/shops/{shop_id}/products/${productId}/publish.json`,
        {},
        { headers: await this.getApiHeaders() }
      );

      // Update local database
      const product = await db.query.printifyProducts.findFirst({
        where: eq(printifyProducts.productId, productId),
      });

      if (product) {
        await db
          .update(printifyProducts)
          .set({ isPublished: true })
          .where(eq(printifyProducts.id, product.id));
      }
    } catch (error) {
      handlePrintifyError(error as PrintifyError);
    }
  }
}

export const printifyService = new PrintifyService();
