import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getProjectApiAuthHeader, getProjectApiUrl } from "../../../lib/basicAuth";
import { getProjectPermissionFilter } from "@/lib/permissions";
import { getUniqueAuditProjects, type ExternalProject } from "@/types/project";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || session.user.company || "";

    if (!company) {
      return NextResponse.json(
        { success: false, message: "Missing company parameter" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch external project API",
          status: response.status,
          detail: text,
        },
        { status: response.status }
      );
    }

    const data = (await response.json()) as ExternalProject[];
    const { allowAll, allowedProjectCodes } = await getProjectPermissionFilter(
      session.user.id,
      company
    );

    const housingCompanyProjects = getUniqueAuditProjects(data);

    const projects = allowAll
      ? housingCompanyProjects
      : housingCompanyProjects.filter((project) =>
          allowedProjectCodes.has(project.Project)
        );

    return NextResponse.json({
      success: true,
      projects,
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
