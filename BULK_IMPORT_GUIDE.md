# Student Bulk Import Guide

## Overview
The AIC Da'wa College Exam Portal supports bulk importing of student data via CSV files. This feature allows administrators to quickly add multiple students to the system instead of entering them one by one.

**Note**: This bulk import is for regular student enrollment. For supplementary exam students, use the **Supplementary** tab in the Management section to register students for supplementary exams from previous semesters.

## How to Access
1. Login as admin (username: `admin`, password: `1234`)
2. Navigate to **Management** section
3. Click on **Students** tab
4. Click the **Bulk Import** button

## CSV Format Requirements

### Required Columns (in exact order)
```csv
adNo,name,className,semester
```

### Column Descriptions
- **adNo**: Admission number (must be unique)
- **name**: Full student name
- **className**: Class code (S1, S2, S3, D1, D2, D3, PG1, PG2)
- **semester**: Either "Odd" or "Even"

### Example CSV Data
```csv
adNo,name,className,semester
001,Ahmed Ali,S1,Odd
002,Fatima Hassan,S1,Odd
003,Omar Khalid,D1,Even
004,Aisha Mohammed,S2,Odd
005,Hassan Ibrahim,D2,Even
```

## Import Methods

### Method 1: File Upload
1. Prepare your CSV file following the format above
2. Click **Upload CSV File** in the bulk import dialog
3. Select your CSV file
4. Click **Import Students**

### Method 2: Copy & Paste
1. Copy your CSV data from Excel or any text editor
2. Paste it into the **CSV Data** textarea
3. Click **Import Students**

## Validation Rules

The system will validate each row and report errors for:
- **Missing required fields**: adNo, name, or className cannot be empty
- **Duplicate admission numbers**: Each adNo must be unique in the system
- **Invalid class codes**: className must be one of: S1, S2, S3, D1, D2, D3, PG1, PG2
- **Invalid semester**: Must be exactly "Odd" or "Even"
- **Column count mismatch**: Each row must have exactly 4 columns

## Import Results

After import, you'll see:
- **Success count**: Number of students successfully imported
- **Error list**: Detailed errors for any failed rows with row numbers
- **Automatic ranking**: Class rankings are recalculated automatically

## Sample CSV Download

Click the **Download Sample CSV** button in the import dialog to get a template file with the correct format and example data.

## Tips for Success

1. **Use the sample file** as a starting point
2. **Check for duplicates** in your data before importing
3. **Verify class codes** match the system's class list
4. **Use consistent formatting** for names and admission numbers
5. **Test with a small batch** first before importing large datasets

## Troubleshooting

### Common Issues
- **"Column count mismatch"**: Make sure each row has exactly 4 values separated by commas
- **"Invalid class"**: Check that className values match exactly: S1, S2, S3, D1, D2, D3, PG1, PG2
- **"Duplicate admission number"**: Check if the student already exists in the system
- **"Missing required data"**: Ensure no cells are empty for adNo, name, or className

### File Format Issues
- Save your file as **CSV (Comma delimited)** format
- Avoid special characters in names that might break CSV parsing
- Don't include extra spaces around commas
- Make sure the first row contains the exact headers: `adNo,name,className,semester`

## Data Management

After successful import:
- Students appear immediately in the student list
- Class rankings are automatically calculated
- Students can be edited individually if needed
- Marks can be entered through the Faculty Entry system
- Results will be available in the Public Portal

## Security Note

Only admin users can perform bulk imports. The system maintains data integrity by:
- Validating all data before import
- Preventing duplicate admission numbers
- Maintaining referential integrity with class and subject assignments
- Providing detailed error reporting for failed imports