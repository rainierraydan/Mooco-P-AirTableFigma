// figma.js
let fetch;

// Cargar node-fetch dinámicamente
import('node-fetch').then((module) => {
  fetch = module.default;
});

// Configura las credenciales de Figma
const FIGMA_TOKEN = process.env.FIGMA_TOKEN; // Tu token de Figma
const FIGMA_FILE_ID = process.env.FIGMA_FILE_ID; // El ID del archivo de Figma

// Función para obtener las páginas y layers de Figma
async function getFigmaFileData(pageName) {
  try {
    if (!fetch) {
      await import('node-fetch').then((module) => {
        fetch = module.default;
      });
    }

    const response = await fetch(`https://api.figma.com/v1/files/${FIGMA_FILE_ID}`, {
      headers: {
        'X-Figma-Token': FIGMA_TOKEN,
      },
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();

    // Filtrar la página por nombre
    if (pageName) {
      const filteredPage = data.document.children.find(page => page.name === pageName);
      if (filteredPage) {
        return filteredPage; // Devuelve solo la página filtrada
      } else {
        throw new Error(`Page with name "${pageName}" not found.`);
      }
    }

    return data.document.children; // Si no se especifica pageName, devuelve todas las páginas
  } catch (error) {
    console.error('Error fetching data from Figma:', error);
    throw error;
  }
}

// Función para crear un nuevo archivo en Figma
async function duplicateFigmaFile() {
  try {
    // Asegúrate de que fetch esté cargado antes de usarlo
    if (!fetch) {
      await import('node-fetch').then((module) => {
        fetch = module.default;
      });
    }

    // Obtener el contenido del archivo original
    const fileData = await getFigmaFileData();

    // Crear un nuevo archivo en Figma (esto es un ejemplo, la API de Figma no tiene un endpoint directo para duplicar)
    // En su lugar, puedes crear un nuevo archivo manualmente y copiar el contenido.
    // Aquí asumimos que tienes un endpoint personalizado o una lógica para manejar esto.
    const response = await fetch('https://api.figma.com/v1/files', {
      method: 'POST',
      headers: {
        'X-Figma-Token': FIGMA_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Copia de ${fileData.name}`,
        nodes: fileData.document.children, // Copia los nodos del archivo original
      }),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`);
    }

    const newFileData = await response.json();
    return newFileData;
  } catch (error) {
    console.error('Error duplicating Figma file:', error);
    throw error;
  }
}

module.exports = { getFigmaFileData, duplicateFigmaFile };