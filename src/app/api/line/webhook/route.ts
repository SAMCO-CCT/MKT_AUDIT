import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("LINE Webhook Event:", JSON.stringify(body, null, 2));

    for (const event of body.events ?? []) {
      const source = event.source;

      console.log("LINE Source:", {
        type: source?.type,
        userId: source?.userId,
        groupId: source?.groupId,
        roomId: source?.roomId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("LINE Webhook Error:", error);
    return NextResponse.json(
      { ok: false, error: "Webhook failed" },
      { status: 500 }
    );
  }
}