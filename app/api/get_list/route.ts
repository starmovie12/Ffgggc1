import { NextResponse } from 'next/server';
import { extractMovieLinks } from '@/lib/solvers';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ status: "error", message: "URL is required" }, { status: 400 });
    }

    const result = await extractMovieLinks(url);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("API Route Error:", e);
    return NextResponse.json({ status: "error", message: e.message }, { status: 500 });
  }
}
