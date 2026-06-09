import { NextResponse } from "next/server";
import { getProjectApiAuthHeader, getProjectApiUrl } from "../../../lib/basicAuth";

type ExternalProject = {
  Company: string;
  CompanyName: string;
  Project: string;
  ProjectName: string;
  IsHousingJuristicPerson: boolean;
};

export async function GET() {
  try {
    const response = await fetch(getProjectApiUrl(), {
      method: "GET",
      headers: {
        Authorization: getProjectApiAuthHeader(),
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch external companies",
          status: response.status,
          detail: text,
        },
        { status: response.status }
      );
    }

    const projects = (await response.json()) as ExternalProject[];
    const companyMap = new Map<string, { Company: string; CompanyName: string }>();

    for (const item of projects) {
      if (!companyMap.has(item.Company)) {
        companyMap.set(item.Company, {
          Company: item.Company,
          CompanyName: item.CompanyName,
        });
      }
    }

    return NextResponse.json({
      success: true,
      companies: Array.from(companyMap.values()).sort((a, b) =>
        a.CompanyName.localeCompare(b.CompanyName, "th")
      ),
    });
  } catch (error) {
    console.error("External companies error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch external companies",
      },
      { status: 500 }
    );
  }
}
