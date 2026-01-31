# Marks Backup & Restore Guide

## Overview

The AIC Da'wa College Exam Portal includes comprehensive Excel-based backup and restore functionality for all marks data. This feature allows you to:

- **Export all marks** to Excel for local backup
- **Import marks** from previously exported Excel files
- **Restore data** if anything goes wrong
- **Transfer data** between different systems

## How to Export Marks

### Step 1: Navigate to Management
1. Go to the **Management** section
2. Click on the **Settings** tab

### Step 2: Export Data
1. Click **"Export Marks to Excel"** button
2. The system will generate a comprehensive Excel file
3. The file will be automatically downloaded to your Downloads folder

### Export File Contents

The exported Excel file contains **3 sheets**:

#### 1. Student Marks Sheet
- Complete marks data for all students
- Columns for each subject (TA, CE, Total, Status)
- Student information (ID, Name, Class, etc.)
- Calculated totals and performance levels

#### 2. Subjects Reference Sheet
- All subject configurations
- Subject IDs, names, and Arabic names
- Maximum TA/CE values
- Target classes and faculty information

#### 3. Students Reference Sheet
- All student information
- Admission numbers, names, classes
- Current totals, averages, and rankings

## How to Import Marks

### Step 1: Prepare Excel File
- Use a previously exported Excel file
- Ensure the file has the correct format
- Do not modify the structure or column headers

### Step 2: Import Process
1. Go to **Management** → **Settings**
2. Click **"Import Marks from Excel"**
3. Select your Excel file (.xlsx or .xls)
4. Confirm the import operation
5. Review the import results

### Import Validation

The system validates:
- **Student existence**: All students must exist in the database
- **Subject validity**: Subjects must be configured
- **Mark limits**: TA/CE values must not exceed maximums
- **Data format**: All marks must be valid numbers

## File Naming Convention

Exported files are automatically named:
```
AIC_Dawa_College_Marks_Backup_YYYY-MM-DD-HH-MM-SS.xlsx
```

Example: `AIC_Dawa_College_Marks_Backup_2025-01-31-14-30-45.xlsx`

## Best Practices

### Regular Backups
- **Export weekly** during active marking periods
- **Export before** major system changes
- **Export after** completing marks entry for each subject

### File Management
- **Store backups** in multiple locations (local, cloud, USB)
- **Label files** with meaningful names if needed
- **Keep multiple versions** for different time periods

### Import Safety
- **Always backup** current data before importing
- **Test imports** with small datasets first
- **Verify results** after importing

## Troubleshooting

### Export Issues
- **No students found**: Add students before exporting
- **No subjects found**: Configure subjects before exporting
- **Download failed**: Check browser download settings

### Import Issues
- **File format error**: Use only .xlsx or .xls files
- **Student not found**: Ensure all students exist in the system
- **Marks exceed maximum**: Check TA/CE values against subject limits
- **Invalid data format**: Ensure marks are valid numbers

### Common Solutions
1. **Refresh the page** and try again
2. **Check file permissions** for downloads
3. **Verify data integrity** in the Excel file
4. **Contact administrator** for persistent issues

## Data Recovery Scenarios

### Scenario 1: Accidental Mark Deletion
1. Use the most recent backup file
2. Import marks to restore deleted data
3. Verify all marks are correctly restored

### Scenario 2: System Migration
1. Export all marks from the old system
2. Set up students and subjects in the new system
3. Import the marks backup file
4. Verify data integrity

### Scenario 3: Database Corruption
1. Clear corrupted data (if necessary)
2. Re-add students and subjects
3. Import marks from the latest backup
4. Recalculate rankings and totals

## Security Considerations

### Data Protection
- **Encrypt backup files** when storing externally
- **Limit access** to backup files
- **Use secure storage** locations

### Privacy
- Backup files contain **sensitive student data**
- Follow institutional **data protection policies**
- **Delete old backups** when no longer needed

## Technical Details

### File Format
- **Excel format**: .xlsx (recommended) or .xls
- **Character encoding**: UTF-8 for Arabic text support
- **Sheet structure**: Fixed format with specific column headers

### Data Validation
- **Real-time validation** during import
- **Error reporting** for invalid data
- **Rollback capability** if import fails

### Performance
- **Large datasets**: Handled efficiently with batch processing
- **Memory usage**: Optimized for typical class sizes
- **Processing time**: Depends on data volume

---

**For technical support or questions about the backup system, contact your system administrator.**