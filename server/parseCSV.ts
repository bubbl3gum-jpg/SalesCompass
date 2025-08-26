// Enhanced CSV parsing with robust data handling
export function parseCSVContent(csvContent: string, tableName?: string): any[] {
  const results: any[] = [];
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) return results;

  // Staff-specific parsing with enhanced data handling
  if (tableName === 'staff') {
    // Find header row (first row with relevant headers)
    let headerRowIndex = 0;
    let headers: string[] = [];
    
    // Look for header row in first few lines
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('nik') && line.includes('email')) {
        headerRowIndex = i;
        break;
      }
    }
    
    // Parse headers from the identified row
    headers = parseCSVLine(lines[headerRowIndex]);
    
    // Enhanced field mapping with flexible matching
    const getFieldMapping = (header: string): string | null => {
      const cleaned = header.toLowerCase().trim().replace(/[\s_-]+/g, ' ');
      const mappings: { [key: string]: string } = {
        'nik': 'nik',
        'email': 'email', 
        'password': 'password',
        'full name': 'namaLengkap',
        'nama lengkap': 'namaLengkap',
        'nama_lengkap': 'namaLengkap',
        'city': 'kota',
        'kota': 'kota',
        'address': 'alamat',
        'alamat': 'alamat',
        'phone number': 'noHp',
        'phone': 'noHp',
        'no hp': 'noHp',
        'no_hp': 'noHp',
        'place of birth': 'tempatLahir',
        'tempat lahir': 'tempatLahir',
        'tempat_lahir': 'tempatLahir',
        'date of birth': 'tanggalLahir',
        'tanggal lahir': 'tanggalLahir',
        'tanggal_lahir': 'tanggalLahir',
        'date joined': 'tanggalMasuk',
        'tanggal masuk': 'tanggalMasuk',  
        'tanggal_masuk': 'tanggalMasuk',
        'position': 'jabatan',
        'jabatan': 'jabatan'
      };
      return mappings[cleaned] || null;
    };

    // Process data rows with enhanced data cleaning
    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.trim() !== '') {
        const values = parseCSVLine(line);
        
        // Skip if not enough values or first column is empty
        if (values.length >= headers.length - 2 && values[0] && values[0].trim()) {
          const rowData: any = {};
          
          // Map each header to its corresponding value
          headers.forEach((header, index) => {
            const mappedField = getFieldMapping(header);
            let value = values[index] || '';
            
            if (mappedField && value) {
              // Clean and process the value
              value = cleanValue(value);
              
              if (value && value !== '###') { // Handle ### as blank
                if (mappedField === 'tanggalLahir' || mappedField === 'tanggalMasuk') {
                  // Enhanced date parsing
                  const dateValue = parseDate(value);
                  if (dateValue) {
                    rowData[mappedField] = dateValue;
                  }
                } else if (mappedField === 'email') {
                  // Ensure email contains @ symbol and basic validation
                  if (value.includes('@') && value.includes('.')) {
                    rowData[mappedField] = value.toLowerCase();
                  }
                } else {
                  rowData[mappedField] = value;
                }
              }
            }
          });
          
          // Only add if we have essential fields (nik and email minimum)
          if (rowData.nik && rowData.email) {
            results.push(rowData);
          }
        }
      }
    }
  }
  
  return results;
}

// Enhanced CSV line parsing that handles commas within quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Handle escaped quotes
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
}

// Clean and normalize field values
function cleanValue(value: string): string {
  if (!value) return '';
  
  // Remove surrounding quotes
  value = value.replace(/^["']|["']$/g, '');
  
  // Handle special cases
  if (value === '###' || value === 'NULL' || value === 'null') {
    return '';
  }
  
  // Clean up whitespace and special characters
  value = value.trim();
  
  // Handle apostrophes and quotes in names/addresses
  value = value.replace(/'/g, "'"); // Normalize apostrophes
  
  return value;
}

// Enhanced date parsing with multiple format support
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  dateStr = dateStr.trim();
  
  // Try different date formats
  const formats = [
    // DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // DD-MM-YYYY  
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    // DD/MM/YY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let day: number, month: number, year: number;
      
      if (format.source.startsWith('^(\\d{4})')) {
        // YYYY-MM-DD format
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      } else {
        // DD/MM/YYYY or DD-MM-YYYY format
        day = parseInt(match[1]);
        month = parseInt(match[2]);
        year = parseInt(match[3]);
        
        // Handle 2-digit years
        if (year < 50) {
          year += 2000;
        } else if (year < 100) {
          year += 1900;
        }
      }
      
      // Validate the date
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1900 && year < 2100) {
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
          return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
        }
      }
    }
  }
  
  return null; // Could not parse date
}