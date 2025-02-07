================================================
File: pre_resources/airtable.js
================================================
const Airtable = require('airtable');

// Configura Airtable con tu API key y base ID
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID
);

// Función para obtener datos de una tabla
async function getTableData(tableName) {
  try {
    const records = await base(tableName).select().all();
    return records.map((record) => record.fields);
  } catch (error) {
    console.error('Error fetching data from Airtable:', error);
    throw error;
  }
}

module.exports = { getTableData };

================================================
File: pre_resources/figma.js
================================================
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

================================================
File: pre_resources/server.js
================================================
require('dotenv').config();
const auth = require('basic-auth');
const express = require('express');
const path = require('path');
const { getTableData } = require('./airtable');
const { getFigmaFileData, duplicateFigmaFile } = require('./figma'); // Importa ambas funciones
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de autenticación básica
app.use((req, res, next) => {
    const user = auth(req);
    const username = process.env.AUTH_USERNAME || 'admin'; // Cambia 'admin' por tu usuario
    const password = process.env.AUTH_PASSWORD || 'miclave'; // Cambia 'miclave' por tu clave
  
    if (!user || user.name !== username || user.pass !== password) {
      res.set('WWW-Authenticate', 'Basic realm="Acceso restringido"');
      return res.status(401).send('Acceso no autorizado');
    }
    next();
  });

// Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para obtener datos de Airtable
app.get('/api/data', async (req, res) => {
  try {
    const data = await getTableData('001'); // Cambia 'Sheet1' por el nombre de tu tabla
    res.json(data);
  } catch (error) {
    console.error('Error fetching data from Airtable:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
});

// Endpoint para obtener datos de Figma
app.get('/api/figma', async (req, res) => {
  try {
    const pageName = req.query.pageName; // Obtén el nombre de la página desde la query
    const figmaData = await getFigmaFileData(pageName);
    res.json(figmaData); // Devuelve solo la página filtrada
  } catch (error) {
    console.error('Error fetching data from Figma:', error);
    res.status(500).json({ error: 'Error fetching data from Figma' });
  }
});

// Endpoint para duplicar el archivo de Figma
app.post('/api/duplicate-figma', async (req, res) => {
  try {
      // Llama a la función para duplicar el archivo de Figma
      const newFileData = await duplicateFigmaFile();

      // Devuelve los datos del nuevo archivo, incluyendo la URL
      const newFileUrl = `https://www.figma.com/file/${newFileData.key}`;
      res.json({ 
          message: 'Figma file duplicated successfully',
          newFileUrl: newFileUrl,
          newFileData: newFileData
      });
  } catch (error) {
      console.error('Error duplicating Figma file:', error);
      res.status(500).json({ error: 'Error duplicating Figma file' });
  }
});

// Endpoint para updatear Figma
app.post('/api/update-figma', async (req, res) => {
  try {
      const { updates } = req.body;
      const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
      const FIGMA_FILE_ID = process.env.FIGMA_FILE_ID;

      // 1. Obtener el archivo original de Figma
      const figmaResponse = await fetch(`https://api.figma.com/v1/files/${FIGMA_FILE_ID}`, {
          headers: { 'X-Figma-Token': FIGMA_TOKEN },
      });
      const figmaData = await figmaResponse.json();

      // 2. Aplicar cambios a los layers de texto
      function applyUpdates(node) {
          if (node.type === 'TEXT') {
              const layerKey = node.name.replace(/\s+/g, '').toLowerCase();
              const update = updates.find(u => u.layerName === layerKey);
              if (update) {
                  node.characters = update.newValue; // Actualiza el texto
              }
          }
          if (node.children) node.children.forEach(applyUpdates);
      }

      figmaData.document.children.forEach(page => applyUpdates(page));

      // 3. Crear un nuevo archivo en Figma (duplicado)
      const newFileResponse = await fetch('https://api.figma.com/v1/files', {
          method: 'POST',
          headers: {
              'X-Figma-Token': FIGMA_TOKEN,
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              name: `Actualizado: ${figmaData.name}`,
              nodes: figmaData.document.children,
          }),
      });

      const newFileData = await newFileResponse.json();
      res.json({ 
          success: true,
          url: `https://www.figma.com/file/${newFileData.key}` 
      });

  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

================================================
File: pre_resources/public/index.html
================================================
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mooco-AirTable_P</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <!-- <button id="airTableButton">AirTable</button>
        <button id="FigmaButton">Figma</button> -->
        <button id="DupFigmaButton">DupFigma</button>
    </div>
    <script src="script.js"></script>
</body>
</html>


================================================
File: pre_resources/public/script.js
================================================

console.log('v0.05');
var curAirtable, curFigma;

document.getElementById('DupFigmaButton').addEventListener('click', async () => {
    try {
        // 1. Obtener datos de Airtable
        const airtableResponse = await fetch('/api/data');
        const airtableData = await airtableResponse.json();

        // 2. Transformar claves (minúsculas y sin espacios)
        const transformedData = airtableData.reduce((acc, record) => {
            Object.entries(record).forEach(([key, value]) => {
                acc[key.replace(/\s+/g, '').toLowerCase()] = value;
            });
            return acc;
        }, {});

        // 3. Obtener datos de Figma
        const pageName = prompt("Nombre de la página en Figma:");
        const figmaResponse = await fetch(`/api/figma?pageName=${encodeURIComponent(pageName)}`);
        const figmaData = await figmaResponse.json();

        // 4. Preparar actualizaciones
        const updates = [];
        const findLayers = (node) => {
            if (node.type === 'TEXT') {
                const layerKey = node.name.replace(/\s+/g, '').toLowerCase();
                if (transformedData[layerKey]) {
                    updates.push({
                        layerName: layerKey,
                        newValue: transformedData[layerKey]
                    });
                }
            }
            if (node.children) node.children.forEach(findLayers);
        };
        figmaData.children.forEach(findLayers);

        // 5. Enviar actualizaciones al servidor
        const response = await fetch('/api/update-figma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates }),
        });

        const result = await response.json();
        if (result.success) {
            alert(`¡Archivo actualizado! URL: ${result.url}`);
        } else {
            alert('Error: ' + result.error);
        }

    } catch (error) {
        console.error('Error:', error);
    }
});

================================================
File: pre_resources/public/styles.css
================================================
body {
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-family: Arial, sans-serif;
    background-color: #f4f4f4;
}

.container {
    text-align: center;
}

button {
    padding: 10px 20px;
    font-size: 18px;
    color: #fff;
    background-color: #007bff;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s;
}

button:hover {
    background-color: #0056b3;
}

