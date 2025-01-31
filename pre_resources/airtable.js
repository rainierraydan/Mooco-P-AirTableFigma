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