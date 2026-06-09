import { NextResponse } from "next/server";
import { sendLineMessage } from "../../../lib/line";

export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    await sendLineMessage("ทดสอบแจ้งเตือนจากระบบ Next.js สำเร็จ");

    return NextResponse.json({
      ok: true,
      message: "LINE message sent",
    });
  } catch (error) {
    console.error("Test LINE Error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}