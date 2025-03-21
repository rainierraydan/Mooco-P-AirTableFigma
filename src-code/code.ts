import { getStore, setStore, listenTS, dispatchTS } from "./utils/code-utils";

// Interfaces and Types
interface ImageField {
  fieldName: string;
  imageUrl: string;
}

interface TransformedFields {
  [key: string]: any;
  imageFields?: ImageField[];
  textLayers?: Array<{
    name: string;
    id: string;
    updated: boolean;
  }>;
}
// Add to Interfaces section at the top
interface AirtableImageAttachment {
  url: string;
  filename: string;
  size: number;
  type: string;
}

interface ImageData {
  fieldName: string;
  attachment: AirtableImageAttachment;
}

// Add after findImageFields function
function extractImageUrl(field: any): ImageData | null {
  if (Array.isArray(field) && field.length > 0 && typeof field[0] === 'object') {
    const attachment = field[0];
    if ('url' in attachment && 'filename' in attachment) {
      console.log(`🔗 Found image URL: ${attachment.url}`);
      return {
        fieldName: attachment.filename,
        attachment: attachment as AirtableImageAttachment
      };
    }
  }
  return null;
}

// Modify inside findImageFields function
function findImageFields(fields: any): ImageField[] {
  const imageFields: ImageField[] = [];
  
  Object.entries(fields).forEach(([key, value]) => {
    const imageData = extractImageUrl(value);
    if (imageData) {
      console.log(`🖼️ Found image field "${key}":`, imageData);
      imageFields.push({
        fieldName: key,
        imageUrl: imageData.attachment.url
      });
    }
  });

  return imageFields;
}

figma.showUI(__html__, {
  themeColors: true,
  width: 400,
  height: 200,
});

console.log('🟢 Mooco Plugin is online');

async function handlePageCreation(filename: string): Promise<PageNode> {
  const existingPage = figma.root.children.find(page => page.name === filename);
  if (existingPage) {
    console.log(`📄 Found existing page: ${filename}`);
    return existingPage;
  }

  const templatePage = figma.root.children.find(page => page.name === "Main Template");
  if (!templatePage) {
    throw new Error("❌ Main Template page not found");
  }

  const newPage = templatePage.clone();
  newPage.name = filename;
  console.log(`✨ Created new page from template: ${filename}`);
  
  return newPage;
}

async function findFrameByVersion(page: PageNode, version: string): Promise<FrameNode | null> {
  const frame = page.findOne(node => node.type === "FRAME" && node.name === version) as FrameNode;
  if (frame) {
    console.log(`🎯 Found frame: ${version}`);
    return frame;
  }
  console.warn(`⚠️ Frame not found: ${version}`);
  return null;
}

function findTextLayers(node: SceneNode): TextNode[] {
  let textLayers: TextNode[] = [];

  if (node.type === "TEXT") {
    textLayers.push(node as TextNode);
  }

  if ('children' in node) {
    for (const child of node.children) {
      textLayers = textLayers.concat(findTextLayers(child));
    }
  }

  return textLayers;
}








figma.ui.onmessage = async (msg) => {
  if (msg.type === 'save-credentials') {
    try {
      await figma.clientStorage.setAsync('airtableToken', msg.credentials.airtableToken);
      await figma.clientStorage.setAsync('airtableBaseId', msg.credentials.airtableBaseId);
      figma.ui.postMessage({ type: 'credentials-saved' });
    } catch (error) {
      figma.ui.postMessage({ type: 'error', message: error.message });
    }
  } else if (msg.type === 'get-credentials') {
    try {
      const token = await figma.clientStorage.getAsync('airtableToken');
      const baseId = await figma.clientStorage.getAsync('airtableBaseId');
      figma.ui.postMessage({ 
        type: 'credentials-loaded',
        credentials: { airtableToken: token, airtableBaseId: baseId }
      });
    } catch (error) {
      figma.ui.postMessage({ type: 'error', message: error.message });
    }
  } else if (msg.type === 'fetch-airtable-data') {
    try {
      const token = await figma.clientStorage.getAsync('airtableToken');
      const baseId = await figma.clientStorage.getAsync('airtableBaseId');
      
      const response = await fetch(`https://api.airtable.com/v0/${baseId}/001`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status}`);
      }

      const data = await response.json();
      const processedRecords = await Promise.all(data.records.map(async record => {
        const transformedFields = {};
        
        // Inside processedRecords map function, add after transformedFields creation:
        Object.entries(record.fields).forEach(([key, value]) => {
          const transformedKey = key.toLowerCase().replace(/\s+/g, '');
          transformedFields[transformedKey] = value ?? ''; // Asigna string vacío si el valor es null o undefined
        });
        
        const imageFields = findImageFields(transformedFields);
        if (imageFields.length > 0) {
          console.log(`📸 Found ${imageFields.length} image fields in record:`, imageFields);
          transformedFields['imageFields'] = imageFields;
        }
        
        if (transformedFields['filename'] && transformedFields['version']) {
        
          const page = await handlePageCreation(transformedFields['filename']);
          const frameNode = await findFrameByVersion(page, transformedFields['version']);
          if (frameNode) {
            const textLayers = findTextLayers(frameNode);
            console.log('🔍 Found text layers:', textLayers.map(layer => layer.name));
            
            for (const layer of textLayers) {
              const layerName = layer.name.toLowerCase().replace(/\s+/g, '');
              if (transformedFields[layerName] !== undefined) {
                console.log(`✏️ Updating layer "${layer.name}" with value:`, transformedFields[layerName]);
                await figma.loadFontAsync({ family: layer.fontName["family"], style: layer.fontName["style"] });
                const formattedText = transformedFields[layerName].toString()
                  .replace(/\\n/g, '\n')
                  .replace(/\\r\\n/g, '\n')
                  .replace(/\\r/g, '\n');
                layer.characters = formattedText;
              } else {
                // Si la key no existe en transformedFields, asigna string vacío
                layer.characters = '';
                layer.visible = false;
              }
            }
            // Add after text layers processing
            if (transformedFields['imageFields'] && transformedFields['imageFields'].length > 0) {
              console.log(`🎨 Processing images for frame: ${frameNode.name}`);
              
              for (const imageField of transformedFields['imageFields']) {
                try {
                  console.log(`🔍 Looking for image layer "${imageField.fieldName}"`);
                  const existingLayer = frameNode.findOne(node => 
                    node.type === "RECTANGLE" && 
                    node.name.toLowerCase().replace(/\s+/g, '') === imageField.fieldName.toLowerCase().replace(/\s+/g, '')
                  ) as RectangleNode;
                  
                  if (existingLayer) {
                    console.log(`📥 Updating image in layer "${existingLayer.name}" with URL: ${imageField.imageUrl}`);
                    const response = await fetch(imageField.imageUrl);
                    const imageBuffer = await response.arrayBuffer();
                    const image = figma.createImage(new Uint8Array(imageBuffer));
                    
                    existingLayer.fills = [{
                      type: 'IMAGE',
                      scaleMode: 'FILL',
                      imageHash: image.hash
                    }];
                    
                    console.log(`✅ Image "${imageField.fieldName}" updated successfully`);
                  } else {
                    console.log(`⚠️ No matching image layer found for "${imageField.fieldName}"`);
                  }
                } catch (error) {
                  console.error(`❌ Failed to process image "${imageField.fieldName}":`, error);
                }
              }
            }
            transformedFields['textLayers'] = textLayers.map(layer => ({
              name: layer.name,
              id: layer.id,
              updated: transformedFields[layer.name.toLowerCase().replace(/\s+/g, '')] !== undefined
            }));
          }
        }





        return transformedFields;
      }));

      console.log('All records processed:', processedRecords);
      figma.ui.postMessage({ type: 'airtable-data', data: processedRecords });


    } catch (error) {
      console.error('Error:', error);
      figma.ui.postMessage({ type: 'error', message: error.message });
    }
  }
};
listenTS("hello", (res) => {
  console.log("code.ts");
  alert(`Hello ${res.string}`);
  dispatchTS("helloCallback", { result: true });
});












