import { NextRequest, NextResponse } from "next/server";
import { getProjectApiAuthHeader, getProjectApiUrl } from "../../../lib/basicAuth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

type ExternalProject = {
  Company: string;
  CompanyName: string;
  Project: string;
  ProjectName: string;
  IsHousingJuristicPerson: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.company) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const company = session.user.company;

    const response = await fetch(getProjectApiUrl(company), {
      method: "GET",
      headers: {
        Authorization: getProjectApiAuthHeader(),
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("External project API error:", response.status, text);

      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch external project API",
          status: response.status,
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as ExternalProject[];

    return NextResponse.json({
      success: true,
      projects: data,
    });
  } catch (error) {
    console.error("External projects error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch external projects",
      },
      { status: 500 }
    );
  }
}
