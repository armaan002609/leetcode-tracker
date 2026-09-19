import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
// Optional: increase timeout for large sheet operations if using Vercel Pro/Hobby
export const maxDuration = 60; 

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { spreadsheetId, sheetName = 'Sheet1', data } = body;

    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID is required' }, { status: 400 });
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'No data provided to export' }, { status: 400 });
    }

    // Google API Authentication
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    if (!privateKey.includes('\n') && privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      const match = privateKey.match(/-----BEGIN PRIVATE KEY-----(.*)-----END PRIVATE KEY-----/);
      if (match) {
        const base64Str = match[1].replace(/\s+/g, '');
        privateKey = `-----BEGIN PRIVATE KEY-----\n${base64Str}\n-----END PRIVATE KEY-----\n`;
      }
    }

    if (!clientEmail || !privateKey) {
      return NextResponse.json({ 
        error: 'Server is not configured for Google Sheets. Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY in .env' 
      }, { status: 500 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Format data for Google Sheets
    // Extract headers from the first object
    const headers = Object.keys(data[0]);
    const rows = data.map(obj => headers.map(header => obj[header] ?? ''));
    const values = [headers, ...rows];

    // 1. Clear existing data in the sheet
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetName,
    });

    // 2. Write new data
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Exported to Google Sheets successfully!',
      updatedCells: response.data.updatedCells 
    });
  } catch (error: any) {
    console.error('Google Sheets Export Error:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred while exporting to Google Sheets' 
    }, { status: 500 });
  }
}
