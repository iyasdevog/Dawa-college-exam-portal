# Product Overview

**AIC Da'wa College Exam Portal**

A comprehensive exam portal and student result management system designed specifically for AIC Da'wa College. The application serves both public and administrative users, providing:

## Core Features

- **Public Portal**: Students and parents can view results, scorecards, and performance analytics
- **Admin Dashboard**: Faculty can enter marks, generate reports, and manage academic data
- **Dual Storage**: Hybrid cloud (Firebase) and local storage with automatic fallback
- **Multi-Class Support**: Handles various academic levels (S1-S3, D1-D3, PG1-PG2)
- **Islamic Academic Focus**: Supports Arabic subjects, Islamic studies, and traditional grading systems
- **AI-Powered Insights**: Performance analysis and motivational feedback using Google Gemini

## User Roles

- **Public Users**: View-only access to student results and performance data
- **Admin/Faculty**: Full CRUD operations on student records, marks entry, and system management
- **System**: Automated calculations for totals, averages, rankings, and performance levels

## Key Business Logic

- Class-specific subject assignments
- Automatic grade calculations (TA + CE = Total)
- Performance categorization (Excellent, Good, Average, Needs Improvement, Failed)
- Rank calculation within each class
- Pass/fail determination based on subject-specific thresholds