
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