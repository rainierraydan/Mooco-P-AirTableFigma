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